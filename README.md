# Kas Operasional DPBJ — Universitas Indonesia

Sistem web untuk **mencatat, mengajukan, dan melacak kas operasional DPBJ UI**:
pengajuan **Konsumsi** (rapat) dan **Transport** (Rumah Tangga & Perjadin), kelengkapan berkas,
pemeriksaan & centang berkas oleh **PUM**, penerusan ke **MDK** (di luar sistem) hingga **No. Invoice MDK**
diinput (**paid**), notifikasi otomatis, dashboard, rekap per pengajuan/per orang, serta unduh laporan **PDF** dan **Excel**.

> Acuan aturan bisnis, alur, model data, dan keputusan desain ada di **[CLAUDE.md](CLAUDE.md)**.
> Skenario uji manual ada di **[docs/PANDUAN-UJI-MANUAL.md](docs/PANDUAN-UJI-MANUAL.md)**.

## Fitur

- **3 jenis pengajuan** — Konsumsi, Transport Rumah Tangga, Transport Perjadin — dengan validasi lengkap.
- **Peserta transport per orang** (ID pegawai sendiri, maks. 2 orang) → total dijumlahkan otomatis & bisa direkap per orang.
- **Kelengkapan berkas**: unggah (klik / seret-lepas) PDF, gambar, Word, Excel; pratinjau; tandai "tidak diperlukan"; dokumen tambahan bebas.
- **Alur status**: Draft → **Diajukan ke PUM** → (Dikembalikan → Diajukan ulang) → **Diajukan ke MDK** → **Selesai (Paid)**.
  Riwayat (audit trail) lengkap.
- **Verifikasi PUM**: centang tiap berkas wajib (*Sesuai* / *Perlu revisi* + catatan), kembalikan berkas dengan alasan,
  teruskan ke MDK (hanya bila semua berkas sesuai) sambil mengisi **Project Hosting** & **Task Name**, lalu input No. Invoice MDK.
- **Notifikasi otomatis** di aplikasi (lonceng + toast): PUM saat ada pengajuan baru; pengaju saat dikembalikan,
  diteruskan ke MDK, atau selesai.
- **Peran**: Operator/Pengaju, PUM, Pimpinan (hanya memantau), Administrator — tampilan & hak akses per peran, ditegakkan di server.
- **Dashboard** interaktif: KPI, tren bulanan, komposisi kategori, KO/LS, rekap per orang teratas, antrian tindakan, aktivitas terbaru.
- **Rekap & laporan**: filter periode/kategori/mekanisme/status, rekap per pengajuan & per pegawai, **PDF** dan **Excel (.xlsx)**; bukti pengajuan PDF dengan blok tanda tangan.
- Tampilan **liquid glass** kuning–biru dongker UI, tema **terang/gelap**, animasi halus, responsif hingga ponsel.

## Teknologi

React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · Motion · Recharts · TanStack Query · React Router ·
Radix UI · Express 5 · SQLite bawaan Node (`node:sqlite`) · jsPDF · Vitest · Playwright.

## Prasyarat

- **Node.js 22.22 atau lebih baru** (dikembangkan & diuji dengan Node 26). Cek: `node -v`
- npm (ikut terpasang bersama Node.js)

Tidak perlu database server terpisah — data tersimpan di file SQLite `data/kas-dpbj.db` dan berkas unggahan di `data/uploads/`.

## Menjalankan (mode pengembangan / uji coba)

```bash
npm install        # sekali saja
npm run dev        # API (port 5211) + aplikasi web (port 5210)
```

Buka **http://localhost:5210**. Di Windows bisa juga klik dua kali **`jalankan.bat`**.

Saat pertama kali dijalankan, database dibuat otomatis dan diisi **data demo**:

| Peran | Username | Password |
|---|---|---|
| Operator / Pengaju | `operator` | `operator123` |
| PUM | `pum` | `pum123` |
| Pimpinan | `pimpinan` | `pimpinan123` |
| Administrator | `admin` | `admin123` |

> Database lama (sebelum revisi alur PUM) dimigrasikan otomatis saat server dijalankan: akun `mdk` menjadi peran **PUM**
> (username/password tetap) dan status *Diajukan* menjadi *Diajukan ke PUM*. Untuk mendapat akun demo baru di atas,
> hentikan server lalu jalankan `npm run db:seed`.

Uji dari ponsel di jaringan yang sama: `npm run dev:lan`, lalu buka `http://<IP-laptop>:5210`
(izinkan Node.js di Windows Firewall bila diminta).

### Mengatur ulang data

| Perintah | Hasil |
|---|---|
| `npm run db:seed` | Hapus semua data → isi ulang data demo (±56 pengajuan) |
| `npm run db:reset` | Hapus semua data → database kosong dengan satu akun `admin` / `admin123` |

> Hentikan server (Ctrl+C) sebelum menjalankan perintah di atas — di Windows file database terkunci saat server berjalan.

## Mode produksi

```bash
npm run build      # typecheck + build frontend ke dist/
npm run db:reset   # (opsional) mulai dengan database kosong
npm start          # aplikasi + API di http://localhost:5211
```

Variabel lingkungan opsional:

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `5211` | Port server |
| `KAS_DB_PATH` | `data/kas-dpbj.db` | Lokasi file database |
| `KAS_UPLOAD_DIR` | `data/uploads` | Folder berkas unggahan |
| `KAS_SEED` | `demo` | Isi awal bila database kosong: `demo` atau `minimal` |
| `COOKIE_SECURE` | `false` | Set `true` bila diakses lewat HTTPS (reverse proxy) |

**Sebelum dipakai sungguhan:** jalankan `npm run db:reset`, masuk sebagai `admin`, segera **ganti password**,
lalu buat akun operator, PUM, dan pimpinan dari menu **Pengguna**.

### Backup

Hentikan server, lalu salin seluruh folder **`data/`** (database + berkas unggahan) ke lokasi aman.
Untuk memulihkan, kembalikan folder tersebut.

## Pengujian

```bash
npm test           # 107 test unit + integrasi API + komponen (Vitest)
npm run test:e2e   # build + 21 skenario browser (Playwright, desktop & mobile)
npm run typecheck  # pemeriksaan tipe frontend, server, dan test
```

E2E memakai server terpisah (port 5212) dengan database `data/e2e/` sehingga tidak mengganggu data Anda.
Laporan HTML E2E: `npx playwright show-report`.

## Struktur folder

```
shared/    konstanta, tipe, validasi, format (dipakai server & frontend)
server/    Express API, database SQLite, autentikasi, seed data demo
src/       aplikasi React (halaman, komponen, PDF/Excel, tema)
tests/     api/ (integrasi), unit/, e2e/ (Playwright)
docs/      panduan uji manual
data/      database & berkas unggahan (dibuat otomatis, tidak di-commit)
```

## Pemecahan masalah

- **"Port 5210/5211 sudah dipakai"** — tutup aplikasi lain yang memakai port tersebut, atau hentikan server sebelumnya.
- **`db:seed`/`db:reset` gagal menghapus database** — server masih berjalan; hentikan dulu (Ctrl+C).
- **Halaman kosong / "Tidak dapat terhubung ke server API"** — pastikan `npm run dev` berjalan dan tidak ada error di terminal.
- **Node terlalu lama** — perbarui ke Node.js 22.22+ (`node:sqlite` dibutuhkan).
