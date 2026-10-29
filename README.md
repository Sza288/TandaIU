# TandaIU

**Presensi Praktikum** — prototipe aplikasi mobile presensi praktikum berbasis **Expo + React Native + TypeScript**, dengan navigasi **Expo Router**.

Aplikasi memakai dua sudut pandang dalam satu aplikasi:

- **Asisten** — membuka/menutup sesi praktikum dan melihat rekap presensi.
- **Praktikan** — melakukan presensi pada sesi yang dibuka dan melihat riwayat kehadiran sendiri.

Data bersifat **lokal/dummy** (tanpa backend, autentikasi, atau persistensi). Rincian kebutuhan, pembagian tugas, dan kriteria penerimaan ada di [`SRS.md`](./SRS.md).

## Alur pengguna

```text
Pemilihan peran
├─ Asisten → Daftar jadwal → Detail sesi → Buka/Tutup sesi
│                                   └→ Rekap presensi
└─ Praktikan (pilih identitas) → Daftar jadwal → Detail sesi → Presensi
                                             └→ Riwayat pribadi
```

Status sesi bertransisi `terjadwal` → `dibuka` → `ditutup`. Presensi hanya dapat dilakukan saat sesi `dibuka`, dan presensi ganda untuk praktikan yang sama pada satu sesi ditolak.

## Teknologi

- **Expo SDK 58** / **React Native 0.88** / **React 19**
- **TypeScript** (strict)
- **Expo Router** (routing berbasis berkas di `src/app/`)
- `@expo-google-fonts/comfortaa`, `@expo-google-fonts/nunito-sans` — tipografi
- `@expo/vector-icons` (`Ionicons`) — ikon
- `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`

## Menjalankan proyek

Prasyarat: Node.js LTS dan npm.

```bash
npm install
npx expo start
```

Setelah dev server berjalan, buka pada perangkat/emulator:

| Perintah | Keterangan |
|---|---|
| `npm start` / `npx expo start` | Menjalankan dev server Expo |
| `npm run android` | Membuka di emulator/perangkat Android |
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
│  ├─ index.tsx      # Halaman pendarat (pemilihan peran)
│  ├─ home.tsx, profile.tsx, role.tsx
│  ├─ assistant.tsx
│  ├─ assistant/rekap/[sessionId].tsx   # Rekap presensi (asisten)
│  ├─ praktikan.tsx
│  ├─ praktikan/riwayat.tsx             # Riwayat presensi (praktikan)
│  ├─ schedule.tsx
│  └─ schedule/[id].tsx                 # Detail sesi
├─ features/         # Implementasi layar per domain (assistant, praktikan, schedule, role, landing, home)
├─ components/       # Komponen bersama (header, kartu sesi, badge status, navigasi bawah, placeholder)
├─ state/            # AttendanceContext + fungsi mutasi state lokal
├─ data/             # Data dummy (sessions, attendances, praktikans, courses)
├─ types/            # Kontrak tipe (PracticumSession, Attendance, Praktikan, Role, dst.)
├─ utils/            # Helper akademik, format waktu, sesi
├─ config/           # Konfigurasi term akademik aktif
└─ theme/            # Token warna dan tipografi
```

Aturan singkat: kode non-rute (komponen, hook, util) disimpan **di luar** `src/app/`.

## Ruang lingkup dan batasan

- Data jadwal, sesi, dan praktikan bersifat lokal/dummy; perubahan dikelola dengan state React.
- Tidak ada server, basis data, login sungguhan, atau sinkronisasi antarperangkat.
- State kembali ke kondisi awal saat aplikasi dimuat ulang (tanpa persistensi).
- Di luar ruang lingkup: autentikasi produksi, GPS/QR, bukti foto, persetujuan izin/sakit, ekspor laporan, notifikasi, dan administrasi jadwal.

## Dokumentasi

- [`SRS.md`](./SRS.md) — kebutuhan fungsional (FR), kebutuhan UI/NFR, skenario uji penerimaan (AT), pembagian tugas, dan jadwal sprint.
- [`AGENTS.md`](./AGENTS.md) — panduan kontribusi, perintah, dan catatan navigasi/Expo.

## Status

Fondasi proyek sudah tersedia (navigasi, pemilihan peran, kontrak tipe, data dummy, dan state bersama). Layar fitur untuk daftar jadwal, detail sesi, buka/tutup sesi, rekap, presensi, dan riwayat masih berupa *placeholder* dan dikerjakan oleh pemilik fitur masing-masing (lihat [`SRS.md`](./SRS.md) §11–13).
