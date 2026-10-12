-- ============================================================
-- Migrasi 2026-10-12 — Berkas wajib/opsional, mekanisme tetap, rekening per penerima, tahun anggaran & kode dana:
--   • jenis_pengajuan_berkas.wajib: berkas per jenis pengajuan bisa wajib atau opsional (data lama = wajib).
--   • jenis_pengajuan.mekanisme_tetap: Transport Rumah Tangga & Perjadin selalu LS (pilihan KO/LS tidak ditampilkan).
--   • pengajuan_peserta.rekening_bank/rekening_nomor: bank & no. rekening tiap penerima (data lama diisi dari master Pegawai).
--   • master_project / master_task.tahun: master dikelompokkan per tahun anggaran (data lama = 2026); kode unik per tahun.
--   • master_dana + master_project_task.kode_dana + pengajuan.kode_dana: kode dana tiap pasangan project–task,
--     dari Laporan Sisa Anggaran 2026 (kolom DANA): 51 = Dana Masyarakat (BP) - Tidak Terikat,
--     61 = Dana Masyarakat (Non BP) - Tidak Terikat.
--
-- Aman dijalankan berulang: hanya menambah tabel/kolom/indeks; pengisian data hanya untuk baris yang masih kosong.
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

-- ─── 1. Mekanisme tetap per jenis pengajuan (Transport: selalu LS) ───
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'jenis_pengajuan' and column_name = 'mekanisme_tetap') then
    alter table public.jenis_pengajuan add column mekanisme_tetap public.mekanisme_enum;
    update public.jenis_pengajuan set mekanisme_tetap = 'LS' where kode in ('rumah_tangga', 'perjadin');
  end if;
end $$;

-- ─── 2. Berkas wajib / opsional ───
alter table public.jenis_pengajuan_berkas add column if not exists wajib boolean not null default true;

-- ─── 3. Rekening per penerima (Transport & model lain berpenerima) ───
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pengajuan_peserta' and column_name = 'rekening_bank') then
    alter table public.pengajuan_peserta add column rekening_bank text;
    alter table public.pengajuan_peserta add column rekening_nomor text;
    -- Sebelumnya rekening penerima ditampilkan dari master Pegawai: salin agar tampilan pengajuan lama tetap sama.
    update public.pengajuan_peserta ps
       set rekening_bank = g.rekening_bank, rekening_nomor = g.rekening_nomor
      from public.pegawai g
     where g.id = ps.pegawai_id and g.rekening_bank is not null and g.rekening_nomor is not null;
  end if;
end $$;

-- ─── 4. Kode dana ───
create table if not exists public.master_dana (
  kode        text primary key check (kode ~ '^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$'),
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
insert into public.master_dana (kode, nama)
select v.* from (values
  ('51', 'Dana Masyarakat (BP) - Tidak Terikat'),
  ('61', 'Dana Masyarakat (Non BP) - Tidak Terikat')
) as v (kode, nama)
on conflict (kode) do nothing;

alter table public.pengajuan add column if not exists kode_dana text;

-- ─── 5. Tahun anggaran master Project & Task (data lama = 2026), kode unik per tahun ───
alter table public.master_project add column if not exists tahun integer not null default 2026;
alter table public.master_project alter column tahun drop default;
alter table public.master_task add column if not exists tahun integer not null default 2026;
alter table public.master_task alter column tahun drop default;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'master_project_tahun_check') then
    alter table public.master_project add constraint master_project_tahun_check check (tahun between 2000 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'master_task_tahun_check') then
    alter table public.master_task add constraint master_task_tahun_check check (tahun between 2000 and 2100);
  end if;
end $$;
alter table public.master_project drop constraint if exists master_project_kode_key;
alter table public.master_task drop constraint if exists master_task_kode_key;
create unique index if not exists ux_master_project_tahun_kode on public.master_project (tahun, lower(kode));
create unique index if not exists ux_master_task_tahun_kode on public.master_task (tahun, lower(kode));

-- ─── 6. Kode dana per pasangan project–task (Laporan Sisa Anggaran 2026) ───
alter table public.master_project_task add column if not exists kode_dana text references public.master_dana (kode);
update public.master_project_task m
   set kode_dana = v.kode_dana
  from (values
  ('D0030.06.01.6.001', '721707', '51'),
  ('D0030.06.01.6.002', '721707', '61'),
  ('D0030.06.01.6.002', '723207', '61'),
  ('D0030.06.01.6.003', '722201', '51'),
  ('D0030.06.01.6.003', '722214', '51'),
  ('D0030.07.01.6.001', '721702', '51'),
  ('D0030.07.01.6.001', '723207', '51'),
  ('D0030.09.01.6.001', '722121', '61'),
  ('D0030.09.01.6.001', '722122', '61'),
  ('D0030.09.01.6.001', '722123', '61'),
  ('D0030.09.01.6.001', '722124', '61'),
  ('D0030.09.01.6.002', '722111', '51'),
  ('D0030.09.01.6.002', '722112', '51'),
  ('D0030.09.01.6.002', '722113', '51'),
  ('D0030.09.01.6.002', '722114', '51'),
  ('D0030.09.01.6.002', '723207', '51'),
  ('D0030.09.01.6.002', '723216', '51'),
  ('D0030.09.01.6.002', '723601', '51'),
  ('D0030.09.01.6.003', '722209', '51'),
  ('D0030.09.01.6.003', '723705', '51'),
  ('D0030.09.01.6.004', '721707', '51'),
  ('D0030.10.01.6.001', '723207', '51'),
  ('D0030.10.01.6.001', '723216', '51'),
  ('D0030.10.01.6.002', '723207', '51'),
  ('D0030.10.01.6.003', '722111', '51'),
  ('D0030.10.01.6.003', '722112', '51'),
  ('D0030.10.01.6.003', '722113', '51'),
  ('D0030.10.01.6.003', '722114', '51'),
  ('D0030.10.01.6.003', '723216', '51'),
  ('D0030.10.01.6.004', '723207', '51'),
  ('D0030.10.01.6.005', '723216', '51'),
  ('D0030.12.01.6.001', '722111', '51'),
  ('D0030.12.01.6.001', '722112', '51'),
  ('D0030.12.01.6.001', '722113', '51'),
  ('D0030.12.01.6.001', '722114', '51'),
  ('D0030.12.01.6.001', '723216', '51'),
  ('D0072.11.01.6.001', '723202', '51'),
  ('D0072.11.01.6.001', '723216', '51')
  ) as v (project_kode, task_kode, kode_dana),
       public.master_project p, public.master_task t
 where p.id = m.project_id and t.id = m.task_id
   and p.tahun = 2026 and t.tahun = 2026
   and p.kode = v.project_kode and t.kode = v.task_kode
   and m.kode_dana is null;

-- ─── 7. Keamanan: hanya server (DATABASE_URL) yang boleh membaca/menulis ──
alter table public.master_dana enable row level security;
revoke all on public.master_dana from anon, authenticated;

-- Cek hasil.
select (select count(*) from public.master_dana) as kode_dana,
       (select count(*) from public.master_project where tahun = 2026) as project_2026,
       (select count(*) from public.master_task where tahun = 2026) as task_2026,
       (select count(*) from public.master_project_task where kode_dana is not null) as pasangan_berkode_dana,
       (select count(*) from public.master_project_task where kode_dana is null) as pasangan_tanpa_kode_dana,
       (select string_agg(kode || '=' || coalesce(mekanisme_tetap::text, 'pilih'), ', ' order by urutan) from public.jenis_pengajuan) as mekanisme,
       (select count(*) from public.pengajuan_peserta where rekening_bank is not null) as penerima_berekening;
