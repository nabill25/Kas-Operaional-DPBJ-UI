import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buatKonteks, masuk, type Konteks } from './helpers';

let ctx: Konteks;
beforeEach(() => {
  ctx = buatKonteks();
});
afterEach(() => ctx.tutup());

describe('Autentikasi', () => {
  it('health check tidak butuh login', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('endpoint terlindungi menolak tanpa login (401)', async () => {
    for (const url of ['/api/pengajuan', '/api/pegawai', '/api/dashboard', '/api/rekap/pegawai', '/api/notifikasi', '/api/users']) {
      const res = await request(ctx.app).get(url);
      expect(res.status, url).toBe(401);
      expect(res.body.message).toBeTruthy();
    }
  });

  it('/auth/me tanpa login → 200 { user: null }', async () => {
    const res = await request(ctx.app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('login gagal dengan password salah', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ username: 'operator', password: 'salah' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Username atau password salah');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('login gagal untuk username yang tidak ada dengan pesan yang sama', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ username: 'tidakada', password: 'apa' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Username atau password salah');
  });

  it('login tanpa isian → 400 dengan error per field', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ username: expect.any(String), password: expect.any(String) });
  });

  it('login berhasil (username tidak peka huruf besar) → cookie httpOnly & /me', async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post('/api/auth/login').send({ username: '  OPERATOR ', password: 'operator123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'operator', role: 'operator', aktif: true });
    expect(res.body.user.password_hash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('kas_sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.nama).toBe('Operator DPBJ');
  });

  it('logout menghapus sesi', async () => {
    const agent = await masuk(ctx, 'pum');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.get('/api/pengajuan')).status).toBe(401);
  });

  it('akun nonaktif tidak dapat login & sesi lamanya ditolak', async () => {
    const agent = await masuk(ctx, 'operator');
    ctx.db.run(`UPDATE users SET aktif = 0 WHERE username = 'operator'`);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.get('/api/pengajuan')).status).toBe(401);
    const res = await request(ctx.app).post('/api/auth/login').send({ username: 'operator', password: 'operator123' });
    expect(res.status).toBe(403);
  });

  it('ganti password: validasi & berhasil', async () => {
    const agent = await masuk(ctx, 'operator');
    let res = await agent.post('/api/auth/password').send({ password_lama: 'keliru', password_baru: 'barubaru1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password_lama).toBeTruthy();

    res = await agent.post('/api/auth/password').send({ password_lama: 'operator123', password_baru: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password_baru).toBeTruthy();

    res = await agent.post('/api/auth/password').send({ password_lama: 'operator123', password_baru: 'barubaru1' });
    expect(res.status).toBe(200);
    // Sesi saat ini tetap berlaku
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const lama = await request(ctx.app).post('/api/auth/login').send({ username: 'operator', password: 'operator123' });
    expect(lama.status).toBe(401);
    const baru = await request(ctx.app).post('/api/auth/login').send({ username: 'operator', password: 'barubaru1' });
    expect(baru.status).toBe(200);
  });

  it('membatasi percobaan login berulang (429)', async () => {
    for (let i = 0; i < 10; i++) {
      await request(ctx.app).post('/api/auth/login').send({ username: 'admin', password: `salah-${i}` });
    }
    const res = await request(ctx.app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Terlalu banyak percobaan');
  });

  it('JSON rusak → 400 yang rapi', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Format data tidak valid');
  });

  it('endpoint API yang tidak ada → 404 JSON', async () => {
    const agent = await masuk(ctx, 'admin');
    const res = await agent.get('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeTruthy();
  });
});
