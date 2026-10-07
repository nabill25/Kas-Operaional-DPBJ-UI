-- ============================================================
-- Migrasi 2026-10-07 — Perjadin: uang harian & uang transport per orang;
-- Konsumsi: rekening "uang siapa" + tanda "sudah dibayarkan" oleh PUM.
--
-- Untuk database yang dibuat sebelum fitur ini. Aman dijalankan berulang dan hanya
-- menambah kolom/nilai enum. Peserta Perjadin lama (satu "jenis uang" per pengajuan)
-- disalin ke kolom baru sesuai jenis uangnya, sehingga rinciannya tetap benar.
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

-- ─── 1. Perjadin: rincian uang per orang ──────────────────────
alter table public.pengajuan_peserta add column if not exists uang_harian bigint;
alter table public.pengajuan_peserta add column if not exists uang_transport bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pengajuan_peserta_uang_harian_check') then
    alter table public.pengajuan_peserta
      add constraint pengajuan_peserta_uang_harian_check check (uang_harian is null or uang_harian >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pengajuan_peserta_uang_transport_check') then
    alter table public.pengajuan_peserta
      add constraint pengajuan_peserta_uang_transport_check check (uang_transport is null or uang_transport >= 0);
  end if;
end $$;

update public.pengajuan_peserta ps
   set uang_harian    = case when p.jenis_uang = 'uang_harian' then ps.nilai else 0 end,
       uang_transport = case when p.jenis_uang = 'uang_harian' then 0 else ps.nilai end
  from public.pengajuan p
 where p.id = ps.pengajuan_id
   and p.kategori = 'perjadin'
   and ps.uang_harian is null
   and ps.uang_transport is null;

-- ─── 2. Konsumsi: rekening pemilik uang & tanda sudah dibayarkan ──
alter table public.pengajuan add column if not exists rekening_bank text;
alter table public.pengajuan add column if not exists rekening_nomor text;
alter table public.pengajuan add column if not exists dibayar_at timestamptz;
alter table public.pengajuan add column if not exists dibayar_by bigint references public.users (id);

alter type public.aksi_riwayat_enum add value if not exists 'dibayarkan';
alter type public.aksi_riwayat_enum add value if not exists 'dibayarkan_batal';
alter type public.jenis_notifikasi_enum add value if not exists 'dibayarkan';
