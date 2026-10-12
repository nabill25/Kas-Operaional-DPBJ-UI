-- ============================================================
-- Migrasi 2026-10-12 (2) — Profil akun:
--   • users.pegawai_id: akun pengguna ditautkan ke data pegawai (oleh admin, menu Pengguna), agar pemilik akun bisa
--     mengisi Bank & No. Rekening miliknya sendiri di Pengaturan → Profil. Satu pegawai hanya untuk satu akun.
--   • Pengaju (operator) tidak lagi mengelola master Pegawai — diatur di kode aplikasi, tanpa perubahan skema.
--
-- Aman dijalankan berulang: hanya menambah kolom & indeks.
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

alter table public.users add column if not exists pegawai_id bigint references public.pegawai (id) on delete set null;
create unique index if not exists ux_users_pegawai on public.users (pegawai_id) where pegawai_id is not null;

-- Cek hasil.
select (select count(*) from public.users) as akun,
       (select count(*) from public.users where pegawai_id is not null) as akun_bertaut_pegawai,
       (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'ux_users_pegawai') as indeks_unik;
