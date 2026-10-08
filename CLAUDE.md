# CLAUDE.md — Acuan Project Kas Operasional DPBJ UI

Dokumen ini adalah **sumber kebenaran** project. Baca dulu sebelum mengubah apa pun.
Jika ada permintaan yang bertentangan dengan dokumen ini, konfirmasi ke pemilik project,
lalu perbarui dokumen ini. **Jangan menebak** aturan bisnis yang tidak tertulis di sini —
tambahkan ke bagian "Pertanyaan Terbuka" dan tanyakan.

---

## 1. Tujuan

Sistem web untuk **mencatat dan melacak (tracking) kas operasional DPBJ Universitas Indonesia**:
pengajuan biaya **Konsumsi** (rapat) dan **Transport** (Rumah Tangga & Perjadin), kelengkapan
berkasnya, **pemeriksaan & verifikasi berkas oleh PUM**, pengajuan ke **MDK (di luar sistem)** dengan input
**No. Invoice MDK** oleh PUM, hingga PUM menandai **selesai (paid)** setelah proses MDK selesai, notifikasi otomatis,
serta **rekap & laporan PDF/Excel**.

Prioritas: data akurat → alur jelas → mudah dipakai → tampilan modern (liquid glass, kuning–biru dongker UI).

## 2. Glosarium

| Istilah | Arti dalam sistem |
|---|---|
| Pengajuan | Satu catatan biaya (Konsumsi / Transport RT / Transport Perjadin) |
| Kategori | `konsumsi`, `rumah_tangga`, `perjadin` (dua terakhir = jenis Transport) |
| KO / LS | Dropdown mekanisme pembayaran, disimpan apa adanya `KO` / `LS` (kepanjangan belum dikonfirmasi — lihat §12) |
| Operator / Pengaju | Pembuat pengajuan: mengisi data, mengunggah berkas, mengajukan ke PUM |
| PUM | Pemeriksa di dalam sistem: mencentang berkas, mengembalikan, **memverifikasi**, menginput No. Invoice MDK (= mengajukan ke MDK), menekan **Selesai** setelah proses MDK selesai |
| MDK | Pihak **di luar sistem** yang memverifikasi & membayar pengajuan yang invoice-nya diinput PUM. Tidak punya akun & tidak ada tampilan input untuk MDK |
| Verifikasi PUM | Persetujuan PUM setelah semua berkas wajib dicentang sesuai → status `diverifikasi_pum` (label "Diverifikasi PUM"; tahap stepper "Verifikasi PUM") |
| Pimpinan | Pemantau (hanya lihat): dashboard, daftar, detail, rekap & laporan |
| Centang berkas | Hasil pemeriksaan PUM per berkas wajib: `sesuai` atau `revisi` (+ catatan) — tabel `cek_berkas` |
| Project Costing / Task Name | Dua isian (opsional, maks. 150; kolom/API tetap `project_hosting` & `task_name`) yang diisi PUM saat/setelah verifikasi. Dipilih lewat kotak cari dari **master Kasubdit** (`shared/project-task.ts`): project `<kode>:<nama>`, task `<kode>_<nama>`; teks lain tetap diterima |
| Rekening | Bank & No. Rekening milik "uang siapa" (konsumsi, opsional) — tujuan pembayaran oleh PUM |
| Sudah dibayarkan | Tanda PUM bahwa uang konsumsi sudah dibayarkan ke pemilik uang (`dibayar_at`/`dibayar_by`) |
| Pegawai | Master data orang (punya `id` sendiri) → dipakai untuk "Uang siapa" & peserta transport, agar bisa **direkap per orang** |
| Peserta | Orang yang menerima nilai uang pada pengajuan transport (maks. 2). Perjadin: uang harian + uang transport per orang |
| Berkas | Dokumen unggahan (PDF/gambar/Office) per jenis kelengkapan |
| N/A berkas | Berkas wajib yang ditandai "tidak diperlukan" oleh pengaju (dianggap terpenuhi; tetap dicentang PUM) |
| Notifikasi | Pemberitahuan otomatis di aplikasi (lonceng + toast) — tabel `notifikasi` |

## 3. Aturan Bisnis per Kategori (dari kebutuhan pemilik project)

### 3.1 Konsumsi (kode `KSM-YYYY-NNNN`)
Field: nama kegiatan*, tanggal kegiatan*, **jenis konsumsi*** (`kudapan` | `makan_siang` | `kudapan_makan_siang` —
label "Kudapan", "Makan Siang", "Kudapan + Makan Siang"), jumlah orang* (≥1), jumlah uang yang digunakan* (Rp > 0),
uang siapa* (pilih Pegawai), **rekening uang siapa** (opsional: `rekening_bank` 2–60 karakter + `rekening_nomor` 5–30 digit,
wajib berpasangan; spasi/titik/strip pada nomor dibuang), mekanisme* `KO`/`LS`, catatan (opsional).
Catatan tetap di form & detail: "Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening."
(`CATATAN_BIAYA_TRANSFER`; ditonjolkan bila bank bukan Mandiri — `isBankMandiri`). Jenis konsumsi & rekening selalu `null`
untuk transport; pengajuan lama boleh `null` (jenis wajib dipilih saat diedit). Perubahan jenis/rekening tercatat di riwayat `diubah`.
**Sudah dibayarkan**: tombol PUM/admin di dekat nama "uang siapa" (status `diajukan_pum`, `diverifikasi_pum`, `diajukan_mdk`, `selesai`;
boleh tanpa rekening, mis. tunai) → `dibayar_at`, `dibayar_by`, riwayat `dibayarkan` + notifikasi ke pengaju.
Bisa dibatalkan (riwayat `dibayarkan_batal`, tanpa notifikasi). Tanda tetap tersimpan bila pengajuan kemudian dikembalikan.
Berkas wajib: **Notula, Undangan, Invoice, Daftar Hadir**. Berkas tambahan: **Dokumen Lainnya** (bebas, banyak, beri nama).
(Kunci internal Notula tetap `notulen` — sudah tersimpan di DB/API; yang diubah hanya label tampilnya.)
`total` = jumlah uang yang digunakan. Ditampilkan juga "biaya per orang" (total ÷ jumlah orang) — informasi saja.

### 3.2 Transport — Rumah Tangga (kode `TRT-YYYY-NNNN`)
Field: tanggal kegiatan*, nama kegiatan*, lokasi tujuan*, mekanisme* `KO`/`LS`, catatan,
**peserta**: 1–2 orang, masing-masing `{ pegawai, nilai uang }` (nilai > 0, pegawai tidak boleh dobel).
`jumlah_orang` = jumlah peserta (dihitung otomatis). `total` = **SUM nilai peserta** (dihitung server).
Berkas wajib: **Surat Tugas, Laporan Kegiatan**.

### 3.3 Transport — Perjadin (kode `TPD-YYYY-NNNN`)
Semua field Rumah Tangga **+** lama kegiatan **dari*** & **sampai*** (sampai ≥ dari), jenis transport* `Dalam Kota`/`Luar Kota`
(di samping Mekanisme). **Tanpa "jenis uang"**: tiap orang mengisi **uang harian** dan **uang transport** (Rp ≥ 0, kosong = 0,
minimal salah satu > 0); `nilai` per orang = uang harian + uang transport (dihitung server). Kolom `pengajuan.jenis_uang`
hanya data lama (simpanan baru selalu `null`); migrasi menyalin nilai lama ke kolom sesuai jenis uangnya.
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
   PUM: Verifikasi (hanya bila SEMUA berkas wajib dicentang sesuai;
        isi Project Costing & Task Name — opsional) ──► DIVERIFIKASI PUM
   PUM: Input No. Invoice MDK + tanggal ──► DIAJUKAN KE MDK   (menunggu verifikasi MDK, di luar sistem)
   PUM: Selesai (setelah proses di MDK selesai) ──► SELESAI (PAID)
   PUM: Ubah data invoice (DIAJUKAN KE MDK / SELESAI) · Batalkan selesai (alasan wajib) ──► DIAJUKAN KE MDK
   PUM: dari DIVERIFIKASI PUM / DIAJUKAN KE MDK masih boleh Kembalikan ke pengaju (mis. ditolak MDK;
        No. Invoice lama dihapus & dicatat di riwayat)
```

Stepper detail (5 tahap, label persis permintaan pemilik project, Okt 2026):
**Draft dibuat → Diajukan ke PUM → Verifikasi PUM → Diajukan ke MDK → Paid**. Tahap berjalan = status saat ini
(`aria-current="step"`); dikembalikan = tahap 2 berwarna amber "Dikembalikan PUM".

| Status (`status`) | Label UI | Arti | Bisa diedit pengaju? |
|---|---|---|---|
| `draft` | Draft | Disimpan, belum diajukan. **Tidak terlihat oleh PUM & pimpinan** | Ya |
| `diajukan_pum` | Diajukan ke PUM | Menunggu pemeriksaan/centang berkas PUM | Tidak (boleh **tarik kembali**) |
| `dikembalikan` | Dikembalikan | PUM minta revisi (`catatan_pum` + catatan per berkas) | Ya |
| `diverifikasi_pum` | Diverifikasi PUM | Semua berkas sesuai & diverifikasi PUM, menunggu input No. Invoice MDK | Tidak |
| `diajukan_mdk` | Diajukan ke MDK | PUM sudah menginput **No. Invoice MDK**, menunggu verifikasi MDK (di luar sistem) | Tidak |
| `selesai` | Selesai (Paid) | Proses MDK selesai; PUM menekan **Selesai** | Tidak |

No. Invoice MDK terisi tepat pada status `diajukan_mdk` & `selesai`. Waktu & pelaku per tahap: `diajukan_at`,
`diverifikasi_by/at`, `diajukan_mdk_by/at`, `diproses_by/at` (dikembalikan atau ditandai selesai).
Data lama (alur 4 tahap sebelum Okt 2026, migrasi `2026-10-08-alur-verifikasi-mdk.sql`): "Teruskan ke MDK" = verifikasi
(`diteruskan_by/at` disalin ke `diverifikasi_*`); "Diajukan ke MDK" lama tanpa invoice → `diverifikasi_pum`; pengajuan
Selesai lama tetap Selesai (invoice dulu langsung menjadikan selesai; `diajukan_mdk_*` diisi dari `diproses_*`).

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
| Diverifikasi PUM · Diajukan ke MDK (invoice diinput) · Selesai (paid) · Selesai dibatalkan · Uang konsumsi sudah dibayarkan | Pembuat pengajuan (aturan sama) |

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
| Halaman **Verifikasi PUM**, centang berkas, kembalikan, verifikasi | ✗ | ✓ | ✗ | ✓ |
| Isi/ubah Project Costing & Task Name (diajukan_pum, diverifikasi_pum, diajukan_mdk, selesai) | ✗ | ✓ | ✗ | ✓ |
| Input No. Invoice MDK (ajukan ke MDK), ubah invoice, tandai **Selesai**, batalkan selesai | ✗ | ✓ | ✗ | ✓ |
| Tandai uang konsumsi "sudah dibayarkan" / batalkan | ✗ | ✓ | ✗ | ✓ |
| Master Pegawai: lihat | ✓ | ✓ | ✓ | ✓ |
| Master Pegawai: tambah/ubah | ✓ | ✗ | ✗ | ✓ |
| Master Pegawai: hapus (hanya jika belum dipakai) / nonaktifkan | ✗ | ✗ | ✗ | ✓ |
| Kelola Pengguna, setujui/tolak pendaftaran | ✗ | ✗ | ✗ | ✓ |
| Halaman Pengaturan (tema warna, info akun, ganti password) | ✓ | ✓ | ✓ | ✓ |

**Pendaftaran mandiri** (`/daftar`): akun baru dibuat `aktif=false`, `menunggu_persetujuan=true`, peran sementara
`operator`; admin dinotifikasi (`jenis=registrasi`, badge di menu Pengguna), lalu **Setujui** (pilih peran → aktif) atau
**Tolak** (profil & akun Supabase Auth dihapus). Pendaftar tidak memilih peran sendiri. Email yang sudah punya akun
Supabase Auth hanya bisa didaftarkan dengan password akun itu.

Konstanta peran: `ROLE_LIHAT_DRAFT`, `ROLE_PENGAJU` (`operator`,`admin`), `ROLE_PUM` (`pum`,`admin`) di `shared/constants.ts`.
Keputusan: semua operator boleh mengedit pengajuan draft/dikembalikan milik siapa pun (tim kecil;
akuntabilitas lewat `riwayat`). Bisa diperketat menjadi "hanya pembuat" bila diminta.

## 6. Model Data (PostgreSQL di Supabase — `supabase/schema.sql`)

Skema lengkap untuk database baru ada di `supabase/schema.sql` (menolak berjalan bila tabel sudah berisi data).
Perubahan skema berikutnya = **file baru di `supabase/migrasi/`** (idempoten, hanya menambah), lalu perbarui
`schema.sql` juga dan terapkan ke Supabase **sebelum** kode yang memakainya di-deploy.

- `users` (id, `auth_id` → auth.users, username = **email** unik huruf kecil, nama, role
  `operator|pum|pimpinan|admin`, aktif, `menunggu_persetujuan`) — **tanpa password**: password dikelola Supabase Auth.
- `sessions` (token_hash sha256, user_id, expires_at) — cookie httpOnly `kas_sid`, 7 hari (Secure di Vercel)
- `pegawai` (id, nama, nip opsional unik, jabatan, aktif)
- `kode_counter` (prefix, tahun, terakhir) — nomor urut kode pengajuan, tidak pernah dipakai ulang
- `pengajuan` (kode, kategori, nama_kegiatan, tanggal_kegiatan DATE, tanggal_selesai, jumlah_orang,
  lokasi_tujuan, mekanisme, jenis_uang (data lama), jenis_transport, **jenis_konsumsi**, uang_siapa_id→pegawai,
  **rekening_bank, rekening_nomor, dibayar_at, dibayar_by**→users, total BIGINT, catatan,
  berkas_na JSONB, berkas_terpenuhi/berkas_wajib (denormalisasi), status, no_invoice_mdk, tanggal_invoice_mdk,
  catatan_pum, project_hosting, task_name, created_by, updated_by, diajukan_at, **diverifikasi_by/at, diajukan_mdk_by/at**,
  diproses_by/at (dikembalikan / selesai), diteruskan_by/at (data lama), …)
- `pengajuan_peserta` (pengajuan_id, pegawai_id, nilai, **uang_harian, uang_transport** (Perjadin; Rumah Tangga `null`), urutan)
  — UNIQUE(pengajuan_id, pegawai_id)
- `berkas` (pengajuan_id, jenis, nama_berkas, nama_asli, **nama_file = kunci objek Storage** `<pengajuan_id>/<uuid>.<ext>`,
  mime, ukuran, uploaded_by)
- `cek_berkas` (pengajuan_id, jenis, status `sesuai|revisi`, catatan, diperiksa_by, diperiksa_at) — PK(pengajuan_id, jenis)
- `notifikasi` (user_id, pengajuan_id NULL-able, kode, jenis incl. `registrasi`, judul, pesan, dibaca_at)
- `riwayat` (pengajuan_id NULL-able, kode, user_id, aksi enum, keterangan, created_at)
- Enum PostgreSQL mengikuti `shared/constants.ts` persis (aksi riwayat, jenis notifikasi, status, dst.).
- Keamanan: RLS aktif di semua tabel tanpa policy + hak `anon`/`authenticated` dicabut → hanya server (DATABASE_URL)
  yang bisa membaca/menulis. Bucket Storage **`berkas`** privat, maks. 10 MB, MIME sesuai `UPLOAD_DIIZINKAN`.

`berkas_sesuai` (jumlah centang sesuai) dihitung lewat subquery di `SELECT_PENGAJUAN`.
Rekap per pegawai = Konsumsi (via `uang_siapa_id`, nilai = total) **+** Transport (via peserta, nilai per orang).
Jumlah seluruh rekap per pegawai = jumlah total seluruh pengajuan (konsisten, diuji di test).

## 7. Tech Stack

- **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Tailwind CSS v4 (`@tailwindcss/vite`) +
  Motion 14 (`motion/react`) + Recharts 3 + TanStack Query 5 + React Router 8 (import dari `react-router`) +
  Radix UI + lucide-react + sonner + date-fns + jsPDF 4 + jspdf-autotable 5 (PDF dibuat di browser, *lazy load*).
- **Backend**: Express 5 sebagai **fungsi serverless Vercel** (`server/vercel.ts` dibundel esbuild → `api/bundle.mjs`,
  region `syd1` dekat database). Database **PostgreSQL Supabase** lewat `pg` + **Transaction pooler** (IPv4, port 6543).
  Login **Supabase Auth** (verifikasi password), berkas **Supabase Storage** (`@supabase/supabase-js`).
  Lokal: `tsx` menjalankan `server/index.ts`.
- **Test**: Vitest 5 (+ supertest untuk API terhadap PostgreSQL lokal, jsdom + Testing Library untuk komponen) dan
  Playwright (E2E). Supabase Auth/Storage ditiru (`tests/support/palsu.ts`, `tests/e2e/server.ts`).
- **Ekspor Excel**: penulis `.xlsx` minimal sendiri (`src/lib/xlsx.ts`, zip via `fflate`).

## 8. Struktur Folder

```
shared/        konstanta, tipe, validasi, format, kelengkapan, project-task (master Kasubdit) — dipakai server & client
server/        Express API: app.ts (createApp), db-pg.ts, auth.ts (sesi), supabase.ts + providers.ts (Auth/Storage),
               env.ts (baca env toleran), routes/*, services/*, vercel.ts (entry Vercel), index.ts (entry lokal)
api/           bundle.mjs — HASIL BUILD (npm run build), di-commit; satu-satunya fungsi Vercel
supabase/      schema.sql (database baru) + migrasi/*.sql (perubahan bertahap)
src/           React app: components/(ui|layout|pengajuan|dashboard), pages/, context/, hooks/, lib/
tests/         api/*.test.ts, unit/*.test.ts, e2e/*.spec.ts + e2e/server.ts, support/ (pg, palsu, seed-demo)
docs/          PANDUAN-UJI-MANUAL.md
```

Endpoint alur (semua `/api/pengajuan/:id/...`): `POST ajukan`, `POST tarik`, `PUT cek-berkas` {jenis, status, catatan},
`POST kembalikan` {catatan}, `POST verifikasi` {project_hosting, task_name, catatan}, `PUT data-pum`,
`POST ajukan-mdk` & `PUT invoice` {no_invoice_mdk, tanggal_invoice_mdk, catatan}, `POST selesai` (tanpa body),
`POST batal-selesai` {catatan},
`PUT dibayarkan` {dibayarkan: boolean} (konsumsi).
Berkas: `POST berkas/siapkan` {jenis, nama_berkas?, nama_asli, ukuran} → URL unggah bertanda tangan; browser `PUT` file
langsung ke Storage; `POST berkas/konfirmasi` {key, …} (server cek isi & ukuran lalu mencatat). `GET /api/berkas/:id/file`
→ 302 ke URL sementara (`?unduh=1` = attachment dengan nama asli).
Akun: `POST /api/auth/login` {username=email, password}, `POST /api/auth/daftar` {nama, username, password},
`POST /api/users/:id/setujui` {role}, `DELETE /api/users/:id` (tolak pendaftaran). Lainnya: `GET /api/pengajuan/saran-pum`,
`GET /api/notifikasi` (antrian incl. `pendaftar` untuk admin), `POST /api/notifikasi/baca` {id?}, `GET /api/health`
(status database + `peringatan` konfigurasi).

## 9. Perintah & Deploy

| Perintah | Fungsi |
|---|---|
| `npm run dev` | API (port **5211**) + Web Vite (port **5210**) → http://localhost:5210 (butuh `.env`, lihat `.env.example`) |
| `npm run build` | typecheck + build frontend (`dist/`) + bundel server (`api/bundle.mjs`) |
| `npm test` | Vitest: unit + komponen + API (**butuh `TEST_DATABASE_URL`** ke PostgreSQL lokal kosong) |
| `npm run test:e2e` | Build + Playwright E2E (server uji port 5212, PostgreSQL lokal + Supabase tiruan) |
| `npm run typecheck` | Cek tipe frontend & server (E2E: `npx tsc -p tsconfig.e2e.json --noEmit`) |

**Deploy**: push ke `main` di GitHub (`nabill25/Kas-Operaional-DPBJ-UI`) → Vercel (proyek `kas-operaional-dpbj-ui`,
akun Vercel pemilik — bukan akun CLI di laptop ini) membangun otomatis. **Jalankan `npm run build` sebelum commit** agar
`api/bundle.mjs` ikut diperbarui. Perubahan skema: terapkan migrasi ke Supabase dulu, baru push.

**Environment** (lokal `.env`, Vercel → Settings → Environment Variables, centang Production, lalu Redeploy):
`DATABASE_URL` (Transaction pooler `postgres.<ref>@aws-0-ap-southeast-2.pooler.supabase.com:6543`; host
`db.<ref>.supabase.co` hanya IPv6 → otomatis dialihkan), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (atau `VITE_*`),
`SUPABASE_SERVICE_ROLE_KEY` (rahasia; tanpa ini login tetap jalan, tetapi berkas/daftar akun/kelola pengguna mati),
`COOKIE_SECURE`. Nama variabel dibaca tanpa peka huruf besar/kecil. **Jangan pernah commit nilai rahasia.**

**Akun**: tidak ada akun demo di produksi. Login memakai email + password Supabase Auth; profil (peran) di tabel
`users` dibuat admin (menu Pengguna) atau lewat pendaftaran yang disetujui admin.

### Pengujian — aturan

- Test API memakai `await buatKonteks()` (`tests/api/helpers.ts`): satu database PostgreSQL per file test (dari template
  `supabase/schema.sql` + stub `tests/support/supabase-stubs.sql`), dikosongkan tiap test; Auth & Storage tiruan.
  `masuk(ctx, 'operator'|'pum'|'pimpinan'|'admin')` (email `<peran>@dpbj.test`), unggah lewat `unggah(ctx, agent, …)`.
  **Jangan jalankan Vitest bersamaan dengan server E2E** — setup global menghapus database `kas_test_*`.
- Fixture E2E (`tests/e2e/fixtures.ts`) **menggagalkan test bila ada `console.error`/error JS** di browser.
  Respons 4xx yang disengaja ikut tercatat browser sebagai error → kosongkan `galat` setelahnya.
- Kait test di UI: `data-berkas` + `data-keadaan` + `data-cek` (baris berkas), `data-kode` (kartu Verifikasi PUM),
  `data-testid="kartu-pum" | "aksi-pum" | "catatan-pengembalian"`, stepper = list "Tahapan pengajuan" + `aria-current="step"`,
  `data-pendaftar` (baris pendaftar),
  `data-warna-opsi` + `data-terpilih` (tema), `data-jenis-konsumsi` (pilihan jenis konsumsi), `data-testid="uang-siapa"`
  (nama, rekening, tombol "Sudah dibayarkan"), `data-peserta` (rincian per orang di detail),
  id stabil pada input form (mis. `#peserta-0-nilai`, `#peserta-0-uang_harian`, `#peserta-0-uang_transport`,
  `#uang_siapa_id`, `#rekening_bank`, `#rekening_nomor`, `#jenis_konsumsi`). Kotak cari Project/Task:
  combobox berlabel "Project Costing"/"Task Name", kotak pencarian "Cari project"/"Cari task".
- Playwright `getByLabel(..., { exact: true })` ikut menghitung tanda `*` wajib → pakai `getByRole('textbox', { name })` atau id.

## 10. Desain UI

- **Tema warna** (halaman Pengaturan, per perangkat, `localStorage kas-warna`, atribut `data-warna` di `<html>`):
  `dpbj` (bawaan) = biru dongker `#0A1A3F` + kuning `#FFD100`; `ui` = **kuning resmi UI `#F6DB00`** (Pantone 109 C,
  pedoman logo UI) + hitam arang. Tema menimpa palet `--color-kuning-*`/`--color-navy-*` & token semantik di `index.css`;
  setiap variabel di blok terang sebuah tema wajib diulang di blok gelapnya. Terpisah dari mode terang/gelap
  (kelas `.dark`). Warna kategori chart & status **tidak** ikut tema (bermakna data).
- Gaya **liquid glass**: kelas `.glass` (backdrop blur + saturate, highlight specular, border gradien),
  latar gradien bergerak (blob) agar efek kaca terlihat. Hormati `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- Font: Plus Jakarta Sans Variable (offline via @fontsource).
- Warna seri chart (tervalidasi skrip dataviz, all-pairs, light & dark):
  Konsumsi `#eda100`/`#c98500`, Rumah Tangga `#2a78d6`/`#3987e5`, Perjadin `#1baf7a`/`#199e70` (light/dark).
  Kontras < 3:1 di light → wajib ada legenda + tampilan tabel (sudah ada). Teks tidak pernah memakai warna seri.
- Status selalu **ikon + label** (bukan warna saja): Draft (abu), Diajukan ke PUM (biru), Dikembalikan (amber),
  Diverifikasi PUM (cyan), Diajukan ke MDK (ungu), Selesai (Paid) (hijau). Bahasa UI: **Indonesia**.
- Dashboard: baris KPI atas = urutan alur (Diajukan ke PUM → Diverifikasi PUM → Diajukan ke MDK → Selesai), baris bawah
  = Dikembalikan, Berkas belum lengkap, Draft/Rata-rata. Verifikasi PUM: tab Perlu diperiksa · Input invoice · Di MDK ·
  Dikembalikan · Selesai (Paid).
- Tampilan per peran: menu & tombol aksi hanya muncul untuk peran yang berhak (lihat §5); pimpinan baca-saja.
- **Kelengkapan berkas = tabel** (Berkas & file · Pemeriksaan PUM · Aksi), kolom mengikuti lebar panel (container query:
  3 kolom ≥ 42rem, 2 kolom ≥ 28rem, bertumpuk di HP). Aksi PUM: centang **Sesuai** + **Revisi** (retur, dengan catatan);
  aksi pengaju: **Unggah** + ⋯ (tandai tidak diperlukan). Di detail (desktop): [informasi | total & PUM], lalu tabel berkas
  dan riwayat selebar halaman; urutan di HP mengikuti DOM (informasi → berkas → total → riwayat).
- Responsif (diaudit 320–1440 px): tabel lebar (Daftar Pengajuan, Rekap) hanya ≥1280 px dengan `table-fixed` + `<colgroup>`;
  di bawahnya daftar kartu. Segmented berisi banyak opsi memakai grid di HP. Nominal di kartu sempit = ringkas + lengkap.
- Toast (sonner) di **tengah atas, di bawah topbar** — tidak menutupi lonceng/menu akun, tombol aksi halaman (kanan),
  atau bar simpan form (bawah). Hindari toast sukses untuk aksi yang perubahannya sudah terlihat (mis. centang berkas).

## 11. Konvensi Kode

- TypeScript strict. Nama domain berbahasa Indonesia (`pengajuan`, `pegawai`, `berkas`), sama di DB/API/UI.
- SQL **selalu** parameter `?` (diubah ke `$1..` oleh `db-pg.ts`; tidak ada interpolasi nilai). Boolean = `true/false`.
  `db.run()` hanya mengembalikan `lastInsertRowid` bila SQL memakai `RETURNING id` (tidak semua tabel punya `id`).
  `SUM(...)` rupiah di-cast `::bigint`; DATE dikembalikan `YYYY-MM-DD`, timestamptz sebagai ISO string.
- API JSON: sukses → objek data; gagal → `{ message, errors? }` + status HTTP yang tepat (400/401/403/404/409/413).
- Setiap perubahan status/data pengajuan **wajib** menulis `riwayat`; perubahan status yang menyangkut pihak lain
  **wajib** mengirim notifikasi (`kirimNotifikasi`).
- Teks PDF disanitasi ke Latin-1 (`src/lib/pdf/`), karena font standar jsPDF.
- Grid responsif selalu diberi kolom dasar eksplisit (`grid-cols-1 sm:grid-cols-2 …`) — tanpa itu item
  ber-teks `nowrap` melebarkan halaman di ponsel (overflow horizontal).
- Ikon/prefiks di dalam input (`absolute`) wajib `z-10`: `.kontrol` memakai `backdrop-filter` sehingga menutupi elemen sebelumnya.
- Angka beranimasi (`AnimatedNumber`) memakai tween berdurasi tetap agar selalu berhenti tepat di nilai akhir.
- Warna chart untuk atribut SVG diambil dari `src/components/dashboard/palet.ts` (nilai sama dengan token CSS).
- Perubahan skema DB = file baru di `supabase/migrasi/` (idempoten) + perbarui `supabase/schema.sql`; terapkan ke Supabase
  sebelum deploy. Environment dibaca lewat `bacaEnv()` (`server/env.ts`).
- Setelah mengubah aturan bisnis: perbarui `shared/`, test API, dan dokumen ini.

## 11a. Keputusan Teknis yang Sudah Diambil

- `GET /api/auth/me` selalu 200: `{ user: null }` bila belum login (cek sesi tidak memunculkan error 401 di konsol).
  Endpoint lain tetap 401 bila sesi tidak ada/kedaluwarsa; frontend lalu kembali ke halaman login.
- Upload langsung browser → Supabase Storage (URL bertanda tangan; menghindari batas body 4,5 MB fungsi Vercel), lalu server
  memverifikasi: kunci harus `<pengajuan_id>/<uuid><ext>`, ukuran ≤ 10 MB, tanda tangan byte sesuai ekstensi; gagal →
  objek dihapus. Unduh = redirect 302 ke URL sementara 5 menit (nama file ditambahkan sendiri, encode sekali).
- Login: password diverifikasi Supabase Auth (anon key), profil dicocokkan lewat `auth_id` (fallback: email untuk profil
  yang belum tertaut); sesi aplikasi = token acak (sha256) di tabel `sessions`; pembatas 10 gagal / 15 menit / IP+email.
  Pendaftaran: maks. 10 / jam / IP.
- Rekap default = semua status **kecuali draft**; PUM & pimpinan tidak pernah melihat draft (daftar, detail, rekap, dashboard).
- Data demo: tanggal relatif terhadap hari ini (±11 bulan ke belakang), waktu aktivitas di jam kerja (Sen–Jum 08.00–16.30).
- PegawaiPicker tidak menawarkan "Tambah … sebagai pegawai baru" bila nama persis sudah terdaftar; pegawai yang sudah
  dipilih di baris lain diberi keterangan "sudah dipilih di baris lain".

## 12. Pertanyaan Terbuka (asumsi saat ini — mohon dikonfirmasi pemilik project)

1. Kepanjangan **KO / LS**, **PUM**, dan **MDK** (saat ini hanya ditampilkan singkatannya).
2. ~~Jenis uang Perjadin~~ — **terjawab**: uang harian & uang transport diisi terpisah per orang (Okt 2026).
3. Batas **maks. 2 orang** saat ini berlaku untuk Rumah Tangga **dan** Perjadin ("field sama seperti sebelumnya").
4. Format resmi **No. Invoice MDK** (saat ini teks bebas, maks. 100 karakter, unik tidak diwajibkan).
5. Apakah pengajuan wajib berkas lengkap sebelum diajukan (saat ini: boleh dengan peringatan).
6. Logo resmi: ganti `public/logo.svg` dengan logo UI/DPBJ resmi bila diizinkan.
7. **Project Costing & Task Name**: kini dipilih dari master Kasubdit (38 pasangan project–task, Okt 2026) lewat kotak cari;
   task terisi otomatis bila project hanya punya satu task sesuai kategori (Konsumsi → Beban Konsumsi, Rumah Tangga →
   Beban Transportasi Rumah Tangga; Perjadin dipilih manual). Tetap opsional & teks lain diterima. Label tampil **"Project Costing"** (dikonfirmasi Okt 2026;
   sebelumnya "Project Hosting" — kolom DB/API tetap `project_hosting`). Perlu wajib diisi?
12. **Sudah dibayarkan** diasumsikan boleh ditandai PUM sejak status Diajukan ke PUM sampai Selesai. Perlu dibatasi
    (mis. hanya setelah Selesai)? Perlu kolom pembayaran di Excel/rekap?
13. **Alur 5 tahap** (Okt 2026) — asumsi: label status "Diverifikasi PUM" (tahap stepper "Verifikasi PUM"), status
    "Selesai (Paid)" (tahap stepper "Paid"); Kembalikan dari Diajukan ke MDK menghapus No. Invoice (tercatat di riwayat);
    Batalkan selesai → kembali Diajukan ke MDK dengan invoice tetap; pengajuan yang sudah Selesai pada alur lama tetap Selesai.
8. **Verifikasi** (dulu "Teruskan ke MDK") diasumsikan hanya boleh bila **semua berkas wajib dicentang sesuai**. Benar?
9. **Notifikasi** saat ini hanya di dalam aplikasi (lonceng + toast). Perlu email/WhatsApp? Perlu notifikasi untuk pimpinan?
10. **Pimpinan** diasumsikan hanya memantau (tanpa aksi & tanpa melihat draft). Perlu persetujuan pimpinan di alur?
11. Data lama (sebelum revisi) dimigrasikan: akun `mdk` → `pum`, status `diajukan` → `diajukan_pum`, pengajuan
    `selesai` lama tidak punya centang berkas/project/task.
