-- ============================================================
-- Migrasi 2026-10-08 — Alur 5 tahap:
--   Draft → Diajukan ke PUM → Verifikasi PUM → Diajukan ke MDK → Paid (Selesai).
-- • Status baru `diverifikasi_pum`: PUM sudah memverifikasi berkas, menunggu input invoice.
-- • Input No. Invoice MDK kini = mengajukan ke MDK (status `diajukan_mdk`, menunggu verifikasi MDK);
--   PUM menekan "Selesai" setelah proses di MDK selesai (status `selesai`).
-- • Waktu & pelaku per tahap: diverifikasi_by/at, diajukan_mdk_by/at (diteruskan_by/at = data lama).
--
-- Untuk database yang dibuat sebelum alur ini. Aman dijalankan berulang: hanya menambah nilai enum &
-- kolom, mengisi kolom baru dari data lama, dan memindahkan pengajuan "Diajukan ke MDK" lama yang
-- belum punya invoice ke status "Diverifikasi PUM" (artinya sama pada alur baru).
-- Cara pakai: Supabase → SQL Editor → tempel → RUN.
-- ============================================================

-- ─── 1. Nilai enum baru ──────────────────────────────────────
alter type public.status_enum add value if not exists 'diverifikasi_pum' before 'diajukan_mdk';
alter type public.aksi_riwayat_enum add value if not exists 'diverifikasi';
alter type public.aksi_riwayat_enum add value if not exists 'diajukan_mdk';
alter type public.jenis_notifikasi_enum add value if not exists 'diverifikasi';
alter type public.jenis_notifikasi_enum add value if not exists 'diajukan_mdk';

-- Nilai enum baru baru boleh dipakai setelah transaksinya di-commit.
commit;

-- ─── 2. Waktu & pelaku per tahap ─────────────────────────────
alter table public.pengajuan add column if not exists diverifikasi_by bigint references public.users (id);
alter table public.pengajuan add column if not exists diverifikasi_at timestamptz;
alter table public.pengajuan add column if not exists diajukan_mdk_by bigint references public.users (id);
alter table public.pengajuan add column if not exists diajukan_mdk_at timestamptz;

-- ─── 3. Isi dari data lama ───────────────────────────────────
-- "Teruskan ke MDK" lama = PUM memverifikasi (semua berkas sesuai).
update public.pengajuan
   set diverifikasi_by = diteruskan_by,
       diverifikasi_at = diteruskan_at
 where diverifikasi_at is null
   and diteruskan_at is not null;

-- Pengajuan selesai lama: invoice diinput bersamaan dengan status selesai.
update public.pengajuan
   set diajukan_mdk_by = diproses_by,
       diajukan_mdk_at = diproses_at
 where status = 'selesai'
   and no_invoice_mdk is not null
   and diajukan_mdk_at is null;

-- "Diajukan ke MDK" lama yang belum ada invoice = sudah diverifikasi PUM, menunggu input invoice.
update public.pengajuan
   set status = 'diverifikasi_pum'
 where status = 'diajukan_mdk'
   and no_invoice_mdk is null;
