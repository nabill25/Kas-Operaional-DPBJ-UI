-- ============================================================
-- Migrasi 2026-10-07 — pendaftaran akun mandiri (menunggu persetujuan admin)
--
-- Untuk database yang dibuat dengan supabase/schema.sql versi SEBELUM 7 Okt 2026.
-- Aman dijalankan berulang dan tidak mengubah data yang ada.
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

alter table public.users
  add column if not exists menunggu_persetujuan boolean not null default false;

alter type public.jenis_notifikasi_enum add value if not exists 'registrasi';
