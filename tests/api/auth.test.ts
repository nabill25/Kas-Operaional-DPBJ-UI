import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMAIL, PASSWORD, buatKonteks, masuk, type Konteks } from './helpers';

let ctx: Konteks;
beforeEach(async () => {
  ctx = await buatKonteks();
});
afterEach(() => ctx.tutup());

const login = (body: Record<string, unknown>) => request(ctx.app).post('/api/auth/login').send(body);

describe('Autentikasi (Supabase Auth)', () => {
  it('health check tidak butuh login & melaporkan koneksi database', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, database: 'terhubung' });
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
    const res = await login({ username: EMAIL.operator, password: 'salah' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Email atau password salah');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('login gagal untuk email yang tidak ada dengan pesan yang sama', async () => {
    const res = await login({ username: 'tidakada@dpbj.test', password: 'apa' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Email atau password salah');
  });

  it('login tanpa isian / email tidak valid → 400 dengan error per field', async () => {
    let res = await login({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ username: expect.any(String), password: expect.any(String) });
    res = await login({ username: 'operator', password: 'operator123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.username).toBe('Format email tidak valid');
  });

  it('login berhasil (email tidak peka huruf besar) → cookie httpOnly & /me', async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post('/api/auth/login').send({ username: `  ${EMAIL.operator.toUpperCase()} `, password: PASSWORD.operator });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: EMAIL.operator, role: 'operator', aktif: true });
    expect(res.body.user.auth_id).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('kas_sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.nama).toBe('Operator DPBJ');
  });

  it('akun Supabase tanpa profil aplikasi tidak bisa masuk (403, pesan jelas)', async () => {
    await ctx.auth.buat('tamu@dpbj.test', 'rahasia1');
    const res = await login({ username: 'tamu@dpbj.test', password: 'rahasia1' });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('belum terdaftar di aplikasi');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('profil yang belum tertaut ditautkan lewat email saat login pertama', async () => {
    const w = new Date().toISOString();
    await ctx.db.run(
      `INSERT INTO users (auth_id, username, nama, role, aktif, created_at, updated_at) VALUES (NULL, 'baru@dpbj.test', 'Pegawai Baru', 'pum', true, ?, ?)`,
      w,
      w,
    );
    const akun = await ctx.auth.buat('baru@dpbj.test', 'rahasia1');
    const res = await login({ username: 'baru@dpbj.test', password: 'rahasia1' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'baru@dpbj.test', role: 'pum' });
    const row = await ctx.db.get<{ auth_id: string }>(`SELECT auth_id FROM users WHERE username = 'baru@dpbj.test'`);
    expect(row!.auth_id).toBe(akun.id);
  });

  it('akun login dibuat ulang di Supabase (uuid baru) → profil lama tetap dipakai', async () => {
    const lama = await ctx.db.get<{ id: number; auth_id: string }>('SELECT id, auth_id FROM users WHERE username = ?', EMAIL.pum);
    await ctx.auth.hapus(lama!.auth_id);
    expect((await ctx.db.get<{ auth_id: string | null }>('SELECT auth_id FROM users WHERE id = ?', lama!.id))!.auth_id).toBeNull();
    expect((await login({ username: EMAIL.pum, password: PASSWORD.pum })).status).toBe(401);

    const baru = await ctx.auth.buat(EMAIL.pum, 'sandibaru1');
    const res = await login({ username: EMAIL.pum, password: 'sandibaru1' });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(lama!.id);
    expect((await ctx.db.get<{ auth_id: string }>('SELECT auth_id FROM users WHERE id = ?', lama!.id))!.auth_id).toBe(baru.id);
  });

  it('email belum dikonfirmasi di Supabase → 403 dengan petunjuk', async () => {
    ctx.auth.belumDikonfirmasi.add(EMAIL.operator);
    const res = await login({ username: EMAIL.operator, password: PASSWORD.operator });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('belum dikonfirmasi');
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
    await ctx.db.run('UPDATE users SET aktif = false WHERE username = ?', EMAIL.operator);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.get('/api/pengajuan')).status).toBe(401);
    const res = await login({ username: EMAIL.operator, password: PASSWORD.operator });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('nonaktif');
  });

  it('ganti password: validasi, password di Supabase berubah, sesi lain diputus', async () => {
    const agent = await masuk(ctx, 'operator');
    const lain = await masuk(ctx, 'operator');
    let res = await agent.post('/api/auth/password').send({ password_lama: 'keliru', password_baru: 'barubaru1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password_lama).toBeTruthy();

    res = await agent.post('/api/auth/password').send({ password_lama: PASSWORD.operator, password_baru: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password_baru).toBeTruthy();

    res = await agent.post('/api/auth/password').send({ password_lama: PASSWORD.operator, password_baru: 'barubaru1' });
    expect(res.status).toBe(200);
    // Sesi saat ini tetap berlaku, sesi lain diputus
    expect((await agent.get('/api/auth/me')).body.user).not.toBeNull();
    expect((await lain.get('/api/auth/me')).body.user).toBeNull();
    expect((await login({ username: EMAIL.operator, password: PASSWORD.operator })).status).toBe(401);
    expect((await login({ username: EMAIL.operator, password: 'barubaru1' })).status).toBe(200);
  });

  it('membatasi percobaan login berulang (429)', async () => {
    for (let i = 0; i < 10; i++) {
      await login({ username: EMAIL.admin, password: `salah-${i}` });
    }
    const res = await login({ username: EMAIL.admin, password: PASSWORD.admin });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Terlalu banyak percobaan');
  });

  it('JSON rusak → 400 yang rapi', async () => {
    const res = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"username": ');
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
