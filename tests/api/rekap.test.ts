import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KATEGORI_LIST } from '../../shared/constants';
import type { DashboardData, PengajuanRingkas, RekapPegawaiData, RekapPengajuanData } from '../../shared/types';
import { TAHUN_INI, buatKonteks, masuk, type Agent, type Konteks } from './helpers';

let ctx: Konteks;
let admin: Agent;
let pum: Agent;
let pimpinan: Agent;
let op: Agent;

beforeAll(async () => {
  ctx = buatKonteks({ demo: true });
  admin = await masuk(ctx, 'admin');
  pum = await masuk(ctx, 'pum');
  pimpinan = await masuk(ctx, 'pimpinan');
  op = await masuk(ctx, 'operator');
});
afterAll(() => ctx.tutup());

const jumlah = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

describe('Dashboard', () => {
  it('angka KPI, tren bulanan, dan komposisi saling konsisten', async () => {
    const res = await admin.get(`/api/dashboard?tahun=${TAHUN_INI}`);
    expect(res.status).toBe(200);
    const d = res.body as DashboardData;
    expect(d.tahun).toBe(TAHUN_INI);
    expect(d.tahunTersedia).toContain(TAHUN_INI);
    expect(d.perBulan).toHaveLength(12);

    const totalBulan = jumlah(d.perBulan.map((b) => b.konsumsi + b.rumah_tangga + b.perjadin));
    const totalKategori = jumlah(d.perKategori.map((k) => k.nilai));
    const totalMekanisme = jumlah(d.perMekanisme.map((m) => m.nilai));
    expect(totalBulan).toBe(d.kpi.total.nilai);
    expect(totalKategori).toBe(d.kpi.total.nilai);
    expect(totalMekanisme).toBe(d.kpi.total.nilai);
    expect(d.kpi.total.jumlah).toBe(
      d.kpi.diajukan_pum.jumlah + d.kpi.dikembalikan.jumlah + d.kpi.diajukan_mdk.jumlah + d.kpi.selesai.jumlah,
    );
    expect(jumlah(d.perBulan.map((b) => b.jumlah))).toBe(d.kpi.total.jumlah);

    // Cocok dengan isi database
    const db = ctx.db.get<{ n: number; v: number }>(
      `SELECT COUNT(*) AS n, SUM(total) AS v FROM pengajuan WHERE status <> 'draft' AND substr(tanggal_kegiatan,1,4) = ?`,
      String(TAHUN_INI),
    )!;
    expect(d.kpi.total).toEqual({ jumlah: db.n, nilai: db.v });
    expect(d.kpi.draft).not.toBeNull();
    expect(d.topPegawai.length).toBeGreaterThan(0);
    expect(d.topPegawai.length).toBeLessThanOrEqual(5);
    for (const p of d.topPegawai) expect(p.konsumsi + p.rumah_tangga + p.perjadin).toBe(p.total);
    expect(d.aktivitas.length).toBeGreaterThan(0);
    expect(d.kpi.rataProsesHari).not.toBeNull();
  });

  it('versi PUM & pimpinan: tanpa draft, aktivitas hanya dari pengajuan yang sudah diajukan', async () => {
    const draftIds = new Set(
      ctx.db.all<{ id: number }>(`SELECT id FROM pengajuan WHERE status = 'draft'`).map((r) => r.id),
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
    for (const p of dPum.perluTindakan) expect(['diajukan_pum', 'diajukan_mdk']).toContain(p.status);
    expect(dPum.perluTindakan[0].status).toBe('diajukan_pum');
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
    expect(jumlah(KATEGORI_LIST.map((k) => r.ringkasan.perKategori[k].nilai))).toBe(r.ringkasan.nilai);
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
      for (const row of g.rows) expect(row.konsumsi + row.rumah_tangga + row.perjadin).toBe(row.total);
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
    const semua = ctx.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM pengajuan WHERE status <> 'draft'`)!.c;
    expect(list.total).toBe(semua);
  });

  it('antrian PUM & menunggu invoice diurutkan dari yang paling lama menunggu', async () => {
    const list = (await pum.get('/api/pengajuan?status=diajukan_pum&sort=antrian')).body as { data: PengajuanRingkas[] };
    expect(list.data.length).toBeGreaterThan(0);
    const waktu = list.data.map((x) => x.diajukan_at!);
    expect([...waktu].sort()).toEqual(waktu);
    const mdk = (await pum.get('/api/pengajuan?status=diajukan_mdk&sort=antrian_mdk')).body as { data: PengajuanRingkas[] };
    expect(mdk.data.length).toBeGreaterThan(0);
    const teruskan = mdk.data.map((x) => x.diteruskan_at!);
    expect(teruskan.every(Boolean)).toBe(true);
    expect([...teruskan].sort()).toEqual(teruskan);
    for (const p of mdk.data) {
      expect(p.berkas_sesuai).toBe(p.berkas_wajib);
      expect(p.project_hosting).toBeTruthy();
    }
  });

  it('data demo: notifikasi & centang berkas konsisten dengan status', async () => {
    const n = (await pum.get('/api/notifikasi')).body;
    expect(n.antrian.diajukan_pum).toBeGreaterThan(0);
    expect(n.antrian.diajukan_mdk).toBeGreaterThan(0);
    expect(n.items.length).toBeGreaterThan(0);
    // Semua yang sudah diteruskan/selesai: seluruh berkas wajib dicentang sesuai
    const salah = ctx.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM pengajuan p WHERE p.status IN ('diajukan_mdk','selesai')
         AND (SELECT COUNT(*) FROM cek_berkas c WHERE c.pengajuan_id = p.id AND c.status = 'sesuai') <> p.berkas_wajib`,
    )!.c;
    expect(salah).toBe(0);
    // Yang dikembalikan memiliki minimal satu berkas berstatus revisi & catatan PUM
    const kembali = ctx.db.all<{ id: number; catatan_pum: string | null }>(
      `SELECT id, catatan_pum FROM pengajuan WHERE status = 'dikembalikan'`,
    );
    expect(kembali.length).toBeGreaterThan(0);
    for (const k of kembali) expect(k.catatan_pum).toBeTruthy();
  });
});
