# HOGA B - Weekly Line Monitoring System

Aplikasi monitoring kesiapan line (B1-B31) dan overline mingguan.
Frontend statis + serverless API di Vercel, database dan login di Supabase.

## Fitur

- Login (Supabase Auth) dengan role `admin` dan `user`
- Dashboard: KPI, grafik kesiapan, grafik per engineer, status per line, filter engineer / line
- Input Monitoring dan Input Overline (tambah, ubah, hapus)
- Data Records dengan pencarian di semua kolom, filter per kolom, urut kolom (klik header), Export / Import Excel, dan Export PDF sesuai filter
- Laporan PDF dashboard lengkap (sesuai filter dashboard) dan PDF Data Records (sesuai filter + urutan di layar)
- Realtime: perubahan data muncul otomatis tanpa refresh
- Manajemen user (khusus admin) lewat API server

## Struktur project

```
hoga-b/
├── public/                  <- semua yang diakses browser (di-serve statis)
│   ├── index.html           <- kerangka halaman (login, header, semua tab)
│   ├── css/style.css
│   └── js/                  <- dimuat berurutan oleh index.html
│       ├── config.js        konstanta: daftar engineer, line, status, data sampel
│       ├── state.js         variabel state global
│       ├── utils.js         fungsi bantu, mapping DB <-> app, badge, toast
│       ├── auth.js          init Supabase, login, logout, start aplikasi
│       ├── data.js          memuat data dari Supabase, reset demo
│       ├── monitoring.js    form + aksi Input Monitoring
│       ├── overline.js      form + aksi Input Overline
│       ├── filters.js       definisi kolom, filter per kolom, pencarian global, urutan
│       ├── records.js       tabel Data Records
│       ├── dashboard.js     KPI dan grafik
│       ├── report.js        laporan PDF (dashboard + Data Records)
│       ├── realtime.js      Supabase Realtime + polling cadangan
│       ├── excel.js         export / import Excel
│       ├── users.js         manajemen user (admin)
│       └── app.js           navigasi tab, dropdown, window.onload
├── api/                     <- serverless function Vercel
│   ├── _lib/http.js         helper respons + penanganan error
│   ├── _lib/supabase.js     client service-role + cek admin
│   ├── config.js            GET /api/config  (URL + anon key untuk frontend)
│   └── users.js             /api/users       (GET/POST/PATCH/DELETE, khusus admin)
├── supabase/schema.sql      <- tabel, constraint, RLS, trigger, realtime (aman untuk DB lama)
├── supabase/check-existing.sql <- cek kecocokan database lama (hanya membaca)
├── scripts/check-syntax.js  <- npm run check
├── vercel.json
├── package.json
└── .env.example
```

Catatan: file di `public/js` adalah script biasa (bukan module) yang berbagi scope global,
jadi **urutan `<script>` di `index.html` penting**. Menambah fitur baru = buat file js baru
lalu daftarkan di `index.html` sebelum `app.js`.

## Setup

### 1. Supabase
1. Buat project di <https://supabase.com>.
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
   (Jika tabel lama sudah ada dan berisi data, baca peringatan di bagian atas file itu dulu.)
3. Buat user pertama di **Authentication > Users**, lalu jadikan admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'email-anda@contoh.com';
   ```
4. Ambil kunci di **Project Settings > API**: `Project URL`, `anon key`, dan `service_role key`.

#### Memakai database lama (sudah ada data)
1. Jalankan `supabase/check-existing.sql` (hanya membaca, tidak mengubah apa pun) dan lihat hasilnya.
2. Jika tidak ada kolom wajib yang hilang, jalankan `supabase/schema.sql`. File ini **tidak menghapus atau mengubah data lama**:
   tabel yang sudah ada dilewati, kolom pendukung yang belum ada (`updated_at`, `created_by`, `created_at`, `email`) ditambahkan,
   dan email di `profiles` yang kosong diisi dari `auth.users`.
3. Data lama tetap terbaca karena nama kolom yang dipakai aplikasi tidak berubah.
4. Constraint ketat (format line, daftar status) hanya dipasang pada tabel baru, sehingga tidak menolak data lama.

### 2. Environment variable
Salin `.env.example` ke `.env.local` (lokal) dan isi juga di
**Vercel > Project > Settings > Environment Variables**:

| Nama | Keterangan |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **rahasia**, hanya dipakai folder `api/` |

### 3. Deploy ke Vercel
- Hubungkan repo Git ke Vercel (Framework Preset: **Other**). `vercel.json` sudah mengatur
  `public/` sebagai folder statis dan `api/` sebagai function. Setelah mengubah environment variable,
  lakukan **Redeploy**.
- Atau lewat CLI: `npm i -g vercel` lalu `vercel --prod`.

### 4. Jalan lokal
```bash
npm install
npm i -g vercel
vercel dev        # buka http://localhost:3000
npm run check     # periksa sintaks semua file JS
```

## Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` hanya ada di environment server dan tidak pernah dikirim ke browser.
- Semua operasi user (tambah, ubah role, hapus) diverifikasi di server: token login dicek, role admin dicek,
  input divalidasi, dan admin tidak bisa mengubah / menghapus akunnya sendiri.
- Data monitoring / overline diakses langsung dari browser dan dilindungi RLS di `schema.sql`.
  Defaultnya semua user yang login boleh mengubah data; aturan yang lebih ketat tersedia (dikomentari) di file itu.

## Belum termasuk (rencana lanjutan)

- Sinkron otomatis ke Google Sheets (`api/sync-sheets.js`) - perlu service account Google.
- Riwayat perubahan data (audit log).
- Notifikasi line yang mendekati jadwal start tetapi belum Ready.
