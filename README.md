# TandaIU

**Presensi Praktikum** — prototipe aplikasi mobile presensi praktikum berbasis **Expo + React Native + TypeScript**, dengan navigasi **Expo Router**.

Aplikasi memakai dua sudut pandang dalam satu aplikasi:

- **Asisten** — membuka/menutup sesi praktikum, melihat rekap presensi, meninjau pengajuan izin, dan membaca ulasan pasca-praktikum beserta sentimen AI.
- **Praktikan** — melakukan presensi pada sesi yang dibuka, melihat riwayat kehadiran, mengajukan izin, dan menulis ulasan setelah sesi ditutup.

Autentikasi dan data fitur Sprint 2 memakai **Firebase** (Auth + Firestore). Analisis sentimen berjalan **on-device**. Pada desain Sprint 2, sentimen dipakai untuk **ulasan pasca-praktikum**, bukan untuk menilai alasan izin. Rincian kebutuhan, pembagian tugas, dan kriteria penerimaan ada di [`SRS.md`](./SRS.md) dan [`PembagianSprint2.md`](./PembagianSprint2.md).

## Alur pengguna

```text
Login / registrasi (email atau Google)
├─ Asisten → Daftar jadwal → Detail sesi → Buka/Tutup sesi
│                                   ├→ Rekap presensi
│                                   ├→ Review izin (setujui/tolak)
│                                   └→ Lihat ulasan + sentimen AI
└─ Praktikan → Daftar jadwal → Detail sesi → Presensi
                                             ├→ Riwayat pribadi
                                             ├→ Ajukan izin → Status izin realtime
                                             └→ Ulasan (sesi ditutup) → Sentimen AI
```

Status sesi bertransisi `terjadwal` → `dibuka` → `ditutup`. Presensi hanya dapat dilakukan saat sesi `dibuka`, dan presensi ganda untuk praktikan yang sama pada satu sesi ditolak.

Pengajuan izin menyimpan alasan praktikan **tanpa** analisis sentimen. Setiap praktikan hanya dapat mengajukan **satu izin per sesi** (ID dokumen `permits/{sessionId}_{uid}`); pengajuan kedua untuk sesi yang sama ditolak, baik di UI maupun di security rules. Setelah sesi ditutup, praktikan dapat menulis **ulasan pasca-praktikum**; teks ulasan itulah yang dianalisis sentimennya **di perangkat** memakai model lokal. Asisten dapat menyetujui atau menolak izin, dan status izin langsung terlihat oleh praktikan.

## Teknologi

- **Expo SDK 58** / **React Native 0.88** / **React 19**
- **TypeScript** (strict)
- **Expo Router** (routing berbasis berkas di `src/app/`)
- **Firebase** (`firebase` v13) — Auth email/password + Google, Firestore realtime, security rules
- `@expo-google-fonts/comfortaa`, `@expo-google-fonts/nunito-sans` — tipografi
- `@expo/vector-icons` (`Ionicons`) — ikon
- `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`

## Menjalankan proyek

Prasyarat: Node.js LTS dan npm.

```bash
npm install
npm start
```

`npm start` menjalankan Expo Go melalui tunnel, jadi QR bisa discan dari iPhone tanpa harus berada di Wi-Fi yang sama. Untuk Wi-Fi lokal yang tidak membatasi koneksi antar-perangkat, gunakan `npm run start:lan`.

> Gunakan `npm start`, bukan `npx expo start`, karena proyek ini memiliki `expo-dev-client` sehingga `npx expo start` default-nya membuat QR untuk development build. Jika ingin memakai Expo CLI langsung, jalankan `npx expo start --go --tunnel`.
>
> Catatan iOS: Expo Go dari App Store berhenti di SDK 54, sedangkan proyek ini memakai SDK 58. Untuk iPhone fisik, buka URL tunnel di Safari (versi web) atau gunakan Expo Go SDK 58 lewat TestFlight (`eas go`, perlu Apple Developer Program). Expo Go SDK 58 juga tersedia untuk Android/emulator lewat [expo.dev/go](https://expo.dev/go).

Setelah dev server berjalan, buka pada perangkat/emulator:

| Perintah | Keterangan |
|---|---|
| `npm start` | Expo Go via tunnel (scan QR dari iPhone) |
| `npm run start:lan` | Expo Go via Wi-Fi lokal |
| `npm run android` | Membuka di Expo Go pada emulator/perangkat Android |
| `npm run ios` | Membuka di simulator iOS |
| `npm run web` | Membuka di peramban web |
| `npm run lint` | Menjalankan `expo lint` |
| `npx tsc --noEmit` | Pemeriksaan tipe TypeScript |
| `npm run reset-project` | Menjalankan skrip `scripts/reset-project.js` |

> Perangkat demo utama adalah **Android** (keputusan implementasi). Jalankan `npm run lint` dan `npx tsc --noEmit` sebelum menandai pekerjaan selesai.

## Struktur proyek

```text
src/
├─ app/              # Rute Expo Router (setiap berkas = satu layar)
│  ├─ _layout.tsx    # Stack navigator + provider global
│  ├─ index.tsx, home.tsx, profile.tsx      # Landing, beranda, profil
│  ├─ auth/login.tsx, auth/register.tsx     # Login & registrasi
│  ├─ assistant.tsx
│  ├─ assistant/manage/                     # CRUD kelas, jadwal, sesi (asisten)
│  ├─ assistant/rekap/[sessionId].tsx       # Rekap presensi (asisten)
│  ├─ assistant/permits.tsx                 # Review izin (asisten)
│  ├─ assistant/reviews.tsx                 # Ulasan + sentimen AI (asisten)
│  ├─ praktikan.tsx
│  ├─ praktikan/riwayat.tsx                 # Riwayat presensi (praktikan)
│  ├─ praktikan/permit.tsx                  # Form pengajuan izin (praktikan)
│  ├─ praktikan/review.tsx                  # Form ulasan pasca-praktikum (praktikan)
│  ├─ schedule.tsx
│  └─ schedule/[id].tsx                     # Detail sesi
├─ features/
│  ├─ auth/          # Layar, context sesi, guard, tipe auth
│  ├─ crud/          # Form & daftar CRUD praktikum
│  ├─ permit/        # Form izin, review izin, badge
│  ├─ review/        # Ulasan pasca-praktikum, badge sentimen, model AI on-device
│  └─ ...            # assistant, praktikan, schedule, profile, landing
├─ components/       # Komponen bersama (header, kartu sesi, badge, navigasi bawah)
├─ state/            # AttendanceContext + fungsi mutasi presensi
├─ services/         # authService, practicumService, permitService, reviewService
├─ hooks/            # useClasses, useSchedules, useSessions, usePermit, useReview
├─ lib/              # firebase, aiClient, currentSession
├─ data/             # Data dummy (sessions, attendances, praktikans, courses, permits, reviews)
├─ types/            # Kontrak tipe (PracticumSession, Attendance, Praktikan, Role, dst.)
├─ utils/            # Helper akademik, format waktu, sesi
├─ config/           # Konfigurasi term akademik aktif
└─ theme/            # Token warna dan tipografi
```

Aturan singkat: kode non-rute (komponen, hook, util) disimpan **di luar** `src/app/`.

> Model sentimen berada di `src/features/review/ai/` dan hanya menganalisis **ulasan pasca-praktikum**. Alasan izin tidak melewati model ini.

## Ruang lingkup dan batasan

- Autentikasi, kelas, jadwal, sesi, izin, dan ulasan memakai **Firebase**; data pendukung lain masih dummy.
- Presensi memakai Firestore: buka/tutup sesi, presensi GPS/QR, pembatalan, riwayat, dan rekap menggunakan collection yang sudah ada (`sessions`, `attendances`, dan `attendanceQrTokens`). Transaksi Firestore menangani perubahan status dan mencegah presensi ganda.
- Mode Firebase Spark tidak menjalankan Cloud Functions. Pemeriksaan jarak Haversine dan kecocokan QR dilakukan oleh client; token QR dapat dibaca oleh praktikan yang terdaftar pada sesi. Firestore Rules membatasi identitas, enrollment, sesi, bentuk data, dan masa berlaku token, tetapi tidak dapat membuktikan bahwa koordinat perangkat, jarak kiriman client, atau pemindaian QR asli. Karena itu mode ini cocok untuk demo/pengujian, bukan validasi presensi yang tahan manipulasi. Validasi otoritatif memerlukan Cloud Functions yang di-deploy pada project ber-billing Blaze.
- Analisis sentimen berjalan **on-device** (tanpa panggilan jaringan) dan hanya dipakai untuk **ulasan pasca-praktikum**. Bila model tidak mengenali teks atau gagal, sistem memakai fallback `src/lib/aiClient.ts` dan UI menampilkan “Analisis cadangan”.
- Ulasan hanya dapat dikirim untuk sesi yang sudah **ditutup**, satu ulasan per pasangan sesi + praktikan (ID dokumen `reviews/{sessionId}_{uid}`).
- Izin hanya dapat diajukan satu kali per pasangan sesi + praktikan (ID dokumen `permits/{sessionId}_{uid}`); pengajuan ulang untuk sesi yang sama ditolak.
- Di luar ruang lingkup: bukti foto, ekspor laporan, notifikasi, dan administrasi jadwal lanjutan.

## Dokumentasi

- [`SRS.md`](./SRS.md) — kebutuhan fungsional (FR), kebutuhan UI/NFR, skenario uji penerimaan (AT), pembagian tugas, dan jadwal sprint.
- [`AGENTS.md`](./AGENTS.md) — panduan kontribusi, perintah, dan catatan navigasi/Expo.

## Hasil pengerjaan Sprint 2

Periode 13–17 Nov 2026. Ringkasan status per modul:

| Modul | PIC | Status | Bukti implementasi |
|---|---|---|---|
| Auth & role management | Husni | **Selesai** (PR #15) | `src/services/authService.ts`, `src/features/auth/*`, `src/app/auth/*`; login email/Google, registrasi profil `users/{uid}`, guard rute, reset kata sandi, logout. |
| CRUD kelas/jadwal/sesi + security rules | Nadia | **Selesai** (PR #16) | `src/services/practicumService.ts`, `src/hooks/useClasses`, `useSchedules`, `useSessions`, `src/features/crud/*`, `firestore.rules`; validasi input dan listener realtime. |
| Pengajuan & review izin | Khanza | **Selesai di branch `feature/sprint-2-izin-ai`** | `src/services/permitService.ts`, `src/hooks/usePermit.ts`, `src/features/permit/*`; simpan izin (satu izin per sesi, ID `permits/{sessionId}_{uid}`), transaksi approve/reject, status realtime. |
| Ulasan pasca-praktikum + sentimen AI | Khanza | **Selesai di branch `feature/sprint-2-izin-ai`** | `src/features/review/*`, `src/services/reviewService.ts`, `src/hooks/useReview.ts`, `src/data/reviews.ts`; satu ulasan per sesi, sentimen on-device, tampilan asisten. |
| Presensi realtime | Olivia | **Belum tergabung di branch ini** | State presensi lokal: `src/state/AttendanceContext.tsx`, `src/state/attendanceMutations.ts`; sinkronisasi Firestore belum ada. |
| Perbaikan UX form izin | Khanza | **Selesai** | `PraktikanPermitScreen` memakai `KeyboardAvoidingView` + `keyboardDismissMode` agar tombol kirim dan daftar sesi tidak tertutup keyboard. |

### Kualitas

- `npx tsc --noEmit` — bersih.
- `npx expo lint` — bersih.
- `npm test` — 130 dari 130 tes lulus (14 suite), termasuk `permit.test.ts` dan `review.test.ts`.

### Catatan desain AI

- Alasan izin **tidak** dianalisis sentimen.
- Model sentimen on-device (`model-edom.json`, `sentiment.js`) dilatih dari data ulasan EDOM, bukan alasan izin. Label positif/netral/negatif hanya bermakna untuk **ulasan pasca-praktikum**.
- Baseline EDOM masih bisa salah pada sebagian kata negatif (mis. “buruk” dapat terbaca positif). Model perlu dilatih ulang dengan data ulasan praktikum agar akurat.
- Fallback `src/lib/aiClient.ts` dipakai bila kosakata model tidak dikenali; UI menandai “Analisis cadangan”.

## Status

Sprint 2 sudah menggabungkan Auth/Role (PR #15) dan CRUD praktikum (PR #16) ke `main`. Branch `feature/sprint-2-izin-ai` menambahkan pengajuan + review izin realtime serta **ulasan pasca-praktikum dengan sentimen AI on-device**. Pekerjaan tersisa: menyinkronkan presensi ke Firestore dan melatih ulang model sentimen dengan data ulasan praktikum.
