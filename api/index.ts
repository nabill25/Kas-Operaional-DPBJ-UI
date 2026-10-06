import { createApp } from '../server/app';
import { loadConfig } from '../server/config';
import { getDb } from '../server/db-pg';

const cfg = loadConfig();
const db = getDb();
const app = createApp({ db, cfg });

export default app;
