-- ============================================================
-- Migrasi 2026-10-08 — Master Data (dikelola admin):
--   • Jenis Pengajuan (kategori) + berkas wajib per jenis, Jenis Berkas, Bank,
--     Project Costing & Task Name (dulu tertanam di kode), rekening pegawai.
--   • pengajuan.kategori: enum → teks yang merujuk master jenis_pengajuan (bisa menambah jenis baru).
--   • pengajuan.berkas_daftar: daftar berkas wajib per pengajuan (dibekukan saat diajukan ke PUM),
--     sehingga perubahan master tidak mengubah pengajuan yang sudah diajukan/selesai.
--
-- Untuk database yang dibuat sebelum fitur ini. Aman dijalankan berulang: hanya membuat tabel & kolom baru,
-- mengisi data awal bila tabelnya masih kosong, dan mengubah tipe kolom kategori tanpa mengubah isinya.
-- Data awal = daftar yang selama ini tertanam di kode (3 jenis pengajuan, 8 jenis berkas + 3 contoh untuk
-- Kontrak Borongan, 17 bank, 15 project / 18 task / 38 pasangan dari Kasubdit).
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

-- ─── 1. Tabel master ─────────────────────────────────────────
create table if not exists public.jenis_berkas (
  kode        text primary key check (kode ~ '^[a-z][a-z0-9_]{1,39}$' and kode <> 'lainnya'),
  label       text not null,
  keterangan  text,
  aktif       boolean not null default true,
  bawaan      boolean not null default false,
  urutan      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists ux_jenis_berkas_label on public.jenis_berkas (lower(label));

create table if not exists public.jenis_pengajuan (
  kode             text primary key check (kode ~ '^[a-z][a-z0-9_]{1,39}$'),
  label            text not null,
  label_pendek     text not null,
  prefix           text not null unique check (prefix ~ '^[A-Z]{2,5}$'),
  deskripsi        text,
  model            text not null check (model in ('konsumsi', 'rumah_tangga', 'perjadin', 'umum')),
  maks_peserta     integer check (maks_peserta is null or maks_peserta between 1 and 50),
  kata_kunci_task  text,
  warna            text not null,
  ikon             text not null,
  aktif            boolean not null default true,
  bawaan           boolean not null default false,
  urutan           integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists ux_jenis_pengajuan_label on public.jenis_pengajuan (lower(label));

create table if not exists public.jenis_pengajuan_berkas (
  jenis_pengajuan  text not null references public.jenis_pengajuan (kode) on delete cascade,
  jenis_berkas     text not null references public.jenis_berkas (kode),
  urutan           integer not null,
  primary key (jenis_pengajuan, jenis_berkas)
);

create table if not exists public.bank (
  id          bigserial primary key,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists ux_bank_nama on public.bank (lower(nama));

create table if not exists public.master_project (
  id          bigserial primary key,
  kode        text not null unique,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.master_task (
  id          bigserial primary key,
  kode        text not null unique,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.master_project_task (
  project_id  bigint not null references public.master_project (id) on delete cascade,
  task_id     bigint not null references public.master_task (id) on delete cascade,
  primary key (project_id, task_id)
);
create index if not exists ix_master_project_task_task on public.master_project_task (task_id);

-- ─── 2. Data awal (hanya bila tabelnya masih kosong) ─────────
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

-- ─── 3. Rekening pegawai ─────────────────────────────────────
alter table public.pegawai add column if not exists rekening_bank text;
alter table public.pegawai add column if not exists rekening_nomor text;

-- ─── 4. Pengajuan: kategori merujuk master, daftar berkas wajib per pengajuan ──
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'pengajuan' and column_name = 'kategori') = 'USER-DEFINED' then
    alter table public.pengajuan alter column kategori type text using kategori::text;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pengajuan_kategori_fkey') then
    alter table public.pengajuan
      add constraint pengajuan_kategori_fkey foreign key (kategori) references public.jenis_pengajuan (kode);
  end if;
end $$;

alter table public.pengajuan add column if not exists berkas_daftar jsonb;

-- Pengajuan lama: daftar berkas wajibnya = daftar bawaan kategorinya (sama persis dengan sebelumnya).
update public.pengajuan p
   set berkas_daftar = coalesce(
         (select jsonb_agg(m.jenis_berkas order by m.urutan)
            from public.jenis_pengajuan_berkas m
           where m.jenis_pengajuan = p.kategori),
         '[]'::jsonb)
 where p.berkas_daftar is null;

-- ─── 5. Keamanan: hanya server (DATABASE_URL) yang boleh membaca/menulis ──
alter table public.jenis_berkas enable row level security;
alter table public.jenis_pengajuan enable row level security;
alter table public.jenis_pengajuan_berkas enable row level security;
alter table public.bank enable row level security;
alter table public.master_project enable row level security;
alter table public.master_task enable row level security;
alter table public.master_project_task enable row level security;
revoke all on public.jenis_berkas, public.jenis_pengajuan, public.jenis_pengajuan_berkas, public.bank, public.master_project, public.master_task, public.master_project_task from anon, authenticated;
revoke all on sequence public.bank_id_seq, public.master_project_id_seq, public.master_task_id_seq from anon, authenticated;

-- Cek hasil: jumlah data master & pengajuan yang belum punya daftar berkas (harus 0).
select (select count(*) from public.jenis_pengajuan) as jenis_pengajuan,
       (select count(*) from public.jenis_berkas) as jenis_berkas,
       (select count(*) from public.bank) as bank,
       (select count(*) from public.master_project) as project,
       (select count(*) from public.master_task) as task,
       (select count(*) from public.master_project_task) as pasangan_project_task,
       (select count(*) from public.pengajuan where berkas_daftar is null) as pengajuan_tanpa_daftar_berkas;
