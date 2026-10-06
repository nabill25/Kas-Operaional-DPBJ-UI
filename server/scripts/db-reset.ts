import { loadConfig } from '../config';
import { Db } from '../db';
import { seedMinimal } from '../seed';
import { hapusDataLama } from './reset';

const cfg = loadConfig();
hapusDataLama(cfg);
const db = new Db(cfg.dbPath);
seedMinimal(db);
db.close();
console.log(`✓ Database direset kosong: ${cfg.dbPath}`);
console.log('    Akun awal: admin / admin123 — segera ganti password setelah masuk.');
