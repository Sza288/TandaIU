# TandaIU

**Presensi Praktikum** — prototipe aplikasi mobile presensi praktikum berbasis **Expo + React Native + TypeScript**, dengan navigasi **Expo Router**.

Aplikasi memakai dua sudut pandang dalam satu aplikasi:

- **Asisten** — membuka/menutup sesi praktikum, melihat rekap presensi, dan meninjau pengajuan izin beserta sentimen AI.
- **Praktikan** — melakukan presensi pada sesi yang dibuka, melihat riwayat kehadiran, dan mengajukan izin.

Data bersifat **lokal/dummy** (tanpa backend, autentikasi, atau persistensi). Rincian kebutuhan, pembagian tugas, dan kriteria penerimaan ada di [`SRS.md`](./SRS.md) dan [`PembagianSprint2.md`](./PembagianSprint2.md).

## Alur pengguna

```text
Pemilihan peran
├─ Asisten → Daftar jadwal → Detail sesi → Buka/Tutup sesi
│                                   ├→ Rekap presensi
│                                   └→ Review izin (setujui/tolak)
└─ Praktikan (pilih identitas) → Daftar jadwal → Detail sesi → Presensi
                                             ├→ Riwayat pribadi
                                             └→ Ajukan izin → Status izin realtime
```

Status sesi bertransisi `terjadwal` → `dibuka` → `ditutup`. Presensi hanya dapat dilakukan saat sesi `dibuka`, dan presensi ganda untuk praktikan yang sama pada satu sesi ditolak.

Pengajuan izin menyimpan alasan praktikan, lalu alasan tersebut dianalisis sentimennya **di perangkat** memakai model lokal di `src/features/permit/ai/`. Asisten dapat menyetujui atau menolak, dan status langsung terlihat oleh praktikan.

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
│  ├─ index.tsx      # Halaman pendarat (pemilihan peran)
│  ├─ home.tsx, profile.tsx, role.tsx
│  ├─ assistant.tsx
│  ├─ assistant/rekap/[sessionId].tsx   # Rekap presensi (asisten)
│  ├─ assistant/permits.tsx             # Review izin + sentimen AI (asisten)
│  ├─ praktikan.tsx
│  ├─ praktikan/riwayat.tsx             # Riwayat presensi (praktikan)
│  ├─ praktikan/permit.tsx              # Form pengajuan izin (praktikan)
│  ├─ schedule.tsx
│  └─ schedule/[id].tsx                 # Detail sesi
├─ features/         # Implementasi layar per domain (assistant, praktikan, schedule, role, landing, home, permit)
│  └─ permit/        # Form izin, review izin, badge, dan model AI on-device
├─ components/       # Komponen bersama (header, kartu sesi, badge status, navigasi bawah, placeholder)
├─ state/            # AttendanceContext + fungsi mutasi state lokal
├─ services/         # permitService (simpan izin, review, listener realtime)
├─ hooks/            # usePermit (langganan status izin)
├─ data/             # Data dummy (sessions, attendances, praktikans, courses, permits)
├─ types/            # Kontrak tipe (PracticumSession, Attendance, Praktikan, Role, dst.)
├─ utils/            # Helper akademik, format waktu, sesi
├─ config/           # Konfigurasi term akademik aktif
└─ theme/            # Token warna dan tipografi
```

Aturan singkat: kode non-rute (komponen, hook, util) disimpan **di luar** `src/app/`.

## Ruang lingkup dan batasan

- Data jadwal, sesi, praktikan, dan izin bersifat lokal/dummy; perubahan dikelola dengan state React.
- Tidak ada server, basis data, login sungguhan, atau sinkronisasi antarperangkat.
- Analisis sentimen izin berjalan **on-device** memakai model di `src/features/permit/ai/` (tanpa panggilan jaringan). Bila model tidak mengenali teks atau gagal, sistem memakai fallback `src/lib/aiClient.ts` dan UI menampilkan peringatan.
- State kembali ke kondisi awal saat aplikasi dimuat ulang (tanpa persistensi).
- Di luar ruang lingkup: autentikasi produksi, GPS/QR, bukti foto, ekspor laporan, notifikasi, dan administrasi jadwal.

## Dokumentasi

- [`SRS.md`](./SRS.md) — kebutuhan fungsional (FR), kebutuhan UI/NFR, skenario uji penerimaan (AT), pembagian tugas, dan jadwal sprint.
- [`AGENTS.md`](./AGENTS.md) — panduan kontribusi, perintah, dan catatan navigasi/Expo.

## Status

Fondasi proyek sudah tersedia (navigasi, pemilihan peran, kontrak tipe, data dummy, dan state bersama). Fitur **pengajuan izin + analisis sentimen AI** sudah diimplementasikan di `src/features/permit/`, `src/services/permitService.ts`, dan `src/hooks/usePermit.ts`. Layar fitur lain seperti daftar jadwal, detail sesi, buka/tutup sesi, rekap, presensi, dan riwayat masih dikerjakan oleh pemilik fitur masing-masing (lihat [`SRS.md`](./SRS.md) §11–13).
