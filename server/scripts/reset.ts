import fs from 'node:fs';
import type { AppConfig } from '../config';

/** Hapus database & folder upload. Gagal bila server masih berjalan (file terkunci di Windows). */
export function hapusDataLama(cfg: AppConfig): void {
  for (const f of [cfg.dbPath, `${cfg.dbPath}-wal`, `${cfg.dbPath}-shm`]) {
    try {
      fs.rmSync(f, { force: true });
    } catch (err) {
      console.error(`✗ Tidak dapat menghapus ${f}.`);
      console.error('  Kemungkinan server masih berjalan. Hentikan server (Ctrl+C) lalu jalankan ulang perintah ini.');
      console.error(`  Detail: ${(err as Error).message}`);
      process.exit(1);
    }
  }
  fs.rmSync(cfg.uploadDir, { recursive: true, force: true });
}
