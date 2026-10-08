import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DashboardData, PengajuanRingkas, RekapPegawaiData, RekapPengajuanData } from '../../shared/types';
import { TAHUN_INI, buatKonteks, masuk, type Agent, type Konteks } from './helpers';

let ctx: Konteks;
let admin: Agent;
let pum: Agent;
let pimpinan: Agent;
let op: Agent;

beforeAll(async () => {
  ctx = await buatKonteks({ demo: true });
  admin = await masuk(ctx, 'admin');
  pum = await masuk(ctx, 'pum');
  pimpinan = await masuk(ctx, 'pimpinan');
  op = await masuk(ctx, 'operator');
});
afterAll(() => ctx.tutup());

const jumlah = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const jumlahNilai = (o: Record<string, number>) => jumlah(Object.values(o));

describe('Dashboard', () => {
  it('angka KPI, tren bulanan, dan komposisi saling konsisten', async () => {
    const res = await admin.get(`/api/dashboard?tahun=${TAHUN_INI}`);
    expect(res.status).toBe(200);
    const d = res.body as DashboardData;
    expect(d.tahun).toBe(TAHUN_INI);
    expect(d.tahunTersedia).toContain(TAHUN_INI);
    expect(d.perBulan).toHaveLength(12);

    const totalBulan = jumlah(d.perBulan.map((b) => b.nilai));
    for (const b of d.perBulan) expect(jumlahNilai(b.perKategori), `bulan ${b.bulan}`).toBe(b.nilai);
    // Komposisi: urut master (Konsumsi, Rumah Tangga, Perjadin) dan tiap jenis aktif selalu ada.
    expect(d.perKategori.map((k) => k.kategori)).toEqual(['konsumsi', 'rumah_tangga', 'perjadin']);
    const totalKategori = jumlah(d.perKategori.map((k) => k.nilai));
    const totalMekanisme = jumlah(d.perMekanisme.map((m) => m.nilai));
    expect(totalBulan).toBe(d.kpi.total.nilai);
    expect(totalKategori).toBe(d.kpi.total.nilai);
    expect(totalMekanisme).toBe(d.kpi.total.nilai);
    expect(d.kpi.total.jumlah).toBe(
      d.kpi.diajukan_pum.jumlah + d.kpi.dikembalikan.jumlah + d.kpi.diverifikasi_pum.jumlah + d.kpi.diajukan_mdk.jumlah +
        d.kpi.selesai.jumlah,
    );
    expect(jumlah(d.perBulan.map((b) => b.jumlah))).toBe(d.kpi.total.jumlah);

    // Cocok dengan isi database
    const db = await ctx.db.get<{ n: number; v: number }>(
      `SELECT COUNT(*) AS n, SUM(total) AS v FROM pengajuan WHERE status <> 'draft' AND to_char(tanggal_kegiatan, 'YYYY') = ?`,
      String(TAHUN_INI),
    )!;
    expect(d.kpi.total).toEqual({ jumlah: db.n, nilai: db.v });
    expect(d.kpi.draft).not.toBeNull();
    expect(d.topPegawai.length).toBeGreaterThan(0);
    expect(d.topPegawai.length).toBeLessThanOrEqual(5);
    for (const p of d.topPegawai) expect(jumlahNilai(p.perKategori)).toBe(p.total);
    expect(d.aktivitas.length).toBeGreaterThan(0);
    expect(d.kpi.rataProsesHari).not.toBeNull();
  });

  it('versi PUM & pimpinan: tanpa draft, aktivitas hanya dari pengajuan yang sudah diajukan', async () => {
    const draftIds = new Set(
      (await ctx.db.all<{ id: number }>(`SELECT id FROM pengajuan WHERE status = 'draft'`)).map((r) => r.id),
    );
    for (const agent of [pum, pimpinan]) {
      const d = (await agent.get(`/api/dashboard?tahun=${TAHUN_INI}`)).body as DashboardData;
      expect(d.kpi.draft).toBeNull();
      expect(d.aktivitas.length).toBeGreaterThan(0);
      for (const a of d.aktivitas) {
        expect(a.pengajuan_id).not.toBeNull();
        expect(draftIds.has(a.pengajuan_id!)).toBe(false);
      }
    }
    const dPum = (await pum.get(`/api/dashboard?tahun=${TAHUN_INI}`)).body as DashboardData;
    expect(dPum.perluTindakan.length).toBeGreaterThan(0);
    for (const p of dPum.perluTindakan) expect(['diajukan_pum', 'diverifikasi_pum', 'diajukan_mdk']).toContain(p.status);
    expect(dPum.perluTindakan[0].status).toBe('diajukan_pum');
    // Urutan tahap: diperiksa → input invoice → menunggu MDK
    const urutan = dPum.perluTindakan.map((p) => ['diajukan_pum', 'diverifikasi_pum', 'diajukan_mdk'].indexOf(p.status));
    expect([...urutan].sort((a, b) => a - b)).toEqual(urutan);
  });

  it('versi operator: perlu tindakan = dikembalikan & draft', async () => {
    const d = (await op.get(`/api/dashboard?tahun=${TAHUN_INI}`)).body as DashboardData;
    expect(d.perluTindakan.length).toBeGreaterThan(0);
    for (const p of d.perluTindakan) expect(['dikembalikan', 'draft']).toContain(p.status);
    expect(d.perluTindakan[0].status).toBe('dikembalikan');
  });

  it('tahun tidak valid jatuh ke tahun berjalan', async () => {
    const d = (await admin.get('/api/dashboard?tahun=abc')).body as DashboardData;
    expect(d.tahun).toBe(TAHUN_INI);
  });
});

describe('Rekap', () => {
  it('rekap pengajuan default tanpa draft & ringkasan sesuai baris', async () => {
    const r = (await admin.get('/api/rekap/pengajuan')).body as RekapPengajuanData;
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.status !== 'draft')).toBe(true);
    expect(r.ringkasan.jumlah).toBe(r.rows.length);
    expect(r.ringkasan.nilai).toBe(jumlah(r.rows.map((x) => x.total)));
    expect(Object.keys(r.ringkasan.perKategori)).toEqual(['konsumsi', 'rumah_tangga', 'perjadin']);
    expect(jumlah(Object.values(r.ringkasan.perKategori).map((k) => k.nilai))).toBe(r.ringkasan.nilai);
    expect(r.ringkasan.perStatus.draft.jumlah).toBe(0);
    // Urut kronologis
    const tanggal = r.rows.map((x) => x.tanggal_kegiatan);
    expect([...tanggal].sort()).toEqual(tanggal);
  });

  it('filter kategori, mekanisme, status, rentang tanggal', async () => {
    let r = (await admin.get('/api/rekap/pengajuan?kategori=konsumsi&mekanisme=KO')).body as RekapPengajuanData;
    expect(r.rows.every((x) => x.kategori === 'konsumsi' && x.mekanisme === 'KO')).toBe(true);

    r = (await admin.get('/api/rekap/pengajuan?status=selesai')).body as RekapPengajuanData;
    expect(r.rows.every((x) => x.status === 'selesai' && x.no_invoice_mdk)).toBe(true);
    r = (await admin.get('/api/rekap/pengajuan?status=diverifikasi_pum')).body as RekapPengajuanData;
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.status === 'diverifikasi_pum' && !x.no_invoice_mdk)).toBe(true);
    expect(r.ringkasan.perStatus.diverifikasi_pum.jumlah).toBe(r.rows.length);

    const dari = `${TAHUN_INI}-03-01`;
    const sampai = `${TAHUN_INI}-06-30`;
    r = (await admin.get(`/api/rekap/pengajuan?dari=${dari}&sampai=${sampai}`)).body as RekapPengajuanData;
    expect(r.rows.every((x) => x.tanggal_kegiatan >= dari && x.tanggal_kegiatan <= sampai)).toBe(true);

    r = (await admin.get('/api/rekap/pengajuan?status=draft')).body as RekapPengajuanData;
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.status === 'draft')).toBe(true);

    // Pimpinan meminta draft → tetap tanpa draft
    r = (await pimpinan.get('/api/rekap/pengajuan?status=draft')).body as RekapPengajuanData;
    expect(r.rows.every((x) => x.status !== 'draft')).toBe(true);
  });

  it('total rekap per pegawai = total rekap pengajuan (filter sama)', async () => {
    for (const qs of ['', '?kategori=konsumsi', '?kategori=perjadin&mekanisme=LS', '?status=selesai', `?dari=${TAHUN_INI}-01-01`]) {
      const p = (await admin.get(`/api/rekap/pengajuan${qs}`)).body as RekapPengajuanData;
      const g = (await admin.get(`/api/rekap/pegawai${qs}`)).body as RekapPegawaiData;
      expect(g.total, qs).toBe(p.ringkasan.nilai);
      for (const row of g.rows) expect(jumlahNilai(row.perKategori)).toBe(row.total);
      // Urut menurun berdasarkan total
      const totals = g.rows.map((x) => x.total);
      expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    }
  });

  it('detail rekap satu pegawai cocok dengan barisnya', async () => {
    const g = (await admin.get('/api/rekap/pegawai')).body as RekapPegawaiData;
    const teratas = g.rows[0];
    const det = await admin.get(`/api/rekap/pegawai/${teratas.pegawai_id}`);
    expect(det.status).toBe(200);
    expect(det.body.pegawai.nama).toBe(teratas.nama);
    expect(det.body.total).toBe(teratas.total);
    expect(new Set(det.body.items.map((i: { pengajuan_id: number }) => i.pengajuan_id)).size).toBe(teratas.jumlah);
    expect((await admin.get('/api/rekap/pegawai/999999')).status).toBe(404);
  });

  it('daftar pengajuan untuk pimpinan tidak memuat draft', async () => {
    const list = (await pimpinan.get('/api/pengajuan?limit=100')).body as { data: PengajuanRingkas[]; total: number };
    expect(list.data.every((x) => x.status !== 'draft')).toBe(true);
    const semua = (await ctx.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM pengajuan WHERE status <> 'draft'`))!.c;
    expect(list.total).toBe(semua);
  });

  it('antrian PUM, input invoice & menunggu MDK diurutkan dari yang paling lama menunggu', async () => {
    const list = (await pum.get('/api/pengajuan?status=diajukan_pum&sort=antrian')).body as { data: PengajuanRingkas[] };
    expect(list.data.length).toBeGreaterThan(0);
    const waktu = list.data.map((x) => x.diajukan_at!);
    expect([...waktu].sort()).toEqual(waktu);

    const verif = (await pum.get('/api/pengajuan?status=diverifikasi_pum&sort=antrian_verifikasi')).body as { data: PengajuanRingkas[] };
    expect(verif.data.length).toBeGreaterThan(0);
    const tVerif = verif.data.map((x) => x.diverifikasi_at!);
    expect(tVerif.every(Boolean)).toBe(true);
    expect([...tVerif].sort()).toEqual(tVerif);
    for (const p of verif.data) {
      expect(p.berkas_sesuai).toBe(p.berkas_wajib);
      expect(p.project_hosting).toBeTruthy();
      expect(p.no_invoice_mdk).toBeNull();
    }

    const mdk = (await pum.get('/api/pengajuan?status=diajukan_mdk&sort=antrian_mdk')).body as { data: PengajuanRingkas[] };
    expect(mdk.data.length).toBeGreaterThan(0);
    const tMdk = mdk.data.map((x) => x.diajukan_mdk_at!);
    expect(tMdk.every(Boolean)).toBe(true);
    expect([...tMdk].sort()).toEqual(tMdk);
    for (const p of mdk.data) {
      expect(p.berkas_sesuai).toBe(p.berkas_wajib);
      expect(p.project_hosting).toBeTruthy();
      expect(p.no_invoice_mdk).toBeTruthy();
      expect(p.diverifikasi_at! < p.diajukan_mdk_at!).toBe(true);
    }
  });

  it('data demo: notifikasi & centang berkas konsisten dengan status', async () => {
    const n = (await pum.get('/api/notifikasi')).body;
    expect(n.antrian.diajukan_pum).toBeGreaterThan(0);
    expect(n.antrian.diverifikasi_pum).toBeGreaterThan(0);
    expect(n.antrian.diajukan_mdk).toBeGreaterThan(0);
    expect(n.items.length).toBeGreaterThan(0);
    // Semua yang sudah diverifikasi/diajukan ke MDK/selesai: seluruh berkas wajib dicentang sesuai
    const salah = (await ctx.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM pengajuan p WHERE p.status IN ('diverifikasi_pum','diajukan_mdk','selesai')
         AND (SELECT COUNT(*) FROM cek_berkas c WHERE c.pengajuan_id = p.id AND c.status = 'sesuai') <> p.berkas_wajib`,
    ))!.c;
    expect(salah).toBe(0);
    // Invoice MDK ada tepat pada status diajukan_mdk & selesai; waktu tiap tahap terisi berurutan
    const invoiceSalah = (await ctx.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM pengajuan
        WHERE (status IN ('diajukan_mdk','selesai')) <> (no_invoice_mdk IS NOT NULL)
           OR (status IN ('diverifikasi_pum','diajukan_mdk','selesai') AND diverifikasi_at IS NULL)
           OR (status IN ('diajukan_mdk','selesai') AND (diajukan_mdk_at IS NULL OR diajukan_mdk_at <= diverifikasi_at))
           OR (status = 'selesai' AND (diproses_at IS NULL OR diproses_at <= diajukan_mdk_at))`,
    ))!.c;
    expect(invoiceSalah).toBe(0);
    // Yang dikembalikan memiliki minimal satu berkas berstatus revisi & catatan PUM
    const kembali = await ctx.db.all<{ id: number; catatan_pum: string | null }>(
      `SELECT id, catatan_pum FROM pengajuan WHERE status = 'dikembalikan'`,
    );
    expect(kembali.length).toBeGreaterThan(0);
    for (const k of kembali) expect(k.catatan_pum).toBeTruthy();
  });
});
