-- ============================================================
-- Migrasi 2026-10-07 — jenis konsumsi (Kudapan / Makan Siang / Kudapan + Makan Siang)
--
-- Untuk database yang dibuat sebelum fitur ini. Aman dijalankan berulang,
-- tidak mengubah data yang ada (pengajuan lama berisi NULL).
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'jenis_konsumsi_enum' and n.nspname = 'public') then
    create type public.jenis_konsumsi_enum as enum ('kudapan', 'makan_siang', 'kudapan_makan_siang');
  end if;
end $$;

alter table public.pengajuan add column if not exists jenis_konsumsi public.jenis_konsumsi_enum;
