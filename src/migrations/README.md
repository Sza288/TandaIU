# Migrasi data Firestore

Folder ini berisi migrasi idempotent untuk menyiapkan relasi data praktikum
tanpa menimpa dokumen Firestore yang sudah ada. Tidak ada perubahan pada
`firestore.rules`, konfigurasi Firebase, atau operasi Git.

## Keputusan berdasarkan struktur aktual repo

| Data | Keputusan | Alasan |
|---|---|---|
| `classes` | Dibuat dari pasangan `courseId` + `className` | Dipakai `sessions.classId`, `schedules.classId`, dan CRUD praktikum. |
| `sessions.classId` | Diisi hanya jika belum ada | Relasi utama kelas ke sesi. `classId` lama yang valid tidak diubah. |
| `enrollments` | Disiapkan dengan ID deterministik `{classId}_{uid}` | Menautkan praktikan Firebase Auth ke kelas, lalu ke sesi lewat `classId`. |
| `courses` | Tidak dimigrasikan | Masih master data lokal `src/data/courses.ts`; tidak ada collection/konsumen Firestore. |
| `dosen` | Tidak dimigrasikan | Masih master data lokal `src/data/dosen.ts`; sesi menyimpan `lecturerId`/`lecturer` sebagai string. |
| `schedules` | Tidak ada dummy lokal | `initialSessions` tidak memuat hari, jam, dan ruangan yang dibutuhkan `ScheduleDoc`. |
| `permits` / `reviews` | Tidak ditulis | Rules mewajibkan `studentId == request.auth.uid` dan ID `{sessionId}_{uid}`; data asli dipertahankan. |
| `attendances` | Tidak ditulis | Rules mewajibkan check-in oleh praktikan sendiri saat sesi `dibuka`; dummy memakai `p1..p31` dan sebagian `izin`. |
| `users` | Tidak ditulis | Dibuat oleh alur registrasi Auth; rules melarang list/update/delete. |

## Skema `enrollments`

Satu dokumen per pasangan kelas + praktikan:

```ts
{
  praktikanId: string;    // Firebase Auth UID, bukan p1..p31
  praktikanName: string;
  studentCode: string;
  classId: string;        // referensi ke classes/{classId}
  courseId: string;       // referensi string ke src/data/courses.ts
  semester: 1 | 2 | 3 | 4 | 5;
  createdAt: string;      // ISO 8601
}
```

ID dokumen: `{classId}_{praktikanId}` (pola yang sama dengan
`permits/{sessionId}_{uid}` dan `reviews/{sessionId}_{uid}`).

Relasi lengkap:

```text
enrollments.praktikanId -> Firebase Auth UID
enrollments.classId      -> classes/{classId}
classes/{classId}.id      <- sessions.classId
sessions.classId          -> classes/{classId}
schedules.classId         -> classes/{classId}
```

Kelas kanonik dipilih satu per `courseId + className`. Dokumen kelas duplikat
dilaporkan dan tidak dipakai untuk enrollment.

## Aturan enrollment

Praktikan terdaftar pada kelas yang semester mata kuliahnya sama dengan
semester praktikan. Aturan ini sama dengan `src/data/sessionEnrollments.ts`
yang dipakai layar jadwal saat ini.

Dengan 12 sesi seed dan 31 praktikan lokal, targetnya adalah **69 enrollment**
bila seluruh 31 kode mahasiswa memiliki UID Firebase Auth valid. Angka aktual
dapat berbeda bila Firestore sudah memiliki kelas tambahan atau duplikat.

## Idempotensi dan keamanan data

- `classes`: transaksi membaca dokumen deterministik lebih dulu; jika sudah ada,
  tidak ditulis ulang. Kelas lama dengan ID otomatis tetap dipakai ulang lewat
  key `courseId + className`.
- `sessions`: hanya `updateDoc({ classId })` pada sesi yang belum punya
  `classId`. Field lain tidak disentuh. `classId` lama yang tidak cocok
  dilaporkan, bukan ditimpa.
- `enrollments`: transaksi membaca `enrollments/{classId}_{uid}` lebih dulu.
  Dokumen yang sudah ada dilewati.
- Tidak ada `delete`, tidak ada overwrite, dan tidak ada UID palsu.
- UID berbentuk `p1..p31` ditolak oleh validasi mapping.

## Blocker Security Rules

`firestore.rules` saat ini tidak memiliki `match` untuk `enrollments`,
`courses`, atau `dosen`, sehingga default-deny berlaku. Akibatnya:

- `classes` dan `sessions.classId` dapat ditulis oleh akun **asisten** yang
  login.
- `enrollments` **tidak dapat ditulis** sampai pemilik rules menambahkan akses
  baca/tulis yang sesuai. Migrasi tidak mengubah rules dan tidak memakai Admin
  SDK untuk bypass.
- `users` tidak dapat di-list; jumlahnya hanya terlihat di Firebase Console.
- `permits`, `reviews`, dan `attendances` hanya dapat dibaca sesuai kepemilikan
  atau role asisten.

Akses yang dibutuhkan untuk `enrollments` (bukan perubahan rules, hanya
kebutuhan operasi): baca untuk praktikan pemilik atau asisten, create untuk
asisten dengan ID `{classId}_{praktikanId}`, serta update/delete ditolak.

## Mapping UID praktikan

Migrasi tidak membuat akun Auth. Template siap pakai ada di
`migration-accounts.example.json` (root repo) dengan 31 key `p1..p31` dan UID
kosong. Salin menjadi `migration-accounts.json` (jangan di-commit), lalu isi
UID dari **Firebase Console > Authentication**:

```json
{
  "p1": { "studentCode": "24060124120001", "uid": "" },
  "p2": { "studentCode": "24060124120002", "uid": "" }
}
```

Runner juga menerima format array `[{ studentCode, uid }]` atau
`{ "accounts": [...] }`. Format keyed `p1..p31` adalah format template resmi.

Validasi mapping:

- UID kosong dianggap belum siap dan tidak menghasilkan enrollment.
- `studentCode` harus cocok dengan `src/data/praktikans.ts` untuk ID tersebut.
- ID lokal yang tidak dikenal, UID `p1..p31`, dan placeholder `<...>` ditolak.
- Satu `studentCode` dengan beberapa UID tidak dipakai.
- Satu UID dengan beberapa `studentCode` tidak dipakai.

## Migrasi parsial

Mapping parsial didukung tanpa mengubah kontrak data:

- Hanya key dengan UID valid yang menghasilkan enrollment.
- Key dengan `uid: ""` dilewati; tidak ada fallback ke `p1..p31` atau UID lain.
- `expectedEnrollments` tetap 69. `readyEnrollments` adalah subset dokumen
  kelas × praktikan untuk akun yang sudah dipetakan.
- Satu akun dapat menghasilkan beberapa enrollment. Contoh: akun semester 3
  menghasilkan 3 dokumen, semester 4 menghasilkan 5 dokumen.
- Dry-run dapat dijalankan dengan mapping sebagian. Runner melaporkan
  `mappedUids`, `missingUids`, dan `readyEnrollments` sesuai subset.
- Migrasi sungguhan secara parsial hanya menulis subset yang terpetakan dan
  memerlukan keputusan PM serta rules `enrollments` yang sudah tersedia.
  Rerun setelah UID lain ditambahkan bersifat idempotent.

Panduan manual: `UID-MATCHING-GUIDE.md`.
Status audit terbaru: `MIGRATION-STATUS.md`.

## Validasi lokal tanpa Firestore

Mode ini tidak membutuhkan kredensial dan tidak membaca/menulis Firestore:

```bash
npx --yes tsx src/migrations/run.ts \
  --local-only \
  --accounts ./migration-accounts.example.json \
  --verbose
```

Keluarannya memuat pemetaan 12 seed session ke `classId`, jumlah kelas unik,
target 69 enrollment, daftar UID yang masih kosong, dan blocker rules. Ini
adalah validasi terhadap `src/data/sessions.ts`, bukan pembacaan 12 dokumen
Firestore. Pemeriksaan dokumen Firestore yang sebenarnya dilakukan oleh
`--dry-run` dengan akun Auth yang valid.

## Menjalankan

Dari root repo:

```bash
MIGRATION_EMAIL="asisten@contoh.com" \
MIGRATION_PASSWORD="..." \
npx --yes tsx src/migrations/run.ts \
  --accounts ./migration-accounts.json \
  --dry-run \
  --verbose
```

Setelah yakin dengan rencana dan rules sudah mengizinkan, jalankan ulang tanpa
`--dry-run` untuk menulis classes/sessions/enrollments secara idempotent.

PowerShell:

```powershell
$env:MIGRATION_EMAIL="asisten@contoh.com"
$env:MIGRATION_PASSWORD="..."
npx --yes tsx src/migrations/run.ts --accounts ./migration-accounts.json --verbose
```

Opsi:

| Opsi | Fungsi |
|---|---|
| `--accounts <file>` | Mapping `p1..p31 -> studentCode -> uid`. |
| `--local-only` | Validasi seed + template tanpa Firebase/kredensial. |
| `--dry-run` | Membaca Firestore dan menyusun rencana tanpa menulis apa pun. |
| `--json` | Mencetak laporan JSON lengkap. |
| `--verbose` | Menampilkan detail langkah dan ID yang rusak. |

`run.ts` membaca `EXPO_PUBLIC_FIREBASE_*` dari `.env` hanya pada mode Firestore,
lalu login memakai `MIGRATION_EMAIL` dan `MIGRATION_PASSWORD`. Akun operator
harus asisten agar `classes` dan `sessions` dapat ditulis. Untuk `--dry-run`,
akun non-asisten tetap dapat dipakai untuk membaca classes/sessions, tetapi
beberapa collection seperti permits/reviews dapat ditolak oleh rules. Tanpa
`--dry-run`, akun non-asisten ditolak sebelum menulis.

## Verifikasi

Setiap eksekusi mengembalikan:

- jumlah dokumen sebelum dan sesudah untuk `users`, `classes`, `schedules`,
  `sessions`, `enrollments`, `attendances`, `permits`, `reviews`;
- relasi `sessions -> classes`, `schedules -> classes`,
  `enrollments -> classes`, `enrollments -> praktikanId`,
  `attendances/permits/reviews -> sessions`, dan `-> studentId`;
- status setiap langkah: `applied`, `skipped`, `blocked`, atau `failed`.

Bila `firestore.rules` masih default-deny untuk `enrollments`, laporan akan
menampilkan `permission-denied` dan langkah enrollment berstatus `blocked`.
Itu adalah hasil yang diharapkan sampai pemilik rules menambahkan akses.
