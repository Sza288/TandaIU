# Model sentimen ulasan (on-device)

Model ini membaca **satu teks ulasan pasca-praktikum** lalu memberi hasil `positif`, `netral`, atau `negatif`. Prediksi dilakukan langsung di perangkat, jadi tidak perlu internet saat aplikasi digunakan.

Folder ini terpasang di fitur ulasan TandaIU. Model **tidak** dipakai untuk menilai alasan izin, karena alasan izin selalu berisi sakit atau keperluan pribadi sehingga label sentimen tidak bermakna.

- `sentiment.js` — fungsi `createSentimentClassifier(model)` untuk membuat prediksi.
- `model-edom.json` — data model yang dipakai untuk memprediksi (sekitar 273 KiB).
- `requirement.txt` — dependensi Python untuk melatih ulang model.

## Pemakaian di aplikasi ini

Jangan memanggil `sentiment.js` langsung dari layar. Gunakan wrapper berikut agar fallback dan penandaan sumber sentimen tetap konsisten:

```ts
import { analyzeReviewSentiment } from './sentiment';

const { sentiment, source } = await analyzeReviewSentiment(comment);
// source: 'model'    → model lokal berhasil memprediksi
// source: 'fallback' → model tidak mengenali teks / gagal, dipakai src/lib/aiClient.ts
```

Alurnya:

1. `src/features/review/sentiment.ts` memanggil model lokal untuk teks ulasan.
2. Jika model mengembalikan `label: null` (kosakata tidak dikenali) atau gagal dimuat, wrapper memanggil `analyzeSentiment()` di `src/lib/aiClient.ts`.
3. `src/services/reviewService.ts` menyimpan hasilnya ke dokumen `reviews/{sessionId}_{uid}` bersama `sentimentSource`.
4. UI (`PraktikanReviewScreen` dan `AssistantReviewsScreen`) menampilkan label sentimen; bila `sentimentSource === 'fallback'`, UI menampilkan penanda **Analisis cadangan**.

## Contoh prediksi

```text
Jelas, asisten sabar, praktikum menyenangkan  → positif
Penjelasan sulit dipahami dan mengecewakan    → negatif
zxqv wplk                                     → null (tidak dikenali)
```

Data seperti nama, nomor mahasiswa, atau nilai tidak dibutuhkan.

## Jika teks tidak bisa dianalisis

Model memberi `label: null` jika teksnya kosong atau tidak menemukan kata yang dikenali. Pada aplikasi, kondisi ini **tidak** dianggap netral secara diam-diam: wrapper memakai fallback `analyzeSentiment()` dan menandai `source: 'fallback'` agar pengguna melihat penanda “Analisis cadangan”.

## Catatan tentang model ini

Model ini masih contoh awal (`research_baseline_edom_not_practicum_validated`). Data latihnya berasal dari komentar evaluasi dosen/perkuliahan, bukan kumpulan ulasan praktikum. Pada validasi data tersebut, kelas netral lebih lemah daripada kelas positif dan negatif. Karena itu, prediksi belum bisa dianggap sebagai penilaian yang pasti dan hanya dipakai sebagai sinyal tambahan untuk asisten.

Prediksi berjalan di dalam aplikasi dan tidak mengirim teks ke internet.

## Kalau ingin melatih model lagi

Pelatihan dilakukan di komputer, bukan di dalam aplikasi. Siapkan Python, lalu jalankan dari folder ini:

```text
python -m pip install -r requirement.txt
python train_edom.py
```

Perintah itu membuat ulang `model-edom.json` dari `edom-data.csv`. Dataset tersebut berasal dari repositori publik [EDOM sentiment](https://github.com/samfch/edom-sentiment). Salinan lisensi MIT dan keterangan sumber tersedia di `EDOM-LICENSE.txt` dan `EDOM-ATTRIBUTION.txt`.

Untuk membuat model yang lebih sesuai, kumpulkan ulasan praktikum yang boleh digunakan, beri label positif/netral/negatif, lalu latih dan evaluasi model dengan data tersebut.
