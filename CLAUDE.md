# CLAUDE.md — Acuan Project Kas Operasional DPBJ UI

Dokumen ini adalah **sumber kebenaran** project. Baca dulu sebelum mengubah apa pun.
Jika ada permintaan yang bertentangan dengan dokumen ini, konfirmasi ke pemilik project,
lalu perbarui dokumen ini. **Jangan menebak** aturan bisnis yang tidak tertulis di sini —
tambahkan ke bagian "Pertanyaan Terbuka" dan tanyakan.

---

## 1. Tujuan

Sistem web untuk **mencatat dan melacak (tracking) kas operasional DPBJ Universitas Indonesia**:
pengajuan biaya **Konsumsi** (rapat) dan **Transport** (Rumah Tangga & Perjadin), kelengkapan
berkasnya, **pemeriksaan berkas oleh PUM**, penerusan ke **MDK (di luar sistem)**, input **No. Invoice MDK**
oleh PUM hingga **selesai (paid)**, notifikasi otomatis, serta **rekap & laporan PDF/Excel**.

Prioritas: data akurat → alur jelas → mudah dipakai → tampilan modern (liquid glass, kuning–biru dongker UI).

## 2. Glosarium

| Istilah | Arti dalam sistem |
|---|---|
| Pengajuan | Satu catatan biaya (Konsumsi / Transport RT / Transport Perjadin) |
| Kategori | `konsumsi`, `rumah_tangga`, `perjadin` (dua terakhir = jenis Transport) |
| KO / LS | Dropdown mekanisme pembayaran, disimpan apa adanya `KO` / `LS` (kepanjangan belum dikonfirmasi — lihat §12) |
| Operator / Pengaju | Pembuat pengajuan: mengisi data, mengunggah berkas, mengajukan ke PUM |
| PUM | Pemeriksa di dalam sistem: mencentang berkas, mengembalikan, meneruskan ke MDK, menginput No. Invoice MDK |
| MDK | Pihak **di luar sistem** yang menerbitkan invoice. Tidak punya akun & tidak ada tampilan input untuk MDK |
| Pimpinan | Pemantau (hanya lihat): dashboard, daftar, detail, rekap & laporan |
| Centang berkas | Hasil pemeriksaan PUM per berkas wajib: `sesuai` atau `revisi` (+ catatan) — tabel `cek_berkas` |
| Project Hosting / Task Name | Dua isian teks bebas (opsional, maks. 150) yang diisi PUM saat/ setelah meneruskan ke MDK |
| Pegawai | Master data orang (punya `id` sendiri) → dipakai untuk "Uang siapa" & peserta transport, agar bisa **direkap per orang** |
| Peserta | Orang yang menerima nilai uang pada pengajuan transport (maks. 2) |
| Berkas | Dokumen unggahan (PDF/gambar/Office) per jenis kelengkapan |
| N/A berkas | Berkas wajib yang ditandai "tidak diperlukan" oleh pengaju (dianggap terpenuhi; tetap dicentang PUM) |
| Notifikasi | Pemberitahuan otomatis di aplikasi (lonceng + toast) — tabel `notifikasi` |

## 3. Aturan Bisnis per Kategori (dari kebutuhan pemilik project)

### 3.1 Konsumsi (kode `KSM-YYYY-NNNN`)
Field: nama kegiatan*, tanggal kegiatan*, jumlah orang* (≥1), jumlah uang yang digunakan* (Rp > 0),
uang siapa* (pilih Pegawai), mekanisme* `KO`/`LS`, catatan (opsional).
Berkas wajib: **Notula, Undangan, Invoice, Daftar Hadir**. Berkas tambahan: **Dokumen Lainnya** (bebas, banyak, beri nama).
(Kunci internal Notula tetap `notulen` — sudah tersimpan di DB/API; yang diubah hanya label tampilnya.)
`total` = jumlah uang yang digunakan. Ditampilkan juga "biaya per orang" (total ÷ jumlah orang) — informasi saja.

### 3.2 Transport — Rumah Tangga (kode `TRT-YYYY-NNNN`)
Field: tanggal kegiatan*, nama kegiatan*, lokasi tujuan*, mekanisme* `KO`/`LS`, catatan,
**peserta**: 1–2 orang, masing-masing `{ pegawai, nilai uang }` (nilai > 0, pegawai tidak boleh dobel).
`jumlah_orang` = jumlah peserta (dihitung otomatis). `total` = **SUM nilai peserta** (dihitung server).
Berkas wajib: **Surat Tugas, Laporan Kegiatan**.

### 3.3 Transport — Perjadin (kode `TPD-YYYY-NNNN`)
Semua field Rumah Tangga **+** lama kegiatan **dari*** & **sampai*** (sampai ≥ dari),
jenis uang* `Uang Harian`/`Uang Transport`, jenis transport* `Dalam Kota`/`Luar Kota`.
`tanggal_kegiatan` = tanggal **dari**; `tanggal_selesai` = **sampai**; lama (hari) = selisih + 1.
Berkas wajib: **Surat Tugas, Laporan Kegiatan, Invoice Hotel, Invoice Tiket**.

### 3.4 Aturan umum
- Uang disimpan sebagai **INTEGER Rupiah** (tanpa desimal). Maks. Rp 1.000.000.000.000.
- Tanggal disimpan `YYYY-MM-DD`; timestamp ISO-8601 UTC (dibuat di JS, bukan `datetime('now')`).
- Konstanta maks peserta: `MAX_PESERTA_TRANSPORT = 2` di `shared/constants.ts`.
- Validasi **otoritatif di server** (`shared/validation.ts` dipakai server & client, pesan berbahasa Indonesia).

## 4. Alur (Workflow) & Status

```
 Operator: Buat ──► DRAFT ──(lengkapi data + unggah berkas)──► Ajukan ke PUM ──► DIAJUKAN KE PUM
                      ▲                                                            │
                      └────────── Tarik kembali (operator, selama masih di PUM) ◄──┤
                                                                                   │
   PUM: centang tiap berkas wajib  [Sesuai] / [Perlu revisi + catatan]             │
   PUM: Kembalikan (alasan wajib) ──► DIKEMBALIKAN ──(operator perbaiki)──► Ajukan ulang ke PUM
   PUM: Teruskan ke MDK (hanya bila SEMUA berkas wajib dicentang sesuai;
        isi Project Hosting & Task Name — opsional) ──► DIAJUKAN KE MDK   (MDK di luar sistem)
   PUM: Input No. Invoice dari MDK + tanggal ──► SELESAI (PAID)
   PUM: Ubah data invoice (tetap SELESAI) · Batalkan selesai (alasan wajib) ──► DIAJUKAN KE MDK
   PUM: dari DIAJUKAN KE MDK masih boleh Kembalikan ke pengaju (mis. ditolak MDK)
```

| Status (`status`) | Label UI | Arti | Bisa diedit pengaju? |
|---|---|---|---|
| `draft` | Draft | Disimpan, belum diajukan. **Tidak terlihat oleh PUM & pimpinan** | Ya |
| `diajukan_pum` | Diajukan ke PUM | Menunggu pemeriksaan/centang berkas PUM | Tidak (boleh **tarik kembali**) |
| `dikembalikan` | Dikembalikan | PUM minta revisi (`catatan_pum` + catatan per berkas) | Ya |
| `diajukan_mdk` | Diajukan ke MDK | Diverifikasi PUM & diteruskan ke MDK, menunggu invoice | Tidak |
| `selesai` | Selesai (Paid) | PUM sudah menginput **No. Invoice MDK** | Tidak |

Aturan centang berkas (`cek_berkas`):
- Hanya PUM/admin, hanya saat status `diajukan_pum`, hanya jenis berkas **wajib** kategori tsb.
- `revisi` wajib catatan (3–500 karakter); `null` = batalkan centang.
- **Mengunggah/menghapus berkas atau mengubah tanda N/A suatu jenis menghapus centangnya** (harus diperiksa ulang).
  Centang jenis lain tetap tersimpan saat dikembalikan & diajukan ulang.
- Berkas wajib tanpa file boleh dicentang sesuai (berkas fisik) — UI memberi peringatan.
- Mengajukan dengan berkas belum lengkap **diperbolehkan dengan konfirmasi** (berkas fisik kadang menyusul).
- Setiap aksi dicatat di tabel `riwayat` (audit trail + timeline + aktivitas dashboard).
- Draft/dikembalikan boleh dihapus (operator/admin); penghapusan tetap tercatat di `riwayat` (kode disimpan).

Notifikasi otomatis (in-app; **tanpa email/WA**):

| Kejadian | Penerima |
|---|---|
| Diajukan / diajukan ulang ke PUM | Semua PUM aktif (bila tidak ada PUM aktif → admin) |
| Dikembalikan (berisi alasan + daftar berkas revisi) | Pembuat pengajuan (bila nonaktif → semua operator aktif) |
| Diteruskan ke MDK · Selesai (paid) · Selesai dibatalkan | Pembuat pengajuan (aturan sama) |

Pelaku aksi tidak menerima notifikasinya sendiri. UI: lonceng + jumlah belum dibaca (polling 30 detik), toast saat ada
notifikasi baru, ringkasan "n notifikasi belum dibaca" sekali per tab setelah login, membuka detail pengajuan
otomatis menandai notifikasi pengajuan itu dibaca. Pimpinan tidak menerima notifikasi (lonceng disembunyikan).

## 5. Peran & Hak Akses

| Aksi | operator | pum | pimpinan | admin |
|---|---|---|---|---|
| Lihat pengajuan non-draft, dashboard, rekap, unduh PDF/Excel | ✓ | ✓ | ✓ | ✓ |
| Lihat draft | ✓ | ✗ | ✗ | ✓ |
| Buat / edit / hapus (draft & dikembalikan) | ✓ | ✗ | ✗ | ✓ |
| Unggah / hapus berkas, tandai N/A (draft & dikembalikan) | ✓ | ✗ | ✗ | ✓ |
| Ajukan / ajukan ulang ke PUM / tarik kembali | ✓ | ✗ | ✗ | ✓ |
| Halaman **Verifikasi PUM**, centang berkas, kembalikan, teruskan ke MDK | ✗ | ✓ | ✗ | ✓ |
| Isi/ubah Project Hosting & Task Name (diajukan_pum, diajukan_mdk, selesai) | ✗ | ✓ | ✗ | ✓ |
| Input / ubah No. Invoice MDK, batalkan selesai | ✗ | ✓ | ✗ | ✓ |
| Master Pegawai: lihat | ✓ | ✓ | ✓ | ✓ |
| Master Pegawai: tambah/ubah | ✓ | ✗ | ✗ | ✓ |
| Master Pegawai: hapus (hanya jika belum dipakai) / nonaktifkan | ✗ | ✗ | ✗ | ✓ |
| Kelola Pengguna | ✗ | ✗ | ✗ | ✓ |

Konstanta peran: `ROLE_LIHAT_DRAFT`, `ROLE_PENGAJU` (`operator`,`admin`), `ROLE_PUM` (`pum`,`admin`) di `shared/constants.ts`.
Keputusan: semua operator boleh mengedit pengajuan draft/dikembalikan milik siapa pun (tim kecil;
akuntabilitas lewat `riwayat`). Bisa diperketat menjadi "hanya pembuat" bila diminta.

## 6. Model Data (SQLite, `server/db.ts`, versi skema via `PRAGMA user_version`)

Skema saat ini **v2** (migrasi otomatis saat server start; v1→v2 membangun ulang `users` & `pengajuan`:
peran `mdk`→`pum`, status `diajukan`→`diajukan_pum`, `catatan_mdk`→`catatan_pum`; urutan AUTOINCREMENT dipertahankan;
diuji di `tests/api/migrasi.test.ts`).

- `users` (id, username unik, nama, role `operator|pum|pimpinan|admin`, password_hash scrypt, aktif)
- `sessions` (token_hash sha256, user_id, expires_at) — cookie httpOnly `kas_sid`, 7 hari
- `pegawai` (id, nama, nip opsional unik, jabatan, aktif)
- `kode_counter` (prefix, tahun, last) — nomor urut kode pengajuan, tidak pernah dipakai ulang
- `pengajuan` (kode, kategori, nama_kegiatan, tanggal_kegiatan, tanggal_selesai, jumlah_orang,
  lokasi_tujuan, mekanisme, jenis_uang, jenis_transport, uang_siapa_id→pegawai, total, catatan,
  berkas_na (JSON array), berkas_terpenuhi/berkas_wajib (denormalisasi), status,
  no_invoice_mdk, tanggal_invoice_mdk, **catatan_pum** (alasan pengembalian / catatan teruskan / catatan invoice — terakhir),
  **project_hosting, task_name**, created_by, updated_by, diajukan_at,
  **diteruskan_by, diteruskan_at** (teruskan ke MDK), diproses_by/diproses_at (dikembalikan atau invoice diinput),
  created_at, updated_at)
- `pengajuan_peserta` (pengajuan_id, pegawai_id, nilai, urutan) — UNIQUE(pengajuan_id, pegawai_id)
- `berkas` (pengajuan_id, jenis, nama_berkas, nama_asli, nama_file acak, mime, ukuran, uploaded_by)
- `cek_berkas` (pengajuan_id, jenis, status `sesuai|revisi`, catatan, diperiksa_by, diperiksa_at) — PK(pengajuan_id, jenis)
- `notifikasi` (user_id, pengajuan_id NULL-able, kode, jenis, judul, pesan, dibaca_at, created_at)
- `riwayat` (pengajuan_id NULL-able, kode, user_id, aksi, keterangan, created_at)

`berkas_sesuai` (jumlah centang sesuai) dihitung lewat subquery di `SELECT_PENGAJUAN`.
Rekap per pegawai = Konsumsi (via `uang_siapa_id`, nilai = total) **+** Transport (via peserta, nilai per orang).
Jumlah seluruh rekap per pegawai = jumlah total seluruh pengajuan (konsisten, diuji di test).

## 7. Tech Stack

- **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Tailwind CSS v4 (`@tailwindcss/vite`) +
  Motion 14 (`motion/react`) + Recharts 3 + TanStack Query 5 + React Router 8 (mode deklaratif,
  import dari `react-router`) + Radix UI (`radix-ui`) + lucide-react + sonner + date-fns (locale `id`) +
  jsPDF 4 + jspdf-autotable 5 (PDF dibuat di browser, di-*lazy load*).
- **Backend**: Node ≥ 22.22 (dev: Node 26) + Express 5 + **`node:sqlite` bawaan** (tanpa modul native)
  + multer 2 (upload) + tsx (menjalankan TypeScript).
- **Test**: Vitest 5 (+ supertest untuk API, jsdom + Testing Library untuk komponen) dan Playwright (E2E).
- **Ekspor Excel**: penulis `.xlsx` minimal sendiri (`src/lib/xlsx.ts`, zip via `fflate`) — angka disimpan sebagai angka.
  (CSV sengaja tidak dipakai: Excel berlokal Indonesia memakai `;` sehingga CSV sering rusak kolomnya.)

## 8. Struktur Folder

```
shared/        konstanta, tipe, validasi, format, kelengkapan (dipakai server & client — tanpa API DOM/Node)
server/        Express API: app.ts (createApp), db.ts (migrasi), auth.ts, routes/*, services/*, seed.ts, scripts/*
src/           React app: components/(ui|layout|pengajuan|dashboard), pages/, context/, hooks/,
               lib/ (api, queries, pdf/laporan, xlsx, periode)
tests/         api/*.test.ts (Vitest+supertest, DB in-memory), unit/*.test.ts, e2e/*.spec.ts (Playwright)
               src/**/*.test.tsx = test komponen (jsdom)
data/          (gitignored) kas-dpbj.db + uploads/ — dibuat otomatis; data/e2e/ khusus E2E
docs/          PANDUAN-UJI-MANUAL.md
```

Endpoint alur (semua `/api/pengajuan/:id/...`): `POST ajukan`, `POST tarik`, `PUT cek-berkas` {jenis, status, catatan},
`POST kembalikan` {catatan}, `POST teruskan` {project_hosting, task_name, catatan}, `PUT data-pum`,
`POST selesai` & `PUT invoice` {no_invoice_mdk, tanggal_invoice_mdk, catatan}, `POST batal-selesai` {catatan}.
Lainnya: `GET /api/pengajuan/saran-pum` (saran isian project/task), `GET /api/notifikasi`, `POST /api/notifikasi/baca` {id?}.

## 9. Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | API (port **5211**) + Web Vite (port **5210**) → buka http://localhost:5210 |
| `npm run dev:lan` | Sama, tetapi web dapat diakses dari perangkat lain di jaringan (uji di ponsel) |
| `jalankan.bat` | (Windows) install bila perlu + `npm run dev` + buka browser |
| `npm run build` | typecheck + build frontend ke `dist/` |
| `npm start` | Produksi: API + frontend hasil build di http://localhost:5211 |
| `npm test` | Unit + integrasi API + komponen (Vitest) |
| `npm run test:e2e` | Build + Playwright E2E (server uji port 5212, DB terpisah `data/e2e/`) |
| `npm run typecheck` | Cek tipe frontend, server, dan test E2E |
| `npm run db:seed` | **Reset** DB + isi data demo |
| `npm run db:reset` | **Reset** DB kosong (hanya akun admin) — untuk mulai pakai sungguhan |

Hentikan server sebelum `db:seed`/`db:reset` (di Windows file DB terkunci). `concurrently -k` di `npm run dev`
mematikan kedua proses saat Ctrl+C.

### Pengujian — aturan

- Test API memakai `buatKonteks()` (`tests/api/helpers.ts`): DB `:memory:` + folder upload sementara per test.
  Data demo di test memakai tanggal acuan tetap 6 Okt tahun berjalan. `masuk(ctx, 'operator'|'pum'|'pimpinan'|'admin')`.
- Fixture E2E (`tests/e2e/fixtures.ts`) **menggagalkan test bila ada `console.error`/error JS** di browser.
  Respons 4xx yang disengaja ikut tercatat browser sebagai error → kosongkan `galat` setelahnya.
- Kait test di UI: `data-berkas="<jenis>"` + `data-keadaan="ada|na|kosong"` + `data-cek="sesuai|revisi|belum"` pada baris
  berkas; `data-kode` pada kartu Verifikasi PUM; `data-testid="kartu-pum" | "aksi-pum" | "catatan-pengembalian"`;
  id stabil pada input form (mis. `#peserta-0-nilai`, `#uang_siapa_id`, `#no_invoice_mdk`).
- Playwright `getByLabel(..., { exact: true })` ikut menghitung tanda `*` wajib → pakai `getByRole('textbox', { name })` atau id.
  Input dengan `list` (datalist) berperan `combobox`, bukan `textbox`.

Env opsional: `PORT`, `KAS_DB_PATH`, `KAS_UPLOAD_DIR`, `KAS_SEED` (`demo`|`minimal`, dipakai saat DB kosong),
`COOKIE_SECURE=true` (jika di belakang HTTPS).

Akun demo (`db:seed`): `operator/operator123`, `pum/pum123`, `pimpinan/pimpinan123`, `admin/admin123`.
**Ganti password sebelum produksi.**

## 10. Desain UI

- Tema: **kuning UI `#FFD100`** (aksen/CTA, teks di atasnya navy) + **biru dongker `#0A1A3F`** (brand/teks).
  Light & dark mode (token CSS di `src/index.css`, kelas `.dark` di `<html>`).
- Gaya **liquid glass**: kelas `.glass` (backdrop blur + saturate, highlight specular, border gradien),
  latar gradien bergerak (blob) agar efek kaca terlihat. Hormati `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- Font: Plus Jakarta Sans Variable (offline via @fontsource).
- Warna seri chart (tervalidasi skrip dataviz, all-pairs, light & dark):
  Konsumsi `#eda100`/`#c98500`, Rumah Tangga `#2a78d6`/`#3987e5`, Perjadin `#1baf7a`/`#199e70` (light/dark).
  Kontras < 3:1 di light → wajib ada legenda + tampilan tabel (sudah ada). Teks tidak pernah memakai warna seri.
- Status selalu **ikon + label** (bukan warna saja): Draft (abu), Diajukan ke PUM (biru), Dikembalikan (amber),
  Diajukan ke MDK (ungu), Selesai (Paid) (hijau). Bahasa UI: **Indonesia**.
- Tampilan per peran: menu & tombol aksi hanya muncul untuk peran yang berhak (lihat §5); pimpinan baca-saja.
- Toast (sonner) di **tengah atas, di bawah topbar** — tidak menutupi lonceng/menu akun, tombol aksi halaman (kanan),
  atau bar simpan form (bawah). Hindari toast sukses untuk aksi yang perubahannya sudah terlihat (mis. centang berkas).

## 11. Konvensi Kode

- TypeScript strict. Nama domain berbahasa Indonesia (`pengajuan`, `pegawai`, `berkas`), sama di DB/API/UI.
- SQL **selalu** parameter `?` (tidak ada interpolasi string nilai). `node:sqlite` tidak menerima `boolean`/`undefined` → konversi ke `0/1`/`null`.
- API JSON: sukses → objek data; gagal → `{ message, errors? }` + status HTTP yang tepat (400/401/403/404/409/413).
- Setiap perubahan status/data pengajuan **wajib** menulis `riwayat`; perubahan status yang menyangkut pihak lain
  **wajib** mengirim notifikasi (`kirimNotifikasi`).
- Teks PDF disanitasi ke Latin-1 (`src/lib/pdf/`), karena font standar jsPDF.
- Grid responsif selalu diberi kolom dasar eksplisit (`grid-cols-1 sm:grid-cols-2 …`) — tanpa itu item
  ber-teks `nowrap` melebarkan halaman di ponsel (overflow horizontal).
- Ikon/prefiks di dalam input (`absolute`) wajib `z-10`: `.kontrol` memakai `backdrop-filter` sehingga menutupi elemen sebelumnya.
- Angka beranimasi (`AnimatedNumber`) memakai tween berdurasi tetap agar selalu berhenti tepat di nilai akhir.
- Warna chart untuk atribut SVG diambil dari `src/components/dashboard/palet.ts` (nilai sama dengan token CSS).
- Perubahan skema DB = tambah elemen baru di `MIGRASI` (`server/db.ts`), jangan ubah migrasi lama; uji di `migrasi.test.ts`.
- Setelah mengubah aturan bisnis: perbarui `shared/`, test API, dan dokumen ini.

## 11a. Keputusan Teknis yang Sudah Diambil

- `GET /api/auth/me` selalu 200: `{ user: null }` bila belum login (cek sesi tidak memunculkan error 401 di konsol).
  Endpoint lain tetap 401 bila sesi tidak ada/kedaluwarsa; frontend lalu kembali ke halaman login.
- Upload: whitelist ekstensi + verifikasi tanda tangan byte (PDF/PNG/JPG/WEBP/DOCX/XLSX/DOC/XLS), maks. 10 MB,
  nama file disimpan acak (UUID); MIME saat diunduh ditentukan server dari ekstensi, `X-Content-Type-Options: nosniff`.
- Login: hash scrypt, token sesi acak (disimpan sebagai sha256), pembatas percobaan (10 gagal / 15 menit / IP+username).
- Rekap default = semua status **kecuali draft**; PUM & pimpinan tidak pernah melihat draft (daftar, detail, rekap, dashboard).
- Data demo: tanggal relatif terhadap hari ini (±11 bulan ke belakang), waktu aktivitas di jam kerja (Sen–Jum 08.00–16.30).
- PegawaiPicker tidak menawarkan "Tambah … sebagai pegawai baru" bila nama persis sudah terdaftar; pegawai yang sudah
  dipilih di baris lain diberi keterangan "sudah dipilih di baris lain".

## 12. Pertanyaan Terbuka (asumsi saat ini — mohon dikonfirmasi pemilik project)

1. Kepanjangan **KO / LS**, **PUM**, dan **MDK** (saat ini hanya ditampilkan singkatannya).
2. Apakah "Uang Harian / Uang Transport" untuk Perjadin cukup **satu pilihan per pengajuan** (saat ini begitu),
   atau perlu dua nilai terpisah per orang?
3. Batas **maks. 2 orang** saat ini berlaku untuk Rumah Tangga **dan** Perjadin ("field sama seperti sebelumnya").
4. Format resmi **No. Invoice MDK** (saat ini teks bebas, maks. 100 karakter, unik tidak diwajibkan).
5. Apakah pengajuan wajib berkas lengkap sebelum diajukan (saat ini: boleh dengan peringatan).
6. Logo resmi: ganti `public/logo.svg` dengan logo UI/DPBJ resmi bila diizinkan.
7. **Project Hosting & Task Name**: diasumsikan dua isian teks bebas opsional milik PUM (diisi saat meneruskan ke MDK,
   bisa diubah setelahnya; ada saran dari nilai yang pernah dipakai), tampil di detail, Excel & PDF. Perlu daftar
   pilihan baku / wajib diisi?
8. **Teruskan ke MDK** diasumsikan hanya boleh bila **semua berkas wajib dicentang sesuai**. Benar?
9. **Notifikasi** saat ini hanya di dalam aplikasi (lonceng + toast). Perlu email/WhatsApp? Perlu notifikasi untuk pimpinan?
10. **Pimpinan** diasumsikan hanya memantau (tanpa aksi & tanpa melihat draft). Perlu persetujuan pimpinan di alur?
11. Data lama (sebelum revisi) dimigrasikan: akun `mdk` → `pum`, status `diajukan` → `diajukan_pum`, pengajuan
    `selesai` lama tidak punya centang berkas/project/task.
