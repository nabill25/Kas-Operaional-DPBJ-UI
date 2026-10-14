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
| A6 | ☐ Login akun **pimpinan**, buka `http://localhost:5210/pengajuan/baru` | "Tidak memiliki akses" (pimpinan hanya memantau). Akun PUM justru bisa membuka halaman ini (PUM juga dapat mengajukan) |
| A7 | ☐ Login akun operator, buka `http://localhost:5210/verifikasi` | "Tidak memiliki akses" (hanya PUM & admin) |

## B. Operator — Konsumsi

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| B1 | ☐ Menu **Buat Pengajuan** → pilih **Konsumsi** | Form "Informasi kegiatan" & "Rincian konsumsi"; langkah 2 dari 3 aktif |
| B2 | ☐ Klik **Simpan draft** tanpa isian | Kolom wajib bertanda merah + pesan; layar menggulir ke isian pertama yang salah |
| B3 | ☐ Isi nama kegiatan, tanggal, jumlah orang `12`, jumlah uang `1500000` | Uang otomatis tampil `1.500.000`; muncul "Rata-rata Rp 125.000 per orang" |
| B4 | ☐ **Uang siapa**: klik, ketik "nur", pilih *Nurul Hidayah* (bisa pakai ↑ ↓ Enter) | Nama terpilih tampil di kotak |
| B5 | ☐ Pada "Uang siapa" ketik nama yang belum terdaftar (mis. "Budi Uji") | Tidak ada opsi menambah pegawai (pengaju tidak mengelola master data); muncul "Nama belum terdaftar? Minta admin menambahkannya di Master Pegawai." |
| B6 | ☐ (Login **admin**) Pada "Uang siapa" ketik nama baru → *Tambah "Budi Uji" sebagai pegawai baru* → **Simpan & pilih**; lalu ketik nama yang **sudah ada persis** | Pegawai baru dibuat & langsung terpilih; untuk nama yang sudah ada, opsi "Tambah …" **tidak** muncul (mencegah data ganda) |
| B6a | ☐ **Rekening uang siapa** (opsional): isi Bank **BNI** + No. Rekening `0123 456 789` | Catatan "Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening." berwarna kuning; isi hanya bank tanpa nomor → "Isi nomor rekening" |
| B7 | ☐ Pilih mekanisme **KO**, klik **Simpan draft** | Detail; kode `KSM-2026-xxxx`; status **Draft**; kotak kuning "…lalu klik Ajukan ke PUM" |
| B7a | ☐ Detail → **Uang siapa** | Nama pegawai, **BNI · 0123456789** (tombol salin), catatan biaya transfer, keterangan "Belum dibayarkan" setelah diajukan |
| B8 | ☐ Panel **List Dokumen Pendukung** (tabel: ☐ · Jenis Dokumen Pendukung · Nama dokumen · Status dokumen · Action): unggah PDF untuk *Notula* (tombol **Unggah**) | Bilah progres tampil; baris *Notula* berpil merah **Wajib**, nama file tampil, status **Belum Verifikasi**; tombol **Download** & **Preview**; cincin 1/4 |
| B9 | ☐ Seret-lepas (drag & drop) gambar JPG/PNG ke baris *Undangan* | Baris berubah kuning saat diseret, file terunggah |
| B10 | ☐ Coba unggah file `.exe`/`.zip` atau file > 10 MB | Ditolak dengan pesan jelas; tidak ada file tersimpan |
| B11 | ☐ Klik nama file / **Preview** | Pratinjau PDF/gambar dalam jendela; tombol *Download* & *Buka di tab baru*. **Download** di baris = unduh file dengan nama aslinya |
| B11a | ☐ Ketik "undangan" di kotak **Cari dokumen** | Hanya baris *Undangan* yang tampil; kosongkan → semua baris kembali |
| B11b | ☐ Centang kotak di awal 2 baris yang sudah ada file → **Download (ZIP)** | Satu file `KSM-…_dokumen.zip` berisi folder per jenis dokumen |
| B12 | ☐ Isi "Dokumen Lainnya" (nama + **Unggah dokumen**) | Tercatat sebagai tambahan (status "Tambahan"), **tidak** mengubah hitungan berkas wajib |
| B13 | ☐ Perhatikan tombol **Ajukan ke PUM** saat berkas wajib baru 2/4 | Tombol **nonaktif**; di bawah tabel berkas: "Belum dapat diajukan — unggah 2 berkas wajib lagi: …" (tombol **Ajukan sekarang** juga nonaktif); baris berkas wajib yang kosong bertuliskan "Wajib diunggah sebelum diajukan" |
| B13a | ☐ Unggah 2 berkas wajib sisanya → **Ajukan ke PUM** → **Ajukan sekarang** | Kotak di bawah tabel berubah hijau "Semua berkas wajib sudah diunggah…"; status **Diajukan ke PUM** |
| B14 | ☐ Perhatikan halaman setelah diajukan | Tombol Ubah/Hapus hilang; berkas terkunci ("sedang diperiksa PUM"); ada **Tarik kembali** |
| B15 | ☐ **Tarik kembali** → konfirmasi | Status kembali **Draft**; bisa diedit lagi |
| B16 | ☐ **Ubah** → ganti jumlah uang → **Simpan perubahan** | Total baru tampil; riwayat mencatat "Nilai Rp … → Rp …" |
| B17 | ☐ Buat draft lain lalu **Hapus** | Terhapus; kembali ke daftar; riwayat penghapusan tetap tercatat di Aktivitas terbaru |
| B18 | ☐ Ajukan lagi pengajuan B7 (4 berkas wajib sudah lengkap) → **Ajukan ke PUM** | Status **Diajukan ke PUM**; stepper 5 tahap: Draft dibuat ✓ → *Diajukan ke PUM* (aktif) → Verifikasi PUM → Diajukan ke MDK → Paid |
| B19 | ☐ (Setelah PUM mengembalikan, lihat E) hapus salah satu berkas wajib → coba **Ajukan ulang ke PUM** | Tombol nonaktif sampai berkas wajib itu diunggah lagi; tidak ada lagi pilihan "Tandai tidak diperlukan" |

## C. Operator — Transport Rumah Tangga

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| C1 | ☐ Buat Pengajuan → **Transport Rumah Tangga** | Bagian "Penerima & nilai uang" dengan 1 baris orang; **tidak ada pilihan Mekanisme KO/LS** (selalu LS) |
| C2 | ☐ Orang 1: pilih pegawai + nilai `150000`; **Tambah orang** → orang 2 + nilai `100000` | Bilah bawah: "Total pengajuan · 2 orang" **Rp 250.000**; di laptop/desktop tiap orang satu baris: **Nama · Nilai uang · Bank · No. Rekening** |
| C2a | ☐ Pilih orang yang punya rekening di master Pegawai (mis. *Nurul Hidayah*) | **Bank & No. Rekening terisi otomatis** + keterangan "Dari data pegawai"; isian boleh diubah/dikosongkan (opsional) |
| C2b | ☐ Isi Bank saja tanpa No. Rekening → simpan | "Isi nomor rekening" pada baris orang itu |
| C3 | ☐ Tombol tambah orang setelah 2 orang | Nonaktif, bertuliskan **Maksimal 2 orang** |
| C4 | ☐ Orang 2: cari pegawai yang sama dengan orang 1 | Tidak muncul sebagai pilihan; ada keterangan "… sudah dipilih di baris lain" |
| C5 | ☐ Simpan → lihat detail | Jumlah orang = 2 (otomatis), total = jumlah nilai per orang, mekanisme **LS**, rekening tiap orang tampil di bawah namanya (tombol salin), berkas wajib: Surat Tugas & Laporan Kegiatan |
| C6 | ☐ Detail → **Ubah** → ganti bank/nomor salah satu orang → **Simpan perubahan** | Riwayat mencatat "Rekening <nama> <lama> → <baru>"; mengubah rekening di master Pegawai **tidak** mengubah pengajuan yang sudah tersimpan |

## D. Operator — Transport Perjadin

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| D1 | ☐ Buat Pengajuan → **Transport Perjadin**; isi *dari* 10 Okt, *sampai* 8 Okt; simpan | Error "Tanggal selesai tidak boleh sebelum tanggal mulai" |
| D2 | ☐ Ubah *sampai* ke 12 Okt | Muncul "Lama kegiatan 3 hari" |
| D3 | ☐ Perhatikan form | Tidak ada pilihan *Jenis uang* maupun **Mekanisme KO/LS** (selalu LS); **Jenis transport** berada di samping **Lokasi tujuan** |
| D3a | ☐ Pilih **Dalam Kota**, isi lokasi; orang 1: **Uang harian** `450000`; orang 2: biarkan kedua uang kosong → simpan | Orang 2: "Isi uang harian dan/atau uang transport" |
| D3b | ☐ Orang 2: Uang harian `200000` + Uang transport `100000` → simpan | "Jumlah orang 2: Rp 300.000"; total Rp 750.000; detail menampilkan rincian uang harian & uang transport per orang |
| D3c | ☐ Perhatikan baris orang (laptop/desktop) | Satu baris: **Nama · Uang harian · Uang transport · Bank · No. Rekening**; rekening terisi otomatis dari master Pegawai bila ada; No. rekening 15 digit tampil utuh |
| D4 | ☐ Perhatikan baris *Invoice Hotel* & *Invoice Tiket* (perjalanan dalam kota) | Tetap berpil **Wajib** ("Wajib diunggah sebelum diajukan"); tidak ada menu "Tandai tidak diperlukan". Bila berkas ini memang tidak selalu ada, admin menjadikannya **Tidak wajib** (L15–L17) |
| D5 | ☐ Unggah keempat berkas wajib | Kotak hijau "Semua berkas wajib sudah diunggah. Pengajuan siap diajukan ke PUM."; tombol **Ajukan ke PUM** aktif |

## E. PUM — pemeriksaan & centang berkas

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| E1 | ☐ Login `pum` | Muncul toast "n notifikasi belum dibaca"; lonceng berangka merah; menu **Verifikasi PUM** berbadge |
| E2 | ☐ Klik lonceng | Daftar notifikasi ("Pengajuan baru menunggu pemeriksaan …"), yang belum dibaca bertitik merah; **Tandai semua dibaca** |
| E3 | ☐ Menu **Verifikasi PUM** → tab **Perlu diperiksa** | Pengajuan *Diajukan ke PUM*, terlama di atas; lencana lama menunggu (≥ 7 hari kuning), "Dicek x/y sesuai" |
| E4 | ☐ Klik **Periksa berkas** pada pengajuan dari B18 | Detail dengan panel **List Dokumen Pendukung** (bingkai kuning) + petunjuk |
| E5 | ☐ Perhatikan tombol **Verifikasi** (atas) & **Verifikasi pengajuan** (bawah panel) | Nonaktif; tertulis "Centang n berkas wajib lagi sebagai Sesuai…" |
| E6 | ☐ **Preview** berkas *Notula*, lalu klik centang **Sesuai** (kolom Action) | Tombol menjadi hijau; kolom *Status dokumen*: **Sudah Verifikasi** · <nama PUM>, baru saja; cincin "Dicentang sesuai" naik |
| E7 | ☐ Klik **Sesuai** sekali lagi (hapus centang) | Centang batal (status kembali *Belum Verifikasi*); riwayat mencatat "Centang berkas dibatalkan" |
| E8 | ☐ Pada *Undangan* klik **Revisi** (retur) → kosongkan catatan → **Simpan catatan revisi** | Pesan "Tuliskan apa yang perlu direvisi" |
| E9 | ☐ Isi catatan (mis. "Tanda tangan ketua belum ada") → simpan | Status **Perlu Revisi** (merah) + catatan + **Batalkan tanda**; kartu **Verifikasi PUM**: "1 berkas ditandai perlu revisi" |
| E9a | ☐ Centang kotak di awal beberapa baris → **Tandai Sesuai (n)** | Semua baris terpilih menjadi **Sudah Verifikasi** sekaligus; **Download (ZIP)** mengunduh file baris terpilih |
| E10 | ☐ Klik **Kembalikan** → kosongkan alasan → kirim | "Alasan pengembalian wajib diisi" |
| E11 | ☐ Pilih alasan cepat / tulis alasan → **Kembalikan ke pengaju** | Dialog menampilkan daftar berkas revisi; status **Dikembalikan**; toast "Notifikasi otomatis terkirim ke pengaju" |
| E12 | ☐ Buka pengajuan *Diajukan ke PUM* lain → centang **Sesuai** semua berkas wajib | Muncul "Semua berkas wajib sesuai"; tombol **Verifikasi** aktif |
| E13 | ☐ **Verifikasi** (pengajuan Konsumsi) → perhatikan urutan isian | **Task Name** di atas **Project Costing**, lalu **Kode dana**; Task Name terisi otomatis *723207 Beban Konsumsi* ("Terisi otomatis: task Konsumsi"); Kode dana "Terisi otomatis setelah task & project dipilih" |
| E13b | ☐ **Project Costing**: klik, ketik "tata kelola", pilih *D0030.09.01.6.002 Koordinasi Tata Kelola Pengadaan* | Daftar project hanya berisi project yang memiliki task terpilih; **Kode dana** otomatis **51 · Dana Masyarakat (BP) - Tidak Terikat** |
| E13c | ☐ Ganti project ke *D0030.06.01.6.002 Penguatan Perencanaan, Pelaksanaan, dan Pengendalian* | Kode dana berganti otomatis **61 · Dana Masyarakat (Non BP) - Tidak Terikat** |
| E13a | ☐ Klik **Verifikasi** pada dialog | Status **Diverifikasi PUM**; stepper aktif di *Verifikasi PUM*; kotak biru kehijauan "Diverifikasi PUM — menunggu input invoice MDK"; kartu Verifikasi PUM menampilkan Task name, Project costing & **Kode dana** (beserta namanya); riwayat "… Kode dana: 61"; belum ada tombol **Selesai** |
| E14 | ☐ Berkas setelah diverifikasi | Terkunci; centang tidak bisa diubah lagi |
| E15 | ☐ Kartu **Verifikasi PUM** → **Ubah task name, project & kode dana** (atau **Aksi PUM** → *Ubah task name / project / kode dana*) | Bisa diubah; riwayat mencatat "Task: … · Project: … · Kode dana: …" |
| E16 | ☐ PUM → **Buat Pengajuan** → isi & simpan draft → unggah berkas → **Ajukan ke PUM** | Draft dibuat atas nama PUM; PUM melihat semua draft (filter status *Draft* tersedia); setelah diajukan, PUM yang sama boleh mencentang & **memverifikasi** pengajuannya sendiri (tercatat di riwayat) |

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
| I8 | ☐ **Excel** | `.xlsx` terbuka di Excel; ada kolom *Project Costing*, *Task Name*, *Kode Dana*, *Dicek PUM*; kolom Nilai berupa angka |
| I9 | ☐ Tab **Per pegawai** → klik satu pegawai → **Unduh PDF pegawai** | Rincian per orang (peran "uang siapa"/"peserta"), total sama dengan baris tabel |
| I10 | ☐ Detail pengajuan → tombol **PDF** | Bukti: info, peserta (+ rekening per orang), berkas + kolom **Cek PUM**, bagian **Proses PUM & MDK** (diverifikasi PUM, project/task, kode dana, invoice & diajukan ke MDK, selesai), riwayat, tanda tangan Pengaju & PUM ("Diverifikasi PUM") |

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
| K1a | ☐ Menu **Pengaturan** → tema warna **Kuning UI** / **Pink** / **Biru Dongker DPBJ** | Warna aksen berganti seketika & diingat di perangkat ini; tema Pink juga rapi di mode gelap |
| K1b | ☐ Mode gelap → buka dropdown (mis. Tahun di Dashboard, Kategori/Status di Rekap) | Daftar pilihan berlatar gelap dengan teks terang (terbaca) |
| K2 | ☐ Perkecil jendela / buka di ponsel (`npm run dev:lan`) | Menu menjadi tombol ☰ (drawer), tabel menjadi kartu, tidak ada geser horizontal |
| K3 | ☐ Pencarian di topbar (mis. "Rapat", atau nama project) + Enter | Daftar pengajuan terfilter kata kunci |
| K4 | ☐ Daftar pengajuan: filter status (6 status), urutan, paginasi | Hasil & jumlah total menyesuaikan; tombol **Reset** mengosongkan filter |
| K5 | ☐ Toast muncul di tengah atas (di bawah topbar) | Tidak menutupi lonceng, menu akun, maupun tombol aksi halaman |
| K6 | ☐ (Windows) Pengaturan → Aksesibilitas → Efek visual → matikan **Efek animasi** | Animasi diminimalkan (menghormati preferensi kurangi gerak) |

## L. Admin — Master Data (Jenis Pengajuan, Jenis Berkas, Project & Task, Bank)

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| L1 | ☐ Login `operator`/`pum`/`pimpinan` → lihat menu **Master Data** | Hanya **Pegawai** (dan Pengguna untuk admin); membuka `/master/jenis-pengajuan` → "Tidak memiliki akses" |
| L2 | ☐ Login `admin` → **Jenis Pengajuan** | 3 jenis bawaan (Konsumsi KSM, Rumah Tangga TRT, Perjadin TPD) beserta berkas berurutan ("Berkas · n wajib, m tidak wajib"), model form, mekanisme (**KO / LS** atau **Selalu LS** untuk Rumah Tangga & Perjadin), jumlah pengajuan |
| L3 | ☐ **Jenis Berkas** → **Tambah Jenis Berkas** (mis. "Kuitansi", keterangan opsional) | Muncul di daftar; nama yang sama / "Dokumen Lainnya" ditolak |
| L4 | ☐ Menu ⋯ **Notula** → Nonaktifkan / Hapus | Tidak bisa: masih tercantum pada Konsumsi ("Wajib di: Konsumsi") / jenis bawaan |
| L5 | ☐ **Jenis Pengajuan** → **Tambah Jenis Pengajuan**: "Kontrak Borongan", singkat "Borongan", awalan **KBR**, model **Umum**, batas 3 orang, berkas Laporan Pekerjaan, Presensi, Kontrak (**Tambah berkas**, atur urutan dengan ↑↓; Presensi diubah ke **Tidak wajib**), mekanisme **KO atau LS**, kata kunci "tenaga lepas", warna & ikon | Tersimpan; kartu menampilkan KBR-YYYY-NNNN, model, maks. 3 orang, "Berkas · 2 wajib, 1 tidak wajib" (Presensi bertanda "· tidak wajib"). Saat mengeklik warna/ikon, judul dialog tetap di tempat (tidak bergeser & tidak ada ruang kosong di bawah) |
| L6 | ☐ Coba awalan yang sudah dipakai (mis. KSM) / nama yang sama | Ditolak dengan pesan pada isian terkait |
| L7 | ☐ Login operator → **Buat Pengajuan** | Ada kartu **Kontrak Borongan** (UMUM, maks. 3 orang, berkasnya; Presensi "· tidak wajib") |
| L8 | ☐ Pilih Kontrak Borongan: isi nama, **Tanggal / mulai periode** + **Sampai (opsional)**, mekanisme, 1–3 penerima + nilai (+ bank & rekening opsional) → Simpan draft | Tidak ada isian lokasi; tombol tambah orang berhenti di 3; kode **KBR-YYYY-0001**; tabel berkas: Laporan Pekerjaan & Kontrak berpil **Wajib**, Presensi tanpa pil; kelengkapan "0 dari 2 berkas wajib"; total = jumlah nilai |
| L8a | ☐ Unggah Presensi (tidak wajib) | Status *Belum Verifikasi*, hitungan berkas wajib tetap 0/2; di bawah tabel: "Belum dapat diajukan — unggah 2 berkas wajib lagi: Laporan Pekerjaan, Kontrak." |
| L9 | ☐ Admin ubah berkas Kontrak Borongan (tambah "Kuitansi" sebagai **Tidak wajib**, ubah Kontrak ke **Tidak wajib**) | Toast "1 pengajuan Draft/Dikembalikan ikut …"; draft tadi menampilkan Kuitansi + riwayat "Berkas mengikuti master — tidak wajib lagi: Kontrak · opsional baru: Kuitansi"; pengajuan yang sudah diajukan ke PUM tidak berubah |
| L9a | ☐ Ubah **Transport Perjadin** → mekanisme **KO atau LS**, simpan; lalu kembalikan ke **Selalu LS** | Saat "KO atau LS", form Perjadin kembali menampilkan pilihan Mekanisme; saat "Selalu LS" pilihan hilang dan pengajuan baru tersimpan LS |
| L10 | ☐ PUM memproses pengajuan Kontrak Borongan sampai **Selesai (Paid)** | Alur sama dengan jenis lain; muncul di dashboard (warna sendiri), rekap per pengajuan & per pegawai, filter kategori (dropdown), PDF/Excel |
| L11 | ☐ Nonaktifkan Kontrak Borongan | Hilang dari Buat Pengajuan; pengajuan lama tetap bisa dibuka & diproses; awalan kode terkunci bila sudah dipakai |
| L12 | ☐ **Project & Task** → tahun anggaran **2026** → tab **Task Name** → **Tambah Task 2026** (kode tanpa "_"); tab **Project Costing** → **Tambah Project 2026** + centang task + pilih **kode dana** tiap task | Kartu project menampilkan task + chip "Dana 51/61"; muncul di kotak cari PUM (Verifikasi / Ubah task name / project / kode dana); memilih task itu mengisi project (bila satu-satunya) & kode dana otomatis |
| L12a | ☐ Kartu project data Kasubdit | Tiap task berkode dana sesuai laporan sisa anggaran 2026: *D0030.09.01.6.001* & *D0030.06.01.6.002* = **Dana 61**, lainnya **Dana 51** |
| L12b | ☐ Pilih tahun **2027** | Kartu "Master tahun anggaran 2027 masih kosong" + tombol **Salin dari 2026** → konfirmasi → seluruh project, task, pasangan & kode dana 2026 tersalin ke 2027 (bisa diubah tanpa memengaruhi 2026) |
| L12c | ☐ Tab **Kode Dana** → **Tambah Kode Dana** (mis. `71`, "Dana Hibah"); ubah nama; nonaktifkan; hapus | Kode dana baru bisa dipilih pada pasangan project–task & oleh PUM; kode yang sudah dipakai pasangan/pengajuan tidak bisa dihapus (nonaktifkan saja) |
| L13 | ☐ **Bank** → tambah "Bank Nagari", lalu nonaktifkan | Muncul / hilang dari saran isian Bank pada form Konsumsi & Pegawai; rekening yang sudah tersimpan tidak berubah |
| L14 | ☐ Operator → Konsumsi → pilih "uang siapa" pegawai yang punya rekening | Bank & No. Rekening terisi otomatis ("diisi otomatis dari data pegawai"); ganti pegawai → ikut berganti; isian yang diubah manual tidak ditimpa |
| L15 | ☐ Admin → **Jenis Berkas** → kartu *Surat Tugas* | Tertulis "Wajib di: Transport Rumah Tangga, Transport Perjadin" + tautan **Atur wajib / tidak wajib** (juga di menu ⋯) |
| L16 | ☐ **Atur wajib / tidak wajib** → *Transport Rumah Tangga* = **Tidak wajib** (Perjadin tetap **Wajib**) → **Simpan** | Toast "Pengaturan wajib Surat Tugas disimpan" (+ jumlah Draft/Dikembalikan yang ikut berubah); kartu: "Wajib di: Transport Perjadin" & "Tidak wajib di: Transport Rumah Tangga"; Master **Jenis Pengajuan** → Rumah Tangga menampilkan "Surat Tugas · tidak wajib" (data sama) |
| L17 | ☐ Operator → draft Rumah Tangga yang baru berisi *Laporan Kegiatan* | Surat Tugas tanpa pil Wajib; kotak hijau "Semua berkas wajib sudah diunggah"; bisa diajukan. Setelah selesai menguji, kembalikan Surat Tugas ke **Wajib** |
| L18 | ☐ Kartu jenis berkas yang belum dipakai (mis. *Kuitansi* baru dari L3) | "Belum dipakai jenis pengajuan mana pun"; menu ⋯ "Atur wajib (belum dipakai)" nonaktif — cantumkan dulu di Master Jenis Pengajuan |

## M. Pengaju tanpa master data & Profil (rekening sendiri)

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| M1 | ☐ Login `operator` → perhatikan menu | Tidak ada grup **Master Data / Pegawai**; membuka `/pegawai` → "Tidak memiliki akses" |
| M2 | ☐ Operator → **Pengaturan** | Kartu **Profil**: "Akun Anda belum ditautkan ke data pegawai…" |
| M3 | ☐ Login `admin` → **Pengguna** → ubah akun operator → **Data pegawai (opsional)**: pilih nama pegawainya → **Simpan perubahan** | Di daftar akun muncul "Data pegawai: <nama>"; pegawai yang sama tidak bisa ditautkan ke akun lain ("Sudah ditautkan ke akun …") |
| M4 | ☐ Operator → Pengaturan → **Profil**: isi Bank & No. Rekening → **Simpan rekening** | Toast "Rekening disimpan"; nomor dibersihkan dari spasi/titik; bank tanpa nomor (atau sebaliknya) ditolak; bila bukan Bank Mandiri catatan biaya transfer berwarna kuning |
| M5 | ☐ Operator → Buat Pengajuan → pilih nama dirinya sebagai "Uang siapa" / penerima | Bank & No. Rekening terisi otomatis dari profil |
| M6 | ☐ Admin → ubah akun → **Lepas** data pegawai → simpan | Profil operator kembali "belum ditautkan"; rekening yang sudah tersimpan di data pegawai tetap ada |
| M7 | ☐ Admin → **Setujui** pendaftaran baru: pilih peran + data pegawai | Akun aktif sekaligus tertaut ke data pegawai |

---

### Catatan temuan

| No. langkah | Yang terjadi | Seharusnya | Tangkapan layar |
|---|---|---|---|
| | | | |
