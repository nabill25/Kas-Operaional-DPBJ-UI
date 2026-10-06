import { loadConfig } from '../config';
import { Db } from '../db';
import { AKUN_DEMO, seedDemo } from '../seed';
import { hapusDataLama } from './reset';

const cfg = loadConfig();
hapusDataLama(cfg);
const db = new Db(cfg.dbPath);
seedDemo(db, cfg.uploadDir);
const { c } = db.get<{ c: number }>('SELECT COUNT(*) AS c FROM pengajuan')!;
db.close();
console.log(`✓ Database direset & diisi data demo (${c} pengajuan): ${cfg.dbPath}`);
for (const a of AKUN_DEMO) console.log(`    - ${a.username} / ${a.password}  (${a.role})`);
