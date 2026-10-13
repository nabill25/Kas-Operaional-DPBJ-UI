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
serta **rekap & laporan PDF/Excel**. Jenis pengajuan beserta berkas wajib/opsional & mekanismenya, jenis berkas,
Project Costing & Task Name per tahun anggaran beserta **kode dana**, dan daftar bank adalah **master data** yang dikelola
admin (menu Master Data), sehingga jenis pengajuan baru (mis. **Kontrak Borongan**) bisa ditambahkan tanpa mengubah kode.

Prioritas: data akurat → alur jelas → mudah dipakai → tampilan modern (liquid glass, kuning–biru dongker UI).

## 2. Glosarium

| Istilah | Arti dalam sistem |
|---|---|
| Pengajuan | Satu catatan biaya (Konsumsi / Transport RT / Transport Perjadin) |
| Kategori / Jenis pengajuan | Kode jenis pengajuan dari **master Jenis Pengajuan** (tabel `jenis_pengajuan`). Bawaan: `konsumsi`, `rumah_tangga`, `perjadin` (dua terakhir = Transport); admin bisa menambah jenis baru |
| Model form | Bentuk isian & aturan validasi jenis pengajuan: `konsumsi`, `rumah_tangga`, `perjadin`, atau `umum` (pegawai + nilai per orang). Tetap setelah jenis dibuat |
| Jenis berkas | Master dokumen kelengkapan (tabel `jenis_berkas`, kunci = kode). Berkas tiap jenis pengajuan (urut, **wajib** atau **opsional**) diatur di master Jenis Pengajuan. "Dokumen Lainnya" (`lainnya`) bukan bagian master: selalu opsional |
| Berkas wajib / opsional | Sifat berkas per jenis pengajuan (`jenis_pengajuan_berkas.wajib`, Okt 2026). **Wajib** = bertanda "Wajib", dihitung kelengkapan, harus dicentang sesuai PUM sebelum verifikasi, boleh ditandai N/A. **Opsional** = tampil di tabel berkas tanpa tanda wajib, tidak dihitung kelengkapan, boleh diunggah & diperiksa PUM (tanda revisinya tetap menahan verifikasi), tidak bisa N/A |
| Daftar berkas pengajuan | `pengajuan.berkas_daftar`: salinan daftar berkas jenisnya `[{kode, wajib}]` (format lama `["kode"]` = semua wajib) — mengikuti master selama Draft/Dikembalikan, dibekukan sejak diajukan ke PUM (lihat §4) |
| KO / LS | Pilihan mekanisme pembayaran, disimpan apa adanya `KO` / `LS` (kepanjangan belum dikonfirmasi — lihat §12). Jenis bermekanisme tetap (`jenis_pengajuan.mekanisme_tetap`; bawaan: Transport Rumah Tangga & Perjadin = **LS**) tidak menampilkan pilihan — server selalu menyimpan mekanisme tetapnya |
| Operator / Pengaju | Pembuat pengajuan: mengisi data, mengunggah berkas, mengajukan ke PUM. Peran pengaju (`ROLE_PENGAJU`) = operator, **PUM** (sejak Okt 2026), admin |
| PUM | Pemeriksa di dalam sistem: mencentang berkas, mengembalikan, **memverifikasi**, menginput No. Invoice MDK (= mengajukan ke MDK), menekan **Selesai** setelah proses MDK selesai. Sejak Okt 2026 juga **dapat mengajukan** seperti operator (melihat semua draft; boleh memeriksa & memverifikasi pengajuannya sendiri) |
| MDK | Pihak **di luar sistem** yang memverifikasi & membayar pengajuan yang invoice-nya diinput PUM. Tidak punya akun & tidak ada tampilan input untuk MDK |
| Verifikasi PUM | Persetujuan PUM setelah semua berkas wajib dicentang sesuai **dan** tidak ada berkas (wajib/opsional) bertanda revisi → status `diverifikasi_pum` (label "Diverifikasi PUM"; tahap stepper "Verifikasi PUM") |
| Pimpinan | Pemantau (hanya lihat): dashboard, daftar, detail, rekap & laporan |
| Centang berkas | Hasil pemeriksaan PUM per berkas pengajuan (wajib; opsional bila perlu): `sesuai` (UI: "Sudah Verifikasi") atau `revisi` (+ catatan) — tabel `cek_berkas` |
| Project Costing / Task Name | Dua isian (opsional, maks. 150; kolom/API tetap `project_hosting` & `task_name`) yang diisi PUM saat/setelah verifikasi. Dipilih lewat kotak cari dari **master Project & Task** per tahun anggaran (Master Data; tabel `master_project`, `master_task`, `master_project_task`; data awal 2026 = daftar Kasubdit): **Task Name dulu**, lalu Project Costing yang memiliki task itu; project `<kode>:<nama>`, task `<kode>_<nama>`; teks lain tetap diterima |
| Kode dana | Kode sumber dana anggaran (kolom DANA Laporan Sisa Anggaran; tabel `master_dana`, tab Kode Dana): `51` = Dana Masyarakat (BP) - Tidak Terikat, `61` = Dana Masyarakat (Non BP) - Tidak Terikat. Ditetapkan per pasangan project–task (`master_project_task.kode_dana`); terisi otomatis saat PUM memilih task & project, tersimpan di `pengajuan.kode_dana` (boleh diubah/dikosongkan PUM) |
| Tahun anggaran (master) | Master project & task dikelompokkan per tahun (`tahun`; kode unik per tahun; pasangan harus setahun). Data Kasubdit = 2026; tahun kosong (mis. 2027) bisa disalin dari tahun lain ("Salin dari 2026") |
| Rekening | Bank & No. Rekening tujuan pembayaran oleh PUM (opsional, berpasangan): milik "uang siapa" (model Konsumsi, `pengajuan.rekening_*`) atau **tiap penerima** (model lain, `pengajuan_peserta.rekening_*`, Okt 2026). Terisi otomatis dari rekening pegawai (master Pegawai) lalu tersimpan di pengajuan (tidak ikut berubah bila master berubah); nama bank disarankan dari **master Bank** (isian tetap bebas) |
| Sudah dibayarkan | Tanda PUM bahwa uang konsumsi sudah dibayarkan ke pemilik uang (`dibayar_at`/`dibayar_by`) |
| Pegawai | Master data orang (punya `id` sendiri, NIP, jabatan, **rekening** opsional) → dipakai untuk "Uang siapa" & penerima per orang, agar bisa **direkap per orang**. Dikelola **admin**; pengaju hanya memilih nama yang terdaftar (Okt 2026) |
| Profil akun | Admin menautkan akun pengguna ke satu data pegawai (`users.pegawai_id`, menu Pengguna); pemilik akun lalu mengisi **Bank & No. Rekening miliknya** di Pengaturan → Profil (tersimpan di master Pegawai → terisi otomatis saat namanya dipilih di form) |
| Peserta | Orang yang menerima nilai uang pada pengajuan bermodel selain Konsumsi (batas orang dari master jenis; bawaan Transport 2), masing-masing dengan bank & no. rekening (opsional). Perjadin: uang harian + uang transport per orang |
| Berkas | Dokumen unggahan (PDF/gambar/Office) per jenis kelengkapan |
| N/A berkas | Berkas **wajib** yang ditandai "tidak diperlukan" oleh pengaju (dianggap terpenuhi; tetap dicentang PUM). Berkas opsional tidak bisa N/A |
| Notifikasi | Pemberitahuan otomatis di aplikasi (lonceng + toast) — tabel `notifikasi` |

## 3. Aturan Bisnis per Kategori (dari kebutuhan pemilik project)

§3.1–§3.3 adalah **jenis bawaan** (master Jenis Pengajuan, `bawaan = true`, tidak dapat dihapus; kode & model form tetap).
Label, deskripsi, awalan kode (selama belum ada pengajuan), batas orang, kata kunci task, warna, ikon, aktif/nonaktif,
**mekanisme** (pilih KO/LS · selalu LS · selalu KO) dan **berkasnya** (urut, wajib/opsional) diatur admin; berkas & mekanisme
yang tertulis di bawah adalah data awal. Jenis tambahan: §3.5.

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
Field: tanggal kegiatan*, nama kegiatan*, lokasi tujuan*, catatan, **mekanisme selalu `LS`** (Okt 2026: master
`mekanisme_tetap = 'LS'`; pilihan KO/LS tidak ditampilkan, kiriman lain diabaikan server),
**peserta**: 1–2 orang, masing-masing `{ pegawai, nilai uang, bank, no. rekening }` (nilai > 0, pegawai tidak boleh dobel;
bank & no. rekening opsional dengan aturan sama seperti rekening "uang siapa" §3.1, terisi otomatis dari rekening pegawai —
lihat §11a). Satu baris per orang: nama | nilai | bank | no. rekening.
`jumlah_orang` = jumlah peserta (dihitung otomatis). `total` = **SUM nilai peserta** (dihitung server).
Berkas wajib: **Surat Tugas, Laporan Kegiatan**.

### 3.3 Transport — Perjadin (kode `TPD-YYYY-NNNN`)
Semua field Rumah Tangga (termasuk **selalu `LS`** & rekening per orang) **+** lama kegiatan **dari*** & **sampai*** (sampai ≥ dari),
jenis transport* `Dalam Kota`/`Luar Kota` (di samping lokasi tujuan; di samping Mekanisme bila admin mengembalikan pilihan KO/LS).
**Tanpa "jenis uang"**: tiap orang mengisi **uang harian** dan **uang transport** (Rp ≥ 0, kosong = 0,
minimal salah satu > 0); `nilai` per orang = uang harian + uang transport (dihitung server). Satu baris per orang:
nama | uang harian | uang transport | bank | no. rekening. Kolom `pengajuan.jenis_uang`
hanya data lama (simpanan baru selalu `null`); migrasi menyalin nilai lama ke kolom sesuai jenis uangnya.
`tanggal_kegiatan` = tanggal **dari**; `tanggal_selesai` = **sampai**; lama (hari) = selisih + 1.
Berkas wajib: **Surat Tugas, Laporan Kegiatan, Invoice Hotel, Invoice Tiket**.

### 3.4 Aturan umum
- Uang disimpan sebagai **INTEGER Rupiah** (tanpa desimal). Maks. Rp 1.000.000.000.000.
- Tanggal disimpan `YYYY-MM-DD`; timestamp ISO-8601 UTC (dibuat di JS, bukan `datetime('now')`).
- Batas orang per pengajuan = `maks_peserta` master jenis (bawaan Transport 2; jenis baru bawaan 10; 1–50).
  `MAX_PESERTA_TRANSPORT = 2` hanya cadangan bila master tidak mengaturnya.
- Validasi **otoritatif di server** (`shared/validation.ts` dipakai server & client, pesan berbahasa Indonesia).

### 3.5 Jenis pengajuan tambahan (master data, mis. Kontrak Borongan)
Admin menambah jenis di **Master Data → Jenis Pengajuan**: nama, nama singkat (grafik/filter/badge), **awalan kode**
(2–5 huruf A–Z, unik → kode `<AWALAN>-YYYY-NNNN`), deskripsi, **model form**, batas orang, **berkas** (urut, dari
master Jenis Berkas, maks. 20; tiap berkas **Wajib** atau **Opsional** — berkas baru wajib secara bawaan), **mekanisme**
("KO atau LS" = pengaju memilih, "Selalu LS", "Selalu KO"), kata kunci Task Name, warna, ikon. Kode internal dibuat dari nama
(`Kontrak Borongan` → `kontrak_borongan`).
- **Model Umum**: nama kegiatan*, tanggal* (+ "sampai" opsional = periode, ≥ tanggal, maks. 366 hari), mekanisme* (kecuali
  mekanisme tetap), penerima 1..batas orang (pegawai + nilai > 0, tidak dobel, + bank & no. rekening opsional), catatan;
  tanpa lokasi. Total = jumlah nilai; rekap per orang lewat peserta.
- Jenis baru boleh memakai model Konsumsi/Rumah Tangga/Perjadin (aturan isian sama dengan jenis bawaannya;
  "Sudah dibayarkan" hanya untuk model Konsumsi; filter `kategori=transport` = semua jenis bermodel Rumah Tangga/Perjadin).
- **Model form tidak dapat diganti** setelah jenis dibuat. **Awalan kode** tidak dapat diubah setelah ada pengajuan.
- **Nonaktif** = tidak muncul di Buat Pengajuan (pengajuan lama tetap bisa diedit & diproses); minimal satu jenis aktif.
  **Hapus** hanya jenis tambahan yang belum pernah dipakai.
- Jenis berkas: nama unik, keterangan opsional (petunjuk di tabel berkas). Tidak dapat dinonaktifkan selama masih tercantum
  (wajib/opsional) pada suatu jenis; tidak dapat dihapus bila bawaan atau sudah tercatat di pengajuan (file, centang, atau
  daftar berkas pengajuan — format lama maupun baru).
  Data awal menyertakan contoh Laporan Pekerjaan, Presensi, Kontrak (belum dipakai jenis mana pun).

## 4. Alur (Workflow) & Status

```
 Operator: Buat ──► DRAFT ──(lengkapi data + unggah berkas)──► Ajukan ke PUM ──► DIAJUKAN KE PUM
                      ▲                                                            │
                      └────────── Tarik kembali (operator, selama masih di PUM) ◄──┤
                                                                                   │
   PUM: centang tiap berkas wajib  [Sesuai] / [Revisi + catatan]  (opsional: bila perlu) │
   PUM: Kembalikan (alasan wajib) ──► DIKEMBALIKAN ──(operator perbaiki)──► Ajukan ulang ke PUM
   PUM: Verifikasi (hanya bila SEMUA berkas wajib dicentang sesuai & tidak ada tanda revisi;
        isi Task Name → Project Costing → kode dana otomatis — opsional) ──► DIVERIFIKASI PUM
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
| `draft` | Draft | Disimpan, belum diajukan. **Tidak terlihat oleh pimpinan** (PUM melihatnya sebagai pengaju, Okt 2026) | Ya |
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
- Hanya PUM/admin, hanya saat status `diajukan_pum`, hanya berkas **yang tercantum di pengajuan itu** (`berkas_daftar`,
  wajib maupun opsional; Dokumen Lainnya tidak dicentang).
- `revisi` wajib catatan (3–500 karakter); `null` = batalkan centang.
- **Verifikasi** butuh semua berkas **wajib** sesuai **dan** tidak ada berkas bertanda revisi (termasuk berkas opsional) —
  server menolak 409 "Masih ada N berkas yang ditandai perlu revisi…". Hitungan sesuai/terpenuhi hanya berkas wajib.
- Beberapa baris bisa dicentang sekaligus (kotak "Pilih …") untuk **Download (ZIP)** atau **Tandai Sesuai (n)** (PUM).
- **Mengunggah/menghapus berkas atau mengubah tanda N/A suatu jenis menghapus centangnya** (harus diperiksa ulang).
  Centang jenis lain tetap tersimpan saat dikembalikan & diajukan ulang.
- Berkas wajib tanpa file boleh dicentang sesuai (berkas fisik) — UI memberi peringatan. Berkas opsional dapat diperiksa
  bila sudah diunggah.
- **Daftar berkas per pengajuan** (`berkas_daftar`, `[{kode, wajib}]`) = salinan dari master jenisnya saat dibuat. Bila admin
  mengubah berkas (atau sifat wajib/opsional) suatu jenis, pengajuan berstatus Draft/Dikembalikan langsung mengikuti (riwayat
  `diubah` "Berkas mengikuti master — wajib baru: … · tidak wajib lagi: … · opsional baru: …"; centang berkas yang keluar dari
  daftar dihapus, tanda N/A hanya dipertahankan untuk berkas yang masih wajib, file berkas yang keluar tetap tampil sebagai
  baris "Di luar daftar"); disamakan sekali lagi saat diajukan, lalu **dibekukan** sejak Diajukan ke PUM
  (pengajuan yang sudah diajukan/diverifikasi/selesai tidak ikut berubah). `null` (data dari kode lama) = ikut master.
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
| Lihat draft | ✓ | ✓ | ✗ | ✓ |
| Buat / edit / hapus (draft & dikembalikan) | ✓ | ✓ | ✗ | ✓ |
| Unggah / hapus berkas, tandai N/A (draft & dikembalikan) | ✓ | ✓ | ✗ | ✓ |
| Ajukan / ajukan ulang ke PUM / tarik kembali | ✓ | ✓ | ✗ | ✓ |
| Halaman **Verifikasi PUM**, centang berkas, kembalikan, verifikasi | ✗ | ✓ | ✗ | ✓ |
| Isi/ubah Task Name, Project Costing & kode dana (diajukan_pum, diverifikasi_pum, diajukan_mdk, selesai) | ✗ | ✓ | ✗ | ✓ |
| Input No. Invoice MDK (ajukan ke MDK), ubah invoice, tandai **Selesai**, batalkan selesai | ✗ | ✓ | ✗ | ✓ |
| Tandai uang konsumsi "sudah dibayarkan" / batalkan | ✗ | ✓ | ✗ | ✓ |
| Halaman/menu Master Pegawai (lihat) | ✗ | ✓ | ✓ | ✓ |
| Daftar pegawai sebagai pilihan di form (API `GET /api/pegawai`) | ✓ | ✓ | ✓ | ✓ |
| Master Pegawai: tambah/ubah (termasuk rekening pegawai & "Tambah … sebagai pegawai baru" di form) | ✗ | ✗ | ✗ | ✓ |
| Master Pegawai: hapus (hanya jika belum dipakai) / nonaktifkan | ✗ | ✗ | ✗ | ✓ |
| Master Jenis Pengajuan, Jenis Berkas, Project & Task (+ Kode Dana), Bank: dibaca (form, tampilan, kotak cari) | ✓ | ✓ | ✓ | ✓ |
| Master Jenis Pengajuan, Jenis Berkas, Project & Task (+ Kode Dana, salin tahun), Bank: menu & tambah/ubah/nonaktifkan/hapus | ✗ | ✗ | ✗ | ✓ |
| Kelola Pengguna, setujui/tolak pendaftaran | ✗ | ✗ | ✗ | ✓ |
| Halaman Pengaturan (profil: rekening sendiri bila akun ditautkan ke data pegawai, tema warna, info akun, ganti password) | ✓ | ✓ | ✓ | ✓ |
| Menautkan akun ke data pegawai (menu Pengguna: tambah/ubah/setujui akun) | ✗ | ✗ | ✗ | ✓ |

**Pendaftaran mandiri** (`/daftar`): akun baru dibuat `aktif=false`, `menunggu_persetujuan=true`, peran sementara
`operator`; admin dinotifikasi (`jenis=registrasi`, badge di menu Pengguna), lalu **Setujui** (pilih peran → aktif) atau
**Tolak** (profil & akun Supabase Auth dihapus). Pendaftar tidak memilih peran sendiri. Email yang sudah punya akun
Supabase Auth hanya bisa didaftarkan dengan password akun itu.

Konstanta peran: `ROLE_LIHAT_DRAFT` & `ROLE_PENGAJU` (`operator`,`pum`,`admin`), `ROLE_PUM` (`pum`,`admin`) di `shared/constants.ts`
(UI memakai konstanta ini, bukan daftar peran manual). PUM sebagai pengaju (Okt 2026, dikonfirmasi pemilik project): sama seperti
operator — melihat semua draft, mengubah draft/dikembalikan milik siapa pun — dan **boleh memeriksa & memverifikasi pengajuannya
sendiri** (tercatat di riwayat). Notifikasi "diajukan" tetap ke semua PUM aktif selain pelaku.
Keputusan: semua operator boleh mengedit pengajuan draft/dikembalikan milik siapa pun (tim kecil;
akuntabilitas lewat `riwayat`). Bisa diperketat menjadi "hanya pembuat" bila diminta.

## 6. Model Data (PostgreSQL di Supabase — `supabase/schema.sql`)

Skema lengkap untuk database baru ada di `supabase/schema.sql` (menolak berjalan bila tabel sudah berisi data).
Perubahan skema berikutnya = **file baru di `supabase/migrasi/`** (idempoten, hanya menambah), lalu perbarui
`schema.sql` juga dan terapkan ke Supabase **sebelum** kode yang memakainya di-deploy.

- `users` (id, `auth_id` → auth.users, username = **email** unik huruf kecil, nama, role
  `operator|pum|pimpinan|admin`, aktif, `menunggu_persetujuan`, **pegawai_id** → pegawai (opsional, unik — satu pegawai
  satu akun, `on delete set null`; ditautkan admin)) — **tanpa password**: password dikelola Supabase Auth.
- `sessions` (token_hash sha256, user_id, expires_at) — cookie httpOnly `kas_sid`, 7 hari (Secure di Vercel)
- `pegawai` (id, nama, nip opsional unik, jabatan, **rekening_bank, rekening_nomor** (opsional, berpasangan), aktif)
- Master data (admin): `jenis_pengajuan` (kode PK, label, label_pendek, prefix unik, deskripsi, model, maks_peserta,
  kata_kunci_task, warna, ikon, aktif, bawaan, urutan, **mekanisme_tetap** `KO|LS|null`) + `jenis_pengajuan_berkas`
  (jenis_pengajuan, jenis_berkas, urutan, **wajib** boolean default true);
  `jenis_berkas` (kode PK ≠ `lainnya`, label unik, keterangan, aktif, bawaan, urutan); `bank` (nama unik, aktif);
  `master_project` / `master_task` (**tahun** 2000–2100, kode unik per tahun `(tahun, lower(kode))`, nama, aktif) +
  `master_project_task` (project_id, task_id, **kode_dana** → `master_dana`; project & task harus setahun);
  `master_dana` (kode PK `^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$`, nama, aktif). Data awal = blok
  `[SEED-MASTER]` di `schema.sql` (master tahun 2026 + kode dana 51/61 per pasangan; sama dengan migrasi
  `2026-10-08-master-data.sql` + `2026-10-12-berkas-opsional-tahun-dana.sql`; diisi hanya bila tabel kosong).
- `kode_counter` (prefix, tahun, terakhir) — nomor urut kode pengajuan, tidak pernah dipakai ulang
- `pengajuan` (kode, **kategori → jenis_pengajuan(kode)** (teks, bukan enum lagi), nama_kegiatan, tanggal_kegiatan DATE, tanggal_selesai, jumlah_orang,
  lokasi_tujuan, mekanisme, jenis_uang (data lama), jenis_transport, **jenis_konsumsi**, uang_siapa_id→pegawai,
  **rekening_bank, rekening_nomor, dibayar_at, dibayar_by**→users, total BIGINT, catatan,
  berkas_na JSONB, **berkas_daftar JSONB** (`[{kode, wajib}]` berkas pengajuan ini), berkas_terpenuhi/berkas_wajib (denormalisasi,
  hanya berkas wajib), status, no_invoice_mdk, tanggal_invoice_mdk,
  catatan_pum, project_hosting, task_name, **kode_dana**, created_by, updated_by, diajukan_at, **diverifikasi_by/at, diajukan_mdk_by/at**,
  diproses_by/at (dikembalikan / selesai), diteruskan_by/at (data lama), …)
- `pengajuan_peserta` (pengajuan_id, pegawai_id, nilai, **uang_harian, uang_transport** (Perjadin; Rumah Tangga `null`),
  **rekening_bank, rekening_nomor** (salinan saat disimpan; migrasi mengisi data lama dari master Pegawai), urutan)
  — UNIQUE(pengajuan_id, pegawai_id)
- `berkas` (pengajuan_id, jenis, nama_berkas, nama_asli, **nama_file = kunci objek Storage** `<pengajuan_id>/<uuid>.<ext>`,
  mime, ukuran, uploaded_by)
- `cek_berkas` (pengajuan_id, jenis, status `sesuai|revisi`, catatan, diperiksa_by, diperiksa_at) — PK(pengajuan_id, jenis)
- `notifikasi` (user_id, pengajuan_id NULL-able, kode, jenis incl. `registrasi`, judul, pesan, dibaca_at)
- `riwayat` (pengajuan_id NULL-able, kode, user_id, aksi enum, keterangan, created_at)
- Enum PostgreSQL mengikuti `shared/constants.ts` persis (aksi riwayat, jenis notifikasi, status, dst.).
- Keamanan: RLS aktif di semua tabel tanpa policy + hak `anon`/`authenticated` dicabut → hanya server (DATABASE_URL)
  yang bisa membaca/menulis. Bucket Storage **`berkas`** privat, maks. 10 MB, MIME sesuai `UPLOAD_DIIZINKAN`.

`berkas_sesuai` (jumlah centang sesuai berkas **wajib**) & `berkas_revisi` (jumlah tanda revisi, semua berkas) dihitung lewat
subquery di `SELECT_PENGAJUAN`.
Rekap per pegawai = model Konsumsi (via `uang_siapa_id`, nilai = total) **+** model lain (via peserta, nilai per orang);
rincian per jenis = `perKategori` (kode jenis → nilai) di dashboard, rekap pegawai, & top pegawai.
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
shared/        konstanta, tipe, validasi, format, kelengkapan, konfig (kamus master), project-task — dipakai server & client
server/        Express API: app.ts (createApp), db-pg.ts, auth.ts (sesi), supabase.ts + providers.ts (Auth/Storage),
               env.ts (baca env toleran), routes/*, services/*, vercel.ts (entry Vercel), index.ts (entry lokal)
api/           bundle.mjs — HASIL BUILD (npm run build), di-commit; satu-satunya fungsi Vercel
supabase/      schema.sql (database baru) + migrasi/*.sql (perubahan bertahap)
src/           React app: components/(ui|layout|pengajuan|dashboard), pages/, context/, hooks/, lib/
tests/         api/*.test.ts, unit/*.test.ts, e2e/*.spec.ts + e2e/server.ts, support/ (pg, palsu, seed-demo)
docs/          PANDUAN-UJI-MANUAL.md
```

Endpoint alur (semua `/api/pengajuan/:id/...`): `POST ajukan`, `POST tarik`, `PUT cek-berkas` {jenis, status, catatan},
`POST kembalikan` {catatan}, `POST verifikasi` {project_hosting, task_name, kode_dana, catatan},
`PUT data-pum` {project_hosting, task_name, kode_dana} (kode dana harus ada di `master_dana`; kosong = `null`),
`POST ajukan-mdk` & `PUT invoice` {no_invoice_mdk, tanggal_invoice_mdk, catatan}, `POST selesai` (tanpa body),
`POST batal-selesai` {catatan},
`PUT dibayarkan` {dibayarkan: boolean} (konsumsi).
Berkas: `POST berkas/siapkan` {jenis, nama_berkas?, nama_asli, ukuran} → URL unggah bertanda tangan; browser `PUT` file
langsung ke Storage; `POST berkas/konfirmasi` {key, …} (server cek isi & ukuran lalu mencatat). `GET /api/berkas/:id/file`
→ 302 ke URL sementara (`?unduh=1` = attachment dengan nama asli).
Master data (`/api/master/...`; GET semua peran, tulis hanya admin): `GET konfig` (jenis pengajuan + `mekanisme_tetap` +
berkasnya `[{kode, wajib}]` & jenis berkas — dimuat client sekali setelah login, `KonfigProvider`), `GET|POST jenis-pengajuan`,
`PUT|DELETE jenis-pengajuan/:kode` {…, mekanisme_tetap, berkas: `[{kode, wajib}]` (string lama = wajib)}
(PUT mengembalikan `disinkron` = jumlah draft/dikembalikan yang ikut berubah), `GET|POST jenis-berkas`, `PUT|DELETE jenis-berkas/:kode`,
`GET|POST bank`, `PUT|DELETE bank/:id`, `GET project-task` → {project (tahun, tasks `[{id, kode_dana}]`), task (tahun), dana},
`POST project`, `PUT|DELETE project/:id` {tahun, kode, nama, aktif, tasks: `[{id, kode_dana}]`} (`task_ids` lama tetap diterima;
tahun tidak dapat diubah), `POST task`, `PUT|DELETE task/:id` {tahun, kode, nama, aktif}, `POST project-task/salin` {dari, ke}
(201 + jumlah project/task/pasangan; 409 bila tahun tujuan sudah berisi, 404 bila tahun asal kosong), `GET|POST dana`,
`PUT|DELETE dana/:kode` {kode, nama, aktif} (kode tetap; hapus 409 bila dipakai pasangan/pengajuan).
Pegawai: `GET /api/pegawai` semua peran (pilihan di form); `POST|PUT /api/pegawai` **admin saja**, menerima `rekening_bank`,
`rekening_nomor`. Profil: `GET|PUT /api/auth/profil` {rekening_bank, rekening_nomor} → data pegawai akun ini (409 bila akun
belum ditautkan; kosongkan keduanya = hapus rekening). Pengajuan: tiap `peserta[]` menerima
`rekening_bank`, `rekening_nomor` (galat per baris `peserta.<i>.rekening_*`).
Akun: `POST /api/auth/login` {username=email, password}, `POST /api/auth/daftar` {nama, username, password},
`POST|PUT /api/users` {…, pegawai_id} (tidak dikirim = tetap, `null` = lepas; 400 bila pegawai sudah ditautkan ke akun lain),
`POST /api/users/:id/setujui` {role, pegawai_id?}, `DELETE /api/users/:id` (tolak pendaftaran). Lainnya: `GET /api/pengajuan/saran-pum`,
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
  Master data ikut dikosongkan lalu diisi ulang dari blok `[SEED-MASTER]` `schema.sql` setiap `buatKonteks()`.
  Unit/komponen memakai konfigurasi master uji `tests/support/konfig-uji.ts` (`KonfigTetap` untuk komponen);
  daftar asli Kasubdit di `tests/support/project-task-awal.ts` (dicocokkan dengan seed master).
  **Jangan jalankan Vitest bersamaan dengan server E2E** — setup global menghapus database `kas_test_*`.
- Fixture E2E (`tests/e2e/fixtures.ts`) **menggagalkan test bila ada `console.error`/error JS** di browser.
  Respons 4xx yang disengaja ikut tercatat browser sebagai error → kosongkan `galat` setelahnya.
- Kait test di UI: `data-berkas` + `data-sifat` (`wajib|opsional|lainnya|di-luar`) + `data-keadaan` + `data-cek` (baris tabel
  "List Dokumen Pendukung", list "Kelengkapan berkas"; baris Dokumen Lainnya `data-berkas="lainnya"`), kotak "Pilih <label>" /
  "Pilih semua dokumen" + `data-testid="aksi-terpilih"` (Download (ZIP), Tandai Sesuai (n)), kotak "<label> sesuai", tombol
  "<label> perlu revisi", tautan "Download <file>" & tombol "Preview <file>", kotak cari "Cari dokumen",
  `data-testid="ringkasan-berkas" | "kode-dana" | "tahun-kosong" | "kartu-profil" | "profil-pegawai" | "profil-belum-tertaut" |
  "pegawai-akun"`, isian profil `#profil-bank` / `#profil-nomor`, pilihan data pegawai akun `#u-pegawai` / `#s-pegawai`,
  `data-dana`, `data-berkas-master` + `data-sifat` (form master
  Jenis Pengajuan; radiogroup "Sifat <berkas>"), `data-baris-penerima` + `#peserta-0-rekening_bank` / `#peserta-0-rekening_nomor`,
  isian PUM: combobox "Task Name" → "Project Costing" → select "Kode dana", `data-kode` (kartu Verifikasi PUM),
  `data-testid="kartu-pum" | "aksi-pum" | "catatan-pengembalian"`, stepper = list "Tahapan pengajuan" + `aria-current="step"`,
  `data-pendaftar` (baris pendaftar), master: `data-jenis-pengajuan`, `data-jenis-berkas`, `data-bank`, `data-project`, `data-task`,
  `data-jenis` (kartu Buat Pengajuan), `data-model` (pilihan model form), `data-testid="pratinjau-jenis" | "sumber-rekening" |
  "rekening-pegawai" | "rekening-peserta"`,
  `data-warna-opsi` + `data-terpilih` (tema), `data-jenis-konsumsi` (pilihan jenis konsumsi), `data-testid="uang-siapa"`
  (nama, rekening, tombol "Sudah dibayarkan"), `data-peserta` (rincian per orang di detail),
  id stabil pada input form (mis. `#peserta-0-nilai`, `#peserta-0-uang_harian`, `#peserta-0-uang_transport`,
  `#uang_siapa_id`, `#rekening_bank`, `#rekening_nomor`, `#jenis_konsumsi`). Kotak cari Project/Task:
  combobox berlabel "Project Costing"/"Task Name", kotak pencarian "Cari project"/"Cari task".
- Playwright `getByLabel(..., { exact: true })` ikut menghitung tanda `*` wajib → pakai `getByRole('textbox', { name })` atau id.

## 10. Desain UI

- **Tema warna** (halaman Pengaturan, per perangkat, `localStorage kas-warna`, atribut `data-warna` di `<html>`):
  `dpbj` (bawaan) = biru dongker `#0A1A3F` + kuning `#FFD100`; `ui` = **kuning resmi UI `#F6DB00`** (Pantone 109 C,
  pedoman logo UI) + hitam arang; `pink` = pink `#F564A8` + plum tua `#28101F` (Okt 2026). Tema menimpa palet
  `--color-kuning-*` (= warna aksen) / `--color-navy-*` (= warna tinta/gelap), `--aksen-kilau`/`--aksen-tepi` (bayangan tombol &
  menu aktif, kanal RGB) & token semantik di `index.css`; setiap variabel di blok terang sebuah tema wajib diulang di blok gelapnya.
  Tema baru wajib lolos cek kontras pasangan yang dipakai komponen (teks `navy-950` di aksen 300–500 ≥ 4,5:1, teks aksen-300 di
  `navy-900`/`navy-500`, `fg`/`fg-muted` di latar, dst.) + didaftarkan di `WARNA_LIST`, `WARNA_BILAH`, skrip awal `index.html`,
  `NETRAL_TEMA`/`NAMA_AKSEN` (`palet.ts`), dan `OPSI_WARNA` (Pengaturan). Terpisah dari mode terang/gelap
  (kelas `.dark`). Warna kategori chart & status **tidak** ikut tema (bermakna data).
- Gaya **liquid glass**: kelas `.glass` (backdrop blur + saturate, highlight specular, border gradien),
  latar gradien bergerak (blob) agar efek kaca terlihat. Hormati `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- Font: Plus Jakarta Sans Variable (offline via @fontsource).
- Warna seri chart = warna master jenis pengajuan (`WARNA_SERI` di `src/components/dashboard/palet.ts`, light/dark):
  kuning `#eda100`/`#c98500` (Konsumsi), biru `#2a78d6`/`#3987e5` (Rumah Tangga), hijau `#1baf7a`/`#199e70` (Perjadin) —
  tervalidasi skrip dataviz; pilihan tambahan merah bata `#c8521a`/`#e0703a`, ungu `#a8558a`/`#c77aa8`, toska `#0b8fa3`/`#1fb3c4`
  (Okabe–Ito; kontras penanda ≥ 3,4:1, ΔE antar-warna ≥ 10 pada simulasi protan/deutan/tritan). `abu` hanya cadangan kode tak dikenal
  (tidak bisa dipilih: terlalu mirip warna lain bagi buta warna). Kontras < 3:1 di light → wajib ada legenda + tampilan tabel
  (sudah ada). Teks tidak pernah memakai warna seri.
- Jenis pengajuan di dashboard/rekap/PDF/Excel mengikuti master: jenis **aktif selalu tampil** (walau 0) + jenis nonaktif yang
  punya data, urut master. Filter kategori di Daftar Pengajuan berupa segmen bila ≤ 3 jenis, dropdown bila lebih.
- Status selalu **ikon + label** (bukan warna saja): Draft (abu), Diajukan ke PUM (biru), Dikembalikan (amber),
  Diverifikasi PUM (cyan), Diajukan ke MDK (ungu), Selesai (Paid) (hijau). Bahasa UI: **Indonesia**.
- Dashboard: baris KPI atas = urutan alur (Diajukan ke PUM → Diverifikasi PUM → Diajukan ke MDK → Selesai), baris bawah
  = Dikembalikan, Berkas belum lengkap, Draft/Rata-rata. Verifikasi PUM: tab Perlu diperiksa · Input invoice · Di MDK ·
  Dikembalikan · Selesai (Paid).
- Tampilan per peran: menu & tombol aksi hanya muncul untuk peran yang berhak (lihat §5); pimpinan baca-saja. Pengaju tidak
  melihat menu Pegawai (grup Master Data kosong → tersembunyi); Pengaturan berisi kartu **Profil** (data pegawai tertaut +
  Bank & No. Rekening) di atas Tema warna.
- **Berkas = tabel "List Dokumen Pendukung"** (Okt 2026, mengikuti contoh pemilik project): kotak "Cari dokumen" di kanan atas;
  kolom ☐ pilih · **Jenis Dokumen Pendukung** (pil merah "Wajib" di atas nama; opsional tanpa pil) · **Nama dokumen** (ikon +
  nama dipotong di tengah, `potongTengah`) · **Status dokumen** (Sudah Verifikasi hijau / Perlu Revisi merah / Belum Verifikasi
  kuning / Belum Diunggah / Tidak Diperlukan / Tambahan / Di luar daftar) · **Action** (Download & Preview per file; pengaju:
  hapus, Unggah/Tambah file, ⋯ tandai tidak diperlukan (wajib saja); PUM: centang **Sesuai** + **Revisi** dengan catatan).
  Baris yang dicentang → Download (ZIP, dibuat di browser) / Tandai Sesuai (PUM). Kolom mengikuti lebar panel (container
  query: 5 kolom ≥ 52rem dengan subgrid; lebih sempit = kartu bertumpuk). Di detail (desktop): [informasi | total & PUM],
  lalu tabel berkas dan riwayat selebar halaman; urutan di HP mengikuti DOM (informasi → berkas → total → riwayat).
- **Penerima** (model selain Konsumsi): satu baris per orang — nama | uang (Perjadin: harian & transport; lainnya: nilai) | bank |
  no. rekening — bila panel ≥ 54rem (Perjadin) / ≥ 50rem (lainnya), mis. laptop 1280 px; lebih sempit 2 kolom, HP bertumpuk.
- **Isian PUM** (modal Verifikasi & "Ubah task name / project / kode dana"): [Tahun anggaran bila master > 1 tahun] → Task Name
  (otomatis dari kata kunci jenis bila hanya satu) → Project Costing (hanya project yang memiliki task itu; otomatis bila hanya
  satu) → Kode dana (otomatis dari pasangan; bisa diubah). Tahun awal = tahun project tersimpan / tahun kegiatan. Data lama
  (task & project sudah terisi sebelum ada kode dana): kode dana terisi otomatis dari pasangannya saat isian dibuka (tersimpan
  setelah PUM menekan Simpan/Verifikasi).
- **Master Project & Task**: tab Project Costing · Task Name · Kode Dana; segmen Tahun anggaran (tahun berdata + tahun ini &
  tahun depan); tahun kosong menampilkan kartu "Salin dari <tahun>"; chip "Dana 51" per pasangan di kartu project.
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
- Rekap default = semua status **kecuali draft**; pimpinan tidak pernah melihat draft (daftar, detail, rekap, dashboard); PUM melihat
  draft sejak ikut menjadi pengaju (Okt 2026).
- Data demo: tanggal relatif terhadap hari ini (±11 bulan ke belakang), waktu aktivitas di jam kerja (Sen–Jum 08.00–16.30).
- Master data dibaca server per permintaan (tanpa cache) & client lewat `useKamus()` (KonfigProvider, staleTime 5 menit,
  disegarkan setelah admin mengubah master). Kode jenis yang tak dikenal tetap tampil dengan tampilan cadangan.
- Rekening "uang siapa" diisi otomatis saat memilih pegawai yang punya rekening, hanya bila isian masih kosong atau sebelumnya
  terisi otomatis (isian manual tidak ditimpa; tombol "Pakai rekening data pegawai" tersedia). Aturan sama untuk rekening
  tiap penerima (keterangan "Dari data pegawai" di bawah isian Bank). Rekening disalin ke pengajuan saat disimpan; perubahan
  tercatat di riwayat ("Rekening <nama> <lama> → <baru>").
- Mekanisme tetap diterapkan server (`jenis.mekanisme_tetap` menimpa kiriman client), sehingga data lama/klien lama tetap konsisten.
- Tautan akun ↔ data pegawai hanya oleh **admin** (bukan pengaju sendiri): rekening menentukan tujuan pembayaran, jadi pengaju
  tidak boleh menautkan diri ke pegawai lain lalu mengganti rekeningnya. Profil hanya mengubah rekening pegawai miliknya
  (`PUT /api/auth/profil`); nama/NIP/jabatan tetap lewat admin. Satu pegawai hanya untuk satu akun (indeks unik).
- Download beberapa dokumen = ZIP dibuat di browser (`fflate`, tanpa kompresi ulang; satu folder per jenis dokumen) dari URL
  unduh biasa — tanpa endpoint baru (batas respons fungsi Vercel 4,5 MB).
- Kode dana disalin ke pengajuan (bukan relasi): mengubah master tidak mengubah pengajuan lama; kode dana yang sudah dipakai
  pengajuan atau pasangan tidak dapat dihapus (nonaktifkan saja).
- PegawaiPicker tidak menawarkan "Tambah … sebagai pegawai baru" bila nama persis sudah terdaftar; pegawai yang sudah
  dipilih di baris lain diberi keterangan "sudah dipilih di baris lain".

## 12. Pertanyaan Terbuka (asumsi saat ini — mohon dikonfirmasi pemilik project)

1. Kepanjangan **KO / LS**, **PUM**, dan **MDK** (saat ini hanya ditampilkan singkatannya).
2. ~~Jenis uang Perjadin~~ — **terjawab**: uang harian & uang transport diisi terpisah per orang (Okt 2026).
3. Batas **maks. 2 orang** saat ini berlaku untuk Rumah Tangga **dan** Perjadin ("field sama seperti sebelumnya").
4. Format resmi **No. Invoice MDK** (saat ini teks bebas, maks. 100 karakter, unik tidak diwajibkan).
5. Apakah pengajuan wajib berkas lengkap sebelum diajukan (saat ini: boleh dengan peringatan).
6. Logo resmi: ganti `public/logo.svg` dengan logo UI/DPBJ resmi bila diizinkan.
7. **Project Costing & Task Name**: kini dipilih dari master Kasubdit (38 pasangan project–task 2026, Okt 2026) lewat kotak cari;
   sejak 12 Okt 2026 **Task Name dipilih lebih dulu** (terisi otomatis bila hanya satu task cocok dengan kata kunci jenis:
   Konsumsi → Beban Konsumsi, Rumah Tangga → Beban Transportasi Rumah Tangga; Perjadin dipilih manual), lalu Project Costing
   dibatasi pada project yang memiliki task itu (otomatis bila hanya satu), lalu **kode dana** terisi otomatis. Tetap opsional &
   teks lain diterima. Label tampil **"Project Costing"** (dikonfirmasi Okt 2026; sebelumnya "Project Hosting" — kolom DB/API
   tetap `project_hosting`). Perlu wajib diisi?
12. **Sudah dibayarkan** diasumsikan boleh ditandai PUM sejak status Diajukan ke PUM sampai Selesai. Perlu dibatasi
    (mis. hanya setelah Selesai)? Perlu kolom pembayaran di Excel/rekap?
13. **Alur 5 tahap** (Okt 2026) — asumsi: label status "Diverifikasi PUM" (tahap stepper "Verifikasi PUM"), status
    "Selesai (Paid)" (tahap stepper "Paid"); Kembalikan dari Diajukan ke MDK menghapus No. Invoice (tercatat di riwayat);
    Batalkan selesai → kembali Diajukan ke MDK dengan invoice tetap; pengajuan yang sudah Selesai pada alur lama tetap Selesai.
14. **Master Data** (Okt 2026) — asumsi: hanya **admin** yang mengelola master Jenis Pengajuan, Jenis Berkas, Project & Task,
    Bank (dikonfirmasi pemilik project) dan menunya hanya tampil untuk admin; rekening pegawai mengikuti aturan Pegawai
    (operator & admin). **Kontrak Borongan** belum dibuat — mekanismenya belum pasti; disiapkan model **Umum** (pegawai + nilai
    per orang, periode opsional) dan contoh jenis berkas Laporan Pekerjaan, Presensi, Kontrak. Perlu kolom/isian khusus lain
    (mis. nomor kontrak, volume pekerjaan)? Perlu rekening per penerima di PDF?
16. **Pengaju tanpa master data & Profil** (Okt 2026, dikonfirmasi: pengaju tidak boleh menambah nama pegawai baru) — asumsi:
    PUM & pimpinan tetap melihat halaman Pegawai (baca saja); Profil tersedia untuk semua peran (akun yang ditautkan admin);
    pengaju yang namanya belum terdaftar meminta admin menambahkannya di Master Pegawai.
15. **Berkas wajib/opsional, mekanisme tetap, rekening per penerima, tahun & kode dana** (Okt 2026) — asumsi:
    berkas opsional yang ditandai revisi oleh PUM tetap menahan verifikasi (dikembalikan atau tanda revisinya dibatalkan);
    berkas opsional tidak bisa ditandai N/A; mekanisme selalu LS hanya untuk Transport Rumah Tangga & Perjadin (jenis lain,
    mis. Pengajuan Lain-lain bermodel Rumah Tangga, tetap memilih KO/LS — admin bisa mengubahnya ke "Selalu LS");
    rekening per penerima berlaku untuk semua model selain Konsumsi (termasuk Umum/Kontrak Borongan) dan opsional;
    kode dana per pasangan project–task sesuai Laporan Sisa Anggaran 2026 (kolom DANA: 51 & 61), boleh diubah/dikosongkan PUM;
    master 2027 belum diisi (bisa disalin dari 2026 lalu disesuaikan). Kode dana tampil di detail, PDF bukti, & Excel rekap —
    perlu juga di rekap per pegawai? Checkbox di tabel berkas dipakai untuk Download (ZIP) / Tandai Sesuai sekaligus.
8. **Verifikasi** (dulu "Teruskan ke MDK") diasumsikan hanya boleh bila **semua berkas wajib dicentang sesuai** (dan tidak ada
   tanda revisi). Benar?
9. **Notifikasi** saat ini hanya di dalam aplikasi (lonceng + toast). Perlu email/WhatsApp? Perlu notifikasi untuk pimpinan?
10. **Pimpinan** diasumsikan hanya memantau (tanpa aksi & tanpa melihat draft). Perlu persetujuan pimpinan di alur?
11. Data lama (sebelum revisi) dimigrasikan: akun `mdk` → `pum`, status `diajukan` → `diajukan_pum`, pengajuan
    `selesai` lama tidak punya centang berkas/project/task.
