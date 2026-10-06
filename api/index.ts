import { createApp } from '../server/app';
import { loadConfig } from '../server/config';
import { getDb } from '../server/db-pg';

let app: any;
try {
  const cfg = loadConfig();
  const db = getDb();
  app = createApp({ db, cfg });
} catch (error: any) {
  console.error("Initialization error:", error);
  app = (req: any, res: any) => {
    res.status(500).json({ 
      message: 'Server failed to start', 
      error: error?.message || String(error)
    });
  };
}

export default app;
