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
  pengajuan, kode_counter, pegawai, sessions, users cascade;
drop type if exists aksi_riwayat_enum, jenis_notifikasi_enum, status_cek_enum,
  jenis_konsumsi_enum, jenis_transport_enum, jenis_uang_enum, status_enum, mekanisme_enum, kategori_enum, role_enum cascade;

-- ─── 2. Tipe enum (sumber: shared/constants.ts) ───────────────
create type role_enum as enum ('operator', 'pum', 'pimpinan', 'admin');
create type kategori_enum as enum ('konsumsi', 'rumah_tangga', 'perjadin');
create type mekanisme_enum as enum ('KO', 'LS');
create type status_enum as enum ('draft', 'diajukan_pum', 'dikembalikan', 'diajukan_mdk', 'selesai');
create type jenis_uang_enum as enum ('uang_harian', 'uang_transport');
create type jenis_transport_enum as enum ('dalam_kota', 'luar_kota');
create type jenis_konsumsi_enum as enum ('kudapan', 'makan_siang', 'kudapan_makan_siang');
create type status_cek_enum as enum ('sesuai', 'revisi');
create type aksi_riwayat_enum as enum (
  'dibuat', 'diubah', 'dihapus',
  'berkas_diunggah', 'berkas_dihapus', 'berkas_na', 'berkas_na_batal',
  'diajukan', 'ditarik', 'berkas_dicek', 'berkas_revisi', 'berkas_cek_batal',
  'dikembalikan', 'diteruskan_mdk', 'data_pum_diubah', 'selesai', 'invoice_diubah', 'selesai_dibatalkan',
  'dibayarkan', 'dibayarkan_batal'
);
create type jenis_notifikasi_enum as enum (
  'diajukan', 'dikembalikan', 'diteruskan_mdk', 'selesai', 'selesai_dibatalkan', 'registrasi', 'dibayarkan'
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
  id          bigserial primary key,
  nama        text not null,
  nip         text unique,
  jabatan     text,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table kode_counter (
  prefix      text not null,
  tahun       integer not null,
  terakhir    integer not null,
  primary key (prefix, tahun)
);

create table pengajuan (
  id                  bigserial primary key,
  kode                text not null unique,
  kategori            kategori_enum not null,
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
  diteruskan_by       bigint references users (id),
  diteruskan_at       timestamptz,
  diproses_by         bigint references users (id),
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
