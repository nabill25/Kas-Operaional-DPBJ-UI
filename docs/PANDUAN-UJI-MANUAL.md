# Panduan Uji Manual — Kas Operasional DPBJ UI

Centang ☐ → ☑ setiap langkah yang sudah dicoba. Bila hasil berbeda dari **Hasil yang diharapkan**,
catat nomor langkah + tangkapan layar agar mudah ditelusuri.

Alur yang diuji (stepper 5 tahap): **Draft dibuat** → **Diajukan ke PUM** (operator/pengaju mengajukan; PUM memeriksa
dan mencentang berkas, atau mengembalikan dengan catatan) → **Verifikasi PUM** (semua berkas sesuai, PUM menekan
**Verifikasi**) → **Diajukan ke MDK** (PUM menginput **No. Invoice MDK**; menunggu verifikasi MDK di luar sistem) →
**Paid** (setelah proses di MDK selesai, PUM menekan **Selesai**). **Pimpinan** hanya memantau.

## 0. Persiapan

1. ☐ Buka aplikasi (Vercel) atau jalankan lokal `npm run dev` (butuh `.env`, lihat README) → **http://localhost:5210**.
2. ☐ Gunakan pengajuan **uji** (nama jelas, mis. "UJI …") dan hapus setelah selesai bila masih draft —
   database Supabase berisi data sungguhan.
3. Akun: siapkan 4 akun **email + password** (Supabase Auth) berperan **Operator**, **PUM**, **Pimpinan**, **Admin**
   (dibuat admin di menu **Pengguna**, atau daftar di halaman **Daftar** lalu disetujui admin).
4. Agar mudah berganti peran, gunakan dua browser (mis. Chrome untuk operator, Edge/jendela samaran untuk PUM).
   Notifikasi diperbarui otomatis tiap ±30 detik (atau saat jendela kembali difokuskan).

---

## A. Login & keamanan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| A1 | ☐ Buka http://localhost:5210 tanpa login | Diarahkan ke halaman **Masuk** |
| A2 | ☐ Klik **Masuk** dengan isian kosong | Muncul "Email wajib diisi" & "Password wajib diisi" |
| A3 | ☐ Login akun operator dengan password salah | Pesan "Email atau password salah" (kotak bergetar) |
| A4 | ☐ Login akun operator dengan password benar | Masuk ke **Dashboard**, sapaan "Selamat …, <nama>" |
| A5 | ☐ Klik avatar (kanan atas) → **Keluar** | Kembali ke halaman login; membuka `/pengajuan` diarahkan ke login |
| A6 | ☐ Login akun PUM, buka `http://localhost:5210/pengajuan/baru` | "Tidak memiliki akses" (PUM tidak membuat pengajuan) |
| A7 | ☐ Login akun operator, buka `http://localhost:5210/verifikasi` | "Tidak memiliki akses" (hanya PUM & admin) |

## B. Operator — Konsumsi

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| B1 | ☐ Menu **Buat Pengajuan** → pilih **Konsumsi** | Form "Informasi kegiatan" & "Rincian konsumsi"; langkah 2 dari 3 aktif |
| B2 | ☐ Klik **Simpan draft** tanpa isian | Kolom wajib bertanda merah + pesan; layar menggulir ke isian pertama yang salah |
| B3 | ☐ Isi nama kegiatan, tanggal, jumlah orang `12`, jumlah uang `1500000` | Uang otomatis tampil `1.500.000`; muncul "Rata-rata Rp 125.000 per orang" |
| B4 | ☐ **Uang siapa**: klik, ketik "nur", pilih *Nurul Hidayah* (bisa pakai ↑ ↓ Enter) | Nama terpilih tampil di kotak |
| B5 | ☐ Pada "Uang siapa" ketik nama baru (mis. "Budi Uji") → *Tambah "Budi Uji" sebagai pegawai baru* → **Simpan & pilih** | Pegawai baru dibuat & langsung terpilih |
| B6 | ☐ Ketik nama pegawai yang **sudah ada persis** (mis. "Nurul Hidayah") | Opsi "Tambah … sebagai pegawai baru" **tidak** muncul (mencegah data ganda) |
| B6a | ☐ **Rekening uang siapa** (opsional): isi Bank **BNI** + No. Rekening `0123 456 789` | Catatan "Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening." berwarna kuning; isi hanya bank tanpa nomor → "Isi nomor rekening" |
| B7 | ☐ Pilih mekanisme **KO**, klik **Simpan draft** | Detail; kode `KSM-2026-xxxx`; status **Draft**; kotak kuning "…lalu klik Ajukan ke PUM" |
| B7a | ☐ Detail → **Uang siapa** | Nama pegawai, **BNI · 0123456789** (tombol salin), catatan biaya transfer, keterangan "Belum dibayarkan" setelah diajukan |
| B8 | ☐ Panel **Kelengkapan berkas** (tabel: Berkas & file · Pemeriksaan PUM · Aksi): unggah PDF untuk *Notula* | Bilah progres tampil, lalu baris hijau "1 file terunggah"; cincin 1/4 |
| B9 | ☐ Seret-lepas (drag & drop) gambar JPG/PNG ke baris *Undangan* | Baris berubah kuning saat diseret, file terunggah |
| B10 | ☐ Coba unggah file `.exe`/`.zip` atau file > 10 MB | Ditolak dengan pesan jelas; tidak ada file tersimpan |
| B11 | ☐ Klik nama file / ikon mata | Pratinjau PDF/gambar dalam jendela; tombol *Unduh* & *Buka di tab baru* |
| B12 | ☐ Isi "Dokumen lainnya" (nama + unggah) | Tercatat sebagai tambahan, **tidak** mengubah hitungan berkas wajib |
| B13 | ☐ Klik **Ajukan ke PUM** saat berkas baru 2/4 | Konfirmasi menyebut berkas yang kurang; **Tetap ajukan** → status **Diajukan ke PUM** |
| B14 | ☐ Perhatikan halaman setelah diajukan | Tombol Ubah/Hapus hilang; berkas terkunci ("sedang diperiksa PUM"); ada **Tarik kembali** |
| B15 | ☐ **Tarik kembali** → konfirmasi | Status kembali **Draft**; bisa diedit lagi |
| B16 | ☐ **Ubah** → ganti jumlah uang → **Simpan perubahan** | Total baru tampil; riwayat mencatat "Nilai Rp … → Rp …" |
| B17 | ☐ Buat draft lain lalu **Hapus** | Terhapus; kembali ke daftar; riwayat penghapusan tetap tercatat di Aktivitas terbaru |
| B18 | ☐ Lengkapi 4 berkas pengajuan B7 → **Ajukan ke PUM** | Status **Diajukan ke PUM**; stepper 5 tahap: Draft dibuat ✓ → *Diajukan ke PUM* (aktif) → Verifikasi PUM → Diajukan ke MDK → Paid |

## C. Operator — Transport Rumah Tangga

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| C1 | ☐ Buat Pengajuan → **Transport Rumah Tangga** | Bagian "Penerima & nilai uang" dengan 1 baris orang |
| C2 | ☐ Orang 1: pilih pegawai + nilai `150000`; **Tambah orang** → orang 2 + nilai `100000` | Bilah bawah: "Total pengajuan · 2 orang" **Rp 250.000** |
| C3 | ☐ Tombol tambah orang setelah 2 orang | Nonaktif, bertuliskan **Maksimal 2 orang** |
| C4 | ☐ Orang 2: cari pegawai yang sama dengan orang 1 | Tidak muncul sebagai pilihan; ada keterangan "… sudah dipilih di baris lain" |
| C5 | ☐ Simpan → lihat detail | Jumlah orang = 2 (otomatis), total = jumlah nilai per orang, berkas wajib: Surat Tugas & Laporan Kegiatan |

## D. Operator — Transport Perjadin

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| D1 | ☐ Buat Pengajuan → **Transport Perjadin**; isi *dari* 10 Okt, *sampai* 8 Okt; simpan | Error "Tanggal selesai tidak boleh sebelum tanggal mulai" |
| D2 | ☐ Ubah *sampai* ke 12 Okt | Muncul "Lama kegiatan 3 hari" |
| D3 | ☐ Perhatikan form | Tidak ada pilihan *Jenis uang*; **Jenis transport** berada di samping **Mekanisme** |
| D3a | ☐ Pilih **Dalam Kota**, isi lokasi; orang 1: **Uang harian** `450000`; orang 2: biarkan kedua uang kosong → simpan | Orang 2: "Isi uang harian dan/atau uang transport" |
| D3b | ☐ Orang 2: Uang harian `200000` + Uang transport `100000` → simpan | "Jumlah orang 2: Rp 300.000"; total Rp 750.000; detail menampilkan rincian uang harian & uang transport per orang |
| D4 | ☐ Berkas *Invoice Hotel* → tombol **⋯** → **Tandai tidak diperlukan** (juga *Invoice Tiket*) | Baris abu-abu "Ditandai tidak diperlukan oleh pengaju"; dihitung terpenuhi |
| D5 | ☐ Unggah file ke baris yang ditandai tidak diperlukan | Tanda dilepas otomatis, baris menjadi hijau |

## E. PUM — pemeriksaan & centang berkas

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| E1 | ☐ Login `pum` | Muncul toast "n notifikasi belum dibaca"; lonceng berangka merah; menu **Verifikasi PUM** berbadge |
| E2 | ☐ Klik lonceng | Daftar notifikasi ("Pengajuan baru menunggu pemeriksaan …"), yang belum dibaca bertitik merah; **Tandai semua dibaca** |
| E3 | ☐ Menu **Verifikasi PUM** → tab **Perlu diperiksa** | Pengajuan *Diajukan ke PUM*, terlama di atas; lencana lama menunggu (≥ 7 hari kuning), "Dicek x/y sesuai" |
| E4 | ☐ Klik **Periksa berkas** pada pengajuan dari B18 | Detail dengan panel **Periksa kelengkapan berkas** (bingkai kuning) + petunjuk |
| E5 | ☐ Perhatikan tombol **Verifikasi** (atas) & **Verifikasi pengajuan** (bawah panel) | Nonaktif; tertulis "Centang n berkas lagi sebagai Sesuai…" |
| E6 | ☐ Buka berkas *Notula*, lalu klik tombol centang **Sesuai** (kolom Aksi) | Tombol menjadi hijau; kolom *Pemeriksaan PUM*: "Sesuai · <nama PUM>, baru saja"; cincin "Dicentang sesuai" naik |
| E7 | ☐ Klik **Sesuai** sekali lagi (hapus centang) | Centang batal; riwayat mencatat "Centang berkas dibatalkan" |
| E8 | ☐ Pada *Undangan* klik **Revisi** (retur) → kosongkan catatan → **Simpan catatan revisi** | Pesan "Tuliskan apa yang perlu direvisi" |
| E9 | ☐ Isi catatan (mis. "Tanda tangan ketua belum ada") → simpan | Baris berbingkai kuning; kolom *Pemeriksaan PUM*: "Perlu revisi" + catatan + **Batalkan tanda**; kartu **Verifikasi PUM**: "1 berkas ditandai perlu revisi" |
| E10 | ☐ Klik **Kembalikan** → kosongkan alasan → kirim | "Alasan pengembalian wajib diisi" |
| E11 | ☐ Pilih alasan cepat / tulis alasan → **Kembalikan ke pengaju** | Dialog menampilkan daftar berkas revisi; status **Dikembalikan**; toast "Notifikasi otomatis terkirim ke pengaju" |
| E12 | ☐ Buka pengajuan *Diajukan ke PUM* lain → centang **Sesuai** semua berkas wajib | Muncul "Semua berkas wajib sesuai"; tombol **Verifikasi** aktif |
| E13 | ☐ **Verifikasi** → **Project Costing**: klik, ketik "tata kelola", pilih *D0030.09.01.6.002 Koordinasi Tata Kelola Pengadaan* | **Task Name** terisi otomatis *723207 Beban Konsumsi* ("Terisi otomatis: task Konsumsi untuk project ini"); daftar task hanya berisi task project itu |
| E13a | ☐ Klik **Verifikasi** pada dialog | Status **Diverifikasi PUM**; stepper aktif di *Verifikasi PUM*; kotak biru kehijauan "Diverifikasi PUM — menunggu input invoice MDK"; project/task tampil di kartu Verifikasi PUM; belum ada tombol **Selesai** |
| E14 | ☐ Berkas setelah diverifikasi | Terkunci; centang tidak bisa diubah lagi |
| E15 | ☐ Kartu **Verifikasi PUM** → **Ubah project costing / task name** | Bisa diubah; riwayat mencatat perubahan |
| E16 | ☐ Cari draft operator (mis. lewat URL detail) | PUM tidak dapat melihat draft ("tidak ditemukan") |

## F. PUM — invoice, diajukan ke MDK, selesai (paid)

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| F1 | ☐ **Verifikasi PUM** → tab **Input invoice** | Pengajuan *Diverifikasi PUM* (terlama di atas), lama menunggu invoice & project/task |
| F2 | ☐ **Input invoice** → kosongkan No. Invoice → simpan | Pesan wajib diisi |
| F3 | ☐ Isi No. Invoice (mis. `MDK/INV/2026/0999`) + tanggal → **Simpan invoice & ajukan ke MDK** | Status **Diajukan ke MDK** (BELUM selesai); stepper aktif di *Diajukan ke MDK*, tahap *Paid* "Menunggu verifikasi MDK"; kotak ungu berisi No. Invoice; pengaju menerima notifikasi "Diajukan ke MDK, menunggu verifikasi MDK" |
| F3a | ☐ Tab **Di MDK** (atau detail pengajuan) | Pengajuan *Diajukan ke MDK* + No. Invoice, lama menunggu MDK; tombol **Selesai** |
| F3b | ☐ Setelah proses di MDK selesai: **Selesai** → **Ya, selesai (paid)** | Status **Selesai (Paid)**; stepper *Paid* ✓; kotak hijau "Selesai (paid) · No. Invoice MDK … ditandai selesai oleh <PUM>"; pengaju menerima notifikasi "Pengajuan selesai (paid)" |
| F4 | ☐ Pengajuan *Diajukan ke MDK* atau *Selesai* → **Aksi PUM** → **Ubah data invoice** | Nomor/tanggal bisa dikoreksi; riwayat mencatat lama → baru |
| F5 | ☐ Pengajuan *Selesai* → **Aksi PUM** → **Batalkan status selesai** (alasan wajib) | Status kembali **Diajukan ke MDK** (menunggu verifikasi MDK); No. Invoice tetap; pengaju menerima notifikasi |
| F6 | ☐ Pengajuan *Diverifikasi PUM* / *Diajukan ke MDK* → **Aksi PUM** → **Kembalikan ke pengaju** | Bisa dikembalikan (mis. ditolak MDK) dengan alasan; No. Invoice lama dihapus & tercatat di riwayat |
| F7 | ☐ Konsumsi (Diajukan ke PUM / Diverifikasi PUM / Diajukan ke MDK / Selesai) → tombol **Sudah dibayarkan** di samping nama *Uang siapa* → **Ya, sudah dibayarkan** | Lencana hijau "Sudah dibayarkan" + "Dibayarkan … oleh <PUM>"; riwayat "Uang ditandai sudah dibayarkan"; pengaju menerima notifikasi |
| F8 | ☐ **Batalkan tanda** (di bawah lencana) | Kembali belum dibayarkan; riwayat mencatat pembatalan. Operator/pimpinan tidak melihat tombol ini |

## G. Operator — notifikasi & revisi setelah dikembalikan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| G1 | ☐ Login `operator` (atau tunggu ±30 detik bila sudah login) | Toast notifikasi baru / ringkasan; lonceng berangka; menu **Daftar Pengajuan** berbadge |
| G2 | ☐ Klik lonceng → notifikasi "Pengajuan dikembalikan PUM" | Berisi alasan + berkas yang perlu revisi; klik → membuka detail & notifikasi otomatis terbaca |
| G3 | ☐ Perhatikan detail | Kotak kuning: alasan + daftar berkas revisi; baris berkas menunjukkan "Perlu revisi" & catatannya; berkas lain tetap "Sesuai" |
| G4 | ☐ Unggah ulang berkas yang direvisi | Tanda revisi berkas tsb. hilang (akan diperiksa ulang PUM) |
| G5 | ☐ **Ajukan ulang ke PUM** | Status **Diajukan ke PUM**; tampil "Diajukan ulang. Catatan pengembalian sebelumnya: …" |
| G6 | ☐ Setelah PUM memverifikasi (E13a), menginput invoice (F3), lalu menekan Selesai (F3b) | Operator menerima notifikasi "Berkas diverifikasi PUM", "Diajukan ke MDK, menunggu verifikasi MDK", lalu "Pengajuan selesai (paid)" |

## H. Pimpinan — pemantauan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| H1 | ☐ Login `pimpinan` | Dashboard; kartu "Pengajuan berjalan"; tidak ada lonceng notifikasi |
| H2 | ☐ Perhatikan menu | Hanya Dashboard, Daftar Pengajuan, Rekap & Laporan, Pegawai (tanpa Buat Pengajuan / Verifikasi PUM / Pengguna) |
| H3 | ☐ Buka detail pengajuan mana pun | Hanya tombol **PDF**; hasil centang PUM terlihat (baca saja) |
| H4 | ☐ Filter status di Daftar Pengajuan | Tidak ada pilihan *Draft*; draft tidak pernah tampil |
| H5 | ☐ Rekap & Laporan → unduh PDF/Excel | Berhasil |

## I. Dashboard, rekap & laporan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| I1 | ☐ **Dashboard**: baris KPI *Diajukan ke PUM* → *Diverifikasi PUM* → *Diajukan ke MDK* → *Selesai (Paid)*, lalu *Dikembalikan*, *Berkas belum lengkap* | Angka menghitung naik (animasi); grafik batang bertumpuk + tooltip |
| I2 | ☐ Klik **Tabel** pada grafik tren | Grafik berganti tabel 12 bulan (angka identik) |
| I3 | ☐ Ganti **Tahun** | Semua kartu & grafik mengikuti tahun terpilih |
| I4 | ☐ Klik kartu KPI sebagai PUM (*Diverifikasi PUM* / *Diajukan ke MDK*) | Membuka tab *Input invoice* / *Di MDK* di Verifikasi PUM (operator: daftar terfilter) |
| I5 | ☐ **Rekap & Laporan** → periode *Tahun ini* | Total nilai sama dengan "Total nilai pengajuan" di dashboard (tahun sama) |
| I6 | ☐ Ubah filter Kategori/Mekanisme/Status | Ringkasan & tabel berubah; URL ikut berubah (bisa di-bookmark) |
| I7 | ☐ **Unduh PDF** (per pengajuan) | `Rekap_Pengajuan_….pdf`: kop DPBJ, ringkasan, tabel 6 status, rincian, total, nomor halaman |
| I8 | ☐ **Excel** | `.xlsx` terbuka di Excel; ada kolom *Project Costing*, *Task Name*, *Dicek PUM*; kolom Nilai berupa angka |
| I9 | ☐ Tab **Per pegawai** → klik satu pegawai → **Unduh PDF pegawai** | Rincian per orang (peran "uang siapa"/"peserta"), total sama dengan baris tabel |
| I10 | ☐ Detail pengajuan → tombol **PDF** | Bukti: info, peserta, berkas + kolom **Cek PUM**, bagian **Proses PUM & MDK** (diverifikasi PUM, project/task, invoice & diajukan ke MDK, selesai), riwayat, tanda tangan Pengaju & PUM ("Diverifikasi PUM") |

## J. Admin — master data & pengguna

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| J1 | ☐ Login `admin` → **Pegawai** → **Tambah Pegawai** (isi NIP dengan spasi) | NIP disimpan tanpa spasi |
| J1a | ☐ Ubah pegawai → isi **Rekening** bank (pilih dari saran) + nomor "0341 0100 0999 307" | Kartu pegawai menampilkan "BRI · 034101000999307"; bank tanpa nomor (atau sebaliknya) ditolak |
| J2 | ☐ Tambah pegawai lain dengan NIP yang sama | Ditolak: "NIP/NUP sudah dipakai oleh …" |
| J3 | ☐ Menu **⋯** pegawai yang sudah dipakai → **Hapus** | Tidak bisa (disarankan Nonaktifkan) |
| J4 | ☐ **Nonaktifkan** pegawai → buat pengajuan baru | Pegawai nonaktif tidak muncul di pilihan; pengajuan lama tetap utuh |
| J5 | ☐ **Pengguna**: kartu 4 peran (Operator / PUM / Pimpinan / Administrator) beserta keterangannya | Jumlah akun aktif per peran |
| J6 | ☐ **Tambah Pengguna** (peran **PUM**) → login dengan akun baru | Berhasil masuk dengan menu **Verifikasi PUM** |
| J7 | ☐ Ubah akun sendiri → coba nonaktifkan/ubah peran | Tidak diizinkan |
| J8 | ☐ Avatar → **Ganti password** | Validasi password lama/baru; berhasil → sesi di perangkat lain dikeluarkan |

## K. Tampilan & kenyamanan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| K1 | ☐ Tombol bulan/matahari (kanan atas) | Tema gelap/terang berganti mulus & diingat setelah muat ulang |
| K1a | ☐ Menu **Pengaturan** → tema warna **Kuning UI** / **Biru Dongker DPBJ** | Warna aksen berganti seketika & diingat di perangkat ini |
| K2 | ☐ Perkecil jendela / buka di ponsel (`npm run dev:lan`) | Menu menjadi tombol ☰ (drawer), tabel menjadi kartu, tidak ada geser horizontal |
| K3 | ☐ Pencarian di topbar (mis. "Rapat", atau nama project) + Enter | Daftar pengajuan terfilter kata kunci |
| K4 | ☐ Daftar pengajuan: filter status (6 status), urutan, paginasi | Hasil & jumlah total menyesuaikan; tombol **Reset** mengosongkan filter |
| K5 | ☐ Toast muncul di tengah atas (di bawah topbar) | Tidak menutupi lonceng, menu akun, maupun tombol aksi halaman |
| K6 | ☐ (Windows) Pengaturan → Aksesibilitas → Efek visual → matikan **Efek animasi** | Animasi diminimalkan (menghormati preferensi kurangi gerak) |

## L. Admin — Master Data (Jenis Pengajuan, Jenis Berkas, Project & Task, Bank)

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| L1 | ☐ Login `operator`/`pum`/`pimpinan` → lihat menu **Master Data** | Hanya **Pegawai** (dan Pengguna untuk admin); membuka `/master/jenis-pengajuan` → "Tidak memiliki akses" |
| L2 | ☐ Login `admin` → **Jenis Pengajuan** | 3 jenis bawaan (Konsumsi KSM, Rumah Tangga TRT, Perjadin TPD) beserta berkas wajib berurutan, model form, jumlah pengajuan |
| L3 | ☐ **Jenis Berkas** → **Tambah Jenis Berkas** (mis. "Kuitansi", keterangan opsional) | Muncul di daftar; nama yang sama / "Dokumen Lainnya" ditolak |
| L4 | ☐ Menu ⋯ **Notula** → Nonaktifkan / Hapus | Tidak bisa: masih wajib pada Konsumsi / jenis bawaan |
| L5 | ☐ **Jenis Pengajuan** → **Tambah Jenis Pengajuan**: "Kontrak Borongan", singkat "Borongan", awalan **KBR**, model **Umum**, batas 3 orang, berkas wajib Laporan Pekerjaan, Presensi, Kontrak (atur urutan dengan ↑↓), kata kunci "tenaga lepas", warna & ikon | Tersimpan; kartu menampilkan KBR-YYYY-NNNN, model, maks. 3 orang, berkas wajib berurutan |
| L6 | ☐ Coba awalan yang sudah dipakai (mis. KSM) / nama yang sama | Ditolak dengan pesan pada isian terkait |
| L7 | ☐ Login operator → **Buat Pengajuan** | Ada kartu **Kontrak Borongan** (UMUM, maks. 3 orang, berkas wajibnya) |
| L8 | ☐ Pilih Kontrak Borongan: isi nama, **Tanggal / mulai periode** + **Sampai (opsional)**, mekanisme, 1–3 penerima + nilai → Simpan draft | Tidak ada isian lokasi; tombol tambah orang berhenti di 3; kode **KBR-YYYY-0001**; tabel berkas berisi 3 berkas wajib tadi; total = jumlah nilai |
| L9 | ☐ Admin ubah berkas wajib Kontrak Borongan (tambah "Kuitansi") | Toast "1 pengajuan Draft/Dikembalikan ikut …"; draft tadi menampilkan Kuitansi + riwayat "Berkas wajib mengikuti master"; pengajuan yang sudah diajukan ke PUM tidak berubah |
| L10 | ☐ PUM memproses pengajuan Kontrak Borongan sampai **Selesai (Paid)** | Alur sama dengan jenis lain; muncul di dashboard (warna sendiri), rekap per pengajuan & per pegawai, filter kategori (dropdown), PDF/Excel |
| L11 | ☐ Nonaktifkan Kontrak Borongan | Hilang dari Buat Pengajuan; pengajuan lama tetap bisa dibuka & diproses; awalan kode terkunci bila sudah dipakai |
| L12 | ☐ **Project & Task** → tab **Task Name** → tambah task (kode tanpa "_"); tab **Project Costing** → tambah project + centang task | Muncul di kotak cari PUM (Verifikasi / Ubah project costing); task terisi otomatis bila satu-satunya yang cocok kata kunci jenis |
| L13 | ☐ **Bank** → tambah "Bank Nagari", lalu nonaktifkan | Muncul / hilang dari saran isian Bank pada form Konsumsi & Pegawai; rekening yang sudah tersimpan tidak berubah |
| L14 | ☐ Operator → Konsumsi → pilih "uang siapa" pegawai yang punya rekening | Bank & No. Rekening terisi otomatis ("diisi otomatis dari data pegawai"); ganti pegawai → ikut berganti; isian yang diubah manual tidak ditimpa |

---

### Catatan temuan

| No. langkah | Yang terjadi | Seharusnya | Tangkapan layar |
|---|---|---|---|
| | | | |
