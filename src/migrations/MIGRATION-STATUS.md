# Status Migrasi Enrollment

Audit ini dilakukan tanpa menulis atau mengubah data Firestore. Kondisi
Firestore/Auth yang disebut di bawah berasal dari kondisi project yang
diberikan; tidak ada pembacaan live karena tidak ada kredensial operator.

## Ringkasan

| Item | Status |
|---|---|
| Praktikan lokal | 31 data `p1..p31`, ID/studentCode/nama unik |
| Seed sessions | 12 session, 12 pasangan `courseId + className` |
| Target enrollment | 69 dokumen |
| Mapping UID | 31 key, 0 UID terisi, 31 kosong |
| Akun praktikan Auth | 1 akun (`praktikan1@tandaiu.com`) |
| Enrollment siap ditulis | 0 |
| Rules `enrollments` | Belum ada, default-deny |
| Migrasi sungguhan | Belum dijalankan |

## Data yang sudah siap

- 31 praktikan lokal lengkap dengan `name`, `studentCode`, dan `semester`.
- 12 seed session konsisten: 12 kelas unik, 0 duplikasi pasangan kelas.
- `migration-accounts.json` valid untuk runner: format keyed, 31 entri,
  0 invalid, 0 `studentCode` mismatch.
- Runner mendukung mapping parsial: UID kosong dilewati, tidak ada fallback ke
  `p1..p31`.
- Dry-run mendukung mapping parsial dan tidak menulis.
- Migrasi classes/sessions/enrollments bersifat idempotent dan tidak memakai
  Admin SDK.

## Data yang belum siap

- Hanya 1 akun praktikan Auth yang diketahui; 30 akun lainnya belum diketahui.
- UID akun `praktikan1@tandaiu.com` belum diketahui.
- `studentCode` akun tersebut belum dicocokkan ke `p1..p31`.
- `migration-accounts.json` masih 0/31 UID.
- `enrollments` belum memiliki Firestore Rules.
- 12 dokumen sessions Firestore belum diaudit live (`classId` valid/tidak,
  duplikasi kelas, sesi tanpa `classId`).
- Operator untuk migrasi sungguhan harus asisten; akun yang diketahui saat ini
  adalah praktikan.
- Keputusan PM tentang migrasi parsial vs menunggu 31 akun belum ada.

## Status akun `praktikan1@tandaiu.com`

- Email tersebut tidak ditemukan di repo; tidak ada mapping UID atau
  `studentCode` yang tersimpan untuk akun itu.
- Jangan mengasumsikan akun itu `p1`. Email tidak membawa informasi
  `studentCode`.
- Satu-satunya cara mencocokkan adalah membuka **Firestore Console →
  `users/{uid}`** dan membaca:
  - `role` — harus `praktikan`;
  - `studentCode` — harus sama persis dengan salah satu dari 31 data;
  - `name` — pemeriksaan kedua;
  - `authProvider` — `password` atau `google`.
- UID diambil dari **document ID** `users/{uid}`, bukan dari field `uid` jika
  field itu ada.
- Kemungkinan hasil:
  - cocok tepat satu baris → isi hanya key tersebut;
  - tidak ada dokumen cocok → jangan isi UID;
  - role bukan praktikan → jangan isi;
  - `studentCode` kosong/ganda/nama berbeda → tandai konflik.

## Dukungan migrasi parsial

Runner sudah mendukung dry-run parsial tanpa perubahan kode:

- `mappedUids` = jumlah akun dengan UID valid.
- `missingUids` = jumlah akun tanpa UID.
- `expectedEnrollments` tetap 69 (target penuh).
- `readyEnrollments` = jumlah dokumen kelas × praktikan untuk akun yang
  terpetakan, bukan jumlah akun.
- Satu akun dapat menghasilkan beberapa enrollment:
  - semester 1: 1 dokumen;
  - semester 2: 1 dokumen;
  - semester 3: 3 dokumen;
  - semester 4: 5 dokumen;
  - semester 5: 2 dokumen.
- Dry-run dengan 0 UID tetap dapat mengaudit classes/sessions, tetapi langkah
  enrollment `blocked`.
- Migrasi sungguhan parsial hanya menulis subset yang terpetakan; ini perlu
  keputusan PM dan rules yang sudah tersedia.

Bukti pengamanan UID kosong:

- `buildEnrollmentAccountMap` mengabaikan UID kosong.
- UID `p1..p31` ditolak oleh `isLocalDemoId`.
- `buildEnrollmentPlan` hanya membuat item untuk akun dengan UID.
- `createMissingEnrollments` hanya menulis item yang ada di plan.
- Test `rejects local demo IDs and empty values`,
  `reports student codes without a valid UID instead of inventing one`, dan
  `does not write during a dry run` lulus.

## Blocker

1. **Rules enrollments belum ada.** `firestore.rules` tidak memiliki
   `match /enrollments/{enrollmentId}`; default-deny menolak read/create.
2. **Mapping UID 0/31.** Hanya 1 akun Auth diketahui dan kecocokannya belum
   diverifikasi.
3. **`users` tidak bisa di-list.** Rules hanya mengizinkan `get` milik sendiri;
   pencocokan harus melalui Firebase Console.
4. **Live dry-run belum dijalankan.** Tidak ada kredensial operator, sehingga
   status `classId` 12 sessions belum diketahui.
5. **Operator asisten belum dikonfirmasi.** Akun yang diketahui adalah praktikan;
   penulisan classes/sessions/enrollments membutuhkan role asisten.
6. **Keputusan partial vs full belum ada.** PM perlu memutuskan apakah migrasi
   parsial boleh dijalankan.
7. **Aplikasi belum membaca enrollments.** Layar jadwal masih memakai
   `src/data/sessionEnrollments.ts`; `authenticatedIdentity.localScheduleId`
   belum diisi. Ini bukan blocker penulisan, tetapi data enrollment belum akan
   mengubah UI sampai integrasi dilakukan.

## Langkah berikutnya

1. Buka Firebase Console → Authentication → Users; cari
   `praktikan1@tandaiu.com` dan salin UID-nya.
2. Buka Firestore → `users/{uid}`; periksa `role`, `studentCode`, `name`, dan
   `authProvider`.
3. Cocokkan `studentCode` ke satu baris `p1..p31`; jangan mengasumsikan `p1`.
4. Jika cocok, isi hanya key tersebut di `migration-accounts.json`; perbarui
   status di `migration-account-matching.csv`.
5. Jalankan `--local-only`; hasil parsial yang diharapkan misalnya
   `UID terpetakan: 1; UID belum diisi: 30; siap ditulis: N` dengan `N`
   bergantung semester akun.
6. Kumpulkan 30 akun lainnya atau minta PM memutuskan kebijakan migrasi parsial.
7. Minta Nadia/PM menambahkan dan men-deploy rules `enrollments`.
8. Setelah ada akun asisten dan mapping, jalankan `--dry-run`; periksa
   sessions/classes dan hasil enrollment.
9. Migrasi sungguhan hanya setelah semua prasyarat dan persetujuan terpenuhi.
   Audit ini tidak menjalankannya.

## File yang diperiksa

- `src/data/praktikans.ts`
- `src/data/sessions.ts`
- `src/migrations/accounts.ts`
- `src/migrations/enrollments.ts`
- `src/migrations/preflight.ts`
- `src/migrations/index.ts`
- `src/migrations/run.ts`
- `src/migrations/README.md`
- `src/migrations/UID-MATCHING-GUIDE.md`
- `migration-accounts.json`
- `migration-accounts.example.json`
- `migration-account-matching.csv`
- `firestore.rules`
- `src/services/authService.ts`
- `src/features/auth/authSession.ts`
- `src/features/praktikan/authenticatedIdentity.ts`
- `src/lib/currentSession.ts`

## File yang diubah/dibuat pada audit ini

- Diubah: `src/migrations/UID-MATCHING-GUIDE.md` — kondisi aktual, migrasi
  parsial, prasyarat dry-run parsial.
- Diubah: `src/migrations/README.md` — ringkasan migrasi parsial.
- Dibuat: `src/migrations/MIGRATION-STATUS.md` — laporan status ini.

Tidak diubah: `migration-accounts.json` (UID tetap kosong),
`migration-accounts.example.json`, `firestore.rules`, konfigurasi Firebase,
`package.json`, dan file anggota lain.

## Validasi terakhir

```text
Seed sessions: 12
Pasangan courseId + className unik: 12
Duplikasi session ID: 0
Duplikasi pasangan kelas: 0
courseId tidak dikenal: 0
className kosong: 0
Mapping template: keyed; entri 31; invalid 0
UID terpetakan: 0; UID belum diisi: 31
Enrollment target: 69; siap ditulis: 0
```

Tidak ada write/update/delete Firestore, pembuatan akun, perubahan rules,
perubahan konfigurasi, atau operasi Git pada audit ini.
