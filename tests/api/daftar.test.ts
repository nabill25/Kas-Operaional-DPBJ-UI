import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NotifikasiData, User } from '../../shared/types';
import { EMAIL, PASSWORD, buatKonteks, masuk, type Agent, type Konteks } from './helpers';

let ctx: Konteks;
let admin: Agent;
beforeEach(async () => {
  ctx = await buatKonteks();
  admin = await masuk(ctx, 'admin');
});
afterEach(() => ctx.tutup());

const daftar = (body: Record<string, unknown>) => request(ctx.app).post('/api/auth/daftar').send(body);
const login = (username: string, password: string) => request(ctx.app).post('/api/auth/login').send({ username, password });
const profil = (username: string) =>
  ctx.db.get<{ id: number; auth_id: string | null; role: string; aktif: boolean; menunggu_persetujuan: boolean }>(
    'SELECT id, auth_id, role, aktif, menunggu_persetujuan FROM users WHERE username = ?',
    username,
  );

describe('Pendaftaran akun mandiri', () => {
  it('berhasil → profil menunggu persetujuan, belum bisa masuk, admin dinotifikasi', async () => {
    const res = await daftar({ nama: '  Budi  Santoso ', username: 'Budi@DPBJ.test', password: 'rahasia1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['set-cookie']).toBeUndefined();

    const p = await profil('budi@dpbj.test');
    expect(p).toMatchObject({ role: 'operator', aktif: false, menunggu_persetujuan: true });
    expect(p!.auth_id).toBeTruthy();

    const masukRes = await login('budi@dpbj.test', 'rahasia1');
    expect(masukRes.status).toBe(403);
    expect(masukRes.body.message).toContain('menunggu persetujuan');

    const n = (await admin.get('/api/notifikasi')).body as NotifikasiData;
    expect(n.items[0]).toMatchObject({ jenis: 'registrasi', kode: 'AKUN BARU', pengajuan_id: null, judul: 'Pendaftaran akun baru' });
    expect(n.items[0].pesan).toContain('budi@dpbj.test');
    expect(n.antrian.pendaftar).toBe(1);

    // Hanya admin yang diberi tahu
    const pum = await masuk(ctx, 'pum');
    const nPum = (await pum.get('/api/notifikasi')).body as NotifikasiData;
    expect(nPum.items.some((x) => x.jenis === 'registrasi')).toBe(false);
    expect(nPum.antrian.pendaftar).toBe(0);

    // Daftar pengguna (admin) memuat status menunggu
    const users = (await admin.get('/api/users')).body as User[];
    expect(users[0]).toMatchObject({ username: 'budi@dpbj.test', menunggu_persetujuan: true, aktif: false });
  });

  it('validasi isian & email yang sudah terdaftar', async () => {
    let res = await daftar({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['nama', 'password', 'username']);

    res = await daftar({ nama: 'X', username: 'bukan-email', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ nama: expect.any(String), username: expect.any(String), password: expect.any(String) });

    res = await daftar({ nama: 'Operator Lain', username: EMAIL.operator, password: 'rahasia1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.username).toContain('sudah terdaftar');

    expect((await daftar({ nama: 'Citra', username: 'citra@dpbj.test', password: 'rahasia1' })).status).toBe(201);
    res = await daftar({ nama: 'Citra Lagi', username: 'citra@dpbj.test', password: 'rahasia2' });
    expect(res.status).toBe(400);
    expect(res.body.errors.username).toContain('sudah terdaftar');
  });

  it('email yang sudah punya akun login (dibuat manual) hanya bisa didaftarkan dengan password-nya', async () => {
    const ada = await ctx.auth.buat('manual@dpbj.test', 'asli1234');
    let res = await daftar({ nama: 'Penyusup', username: 'manual@dpbj.test', password: 'tebakan1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toContain('sudah memiliki akun login');
    expect(await profil('manual@dpbj.test')).toBeUndefined();
    expect(await ctx.auth.cariByEmail('manual@dpbj.test')).toEqual(ada);

    res = await daftar({ nama: 'Pemilik Asli', username: 'manual@dpbj.test', password: 'asli1234' });
    expect(res.status).toBe(201);
    expect((await profil('manual@dpbj.test'))!.auth_id).toBe(ada.id);
  });

  it('admin menyetujui dengan peran tertentu → akun bisa masuk', async () => {
    await daftar({ nama: 'Dewi PUM', username: 'dewi@dpbj.test', password: 'rahasia1' });
    const id = (await profil('dewi@dpbj.test'))!.id;

    expect((await admin.post(`/api/users/${id}/setujui`).send({ role: 'boss' })).status).toBe(400);
    const res = await admin.post(`/api/users/${id}/setujui`).send({ role: 'pum' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, role: 'pum', aktif: true, menunggu_persetujuan: false });
    expect((await admin.post(`/api/users/${id}/setujui`).send({ role: 'pum' })).status).toBe(409);

    const masukRes = await login('dewi@dpbj.test', 'rahasia1');
    expect(masukRes.status).toBe(200);
    expect(masukRes.body.user).toMatchObject({ role: 'pum', menunggu_persetujuan: false });
    expect(((await admin.get('/api/notifikasi')).body as NotifikasiData).antrian.pendaftar).toBe(0);
  });

  it('mengaktifkan lewat form ubah pengguna sekaligus menyetujui', async () => {
    await daftar({ nama: 'Eko', username: 'eko@dpbj.test', password: 'rahasia1' });
    const id = (await profil('eko@dpbj.test'))!.id;
    const res = await admin.put(`/api/users/${id}`).send({ username: 'eko@dpbj.test', nama: 'Eko', role: 'pimpinan', aktif: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'pimpinan', aktif: true, menunggu_persetujuan: false });
    expect((await login('eko@dpbj.test', 'rahasia1')).status).toBe(200);
  });

  it('admin menolak → profil & akun login dihapus; akun aktif tidak bisa "ditolak"', async () => {
    await daftar({ nama: 'Fajar', username: 'fajar@dpbj.test', password: 'rahasia1' });
    const id = (await profil('fajar@dpbj.test'))!.id;
    const res = await admin.delete(`/api/users/${id}`);
    expect(res.status).toBe(200);
    expect(await profil('fajar@dpbj.test')).toBeUndefined();
    expect(await ctx.auth.cariByEmail('fajar@dpbj.test')).toBeNull();
    expect((await login('fajar@dpbj.test', 'rahasia1')).status).toBe(401);
    // Email bisa dipakai mendaftar lagi
    expect((await daftar({ nama: 'Fajar', username: 'fajar@dpbj.test', password: 'baru1234' })).status).toBe(201);

    const opId = (await profil(EMAIL.operator))!.id;
    expect((await admin.delete(`/api/users/${opId}`)).status).toBe(409);
    expect((await login(EMAIL.operator, PASSWORD.operator)).status).toBe(200);
  });

  it('hanya admin yang dapat menyetujui atau menolak', async () => {
    await daftar({ nama: 'Gita', username: 'gita@dpbj.test', password: 'rahasia1' });
    const id = (await profil('gita@dpbj.test'))!.id;
    for (const peran of ['operator', 'pum', 'pimpinan'] as const) {
      const agent = await masuk(ctx, peran);
      expect((await agent.post(`/api/users/${id}/setujui`).send({ role: 'operator' })).status).toBe(403);
      expect((await agent.delete(`/api/users/${id}`)).status).toBe(403);
    }
    expect((await request(ctx.app).post(`/api/users/${id}/setujui`).send({ role: 'operator' })).status).toBe(401);
    expect(await profil('gita@dpbj.test')).toMatchObject({ menunggu_persetujuan: true });
  });

  it('membatasi pendaftaran berulang dari satu jaringan (429)', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await daftar({ nama: `Pendaftar ${i}`, username: `p${i}@dpbj.test`, password: 'rahasia1' })).status).toBe(201);
    }
    const res = await daftar({ nama: 'Kesebelas', username: 'p10@dpbj.test', password: 'rahasia1' });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Terlalu banyak pendaftaran');
  });
});
