# SRS dan Pembagian Tugas Programmer

## Aplikasi Presensi Praktikum — Prototipe React Native

**Versi:** 1.0
**Tanggal:** 21 Oktober 2026
**Status:** Baseline untuk diskusi kebutuhan dan sprint

## 1. Tujuan dan ruang lingkup

Aplikasi mobile ini membantu **asisten** membuka dan menutup sesi praktikum serta memantau presensi, dan membantu **praktikan** melihat jadwal, melakukan presensi, serta melihat riwayat kehadirannya. Hasil sprint adalah prototipe React Native yang dapat didemonstrasikan dari kedua sudut pandang pada satu aplikasi.

Satu sprint ditargetkan selesai **maksimal empat hari setelah kegiatan praktikum**. Minggu persiapan dipakai untuk menyepakati kebutuhan dan kontrak data. Tanggal kegiatan praktikum belum diberikan, sehingga rencana kerja memakai H (hari praktikum) dan H+1 sampai H+4.

### 1.1 Batasan yang berasal dari studi kasus

- Data jadwal, sesi, dan praktikan bersifat **lokal/dummy**; perubahan cukup dikelola dengan React state.
- Tidak diperlukan server, basis data, login sungguhan, atau sinkronisasi antarperangkat.
- Dua sudut pandang harus dapat dicoba melalui pemilihan peran dalam aplikasi. Pengguna praktikan dipilih dari data dummy agar identitas presensi tetap konsisten.
- Status sesi harus langsung tercermin pada layar yang menggunakan state yang sama. Penyelarasan data presensi antara perangkat asisten dan perangkat praktikan **tidak diwajibkan** oleh catatan studi kasus. Untuk demo pada satu proses aplikasi, state bersama dianjurkan agar alur lengkap mudah terlihat.
- Data state boleh kembali ke kondisi awal saat aplikasi dimuat ulang; persistensi tidak termasuk ruang lingkup.

### 1.2 Di luar ruang lingkup sprint

Autentikasi dan otorisasi produksi, GPS/QR, bukti foto, persetujuan izin/sakit, ekspor laporan, notifikasi, administrasi jadwal, backend, dan sinkronisasi real-time antarperangkat.

## 2. Pemangku kepentingan dan istilah

| Istilah | Arti |
|---|---|
| Asisten | Pengguna demo yang mengelola status sesi dan melihat rekap kehadiran. |
| Praktikan | Pengguna demo yang melakukan presensi dan melihat riwayatnya sendiri. |
| Jadwal | Rencana praktikum yang memuat nama praktikum, kelas, waktu, dan sesi terkait. |
| Sesi | Pelaksanaan satu jadwal dengan status `terjadwal`, `dibuka`, atau `ditutup`. |
| Presensi | Satu catatan kehadiran untuk pasangan `sessionId` dan `practikanId`, dengan waktu kehadiran. |

## 3. Asumsi dan keputusan kerja

1. Prototipe menggunakan **Expo + React Native + TypeScript** dan navigasi berbasis **Expo Router** sesuai rujukan yang diberikan. Android menjadi perangkat demo utama; ini keputusan implementasi, bukan syarat eksplisit pada catatan studi kasus.
2. Sesi yang ditutup tidak dapat dibuka lagi dalam sprint ini. Perubahan status mengikuti `terjadwal` → `dibuka` → `ditutup`.
3. Data awal minimal memuat **dua sesi** (satu terjadwal dan satu sesi lain untuk menguji daftar/riwayat) dan **dua praktikan**. Nilai nama, kelas, serta tanggalnya adalah contoh dan disepakati saat kickoff.
4. Waktu kehadiran diambil dari jam perangkat **pada saat tombol konfirmasi presensi ditekan**, disimpan sebagai timestamp ISO, dan ditampilkan dalam format tanggal/jam lokal.
5. Asisten demo adalah satu identitas dummy. Praktikan memilih satu identitas dummy melalui form/pilihan sebelum masuk ke halaman praktikan. Identitas yang dipilih dipakai untuk pemeriksaan presensi ganda dan filter riwayat.
6. Jika arah dosen/asisten pengampu berbeda, PM memperbarui baseline ini sebelum pengerjaan fitur terkait. Asumsi di atas tidak boleh diam-diam dianggap sebagai kutipan persyaratan studi kasus.

## 4. Alur pengguna dan navigasi

```text
Pemilihan peran
├─ Asisten → Daftar jadwal → Detail sesi → Buka/Tutup sesi
│                                   └→ Rekap presensi
└─ Praktikan (pilih identitas) → Daftar jadwal → Detail sesi → Presensi
                                             └→ Riwayat pribadi
```

Navigasi harus memungkinkan kembali dari detail/rekap/riwayat ke daftar dan berpindah peran untuk demo. Saat pindah peran dalam proses aplikasi yang sama, state sesi tetap ada. Tombol dan judul halaman mengikuti peran agar aksi asisten tidak muncul di layar praktikan.

## 5. Kebutuhan fungsional

Prioritas **Wajib** berarti harus ada pada demo sprint. Kolom **PIC** menunjukkan satu programmer yang bertanggung jawab memastikan kebutuhan selesai. Pekerjaan pendukung dan berkasnya dirinci pada bagian 11–13.

| ID | PIC | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | Olivia (P1) | Pengguna dapat memilih sudut pandang asisten atau praktikan. Pada praktikan, pengguna memilih identitas dummy. | Memilih peran membuka halaman yang tepat; identitas praktikan aktif terlihat; saat kembali dan berpindah peran, aksi mengikuti peran yang baru. |
| FR-02 | Husni (P2) | Kedua peran dapat melihat daftar jadwal. | Setiap item menampilkan nama praktikum, kelas, waktu, dan status sesi; menekan item membuka detail sesi yang sesuai. |
| FR-03 | Husni (P2) | Kedua peran dapat melihat detail sesi. | Detail menampilkan nama praktikum, kelas, waktu, status, dan petunjuk/aksi sesuai peran serta status terkini. |
| FR-04 | Nabila (P3) | Asisten dapat membuka sesi yang berstatus `terjadwal`. | Aksi memakai konfirmasi; setelah disetujui status menjadi `dibuka`, label/tombol berubah, dan layar terkait dalam proses aplikasi yang sama membaca status baru. Pembatalan tidak mengubah status. |
| FR-05 | Nabila (P3) | Asisten dapat menutup sesi yang berstatus `dibuka`. | Aksi memakai konfirmasi; setelah disetujui status menjadi `ditutup`; tombol presensi tidak aktif dan sesi tidak dapat dibuka lagi. Pembatalan tidak mengubah status. |
| FR-06 | Nadia (P4) | Praktikan dapat melakukan presensi hanya ketika sesi `dibuka`. | Praktikan memilih/menetapkan identitas, menekan aksi presensi, mengonfirmasi, lalu menerima umpan balik berhasil; catatan memuat `sessionId`, `praktikanId`, dan waktu kehadiran. |
| FR-07 | Nadia (P4) | Sistem mencegah presensi ganda pada satu sesi untuk satu praktikan. | Setelah berhasil sekali, aksi presensi untuk kombinasi identitas dan sesi yang sama menjadi tidak aktif atau memberi pesan sudah presensi; jumlah catatan tetap satu. Praktikan lain masih dapat presensi. |
| FR-08 | Nabila (P3) | Asisten dapat melihat rekap sederhana per sesi. | Rekap menampilkan daftar praktikan yang hadir dan waktu kehadirannya; jumlah hadir sesuai jumlah catatan unik untuk sesi itu. |
| FR-09 | Nadia (P4) | Praktikan dapat melihat catatan kehadirannya sendiri. | Riwayat hanya memuat catatan milik identitas aktif, dengan nama praktikum/kelas dan waktu hadir; catatan praktikan lain tidak tampil. |
| FR-10 | Husni (P2) | Aplikasi memberi keadaan kosong dan petunjuk yang jelas. | Daftar tanpa jadwal, rekap tanpa presensi, dan riwayat tanpa catatan tidak menjadi layar kosong tanpa penjelasan; sebelum sesi dibuka dan setelah ditutup, alasan presensi tidak tersedia terlihat. |
| FR-11 | Olivia (P1) | Aplikasi memakai form/pilihan, modal konfirmasi/informasi, dan navigasi antarhalaman. | Pilihan peran/identitas dapat dioperasikan; buka/tutup/presensi meminta konfirmasi; tombol batal dan tombol kembali bekerja. |
| FR-12 | Olivia (P1) | Perubahan data lokal merender ulang layar yang terkait. | Sesudah buka, presensi, dan tutup pada satu proses aplikasi, daftar/detail/rekap/riwayat menampilkan nilai terbaru tanpa memuat ulang aplikasi. |

### 5.1 Aturan bisnis dan transisi status

| Kondisi awal | Aksi | Hasil |
|---|---|---|
| `terjadwal` | Asisten membuka sesi | `dibuka` |
| `dibuka` | Asisten menutup sesi | `ditutup` |
| `terjadwal` atau `ditutup` | Praktikan mencoba presensi | Ditolak; tidak membuat catatan |
| `dibuka`, belum hadir | Praktikan mengonfirmasi presensi | Satu catatan baru dengan waktu perangkat |
| `dibuka`, sudah hadir | Praktikan mengulang presensi | Ditolak; catatan awal tidak berubah |
| Status lain/aksi berulang | Buka atau tutup sesi | Tidak mengubah status; tampilkan keadaan aksi yang sesuai |

Pemeriksaan aturan bisnis dilakukan pada fungsi pengubah state, bukan hanya dengan menonaktifkan tombol, supaya aksi berulang cepat tetap tidak membuat catatan ganda.

## 6. Data dan kontrak antarmodul

Model minimum yang disepakati sebelum implementasi:

```ts
type SessionStatus = 'terjadwal' | 'dibuka' | 'ditutup';

type PracticumSession = {
  id: string;
  practicumName: string;
  className: string;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  status: SessionStatus;
};

type Praktikan = { id: string; name: string; studentCode?: string };

type Attendance = {
  sessionId: string;
  praktikanId: string;
  attendedAt: string; // ISO 8601
};
```

State minimum: `sessions`, `praktikans`, `attendances`, `activeRole`, dan `activePraktikanId`. Nama tipe dan berkas final boleh disesuaikan bersama sebelum coding, tetapi semua anggota harus memakai **satu kontrak**. Mutasi yang tersedia: `openSession(id)`, `closeSession(id)`, dan `checkIn(sessionId, praktikanId)`; masing-masing mengembalikan hasil berhasil/gagal beserta alasan untuk umpan balik UI. Daftar rekap dan riwayat diturunkan dari `attendances`, bukan disimpan sebagai salinan terpisah.

Data dummy boleh berisi sesi kosong dan presensi kosong sebagai skenario pengujian. Jika ada tombol reset demo, tombol itu bersifat tambahan, bukan syarat penerimaan.

## 7. Kebutuhan antarmuka dan kualitas

| ID | Kebutuhan terukur | Cara verifikasi |
|---|---|---|
| UI-01 | Tata letak menggunakan Flexbox dan tetap terbaca pada layar Android kecil serta layar yang lebih lebar; teks dan tombol tidak terpotong pada orientasi potret. | Pemeriksaan visual pada minimal dua ukuran layar/emulator. |
| UI-02 | Gaya antarlayar konsisten dengan `StyleSheet.create` atau pola style terpusat; warna status disertai teks, bukan warna saja. | Review UI daftar, detail, rekap, riwayat, dan modal. |
| UI-03 | Tombol aksi utama terlihat jelas, mempunyai label tindakan, dan kondisi nonaktif disertai alasan. | Uji manual pada tiap status sesi. |
| UI-04 | Waktu hadir tampil dengan format lokal yang konsisten dan jelas. | Bandingkan waktu perangkat saat presensi dengan tampilan rekap/riwayat. |
| NFR-01 | Prototipe dapat dijalankan secara lokal pada Android melalui alur Expo yang dipilih tim tanpa layanan jaringan aplikasi. | Jalankan demo setelah dependensi proyek terpasang; alur utama berhasil tanpa backend. |
| NFR-02 | Perubahan state terlihat segera setelah aksi pada proses aplikasi yang sama. | Jalankan alur demo dan periksa daftar/detail/rekap/riwayat. |
| NFR-03 | Tidak ada crash pada daftar kosong, identitas belum dipilih, pembatalan modal, atau aksi berulang. | Uji skenario negatif dan kosong pada bagian 8. |

## 8. Skenario uji penerimaan

| ID | Langkah ringkas | Hasil yang diharapkan | Cakupan |
|---|---|---|---|
| AT-01 | Pilih asisten → buka daftar → detail sesi terjadwal. | Data dan status pada daftar/detail cocok. | FR-01–03 |
| AT-02 | Buka sesi; batalkan sekali, lalu konfirmasi. | Batal tidak mengubah status; konfirmasi mengubah ke `dibuka`. | FR-04, FR-11–12 |
| AT-03 | Pindah ke praktikan A → buka detail sesi tadi → presensi. | Aksi tersedia; ada konfirmasi, waktu hadir, dan pesan berhasil. | FR-01, FR-06, FR-12 |
| AT-04 | Praktikan A menekan presensi lagi. | Tidak ada catatan kedua; tampil keadaan sudah presensi. | FR-07 |
| AT-05 | Pindah ke asisten → buka rekap sesi. | A muncul tepat satu kali dengan waktu hadir. | FR-08, FR-12 |
| AT-06 | Pindah ke praktikan B → lihat riwayat, lalu presensi pada sesi terbuka. | Riwayat awal B tidak menampilkan milik A; B dapat presensi; riwayat B menampilkan miliknya. | FR-06, FR-09 |
| AT-07 | Asisten menutup sesi; praktikan mencoba melihat detail lagi. | Status `ditutup`; aksi presensi tidak tersedia dan alasannya jelas. | FR-05, FR-06, FR-12 |
| AT-08 | Lihat sesi terjadwal, rekap kosong, riwayat kosong, dan daftar jadwal kosong melalui data uji. | Ada pesan keadaan kosong/belum dibuka; aplikasi tidak crash. | FR-10, NFR-03 |
| AT-09 | Jalankan alur pada dua ukuran layar Android. | Konten dan modal dapat dibaca serta tombol dapat ditekan. | UI-01–03 |

## 9. Keterlacakan dan referensi teknis

| Butir studi kasus | ID SRS |
|---|---|
| Jadwal dan detail sesi | FR-02, FR-03 |
| Buka/tutup sesi | FR-04, FR-05, FR-12 |
| Presensi dan cegah duplikasi | FR-06, FR-07 |
| Rekap dan riwayat | FR-08, FR-09 |
| Form, modal, navigasi | FR-01, FR-11 |
| Data dummy dan state | FR-12, bagian 6 |
| Flexbox, responsif, kondisi kosong | FR-10, UI-01–03 |

Referensi implementasi resmi (diakses 21 Oktober 2026):

- [React Fundamentals — komponen, props, state/useState](https://reactnative.dev/docs/intro-react)
- [Layout with Flexbox — `flexDirection`, `alignItems`, `justifyContent`](https://reactnative.dev/docs/flexbox)
- [Handling Text Input — `TextInput` dan state input](https://reactnative.dev/docs/handling-text-input)
- [Modal — dialog dan `onRequestClose`](https://reactnative.dev/docs/modal)
- [Style — `style` dan `StyleSheet.create`](https://reactnative.dev/docs/style)
- [Expo: Add navigation — Expo Router, stack, dan tab](https://docs.expo.dev/tutorial/add-navigation/)

## 10. Definisi selesai sprint

SRS dianggap terpenuhi bila FR-01 sampai FR-12 dan AT-01 sampai AT-09 lulus pada demo Android, aplikasi dapat dijalankan dengan perintah `npm install` dan `npx expo start`, tidak ada crash pada alur utama, dan PM telah menerima hasil integrasi. Laporan akhir mencatat setiap kebutuhan yang belum lulus beserta alasannya; kebutuhan tidak dihapus diam-diam untuk menyesuaikan hasil.

## 11. Anggota tim dan penanggung jawab

Satu FR memiliki **satu PIC** yang bertanggung jawab menyelesaikan perilaku dan menunjukkan bukti uji. Kolom pendukung di bagian 12 menunjukkan anggota yang menyediakan kontrak, state, atau komponen untuk PIC. PM menyetujui hasil, bukan menjadi pengganti programmer suatu FR.

| Kode | Nama dan NIM sesuai data yang diberikan PM | Modul utama | FR yang menjadi tanggung jawab akhir |
|---|---|---|---|
| P1 | **Olivia Oktaviani — 24060124120050** | Fondasi proyek, navigasi, identitas demo, data dummy, state bersama | FR-01, FR-11, FR-12 |
| P2 | **Husni Ulyaa Khanifah — 24060124120021** | Daftar jadwal, detail sesi, keadaan kosong, konsistensi tampilan | FR-02, FR-03, FR-10 |
| P3 | **Nabila Kayla Rafa — 24060124120022** | Buka/tutup sesi dan rekap asisten | FR-04, FR-05, FR-08 |
| P4 | **Nadia Azura Nurhaniya — 24060124120019** | Presensi dan riwayat praktikan | FR-06, FR-07, FR-09 |

## 12. Matriks pekerjaan rinci per kebutuhan SRS

| ID | PIC | Yang dikerjakan dan diserahkan | Pendukung / dependensi | Bukti selesai |
|---|---|---|---|---|
| FR-01 | **Olivia (P1)** | Buat halaman pilih peran dan pilihan identitas praktikan dummy; simpan `activeRole` dan `activePraktikanId`; arahkan ke rute peran yang dipilih dan sediakan cara kembali/ganti peran. | Nadia memakai identitas aktif; Husni membaca peran untuk detail. | AT-01 dan perpindahan peran pada AT-03/06; identitas tidak tertukar. |
| FR-02 | **Husni (P2)** | Buat layar daftar jadwal dengan kartu berisi nama praktikum, kelas, waktu, status, dan tautan ke detail berdasarkan ID sesi. | Olivia menyediakan tipe, seed `sessions`, dan rute. | AT-01; setiap item membuka sesi yang tepat. |
| FR-03 | **Husni (P2)** | Buat layar detail yang membaca sesi berdasarkan ID dan menampilkan informasi penuh serta area aksi sesuai peran/status; sediakan tempat memasang komponen aksi asisten/praktikan. | Nabila memasok aksi asisten; Nadia memasok aksi presensi; Olivia memasok state. | AT-01 dan AT-07; status terbaru terlihat setelah kembali ke detail. |
| FR-04 | **Nabila (P3)** | Buat tombol **Buka sesi**, modal konfirmasi/batal, panggil `openSession(id)`, tampilkan pesan hasil, dan cegah aksi pada status selain `terjadwal`. | Olivia mengimplementasikan fungsi transisi pada state; Husni memasang area aksi pada detail. | AT-02; batal tidak mengubah status, konfirmasi mengubahnya sekali. |
| FR-05 | **Nabila (P3)** | Buat tombol **Tutup sesi**, modal konfirmasi/batal, panggil `closeSession(id)`, tampilkan status akhir, dan cegah penutupan berulang. | Olivia menyediakan fungsi transisi; Nadia memastikan presensi tidak tersedia sesudah tutup. | AT-07; status `ditutup` dan tidak ada presensi baru. |
| FR-06 | **Nadia (P4)** | Buat aksi presensi praktikan, konfirmasi, pesan berhasil/gagal, serta tampilan waktu hadir. Gunakan identitas aktif dan panggil `checkIn(sessionId, praktikanId)` hanya ketika sesi dibuka. | Olivia menyediakan identitas, state, dan fungsi `checkIn`; Husni menyediakan detail sesi. | AT-03 dan AT-06; catatan memuat pasangan ID dan waktu. |
| FR-07 | **Nadia (P4)** | Tampilkan kondisi **Sudah presensi**, nonaktifkan/ubah aksi, dan pastikan pesan duplikasi jelas. Uji dua identitas berbeda pada sesi yang sama. | Olivia wajib menolak duplikasi di fungsi `checkIn`, bukan hanya di UI. | AT-04; pasangan ID yang sama tetap satu catatan, praktikan B masih bisa hadir. |
| FR-08 | **Nabila (P3)** | Buat halaman rekap per sesi dari `attendances`: gabungkan nama praktikan, format waktu hadir, dan jumlah hadir; jangan simpan rekap sebagai state kedua. | Olivia menyediakan data/selector; Nadia menghasilkan catatan presensi; Husni menautkan dari detail. | AT-05; nama/waktu muncul tepat sekali dan jumlah sesuai. |
| FR-09 | **Nadia (P4)** | Buat halaman riwayat yang memfilter `attendances` dengan `activePraktikanId`, lalu tampilkan praktikum, kelas, dan waktu hadir. | Olivia menyediakan identitas aktif dan data sesi; Husni menyediakan pola kartu tampilan bila dipakai. | AT-06; riwayat B tidak memuat catatan A. |
| FR-10 | **Husni (P2)** | Susun pola pesan keadaan kosong dan pastikan daftar kosong, sesi belum dibuka, serta sesi ditutup memberi petunjuk. Tinjau pesan kosong pada rekap dan riwayat sebelum integrasi. | Nabila menerapkan rekap kosong; Nadia menerapkan riwayat kosong dan alasan presensi nonaktif. | AT-08; semua keadaan kosong terbaca tanpa crash. |
| FR-11 | **Olivia (P1)** | Pastikan rute daftar/detail/rekap/riwayat, tombol kembali, pemilihan peran/identitas, dan pola modal terhubung dalam satu alur demo. | Nabila membuat modal buka/tutup; Nadia membuat modal presensi; Husni menyediakan tautan dari daftar/detail. | AT-01–03 dan AT-07; modal dapat batal, navigasi tidak tersesat. |
| FR-12 | **Olivia (P1)** | Sediakan satu sumber state lokal dan mutasi `openSession`, `closeSession`, `checkIn` dengan hasil `{ ok, reason }`; pastikan layar membaca state terbaru dan transisi/duplikasi ditolak pada fungsi mutasi. | Husni, Nabila, Nadia memakai state yang sama tanpa menyimpan salinan status atau daftar presensi. | AT-02–07; perubahan terlihat setelah berpindah layar tanpa reload. |

### 12.1 Pembagian kebutuhan UI dan kualitas

| ID | PIC utama | Pekerjaan dan pemeriksaan |
|---|---|---|
| UI-01, UI-02 | **Husni (P2)** | Menetapkan pola Flexbox/StyleSheet dan komponen jadwal/status; Olivia, Nabila, Nadia menerapkan pola itu pada layar masing-masing. Husni memeriksa dua ukuran Android bersama PM. |
| UI-03 | **Husni (P2)** | Menetapkan gaya tombol/teks status; Nabila dan Nadia memastikan tombol aksi masing-masing punya label dan alasan ketika tidak tersedia. |
| UI-04 | **Olivia (P1)** | Menetapkan fungsi format waktu lokal bersama; Nabila dan Nadia memakainya pada rekap/riwayat. |
| NFR-01 | **Olivia (P1)** | Menjaga proyek dapat dijalankan melalui `npm install` dan `npx expo start`, serta menjelaskan batasan data lokal saat serah terima. |
| NFR-02 | **Olivia (P1)** | Memeriksa state bersama dan alur pindah peran; tiap pemilik layar memperbaiki tampilan yang tidak membaca nilai terbaru. |
| NFR-03 | **Masing-masing pemilik layar; PM menerima** | Husni menguji daftar kosong, Nabila rekap kosong/modal batal, Nadia riwayat kosong/identitas belum dipilih/aksi berulang, Olivia memastikan aplikasi tidak crash saat navigasi. |

## 13. Batas berkas dan kontrak integrasi

Ini **rencana kepemilikan**, bukan daftar berkas yang sudah ada. Olivia membuat kerangka terlebih dahulu. Sebelum empat orang mulai coding, tim menyepakati nama rute, bentuk tipe pada bagian 6, serta hasil fungsi mutasi. Perubahan kontrak setelah itu perlu diumumkan kepada semua pemilik layar.

| Area implementasi yang direncanakan | Pemilik | Serah terima kepada anggota lain |
|---|---|---|
| `src/types/`, `src/data/`, `src/state/`, `src/app/_layout.tsx`, layar pilih peran | **Olivia** | Tipe, seed, hook/provider state, tiga fungsi mutasi, dan daftar rute dapat diimpor anggota lain. |
| `src/features/schedule/`, layar daftar/detail, komponen kartu/status bersama | **Husni** | Detail menyediakan tempat aksi sesuai peran; API props komponen bersama terdokumentasi. |
| `src/features/assistant/`, layar rekap, modal buka/tutup | **Nabila** | Komponen aksi menerima `sessionId`/status dan memakai fungsi mutasi Olivia; rekap membaca data terbaru. |
| `src/features/praktikan/`, layar riwayat, modal/aksi presensi | **Nadia** | Komponen aksi menerima `sessionId` dan identitas aktif; riwayat membaca data terbaru. |

**Aturan integrasi:** identitas praktikan memakai ID stabil, bukan nama. Fungsi mutasi menguji status dan duplikasi sebelum memperbarui state. Rekap dan riwayat dihitung dari `attendances`. Anggota yang membuat layar menguji layar tersebut dan menyerahkan ringkasan perubahan serta cara mencobanya kepada PM.