-- ============================================================
-- KAS OPERASIONAL DPBJ UI — skema database Supabase (PostgreSQL)
--
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor → New query.
--   2. Tempel seluruh isi file ini, lalu klik RUN.
--   3. Jalankan ulang hanya jika tabel-tabel aplikasi masih kosong.
--      Skrip ini MENOLAK berjalan bila ada data (lihat blok pengaman).
--
-- Prasyarat: akun login sudah dibuat di Authentication → Users
-- (email + password). Baris profil (peran, nama) dibuat otomatis
-- oleh bagian paling bawah untuk akun yang emailnya tercantum di sana.
-- ============================================================

-- ─── 0. Pengaman: jangan menghapus data yang sudah terisi ─────
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['users', 'sessions', 'pegawai', 'kode_counter', 'pengajuan',
                           'pengajuan_peserta', 'berkas', 'riwayat', 'cek_berkas', 'notifikasi'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'Skrip dibatalkan: tabel public.% masih berisi % baris. Kosongkan dulu bila memang ingin reset.', t, n;
      end if;
    end if;
  end loop;
end $$;

-- ─── 1. Bersihkan objek lama (tabel sudah kosong, aman) ───────
drop table if exists notifikasi, cek_berkas, riwayat, berkas, pengajuan_peserta,
  pengajuan, kode_counter, pegawai, sessions, users,
  jenis_pengajuan_berkas, jenis_pengajuan, jenis_berkas, bank,
  master_project_task, master_project, master_task cascade;
drop type if exists aksi_riwayat_enum, jenis_notifikasi_enum, status_cek_enum,
  jenis_konsumsi_enum, jenis_transport_enum, jenis_uang_enum, status_enum, mekanisme_enum, kategori_enum, role_enum cascade;

-- ─── 2. Tipe enum (sumber: shared/constants.ts) ───────────────
-- Kategori (jenis pengajuan) bukan enum: daftarnya master data (tabel jenis_pengajuan).
create type role_enum as enum ('operator', 'pum', 'pimpinan', 'admin');
create type mekanisme_enum as enum ('KO', 'LS');
create type status_enum as enum ('draft', 'diajukan_pum', 'dikembalikan', 'diverifikasi_pum', 'diajukan_mdk', 'selesai');
create type jenis_uang_enum as enum ('uang_harian', 'uang_transport');
create type jenis_transport_enum as enum ('dalam_kota', 'luar_kota');
create type jenis_konsumsi_enum as enum ('kudapan', 'makan_siang', 'kudapan_makan_siang');
create type status_cek_enum as enum ('sesuai', 'revisi');
create type aksi_riwayat_enum as enum (
  'dibuat', 'diubah', 'dihapus',
  'berkas_diunggah', 'berkas_dihapus', 'berkas_na', 'berkas_na_batal',
  'diajukan', 'ditarik', 'berkas_dicek', 'berkas_revisi', 'berkas_cek_batal',
  'dikembalikan', 'diteruskan_mdk', 'data_pum_diubah', 'selesai', 'invoice_diubah', 'selesai_dibatalkan',
  'dibayarkan', 'dibayarkan_batal', 'diverifikasi', 'diajukan_mdk'
);
create type jenis_notifikasi_enum as enum (
  'diajukan', 'dikembalikan', 'diteruskan_mdk', 'selesai', 'selesai_dibatalkan', 'registrasi', 'dibayarkan',
  'diverifikasi', 'diajukan_mdk'
);

-- ─── 3. Tabel ─────────────────────────────────────────────────

-- Profil pengguna aplikasi. Kata sandi dikelola Supabase Auth (auth.users),
-- tabel ini hanya menyimpan peran dan status aktif, terhubung lewat auth_id.
create table users (
  id          bigserial primary key,
  auth_id     uuid unique references auth.users (id) on delete set null,
  username    text not null unique check (username = lower(username)), -- = email login
  nama        text not null,
  role        role_enum not null,
  aktif       boolean not null default true,
  -- Mendaftar sendiri (halaman Daftar) & belum disetujui admin: aktif = false sampai disetujui.
  menunggu_persetujuan boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table sessions (
  token_hash  text primary key,
  user_id     bigint not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index ix_sessions_user on sessions (user_id);
create index ix_sessions_expires on sessions (expires_at);

create table pegawai (
  id              bigserial primary key,
  nama            text not null,
  nip             text unique,
  jabatan         text,
  rekening_bank   text,                         -- rekening pegawai (opsional, berpasangan) → isi otomatis "uang siapa"
  rekening_nomor  text,
  aktif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Master data (dikelola admin, menu Master Data) ──────────

-- Jenis berkas kelengkapan. "Dokumen Lainnya" (kode lainnya) bukan bagian master: selalu opsional.
create table jenis_berkas (
  kode        text primary key check (kode ~ '^[a-z][a-z0-9_]{1,39}$' and kode <> 'lainnya'),
  label       text not null,
  keterangan  text,
  aktif       boolean not null default true,
  bawaan      boolean not null default false,   -- bawaan sistem: tidak dapat dihapus
  urutan      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ux_jenis_berkas_label on jenis_berkas (lower(label));

-- Jenis pengajuan (kategori). model = bentuk form & aturan isian:
-- konsumsi (uang siapa + jumlah uang), rumah_tangga / perjadin (transport per orang), umum (pegawai + nilai per orang).
create table jenis_pengajuan (
  kode             text primary key check (kode ~ '^[a-z][a-z0-9_]{1,39}$'),
  label            text not null,
  label_pendek     text not null,
  prefix           text not null unique check (prefix ~ '^[A-Z]{2,5}$'),  -- awalan kode pengajuan, mis. KSM
  deskripsi        text,
  model            text not null check (model in ('konsumsi', 'rumah_tangga', 'perjadin', 'umum')),
  maks_peserta     integer check (maks_peserta is null or maks_peserta between 1 and 50),
  kata_kunci_task  text,                         -- saran Task Name otomatis (cocok sebagian nama task)
  warna            text not null,
  ikon             text not null,
  aktif            boolean not null default true,
  bawaan           boolean not null default false,
  urutan           integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index ux_jenis_pengajuan_label on jenis_pengajuan (lower(label));

-- Berkas wajib per jenis pengajuan.
create table jenis_pengajuan_berkas (
  jenis_pengajuan  text not null references jenis_pengajuan (kode) on delete cascade,
  jenis_berkas     text not null references jenis_berkas (kode),
  urutan           integer not null,
  primary key (jenis_pengajuan, jenis_berkas)
);

create table bank (
  id          bigserial primary key,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ux_bank_nama on bank (lower(nama));

-- Project Costing & Task Name (Kasubdit). Disimpan di pengajuan sebagai teks "<kode>:<nama>" / "<kode>_<nama>".
create table master_project (
  id          bigserial primary key,
  kode        text not null unique,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table master_task (
  id          bigserial primary key,
  kode        text not null unique,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table master_project_task (
  project_id  bigint not null references master_project (id) on delete cascade,
  task_id     bigint not null references master_task (id) on delete cascade,
  primary key (project_id, task_id)
);
create index ix_master_project_task_task on master_project_task (task_id);

create table kode_counter (
  prefix      text not null,
  tahun       integer not null,
  terakhir    integer not null,
  primary key (prefix, tahun)
);

create table pengajuan (
  id                  bigserial primary key,
  kode                text not null unique,
  kategori            text not null references jenis_pengajuan (kode),
  nama_kegiatan       text not null,
  tanggal_kegiatan    date not null,
  tanggal_selesai     date,
  jumlah_orang        integer not null check (jumlah_orang >= 0),
  lokasi_tujuan       text,
  mekanisme           mekanisme_enum not null,
  jenis_uang          jenis_uang_enum,          -- data lama Perjadin; kini rincian per orang di pengajuan_peserta
  jenis_transport     jenis_transport_enum,
  jenis_konsumsi      jenis_konsumsi_enum,      -- hanya kategori konsumsi
  uang_siapa_id       bigint references pegawai (id),
  rekening_bank       text,                     -- rekening "uang siapa" (konsumsi, opsional)
  rekening_nomor      text,
  dibayar_at          timestamptz,              -- PUM menandai uang sudah dibayarkan ke pemilik uang
  dibayar_by          bigint references users (id),
  total               bigint not null default 0 check (total >= 0),
  catatan             text,
  berkas_na           jsonb not null default '[]'::jsonb,
  -- Berkas wajib pengajuan ini (kode jenis berkas, urut). Mengikuti master selama draft/dikembalikan,
  -- dibekukan saat diajukan ke PUM. null = belum dicatat → ikut master jenis pengajuannya.
  berkas_daftar       jsonb,
  berkas_terpenuhi    integer not null default 0,
  berkas_wajib        integer not null default 0,
  status              status_enum not null default 'draft',
  no_invoice_mdk      text,
  tanggal_invoice_mdk date,
  catatan_pum         text,
  project_hosting     text,
  task_name           text,
  created_by          bigint not null references users (id),
  updated_by          bigint references users (id),
  diajukan_at         timestamptz,
  diteruskan_by       bigint references users (id),   -- data lama (alur sebelum Okt 2026)
  diteruskan_at       timestamptz,
  diverifikasi_by     bigint references users (id),   -- PUM memverifikasi (semua berkas sesuai)
  diverifikasi_at     timestamptz,
  diajukan_mdk_by     bigint references users (id),   -- PUM menginput No. Invoice = diajukan ke MDK
  diajukan_mdk_at     timestamptz,
  diproses_by         bigint references users (id),   -- dikembalikan PUM / ditandai selesai (paid)
  diproses_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index ix_pengajuan_status on pengajuan (status);
create index ix_pengajuan_kategori on pengajuan (kategori);
create index ix_pengajuan_tanggal on pengajuan (tanggal_kegiatan);
create index ix_pengajuan_uang_siapa on pengajuan (uang_siapa_id);

create table pengajuan_peserta (
  id            bigserial primary key,
  pengajuan_id  bigint not null references pengajuan (id) on delete cascade,
  pegawai_id    bigint not null references pegawai (id),
  nilai         bigint not null check (nilai > 0),
  -- Perjadin: nilai = uang_harian + uang_transport (Rumah Tangga: keduanya null)
  uang_harian   bigint constraint pengajuan_peserta_uang_harian_check check (uang_harian is null or uang_harian >= 0),
  uang_transport bigint constraint pengajuan_peserta_uang_transport_check check (uang_transport is null or uang_transport >= 0),
  urutan        integer not null,
  unique (pengajuan_id, pegawai_id)
);
create index ix_peserta_pegawai on pengajuan_peserta (pegawai_id);

-- nama_file = kunci objek di Supabase Storage (bucket "berkas"), format: <pengajuan_id>/<uuid>.<ext>
create table berkas (
  id            bigserial primary key,
  pengajuan_id  bigint not null references pengajuan (id) on delete cascade,
  jenis         text not null,
  nama_berkas   text,
  nama_asli     text not null,
  nama_file     text not null unique,
  mime          text not null,
  ukuran        bigint not null,
  uploaded_by   bigint not null references users (id),
  created_at    timestamptz not null default now()
);
create index ix_berkas_pengajuan on berkas (pengajuan_id);

create table riwayat (
  id            bigserial primary key,
  pengajuan_id  bigint references pengajuan (id) on delete set null,
  kode          text not null,
  user_id       bigint references users (id),
  aksi          aksi_riwayat_enum not null,
  keterangan    text,
  created_at    timestamptz not null default now()
);
create index ix_riwayat_pengajuan on riwayat (pengajuan_id);
create index ix_riwayat_waktu on riwayat (created_at);

create table cek_berkas (
  pengajuan_id  bigint not null references pengajuan (id) on delete cascade,
  jenis         text not null,
  status        status_cek_enum not null,
  catatan       text,
  diperiksa_by  bigint not null references users (id),
  diperiksa_at  timestamptz not null,
  primary key (pengajuan_id, jenis)
);

create table notifikasi (
  id            bigserial primary key,
  user_id       bigint not null references users (id) on delete cascade,
  pengajuan_id  bigint references pengajuan (id) on delete set null,
  kode          text not null,
  jenis         jenis_notifikasi_enum not null,
  judul         text not null,
  pesan         text not null,
  dibaca_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index ix_notifikasi_user on notifikasi (user_id, dibaca_at, id);

-- ─── 3a. Data awal master data ─────────────────────────────────
-- Blok di antara penanda di bawah juga dipakai test (tests/api/helpers.ts) untuk mengisi ulang master.
-- Setiap INSERT hanya berjalan bila tabelnya masih kosong.
-- [SEED-MASTER:MULAI]
-- Jenis berkas (kelengkapan). "Dokumen Lainnya" (lainnya) bukan bagian master: selalu opsional.
insert into jenis_berkas (kode, label, bawaan, urutan)
select v.* from (values
  ('notulen', 'Notula', true, 1),
  ('undangan', 'Undangan', true, 2),
  ('invoice', 'Invoice', true, 3),
  ('daftar_hadir', 'Daftar Hadir', true, 4),
  ('surat_tugas', 'Surat Tugas', true, 5),
  ('laporan_kegiatan', 'Laporan Kegiatan', true, 6),
  ('invoice_hotel', 'Invoice Hotel', true, 7),
  ('invoice_tiket', 'Invoice Tiket', true, 8),
  ('laporan_pekerjaan', 'Laporan Pekerjaan', false, 9),
  ('presensi', 'Presensi', false, 10),
  ('kontrak', 'Kontrak', false, 11)
) as v (kode, label, bawaan, urutan)
where not exists (select 1 from jenis_berkas);

-- Jenis pengajuan bawaan (model form tetap). Jenis baru ditambahkan admin lewat menu Master Data.
insert into jenis_pengajuan (kode, label, label_pendek, prefix, deskripsi, model, maks_peserta, kata_kunci_task, warna, ikon, bawaan, urutan)
select v.* from (values
  ('konsumsi', 'Konsumsi', 'Konsumsi', 'KSM', 'Konsumsi rapat / kegiatan', 'konsumsi', null::integer, 'konsumsi', 'kuning', 'coffee', true, 1),
  ('rumah_tangga', 'Transport Rumah Tangga', 'Rumah Tangga', 'TRT', 'Transport kegiatan rumah tangga', 'rumah_tangga', 2, 'transportasi rumah tangga', 'biru', 'car', true, 2),
  ('perjadin', 'Transport Perjadin', 'Perjadin', 'TPD', 'Perjalanan dinas dalam / luar kota', 'perjadin', 2, 'perjadin', 'hijau', 'plane', true, 3)
) as v (kode, label, label_pendek, prefix, deskripsi, model, maks_peserta, kata_kunci_task, warna, ikon, bawaan, urutan)
where not exists (select 1 from jenis_pengajuan);

-- Berkas wajib per jenis pengajuan (urutan = urutan tampil).
insert into jenis_pengajuan_berkas (jenis_pengajuan, jenis_berkas, urutan)
select v.* from (values
  ('konsumsi', 'notulen', 1),
  ('konsumsi', 'undangan', 2),
  ('konsumsi', 'invoice', 3),
  ('konsumsi', 'daftar_hadir', 4),
  ('rumah_tangga', 'surat_tugas', 1),
  ('rumah_tangga', 'laporan_kegiatan', 2),
  ('perjadin', 'surat_tugas', 1),
  ('perjadin', 'laporan_kegiatan', 2),
  ('perjadin', 'invoice_hotel', 3),
  ('perjadin', 'invoice_tiket', 4)
) as v (jenis_pengajuan, jenis_berkas, urutan)
where not exists (select 1 from jenis_pengajuan_berkas);

-- Daftar bank untuk isian rekening.
insert into bank (nama)
select v.nama from (values
  ('Bank Mandiri'),
  ('BNI'),
  ('BRI'),
  ('BTN'),
  ('BSI (Bank Syariah Indonesia)'),
  ('BCA'),
  ('CIMB Niaga'),
  ('Bank Permata'),
  ('Bank Danamon'),
  ('Bank DKI'),
  ('Bank BJB'),
  ('Bank Mega'),
  ('OCBC'),
  ('Maybank Indonesia'),
  ('Panin Bank'),
  ('SeaBank'),
  ('Bank Jago')
) as v (nama)
where not exists (select 1 from bank);

-- Master Project Costing & Task Name dari Kasubdit (15 project, 18 task, 38 pasangan).
insert into master_project (kode, nama)
select v.* from (values
  ('D0030.06.01.6.001', 'Penguatan Manajemen Kontrak'),
  ('D0030.06.01.6.002', 'Penguatan Perencanaan, Pelaksanaan, dan Pengendalian'),
  ('D0030.06.01.6.003', 'Perancangan dan Persiapan SCM'),
  ('D0030.07.01.6.001', 'Sosialisasi Revisi PRPBJ dan E-Proc'),
  ('D0030.09.01.6.001', 'Benchmarking Pengadaan Barang dan Jasa'),
  ('D0030.09.01.6.002', 'Koordinasi Tata Kelola Pengadaan'),
  ('D0030.09.01.6.003', 'Penyusunan Laporan Pengadaan Barang dan Jasa'),
  ('D0030.09.01.6.004', 'Pengelolaan Sistem Informasi dan Penyedia Pengadaan B'),
  ('D0030.10.01.6.001', 'Rapat Koordinasi Lintas Bidang Pengadaan Barang&Jasa'),
  ('D0030.10.01.6.002', 'Koordinasi Perencanaan dan Pengadaan Langsung'),
  ('D0030.10.01.6.003', 'Survei Pengelolaan Kontrak'),
  ('D0030.10.01.6.004', 'Koordinasi Pengelolaan Kontrak'),
  ('D0030.10.01.6.005', 'Undangan, penugasan, koordinasi kelembagaan & temuan'),
  ('D0030.12.01.6.001', 'Survei Perencanaan dan Pengadaan Langsung'),
  ('D0072.11.01.6.001', 'Operasional Administrasi Kantor')
) as v (kode, nama)
where not exists (select 1 from master_project);

insert into master_task (kode, nama)
select v.* from (values
  ('721702', 'Honor Moderator/Pembicara/Fasilitator'),
  ('721707', 'Honor Tenaga Lepas'),
  ('722111', 'Beban Uang Harian - Perjadin Luar Kota'),
  ('722112', 'Beban Penginapan - Perjadin Luar Kota'),
  ('722113', 'Beban Tiket - Perjadin Luar Kota'),
  ('722114', 'Beban Transportasi Perjadin - Perjadin Luar Kota'),
  ('722121', 'Beban Uang Harian - Perjadin Luar Negeri'),
  ('722122', 'Beban Penginapan - Perjadin Luar Negeri'),
  ('722123', 'Beban Tiket - Perjadin Luar Negeri'),
  ('722124', 'Beban Transportasi Perjadin - Perjadin Luar Negeri'),
  ('722201', 'Beban Jasa Konsultan'),
  ('722209', 'Beban Jasa Cetak'),
  ('722214', 'Beban Jasa Orang Pribadi'),
  ('723202', 'Beban Pengiriman Surat/Dokumen'),
  ('723207', 'Beban Konsumsi'),
  ('723216', 'Beban Transportasi Rumah Tangga'),
  ('723601', 'Beban Perizinan'),
  ('723705', 'Beban Foto Copy/Penjilidan')
) as v (kode, nama)
where not exists (select 1 from master_task);

insert into master_project_task (project_id, task_id)
select p.id, t.id from (values
  ('D0030.07.01.6.001', '723207'),
  ('D0030.09.01.6.002', '723216'),
  ('D0072.11.01.6.001', '723216'),
  ('D0030.06.01.6.001', '721707'),
  ('D0030.10.01.6.002', '723207'),
  ('D0030.10.01.6.003', '722111'),
  ('D0030.09.01.6.002', '723207'),
  ('D0030.10.01.6.003', '722114'),
  ('D0030.12.01.6.001', '723216'),
  ('D0030.10.01.6.001', '723216'),
  ('D0030.09.01.6.003', '723705'),
  ('D0030.10.01.6.003', '723216'),
  ('D0072.11.01.6.001', '723202'),
  ('D0030.09.01.6.004', '721707'),
  ('D0030.09.01.6.001', '722123'),
  ('D0030.09.01.6.002', '722113'),
  ('D0030.09.01.6.001', '722121'),
  ('D0030.12.01.6.001', '722112'),
  ('D0030.10.01.6.001', '723207'),
  ('D0030.07.01.6.001', '721702'),
  ('D0030.09.01.6.002', '722114'),
  ('D0030.09.01.6.002', '722111'),
  ('D0030.06.01.6.002', '723207'),
  ('D0030.10.01.6.003', '722113'),
  ('D0030.09.01.6.002', '722112'),
  ('D0030.09.01.6.002', '723601'),
  ('D0030.12.01.6.001', '722114'),
  ('D0030.12.01.6.001', '722113'),
  ('D0030.10.01.6.003', '722112'),
  ('D0030.12.01.6.001', '722111'),
  ('D0030.09.01.6.001', '722124'),
  ('D0030.09.01.6.003', '722209'),
  ('D0030.06.01.6.002', '721707'),
  ('D0030.10.01.6.005', '723216'),
  ('D0030.09.01.6.001', '722122'),
  ('D0030.10.01.6.004', '723207'),
  ('D0030.06.01.6.003', '722214'),
  ('D0030.06.01.6.003', '722201')
) as v (project_kode, task_kode)
join master_project p on p.kode = v.project_kode
join master_task t on t.kode = v.task_kode
where not exists (select 1 from master_project_task);
-- [SEED-MASTER:SELESAI]

-- ─── 4. Keamanan ──────────────────────────────────────────────
-- Aplikasi mengakses database lewat server (DATABASE_URL, role postgres) sehingga
-- tidak terpengaruh RLS. Kunci anon yang ada di browser TIDAK boleh membaca/menulis
-- tabel ini, karena itu RLS dinyalakan tanpa kebijakan dan hak akses anon/authenticated dicabut.
alter table users enable row level security;
alter table sessions enable row level security;
alter table pegawai enable row level security;
alter table kode_counter enable row level security;
alter table pengajuan enable row level security;
alter table pengajuan_peserta enable row level security;
alter table berkas enable row level security;
alter table riwayat enable row level security;
alter table cek_berkas enable row level security;
alter table notifikasi enable row level security;
alter table jenis_berkas enable row level security;
alter table jenis_pengajuan enable row level security;
alter table jenis_pengajuan_berkas enable row level security;
alter table bank enable row level security;
alter table master_project enable row level security;
alter table master_task enable row level security;
alter table master_project_task enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ─── 5. Penyimpanan berkas (bucket privat) ────────────────────
-- Batas 10 MB dan jenis file mengikuti shared/constants.ts (UPLOAD_DIIZINKAN).
-- Berkas diunduh lewat URL bertanda tangan yang dibuat server, bukan akses publik.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'berkas', 'berkas', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── 6. Profil untuk akun Supabase Auth yang sudah Anda buat ──
-- Peran di bawah ini adalah tebakan dari email. Ubah lewat menu Pengguna
-- di aplikasi (login admin) bila tidak sesuai. Akun lain bisa ditambahkan
-- dari menu Pengguna; akun tanpa profil TIDAK bisa masuk ke aplikasi.
insert into users (auth_id, username, nama, role, aktif, created_at, updated_at)
select au.id, lower(au.email), m.nama, m.peran::role_enum, true, now(), now()
from (values
  ('admin@gmail.com',    'Administrator',  'admin'),
  ('pengaju@gmail.com',  'Operator DPBJ',  'operator'),
  ('pau@gmail.com',      'Petugas PUM',    'pum'),
  ('pimpinan@gmail.com', 'Pimpinan DPBJ',  'pimpinan')
) as m (email, nama, peran)
join auth.users au on lower(au.email) = m.email;

-- Cek hasil: harus menampilkan semua akun yang ingin bisa masuk, dengan terhubung = true.
select username, nama, role, aktif, (auth_id is not null) as terhubung
from users
order by role, username;
