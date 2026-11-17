# Panduan Pencocokan UID Praktikan

Dokumen ini adalah panduan manual untuk mencocokkan 31 praktikan dummy dengan
akun Firebase Auth yang sudah ada. Tidak ada akun, UID, atau data Firestore yang
dibuat oleh panduan ini.

## Kondisi aktual

- Data lokal: 31 praktikan `p1..p31`, semuanya memiliki `studentCode` unik.
- Firebase Auth berdasarkan kondisi yang diberikan: hanya 1 akun praktikan,
  yaitu `praktikan1@tandaiu.com`.
- UID dan `studentCode` akun tersebut belum diketahui dari repo. Email itu tidak
  ada di `src/data/praktikans.ts`.
- Jangan mengasumsikan `praktikan1` adalah `p1`. Pencocokan hanya boleh
  berdasarkan `users/{uid}.studentCode` dan `role` di Firestore Console.
- `migration-accounts.json`: 31 key, semua UID masih kosong.
- Preflight lokal: 12 seed session, 12 kelas, 69 target enrollment,
  0 UID terpetakan, 31 UID kosong, 0 enrollment siap ditulis.

## 1. Status file mapping

| File | Fungsi |
|---|---|
| `migration-accounts.example.json` | Template resmi runner; 31 key `p1..p31`, semua UID kosong. Jangan diisi. |
| `migration-accounts.json` | Salinan kerja untuk diisi UID. Saat ini 31 UID masih kosong. |
| `migration-account-matching.csv` | Worksheet pencocokan manual (ID, nama, studentCode, semester, UID, status). |

Format yang dibaca runner:

```json
{
  "p1": { "studentCode": "24060124120001", "uid": "" }
}
```

Runner juga menerima array dan `{ "accounts": [...] }`, tetapi format keyed
`p1..p31` adalah format resmi. Aturan validasi:

- Key harus salah satu dari `p1..p31` di `src/data/praktikans.ts`.
- `studentCode` harus cocok dengan praktikan lokal.
- `uid` kosong berarti belum siap dan tidak menghasilkan enrollment.
- UID `p1..p31`, placeholder `<...>`, ID lokal tak dikenal, dan mapping ganda ditolak.

Validasi lokal saat ini:

```text
Mapping template: keyed; entri 31; invalid 0
UID terpetakan: 0; UID belum diisi: 31
Enrollment target: 69; siap ditulis: 0
```

## 2. Pencocokan manual di Firebase Console

1. Buka Firebase Console untuk project yang dipakai `.env`.
2. Buka **Authentication → Users**.
   - Catat akun yang ada, UID, email, dan provider (`password`/`google`).
   - Halaman ini tidak menampilkan `studentCode`, jadi jangan mencocokkan hanya dari sini.
3. Buka **Firestore Database → `users`**.
4. Untuk setiap dokumen `users/{uid}`:
   - **Document ID adalah UID Firebase Auth.**
   - Periksa field `name`, `email`, `role`, `authProvider`, `studentCode`.
   - Pastikan `role == "praktikan"`.
   - Cocokkan `studentCode` dengan worksheet.
5. Cocokkan juga `name` sebagai pemeriksaan kedua.
6. Salin **document ID** ke kolom `UID Firebase Auth` dan isi `Status akun`.
7. Masukkan UID yang sama ke `migration-accounts.json` pada key `p1..p31` yang sesuai.

Jangan memakai ID dummy `p1..p31` sebagai UID. Jangan menebak UID dari nama atau
studentCode. Jangan membuat akun Firebase baru untuk melengkapi mapping.

## 3. Memastikan role dan UID yang benar

- `users/{uid}` harus memiliki `role == "praktikan"`.
- Role `"asisten"` atau `"assistant"` bukan akun praktikan; jangan dipetakan.
- `authProvider` harus `"password"` atau `"google"`.
- Ambil UID dari **document ID**, bukan dari field `uid` jika field itu ada.
  Jika ada field `uid`, nilainya harus sama dengan document ID; jika berbeda,
  tandai konflik.
- Cocokkan `studentCode` secara persis, termasuk angka dan panjang karakter.
- Jika `studentCode` kosong, cocokkan lewat nama/email hanya bila tidak ambigu;
  jika ragu, tandai konflik.
- Pastikan UID yang sama juga muncul di Authentication → Users.
- Satu studentCode hanya boleh memiliki satu UID. Satu UID tidak boleh dipakai
  dua praktikan.

## 4. Status checklist

| Status | Arti |
|---|---|
| `belum dicek` | Belum diperiksa di Console. |
| `cocok` | Tepat satu `users/{uid}` dengan role praktikan, studentCode dan nama sesuai. |
| `belum ditemukan` | Sudah dicek, tidak ada akun/dokumen users yang cocok. |
| `konflik` | Ada duplikasi, role salah, studentCode tidak cocok/kosong, nama berbeda, atau UID tidak ada di Authentication. |

Checklist 31 praktikan:

| ✓ | ID | Nama | studentCode | Semester | UID ditemukan | Status | Catatan |
|---|---|---|---|---|---|---|---|
| [ ] | p1 | Andi Pratama | 24060124120001 | 3 | | belum dicek | |
| [ ] | p2 | Budi Santoso | 24060124120002 | 1 | | belum dicek | |
| [ ] | p3 | Citra Dewi | 24060124120003 | 5 | | belum dicek | |
| [ ] | p4 | Dewi Lestari | 24060124120004 | 2 | | belum dicek | |
| [ ] | p5 | Eka Putra | 24060124120005 | 3 | | belum dicek | |
| [ ] | p6 | Fajar Nugroho | 24060124120006 | 4 | | belum dicek | |
| [ ] | p7 | Gita Maharani | 24060124120007 | 1 | | belum dicek | |
| [ ] | p8 | Hadi Saputra | 24060124120008 | 3 | | belum dicek | |
| [ ] | p9 | Intan Permata | 24060124120009 | 5 | | belum dicek | |
| [ ] | p10 | Joko Firmansyah | 24060124120010 | 1 | | belum dicek | |
| [ ] | p11 | Kartika Sari | 24060124120011 | 3 | | belum dicek | |
| [ ] | p12 | Lukman Hakim | 24060124120012 | 5 | | belum dicek | |
| [ ] | p13 | Maya Anggraini | 24060124120013 | 1 | | belum dicek | |
| [ ] | p14 | Nanda Wijaya | 24060124120014 | 3 | | belum dicek | |
| [ ] | p15 | Olivia Rahma | 24060124120015 | 5 | | belum dicek | |
| [ ] | p16 | Putra Ramadhan | 24060124120016 | 1 | | belum dicek | |
| [ ] | p17 | Qori Azzahra | 24060124120017 | 3 | | belum dicek | |
| [ ] | p18 | Rafi Kurniawan | 24060124120018 | 5 | | belum dicek | |
| [ ] | p19 | Sinta Wulandari | 24060124120019 | 1 | | belum dicek | |
| [ ] | p20 | Tegar Prakoso | 24060124120020 | 3 | | belum dicek | |
| [ ] | p21 | Ulya Safitri | 24060124120032 | 5 | | belum dicek | |
| [ ] | p22 | Vino Pradana | 24060124120022 | 1 | | belum dicek | |
| [ ] | p23 | Wulan Puspita | 24060124120023 | 3 | | belum dicek | |
| [ ] | p24 | Yoga Prasetyo | 24060124120024 | 5 | | belum dicek | |
| [ ] | p25 | Zahra Amelia | 24060124120025 | 1 | | belum dicek | |
| [ ] | p26 | Aldi Firmansyah | 24060124120026 | 3 | | belum dicek | |
| [ ] | p27 | Bella Anjani | 24060124120027 | 5 | | belum dicek | |
| [ ] | p28 | Candra Wibowo | 24060124120028 | 2 | | belum dicek | |
| [ ] | p29 | Dinda Pertiwi | 24060124120029 | 2 | | belum dicek | |
| [ ] | p30 | Evan Maulana | 24060124120030 | 4 | | belum dicek | |
| [ ] | p31 | Farah Nabila | 24060124120031 | 4 | | belum dicek | |

Ringkasan setelah pengecekan:

```text
cocok: __ / 31
belum ditemukan: __
konflik: __
belum dicek: __
```

## 5. Migrasi parsial

Mapping parsial didukung tanpa mengubah kontrak data:

- Isi hanya key `p1..p31` yang benar-benar cocok dengan akun Auth.
- Key dengan `uid: ""` tetap tidak menghasilkan enrollment dan tidak pernah
  diganti dengan `p1..p31` atau UID lain.
- `mappedUids` menghitung akun yang punya UID; `missingUids` menghitung akun
  yang belum punya UID.
- `readyEnrollments` menghitung dokumen kelas × praktikan, bukan jumlah akun.
  Satu akun bisa menghasilkan beberapa enrollment:
  - semester 1: 1 kelas;
  - semester 2: 1 kelas;
  - semester 3: 3 kelas;
  - semester 4: 5 kelas;
  - semester 5: 2 kelas.
- `expectedEnrollments` tetap 69, yaitu target penuh. Untuk mapping parsial,
  `readyEnrollments` adalah subset dari 69.
- Dry-run dengan mapping parsial didukung. Runner hanya merencanakan enrollment
  untuk akun yang punya UID, lalu melaporkan sisanya sebagai `missingUids`.
- Migrasi sungguhan secara parsial hanya akan menulis subset yang terpetakan.
  Ini memerlukan keputusan PM dan rules `enrollments` yang sudah tersedia.
  Rerun setelah UID lain ditambahkan bersifat idempotent; dokumen yang sudah ada
  dilewati.
- Migrasi parsial belum dijalankan pada tahap ini.

## 6. Validasi setelah UID diisi

1. Isi hanya file `migration-accounts.json`; biarkan `migration-accounts.example.json` tetap kosong.
2. Pastikan JSON valid (tidak ada koma berlebih atau tanda kutip rusak).
3. Jalankan:

```bash
npx --yes tsx src/migrations/run.ts \
  --local-only \
  --accounts ./migration-accounts.json \
  --verbose
```

Hasil yang diharapkan jika 31 UID lengkap:

```text
Mapping template: keyed; entri 31; invalid 0
UID terpetakan: 31; UID belum diisi: 0
Enrollment target: 69; siap ditulis: 69
```

Hasil untuk mapping parsial (contoh):

```text
Mapping template: keyed; entri 31; invalid 0
UID terpetakan: N; UID belum diisi: 31-N
Enrollment target: 69; siap ditulis: M
```

`N` adalah jumlah akun yang punya UID. `M` adalah jumlah dokumen kelas ×
praktikan untuk akun tersebut, sehingga `M` tidak harus sama dengan `N`.
Contoh: satu akun semester 3 menghasilkan `M = 3`; satu akun semester 4
menghasilkan `M = 5`.

Yang harus tetap kosong/tidak ada:

- `accountIssues`
- `accountUnknownLocalIds`
- `missingLocalIds`
- `duplicateUids`
- `duplicateStudentCodes`
- `targetIssues`

Jika `siap ditulis` kurang dari 69, periksa daftar UID yang masih kosong atau
entry mapping yang ditolak. Jika `UID terpetakan > 0` tetapi `siap ditulis = 0`,
periksa apakah `studentCode` akun cocok dengan semester/kelas yang tersedia.
Jangan menambal dengan UID tebakan.

## 7. Prasyarat dry-run

Dry-run hanya membaca Firestore dan menyusun rencana; tidak menulis data.

Prasyarat:

1. Minimal satu UID valid untuk dry-run parsial; 31 UID untuk laporan penuh.
   Validasi lokal harus bersih untuk mapping yang diisi.
2. `EXPO_PUBLIC_FIREBASE_*` tersedia.
3. `MIGRATION_EMAIL` dan `MIGRATION_PASSWORD` tersedia sebagai environment
   variable, bukan di dalam file mapping. Gunakan akun asisten.
4. Akun operator memiliki `users/{uid}.role == "asisten"`.
5. Jalankan:

```bash
npx --yes tsx src/migrations/run.ts \
  --accounts ./migration-accounts.json \
  --dry-run --json --verbose
```

Periksa:

- `sessionsWithoutClassId`
- `invalidClassReferences`
- `invalidExistingClassIds`
- `duplicateClasses`
- `sessionsMissing`
- `mappedUids` — jumlah akun yang terpetakan, bukan harus 31
- `readyEnrollments` — jumlah dokumen siap, bukan harus 69

Dry-run dengan mapping parsial hanya merencanakan subset yang punya UID.
Dengan 0 UID, dry-run masih dapat mengaudit classes/sessions, tetapi langkah
enrollment akan `blocked` karena tidak ada pasangan yang bisa dipetakan.

Jika operator hanya memakai akun praktikan yang tersedia, pembacaan
classes/sessions tetap dapat dilakukan, tetapi list permits/reviews dapat
ditolak oleh rules. Akun asisten lebih disarankan untuk dry-run lengkap.

Dry-run tetap tidak menulis apa pun meskipun laporan menunjukkan masalah.

## 8. Prasyarat migrasi enrollment sungguhan

Jangan menjalankan migrasi tanpa `--dry-run` sampai semua syarat ini terpenuhi:

1. Validasi lokal bersih dan dry-run sudah diperiksa.
2. PM memutuskan apakah migrasi parsial boleh dijalankan atau harus menunggu
   31 akun. Jika parsial, hanya subset yang terpetakan yang akan ditulis.
3. Pemilik rules (Nadia/PM) menambahkan `match /enrollments/{enrollmentId}`
   dengan akses baca/create yang sesuai, lalu men-deploy rules.
4. Rules mengizinkan create dokumen dengan ID `{classId}_{praktikanId}` dan
   field `praktikanId`, `praktikanName`, `studentCode`, `classId`, `courseId`,
   `semester`, `createdAt`.
5. `update`/`delete` untuk enrollments tetap ditolak.
6. Operator menggunakan akun asisten yang valid.
7. Setelah itu baru jalankan tanpa `--dry-run`, lalu verifikasi jumlah dokumen
   dan relasinya. Rerun setelah UID lain ditambahkan aman karena idempotent.

Migrasi tidak menggunakan Admin SDK, tidak mengubah rules, dan tidak melakukan
bypass Security Rules.
