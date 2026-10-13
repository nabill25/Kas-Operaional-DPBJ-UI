# Kas Operasional DPBJ — Universitas Indonesia

Sistem web untuk **mencatat, mengajukan, dan melacak kas operasional DPBJ UI**:
pengajuan **Konsumsi** (rapat) dan **Transport** (Rumah Tangga & Perjadin), kelengkapan berkas,
pemeriksaan & centang berkas oleh **PUM**, verifikasi PUM, pengajuan ke **MDK** (di luar sistem) dengan **No. Invoice MDK**,
hingga **Selesai (Paid)** setelah proses MDK selesai, notifikasi otomatis, dashboard, rekap per pengajuan/per orang, serta unduh laporan **PDF** dan **Excel**.

> Acuan aturan bisnis, alur, model data, dan keputusan desain ada di **[CLAUDE.md](CLAUDE.md)**.
> Skenario uji manual ada di **[docs/PANDUAN-UJI-MANUAL.md](docs/PANDUAN-UJI-MANUAL.md)**.

## Fitur

- **Jenis pengajuan dari master data**: bawaan Konsumsi, Transport Rumah Tangga, Transport Perjadin; admin dapat menambah jenis baru
  (mis. Kontrak Borongan) dengan model form **Umum** (pegawai + nilai per orang), awalan kode, dan berkas sendiri.
- **Master Data (admin)**: Jenis Pengajuan (berkas **wajib/opsional**, mekanisme KO/LS atau tetap, batas orang, warna, ikon),
  Jenis Berkas, Project Costing & Task Name **per tahun anggaran** (2026, 2027, …; salin dari tahun lain) beserta **kode dana**
  tiap pasangan (51/61 sesuai laporan sisa anggaran), Bank, Pegawai; **rekening pegawai** mengisi otomatis rekening di form.
- **Profil akun**: admin menautkan akun ke data pegawai; pemilik akun (mis. pengaju) mengisi Bank & No. Rekening miliknya sendiri
  di **Pengaturan → Profil**. Pengaju tidak mengelola master data.
- **Konsumsi**: jenis konsumsi (Kudapan / Makan Siang / keduanya), "uang siapa" + **rekening (bank & no. rekening)**
  dengan catatan biaya transfer non-Mandiri; PUM menandai **Sudah dibayarkan**.
- **Transport per orang** (batas orang dari master, bawaan 2; ID pegawai sendiri; mekanisme selalu **LS**): Rumah Tangga = nilai uang;
  Perjadin = **uang harian + uang transport**; tiap orang + **bank & no. rekening** (otomatis dari data pegawai), satu baris per orang.
  Total dijumlahkan otomatis & bisa direkap per orang.
- **List Dokumen Pendukung**: tabel berkas (tanda *Wajib*, nama dokumen, status Sudah/Belum Verifikasi, Download & Preview),
  kotak cari, unggah (klik / seret-lepas) PDF, gambar, Word, Excel; tandai "tidak diperlukan"; dokumen tambahan bebas;
  centang beberapa baris → Download (ZIP) / Tandai Sesuai.
- **Alur status** (stepper 5 tahap): Draft → **Diajukan ke PUM** → (Dikembalikan → Diajukan ulang) → **Diverifikasi PUM** →
  **Diajukan ke MDK** (No. Invoice diinput, menunggu verifikasi MDK) → **Selesai (Paid)**. Riwayat (audit trail) lengkap.
- **Verifikasi PUM**: centang tiap berkas wajib (*Sesuai* / *Revisi* + catatan), kembalikan dengan alasan, **Verifikasi**
  (hanya bila semua berkas wajib sesuai & tidak ada tanda revisi) sambil memilih **Task Name** lalu **Project Costing** dari
  kotak cari (master Project & Task) — **kode dana** terisi otomatis —, input No. Invoice MDK (= diajukan ke MDK), lalu tekan
  **Selesai** setelah proses di MDK selesai.
- **Notifikasi otomatis** di aplikasi (lonceng + toast).
- **Peran**: Operator/Pengaju, PUM (memeriksa & memverifikasi, juga dapat mengajukan), Pimpinan (hanya memantau), Administrator.
  Pendaftaran akun mandiri dengan persetujuan admin.
- **Dashboard**, **rekap & laporan** (PDF dan Excel), tema warna (Biru Dongker DPBJ / Kuning UI / Pink), terang/gelap, responsif hingga ponsel.

## Teknologi

React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · Motion · Recharts · TanStack Query · React Router · Radix UI ·
Express 5 (fungsi serverless Vercel) · PostgreSQL, Auth & Storage **Supabase** · jsPDF · Vitest · Playwright.

## Menjalankan secara lokal

Prasyarat: **Node.js 22.22+** dan file **`.env`** (salin dari [`.env.example`](.env.example), isi koneksi Supabase).

```bash
npm install        # sekali saja
npm run dev        # API (port 5211) + aplikasi web (port 5210)
```

Buka **http://localhost:5210** (Windows: klik dua kali **`jalankan.bat`**). Uji dari ponsel di jaringan yang sama:
`npm run dev:lan`, lalu buka `http://<IP-laptop>:5210`.

**Akun**: tidak ada akun demo. Masuk dengan email + password akun **Supabase Auth**; peran diatur admin di menu
**Pengguna**, atau daftar sendiri di halaman **Daftar** lalu disetujui admin.

## Database & deploy

- Database baru: jalankan [`supabase/schema.sql`](supabase/schema.sql) di Supabase → SQL Editor.
- Perubahan skema: file baru di [`supabase/migrasi/`](supabase/migrasi/) (aman diulang). Terapkan ke Supabase
  **sebelum** kode yang memakainya di-deploy.
- Deploy: push ke `main` → Vercel membangun otomatis. Jalankan `npm run build` sebelum commit agar `api/bundle.mjs` ikut diperbarui.
- Variabel lingkungan Vercel: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (rahasia, jangan di-commit). Rincian di CLAUDE.md §9.

## Pengujian

```bash
npm test           # unit + integrasi API (Vitest) — butuh TEST_DATABASE_URL ke PostgreSQL lokal kosong
npm run test:e2e   # build + skenario browser (Playwright, desktop & mobile), server uji port 5212
npm run typecheck  # pemeriksaan tipe frontend & server
```

Test memakai PostgreSQL lokal dan Supabase Auth/Storage tiruan, tidak menyentuh data produksi.
Laporan HTML E2E: `npx playwright show-report`.

## Struktur folder

```
shared/    konstanta, tipe, validasi, format, kamus master data, project/task (dipakai server & frontend)
server/    Express API (Supabase: database, Auth, Storage), entry lokal & Vercel
api/       bundle.mjs — hasil build server untuk Vercel (di-commit)
supabase/  schema.sql + migrasi/
src/       aplikasi React (halaman, komponen, PDF/Excel, tema)
tests/     api/ (integrasi), unit/, e2e/ (Playwright), support/ (data demo & tiruan)
docs/      panduan uji manual
```

## Pemecahan masalah

- **"Port 5210/5211 sudah dipakai"**: tutup aplikasi lain yang memakai port tersebut, atau hentikan server sebelumnya.
- **Tidak bisa login / "Server belum siap"**: periksa `.env` (lokal) atau Environment Variables Vercel, lalu buka
  `/api/health` untuk melihat status database & peringatan konfigurasi.
- **Unggah berkas / kelola pengguna gagal (503)**: `SUPABASE_SERVICE_ROLE_KEY` belum diisi.
