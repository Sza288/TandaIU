# Provisioning 31 Akun Praktikan Dummy

Script ini adalah alat **satu kali** untuk membuat akun Firebase Auth dan
dokumen `users/{uid}` bagi 31 praktikan dummy `p1..p31`. Script tidak dipanggil
oleh aplikasi Expo dan tidak mengubah `package.json`, rules, atau konfigurasi
Firebase.

> **Belum dijalankan.** Tahap ini hanya menyiapkan script dan mode lokal.
> Mode `execute` dilarang dijalankan sebelum persetujuan dan exclusion list
> tiga akun testing Husni tersedia.

## File

| File | Fungsi |
|---|---|
| `scripts/provision-dummy-praktikans.ts` | Script provisioning. |
| `scripts/provisioning-exclusions.example.json` | Template exclusion list tiga akun testing. Harus disalin dan diisi. |
| `scripts/README-provisioning.md` | Panduan ini. |

## Sumber data dan identitas

- Sumber nama, studentCode, dan semester: `src/data/praktikans.ts`.
- Peta UID kosong: `migration-accounts.json`.
- Email dummy deterministik dari nama praktikan, bukan ID atau NIM:
  `nama.depan.nama.belakang@<domain>`. Nama dinormalisasi ke huruf kecil
  dan dipisahkan dengan titik.
  Contoh: `Ulya Safitri` → `ulya.safitri@tandaiu.com`.
- ID `p1..p31` tetap menjadi key internal dan kunci mapping; ID tidak dipakai
  sebagai email.
- Jika dua nama menghasilkan email yang sama, script berhenti dan melaporkan
  pasangan yang bentrok. Script tidak menambahkan suffix otomatis.
- Role selalu `praktikan`.
- `authProvider` di dokumen `users/{uid}` adalah `password`.
- NIM mengikuti data lokal saat ini, termasuk p19, p21, dan p22. Script tidak
  mengubah NIM.

## Mode

| Mode | Firebase | Menulis | Kegunaan |
|---|---|---|---|
| `manifest` | Tidak | Tidak | Menampilkan 31 rencana akun dan email. |
| `dry-run` | Tidak | Tidak | Validasi lokal + mapping, termasuk UID kosong. |
| `preflight` | Ya, read-only | Tidak | Mengecek Auth/users dan melaporkan create/skip/conflict. |
| `execute` | Ya | Auth + `users` | Membuat akun/profil yang belum ada. Wajib `--confirm`. |
| `verify` | Ya, read-only | Tidak | Memverifikasi 31 akun dan menghasilkan kandidat mapping. |

`migration-accounts.json` **tidak pernah ditulis otomatis**. Mode `verify`
hanya dapat menulis kandidat mapping ke path `--mapping-out`; salin ke
`migration-accounts.json` setelah ditinjau.

## Perintah lokal (aman, tanpa Firebase)

```bash
# manifest
npx --yes tsx scripts/provision-dummy-praktikans.ts manifest

# dry-run, tanpa exclusion list
npx --yes tsx scripts/provision-dummy-praktikans.ts dry-run --mapping ./migration-accounts.json

# manifest dengan exclusion list yang sudah diisi
npx --yes tsx scripts/provision-dummy-praktikans.ts manifest \
  --exclusions ./scripts/provisioning-exclusions.json
```

Hasil lokal yang diharapkan:

- 31 akun rencana.
- 31 email dummy unik dengan format nama (bukan `dummy.p01`).
- 31 studentCode unik.
- Mapping 31 entri; 31 UID kosong saat ini.
- Tidak ada koneksi Firebase dan tidak ada penulisan.

## Exclusion list tiga akun testing

Salin template:

```bash
copy scripts\provisioning-exclusions.example.json scripts\provisioning-exclusions.json
```

Isi **email dan UID** ketiga akun testing Husni:

```json
{
  "accounts": [
    {
      "label": "husni-testing-1",
      "email": "akun1@contoh",
      "uid": "uid-akun-1",
      "studentCode": "NIM-akun-1"
    },
    {
      "label": "husni-testing-2",
      "email": "akun2@contoh",
      "uid": "uid-akun-2",
      "studentCode": "NIM-akun-2"
    },
    {
      "label": "husni-testing-3",
      "email": "akun3@contoh",
      "uid": "uid-akun-3",
      "studentCode": "NIM-akun-3"
    }
  ]
}
```

Aturan:

- Harus tepat 3 akun.
- Setiap akun wajib memiliki `email` dan `uid` yang terisi.
- Template bawaan sengaja kosong; script akan menolak sampai ketiga entri diisi.
- Jangan memasukkan akun testing ke `migration-accounts.json`.
- Script menolak email dummy yang sama dengan email exclusion dan menolak UID
  exclusion yang muncul di mapping.
- Script tidak pernah membuat, mengubah, atau menghapus dokumen ketiga akun.

## Kredensial Admin

Admin SDK memerlukan file service account. Script menolak mode Admin jika
`FIREBASE_SERVICE_ACCOUNT_PATH`/`GOOGLE_APPLICATION_CREDENTIALS` tidak menunjuk
file di luar repository; tidak ada fallback ADC diam-diam.

### Mendapatkan dan menyimpan service account

1. Buka Firebase Console → Project settings → Service accounts.
2. Untuk izin minimum, buat service account khusus di Google Cloud Console →
   IAM & Admin → Service Accounts, lalu beri role:
   - **Firebase Authentication Admin**;
   - **Cloud Datastore User** atau custom role untuk create/get `users`.
3. Buat key JSON untuk service account tersebut dan unduh.
4. Simpan di luar repository, misalnya:
   ```text
   D:\secure\tandaiu-provisioning.json
   ```
5. Jangan commit, upload, tempel di chat, atau menaruhnya di folder
   `D:\TandaIU`.
6. Set environment:
   ```powershell
   $env:FIREBASE_PROJECT_ID = "presensi-praktikum-80d68"
   $env:FIREBASE_SERVICE_ACCOUNT_PATH = "D:\secure\tandaiu-provisioning.json"
   ```
7. Setelah provisioning selesai, pertimbangkan menghapus key/service account
   sementara sesuai kebijakan tim.

Environment yang didukung:

```text
FIREBASE_PROJECT_ID=presensi-praktikum-80d68
FIREBASE_SERVICE_ACCOUNT_PATH=D:\secure\tandaiu-provisioning.json
# atau GOOGLE_APPLICATION_CREDENTIALS dengan file di luar repo
```

Izin minimum yang disarankan:

- Firebase Authentication Admin: create/get user.
- Cloud Datastore User atau custom role untuk create/get dokumen `users`.
- Hindari role Owner/Editor penuh.
- Jangan memakai API key publik `EXPO_PUBLIC_FIREBASE_*` untuk Admin SDK.

Admin SDK mem-bypass Firestore Security Rules. Ini adalah operasi
administratif satu kali di luar aplikasi, bukan bypass dari client. Pastikan
PM menyetujuinya.

`firebase-admin` belum ditambahkan ke `package.json`. Script memuatnya secara
dinamis hanya pada mode `preflight`, `execute`, dan `verify`. Untuk menjalankan
tanpa mengubah manifest/lockfile:

```powershell
npm install --no-save --package-lock=false firebase-admin@14.5.1
```

`firebase-admin@14.5.1` membutuhkan Node >=22; environment project saat ini
Node 24.18.0. Perintah di atas hanya mengisi `node_modules`; `package.json` dan
`package-lock.json` tidak diubah. Jika ingin memastikan:

```powershell
$beforeJson = (Get-FileHash package.json).Hash
$beforeLock = (Get-FileHash package-lock.json).Hash
npm install --no-save --package-lock=false firebase-admin@14.5.1
"package.json changed: $((Get-FileHash package.json).Hash -ne $beforeJson)"
"package-lock.json changed: $((Get-FileHash package-lock.json).Hash -ne $beforeLock)"
```

Jika tidak ingin menyentuh `node_modules` project, gunakan environment tooling
terpisah dengan dependency sendiri dan jalankan script dari environment yang
memiliki resolusi `firebase-admin`.

## Urutan PowerShell: dependency, preflight, execute, verify

```powershell
# 0. Dependency khusus provisioning (tidak mengubah package.json)
npm install --no-save --package-lock=false firebase-admin@14.5.1

# 1. Environment Admin dan exclusion
$env:FIREBASE_PROJECT_ID = "presensi-praktikum-80d68"
$env:FIREBASE_SERVICE_ACCOUNT_PATH = "D:\secure\tandaiu-provisioning.json"
$env:PROVISION_EXCLUSIONS = "D:\TandaIU\scripts\provisioning-exclusions.json"

# 2. Pemeriksaan lokal
npx --yes tsx scripts/provision-dummy-praktikans.ts manifest
npx --yes tsx scripts/provision-dummy-praktikans.ts dry-run `
  --mapping ./migration-accounts.json

# 3. Preflight read-only
npx --yes tsx scripts/provision-dummy-praktikans.ts preflight `
  --mapping ./migration-accounts.json `
  --exclusions $env:PROVISION_EXCLUSIONS

# 4. Execute HANYA setelah preflight bersih dan disetujui
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$env:PROVISION_CREDENTIALS_OUT = "D:\secure\provisioning-credentials-$stamp.csv"
npx --yes tsx scripts/provision-dummy-praktikans.ts execute `
  --mapping ./migration-accounts.json `
  --exclusions $env:PROVISION_EXCLUSIONS `
  --credentials-out $env:PROVISION_CREDENTIALS_OUT `
  --confirm=PROVISION-31-DUMMY-PRAKTIKANS

# 5. Verifikasi dan kandidat mapping
npx --yes tsx scripts/provision-dummy-praktikans.ts verify `
  --mapping ./migration-accounts.json `
  --exclusions $env:PROVISION_EXCLUSIONS `
  --mapping-out ./migration-accounts.generated.json
```

Jangan jalankan `execute` sebelum exclusion list, service account, dependency,
dan preflight siap. Script tidak menulis UID ke `migration-accounts.json`;
tinjau `migration-accounts.generated.json` terlebih dahulu.

## Password dan file kredensial

- Password dibuat acak 24 karakter di memori.
- Password tidak dicetak ke console/log dan tidak masuk
  `migration-accounts.json`.
- Password hanya ditulis ke file `PROVISION_CREDENTIALS_OUT` yang **wajib di
  luar repository**.
- Script menolak path kredensial di dalam folder project dan menolak menimpa
  file yang sudah ada.
- Simpan file kredensial di password manager atau media terenkripsi.

Jika `execute` terhenti setelah sebagian akun dibuat, simpan file kredensial
yang sudah ada. Jalankan ulang `preflight`; akun yang sudah valid akan
di-skip. Jika masih ada akun baru yang perlu dibuat, gunakan path kredensial
baru agar password akun lama tidak tertimpa.

Perintah PowerShell lengkap ada di bagian **Urutan PowerShell: dependency,
preflight, execute, verify** di atas.

## Alur sebelum dan sesudah execute

1. Isi exclusion list tiga akun testing.
2. Siapkan service account least privilege di luar repo.
3. Jalankan `manifest` dan `dry-run`.
4. Jalankan `preflight` read-only; periksa create/skip/conflict.
5. Jika tidak ada conflict, jalankan `execute` dengan konfirmasi.
6. Jalankan `verify`:

```bash
npx --yes tsx scripts/provision-dummy-praktikans.ts verify \
  --exclusions ./scripts/provisioning-exclusions.json \
  --mapping-out ./migration-accounts.generated.json
```

7. Tinjau mapping kandidat, lalu salin UID ke `migration-accounts.json`.
8. Jalankan local preflight migrasi:

```bash
npx --yes tsx src/migrations/run.ts \
  --local-only \
  --accounts ./migration-accounts.json \
  --verbose
```

Target: 31 UID terpetakan, 0 UID kosong, 69 enrollment siap.

## Idempotensi

- Kunci idempotensi: email dummy deterministik dari nama praktikan.
- Jika Auth user sudah ada, script tidak membuat akun kedua.
- Jika `users/{uid}` sudah ada dan valid, script skip.
- Jika Auth user ada tetapi profil belum ada, `preflight` menandainya
  `repair-profile`; `execute` hanya membuat profil jika
  `--repair-missing-profiles` diberikan.
- Jika profil berbeda (role/studentCode/name/email/authProvider), script
  conflict dan tidak menimpa.
- Jika dokumen `users` dengan studentCode sudah ada tetapi Auth user tidak ada,
  script conflict dan tidak membuat akun baru.
- Tidak ada delete/update akun atau profil.

## Verifikasi

`verify` memeriksa:

- 31 email dummy ada di Auth.
- UID unik dan tidak ada di exclusion list.
- `users/{uid}` ada.
- `role == "praktikan"`.
- `name`, `email`, `studentCode`, dan `authProvider` cocok.
- 31 UID unik.
- Mapping kandidat tidak berisi UID akun testing.

Jika ada satu saja kegagalan, mapping tidak dihasilkan.

## Batasan tahap ini

- Tidak ada akun Firebase yang dibuat.
- Tidak ada dokumen Firestore yang ditulis.
- Tidak ada perubahan `migration-accounts.json`.
- Tidak ada perubahan Firestore Rules, konfigurasi Firebase, `package.json`,
  kode aplikasi, atau file anggota lain.
- Tidak ada migrasi enrollment dan tidak ada operasi Git.
