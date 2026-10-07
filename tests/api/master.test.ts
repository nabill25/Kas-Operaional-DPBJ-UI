import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMAIL, buatKonteks, dataKonsumsi, dataRumahTangga, masuk, type Agent, type Konteks } from './helpers';

let ctx: Konteks;
let op: Agent;
let pum: Agent;
let pimpinan: Agent;
let admin: Agent;

beforeEach(async () => {
  ctx = await buatKonteks();
  op = await masuk(ctx, 'operator');
  pum = await masuk(ctx, 'pum');
  pimpinan = await masuk(ctx, 'pimpinan');
  admin = await masuk(ctx, 'admin');
});
afterEach(() => ctx.tutup());

describe('Master Pegawai', () => {
  it('semua peran dapat membaca; operator & admin dapat menambah/mengubah', async () => {
    const list = await pimpinan.get('/api/pegawai');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(5);
    expect(list.body[0]).toMatchObject({ aktif: true, dipakai: 0 });

    expect((await pum.post('/api/pegawai').send({ nama: 'Orang Baru' })).status).toBe(403);
    expect((await pimpinan.post('/api/pegawai').send({ nama: 'Orang Baru' })).status).toBe(403);

    const baru = await op.post('/api/pegawai').send({ nama: '  Dewi   Kartika ', nip: '1990 0101 2020 1220 01', jabatan: 'Staf' });
    expect(baru.status).toBe(201);
    expect(baru.body).toMatchObject({ nama: 'Dewi Kartika', nip: '199001012020122001', jabatan: 'Staf', aktif: true });

    const ubah = await op.put(`/api/pegawai/${baru.body.id}`).send({ nama: 'Dewi K.', nip: '', jabatan: '' });
    expect(ubah.status).toBe(200);
    expect(ubah.body).toMatchObject({ nama: 'Dewi K.', nip: null, jabatan: null });
  });

  it('validasi nama & NIP unik', async () => {
    let res = await op.post('/api/pegawai').send({ nama: 'A', nip: '12ab' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ nama: expect.any(String), nip: expect.any(String) });

    await op.post('/api/pegawai').send({ nama: 'Pegawai Satu', nip: '123456' });
    res = await op.post('/api/pegawai').send({ nama: 'Pegawai Dua', nip: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.errors.nip).toContain('Pegawai Satu');
  });

  it('pencarian & filter status', async () => {
    const res = await op.get('/api/pegawai?q=fauz');
    expect(res.body.map((p: { nama: string }) => p.nama)).toEqual(['Ahmad Fauzan']);
    await admin.patch(`/api/pegawai/${ctx.pegawai[0]}/aktif`).send({ aktif: false });
    expect((await op.get('/api/pegawai?status=aktif')).body).toHaveLength(4);
    expect((await op.get('/api/pegawai?status=nonaktif')).body).toHaveLength(1);
  });

  it('hanya admin yang dapat menonaktifkan & menghapus; pegawai terpakai tidak bisa dihapus', async () => {
    expect((await op.patch(`/api/pegawai/${ctx.pegawai[0]}/aktif`).send({ aktif: false })).status).toBe(403);
    expect((await op.delete(`/api/pegawai/${ctx.pegawai[4]}`)).status).toBe(403);

    await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    const pakai = await admin.get(`/api/pegawai/${ctx.pegawai[0]}`);
    expect(pakai.body.dipakai).toBe(1);
    const gagal = await admin.delete(`/api/pegawai/${ctx.pegawai[0]}`);
    expect(gagal.status).toBe(409);
    expect(gagal.body.message).toContain('Nonaktifkan');

    expect((await admin.delete(`/api/pegawai/${ctx.pegawai[4]}`)).status).toBe(200);
    expect((await admin.get(`/api/pegawai/${ctx.pegawai[4]}`)).status).toBe(404);
  });

  it('pegawai nonaktif tidak bisa dipilih baru, tapi pengajuan lama tetap bisa diedit', async () => {
    const { body } = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[1], nilai: 50_000 }]));
    await admin.patch(`/api/pegawai/${ctx.pegawai[1]}/aktif`).send({ aktif: false });

    const baru = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[1], nilai: 50_000 }]));
    expect(baru.status).toBe(400);
    expect(baru.body.errors['peserta.0.pegawai_id']).toBe('Pegawai sudah nonaktif');

    const edit = await op.put(`/api/pengajuan/${body.id}`).send(dataRumahTangga([{ pegawai_id: ctx.pegawai[1], nilai: 60_000 }]));
    expect(edit.status).toBe(200);
    expect(edit.body.total).toBe(60_000);
  });
});

describe('Kelola Pengguna', () => {
  it('hanya admin', async () => {
    expect((await op.get('/api/users')).status).toBe(403);
    expect((await pum.get('/api/users')).status).toBe(403);
    expect((await pimpinan.get('/api/users')).status).toBe(403);
    const res = await admin.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0].password_hash).toBeUndefined();
  });

  it('membuat pengguna baru & login dengannya', async () => {
    let res = await admin.post('/api/users').send({ username: 'Op2@DPBJ.test', nama: 'Operator Dua', role: 'operator', password: 'rahasia1' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'op2@dpbj.test', role: 'operator', aktif: true });

    res = await admin.post('/api/users').send({ username: 'op2@dpbj.test', nama: 'Lagi', role: 'operator', password: 'rahasia1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.username).toBe('Email sudah dipakai');

    // Peran lama "mdk" tidak berlaku lagi
    res = await admin.post('/api/users').send({ username: 'mdk2@dpbj.test', nama: 'MDK', role: 'mdk', password: 'rahasia1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.role).toBeTruthy();

    res = await admin.post('/api/users').send({ username: 'x', nama: '', role: 'boss', password: '1' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['nama', 'password', 'role', 'username']);

    const login = await request(ctx.app).post('/api/auth/login').send({ username: 'op2@dpbj.test', password: 'rahasia1' });
    expect(login.status).toBe(200);
  });

  it('email yang sudah punya akun login di Supabase ditautkan, bukan dibuat ganda', async () => {
    const ada = await ctx.auth.buat('manual@dpbj.test', 'lamaSekali1');
    const res = await admin.post('/api/users').send({ username: 'manual@dpbj.test', nama: 'Dibuat Manual', role: 'pimpinan', password: 'baruSekali1' });
    expect(res.status).toBe(201);
    const row = await ctx.db.get<{ auth_id: string }>(`SELECT auth_id FROM users WHERE username = 'manual@dpbj.test'`);
    expect(row!.auth_id).toBe(ada.id);
    expect((await ctx.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM auth.users WHERE email = 'manual@dpbj.test'`))!.c).toBe(1);
    // Password mengikuti isian admin
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'manual@dpbj.test', password: 'lamaSekali1' })).status).toBe(401);
    const login = await request(ctx.app).post('/api/auth/login').send({ username: 'manual@dpbj.test', password: 'baruSekali1' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('pimpinan');
  });

  it('mengubah email pengguna ikut mengubah email login', async () => {
    const users = (await admin.get('/api/users')).body as { id: number; username: string }[];
    const pumId = users.find((u) => u.username === EMAIL.pum)!.id;
    const res = await admin.put(`/api/users/${pumId}`).send({ username: 'pum.baru@dpbj.test', nama: 'Petugas PUM', role: 'pum', aktif: true });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('pum.baru@dpbj.test');
    expect((await request(ctx.app).post('/api/auth/login').send({ username: EMAIL.pum, password: 'pum123' })).status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'pum.baru@dpbj.test', password: 'pum123' })).status).toBe(200);
  });

  it('admin tidak dapat menonaktifkan/menurunkan dirinya sendiri', async () => {
    const me = (await admin.get('/api/auth/me')).body.user;
    const res = await admin.put(`/api/users/${me.id}`).send({ username: EMAIL.admin, nama: 'Admin', role: 'operator', aktif: true });
    expect(res.status).toBe(409);
    const res2 = await admin.put(`/api/users/${me.id}`).send({ username: EMAIL.admin, nama: 'Admin', role: 'admin', aktif: false });
    expect(res2.status).toBe(409);
  });

  it('reset password / nonaktifkan memaksa pengguna login ulang', async () => {
    const users = (await admin.get('/api/users')).body as { id: number; username: string }[];
    const opId = users.find((u) => u.username === EMAIL.operator)!.id;
    expect((await op.get('/api/auth/me')).body.user).not.toBeNull();

    let res = await admin.put(`/api/users/${opId}`).send({ username: EMAIL.operator, nama: 'Operator DPBJ', role: 'operator', aktif: true, password: 'passbaru1' });
    expect(res.status).toBe(200);
    expect((await op.get('/api/auth/me')).body.user).toBeNull();
    const login = await request(ctx.app).post('/api/auth/login').send({ username: EMAIL.operator, password: 'passbaru1' });
    expect(login.status).toBe(200);

    res = await admin.put(`/api/users/${opId}`).send({ username: EMAIL.operator, nama: 'Operator DPBJ', role: 'operator', aktif: false });
    expect(res.status).toBe(200);
    expect(res.body.aktif).toBe(false);
    const ditolak = await request(ctx.app).post('/api/auth/login').send({ username: EMAIL.operator, password: 'passbaru1' });
    expect(ditolak.status).toBe(403);
  });
});
