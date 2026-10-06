-- ============================================================
-- KAS OPERASIONAL DPBJ UI - Supabase / PostgreSQL Schema
-- Jalankan di Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ─── Enum Types ─────────────────────────────────────────────
CREATE TYPE role_enum AS ENUM ('admin', 'operator', 'pum', 'pimpinan');
CREATE TYPE kategori_enum AS ENUM ('konsumsi', 'rumah_tangga', 'perjadin');
CREATE TYPE mekanisme_enum AS ENUM ('KO', 'LS');
CREATE TYPE status_enum AS ENUM ('draft', 'diajukan_pum', 'dikembalikan', 'diajukan_mdk', 'selesai');
CREATE TYPE jenis_uang_enum AS ENUM ('uang_harian', 'uang_transport');
CREATE TYPE jenis_transport_enum AS ENUM ('dalam_kota', 'luar_kota');
CREATE TYPE status_cek_enum AS ENUM ('sesuai', 'revisi');
CREATE TYPE aksi_riwayat_enum AS ENUM (
  'dibuat', 'diajukan', 'dikembalikan', 'diteruskan_mdk', 'selesai',
  'berkas_diunggah', 'berkas_dihapus', 'berkas_na', 'berkas_dicek', 'berkas_revisi',
  'batal_selesai', 'tarik_kembali', 'data_diubah', 'data_pum_diubah', 'invoice_diubah'
);
CREATE TYPE jenis_notifikasi_enum AS ENUM ('diajukan', 'dikembalikan', 'diteruskan_mdk', 'selesai');

-- ─── Table: users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  nama          TEXT NOT NULL,
  role          role_enum NOT NULL,
  password_hash TEXT NOT NULL,
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_expires ON sessions(expires_at);

-- ─── Table: pegawai ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pegawai (
  id         BIGSERIAL PRIMARY KEY,
  nama       TEXT NOT NULL,
  nip        TEXT UNIQUE,
  jabatan    TEXT,
  aktif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: kode_counter ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS kode_counter (
  prefix   TEXT NOT NULL,
  tahun    INTEGER NOT NULL,
  terakhir INTEGER NOT NULL,
  PRIMARY KEY (prefix, tahun)
);

-- ─── Table: pengajuan ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pengajuan (
  id                  BIGSERIAL PRIMARY KEY,
  kode                TEXT NOT NULL UNIQUE,
  kategori            kategori_enum NOT NULL,
  nama_kegiatan       TEXT NOT NULL,
  tanggal_kegiatan    DATE NOT NULL,
  tanggal_selesai     DATE,
  jumlah_orang        INTEGER NOT NULL CHECK (jumlah_orang >= 0),
  lokasi_tujuan       TEXT,
  mekanisme           mekanisme_enum NOT NULL,
  jenis_uang          jenis_uang_enum,
  jenis_transport     jenis_transport_enum,
  uang_siapa_id       BIGINT REFERENCES pegawai(id),
  total               BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  catatan             TEXT,
  berkas_na           JSONB NOT NULL DEFAULT '[]'::jsonb,
  berkas_terpenuhi    INTEGER NOT NULL DEFAULT 0,
  berkas_wajib        INTEGER NOT NULL DEFAULT 0,
  berkas_sesuai       INTEGER NOT NULL DEFAULT 0,
  status              status_enum NOT NULL DEFAULT 'draft',
  no_invoice_mdk      TEXT,
  tanggal_invoice_mdk DATE,
  catatan_pum         TEXT,
  project_hosting     TEXT,
  task_name           TEXT,
  created_by          BIGINT NOT NULL REFERENCES users(id),
  updated_by          BIGINT REFERENCES users(id),
  diajukan_at         TIMESTAMPTZ,
  diteruskan_by       BIGINT REFERENCES users(id),
  diteruskan_at       TIMESTAMPTZ,
  diproses_by         BIGINT REFERENCES users(id),
  diproses_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_pengajuan_status ON pengajuan(status);
CREATE INDEX IF NOT EXISTS ix_pengajuan_kategori ON pengajuan(kategori);
CREATE INDEX IF NOT EXISTS ix_pengajuan_tanggal ON pengajuan(tanggal_kegiatan);
CREATE INDEX IF NOT EXISTS ix_pengajuan_uang_siapa ON pengajuan(uang_siapa_id);

-- ─── Table: pengajuan_peserta ────────────────────────────────
CREATE TABLE IF NOT EXISTS pengajuan_peserta (
  id           BIGSERIAL PRIMARY KEY,
  pengajuan_id BIGINT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  pegawai_id   BIGINT NOT NULL REFERENCES pegawai(id),
  nilai        BIGINT NOT NULL CHECK (nilai > 0),
  urutan       INTEGER NOT NULL,
  UNIQUE (pengajuan_id, pegawai_id)
);
CREATE INDEX IF NOT EXISTS ix_peserta_pegawai ON pengajuan_peserta(pegawai_id);

-- ─── Table: berkas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS berkas (
  id           BIGSERIAL PRIMARY KEY,
  pengajuan_id BIGINT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  jenis        TEXT NOT NULL,
  nama_berkas  TEXT,
  nama_asli    TEXT NOT NULL,
  nama_file    TEXT NOT NULL UNIQUE,
  mime         TEXT NOT NULL,
  ukuran       BIGINT NOT NULL,
  uploaded_by  BIGINT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_berkas_pengajuan ON berkas(pengajuan_id);

-- ─── Table: riwayat ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS riwayat (
  id           BIGSERIAL PRIMARY KEY,
  pengajuan_id BIGINT REFERENCES pengajuan(id) ON DELETE SET NULL,
  kode         TEXT NOT NULL,
  user_id      BIGINT REFERENCES users(id),
  aksi         aksi_riwayat_enum NOT NULL,
  keterangan   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_riwayat_pengajuan ON riwayat(pengajuan_id);
CREATE INDEX IF NOT EXISTS ix_riwayat_waktu ON riwayat(created_at);

-- ─── Table: cek_berkas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cek_berkas (
  pengajuan_id  BIGINT NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  status        status_cek_enum NOT NULL,
  catatan       TEXT,
  diperiksa_by  BIGINT NOT NULL REFERENCES users(id),
  diperiksa_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (pengajuan_id, jenis)
);

-- ─── Table: notifikasi ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifikasi (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pengajuan_id BIGINT REFERENCES pengajuan(id) ON DELETE SET NULL,
  kode         TEXT NOT NULL,
  jenis        jenis_notifikasi_enum NOT NULL,
  judul        TEXT NOT NULL,
  pesan        TEXT NOT NULL,
  dibaca_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_notifikasi_user ON notifikasi(user_id, dibaca_at, id);

-- ─── RLS: Disable untuk akses via service_role key ───────────
-- Backend menggunakan service_role key sehingga RLS di-bypass
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pegawai DISABLE ROW LEVEL SECURITY;
ALTER TABLE kode_counter DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_peserta DISABLE ROW LEVEL SECURITY;
ALTER TABLE berkas DISABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat DISABLE ROW LEVEL SECURITY;
ALTER TABLE cek_berkas DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SELESAI. Tempel seluruh isi file ini ke Supabase SQL Editor
-- (https://supabase.com/dashboard/project/axnassfdxtiyhcjvgfzo/sql)
-- lalu klik RUN.
-- ============================================================
