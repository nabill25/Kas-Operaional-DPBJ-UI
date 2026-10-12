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
  it('semua peran dapat membaca (pilihan di form); hanya admin yang dapat menambah/mengubah', async () => {
    const list = await pimpinan.get('/api/pegawai');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(5);
    expect(list.body[0]).toMatchObject({ aktif: true, dipakai: 0 });
    expect((await op.get('/api/pegawai')).status).toBe(200);

    // Pengaju tidak mengelola master data (Okt 2026): tambah/ubah pegawai hanya admin.
    for (const agen of [op, pum, pimpinan]) {
      expect((await agen.post('/api/pegawai').send({ nama: 'Orang Baru' })).status).toBe(403);
      expect((await agen.put(`/api/pegawai/${ctx.pegawai[0]}`).send({ nama: 'Ganti Nama' })).status).toBe(403);
    }

    const baru = await admin.post('/api/pegawai').send({ nama: '  Dewi   Kartika ', nip: '1990 0101 2020 1220 01', jabatan: 'Staf' });
    expect(baru.status).toBe(201);
    expect(baru.body).toMatchObject({ nama: 'Dewi Kartika', nip: '199001012020122001', jabatan: 'Staf', aktif: true });

    const ubah = await admin.put(`/api/pegawai/${baru.body.id}`).send({ nama: 'Dewi K.', nip: '', jabatan: '' });
    expect(ubah.status).toBe(200);
    expect(ubah.body).toMatchObject({ nama: 'Dewi K.', nip: null, jabatan: null });
  });

  it('validasi nama & NIP unik', async () => {
    let res = await admin.post('/api/pegawai').send({ nama: 'A', nip: '12ab' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ nama: expect.any(String), nip: expect.any(String) });

    await admin.post('/api/pegawai').send({ nama: 'Pegawai Satu', nip: '123456' });
    res = await admin.post('/api/pegawai').send({ nama: 'Pegawai Dua', nip: '123456' });
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

describe('Profil akun (tautan data pegawai & rekening sendiri)', () => {
  const idAkun = async (peran: keyof typeof EMAIL) =>
    ((await admin.get('/api/users')).body as { id: number; username: string }[]).find((u) => u.username === EMAIL[peran])!.id;
  const dataOp = { username: EMAIL.operator, nama: 'Operator DPBJ', role: 'operator', aktif: true };

  it('belum ditautkan → profil kosong & rekening tidak bisa disimpan', async () => {
    expect((await op.get('/api/auth/profil')).body).toEqual({ pegawai: null });
    const res = await op.put('/api/auth/profil').send({ rekening_bank: 'BNI', rekening_nomor: '0123456789' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('belum ditautkan');
    expect((await request(ctx.app).get('/api/auth/profil')).status).toBe(401);
  });

  it('admin menautkan akun ke pegawai; pemilik akun mengisi rekeningnya sendiri; satu pegawai satu akun', async () => {
    const opId = await idAkun('operator');
    let res = await admin.put(`/api/users/${opId}`).send({ ...dataOp, pegawai_id: ctx.pegawai[2] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ pegawai_id: ctx.pegawai[2], pegawai_nama: 'Nurul Hidayah' });
    expect((await op.get('/api/auth/me')).body.user).toMatchObject({ pegawai_id: ctx.pegawai[2], pegawai_nama: 'Nurul Hidayah' });
    expect(((await admin.get('/api/users')).body as { id: number; pegawai_nama: string | null }[]).find((u) => u.id === opId)?.pegawai_nama).toBe(
      'Nurul Hidayah',
    );

    // Pegawai yang sama tidak bisa ditautkan ke akun lain; pegawai tak dikenal ditolak.
    const pumId = await idAkun('pum');
    const dataPum = { username: EMAIL.pum, nama: 'Petugas PUM', role: 'pum', aktif: true };
    res = await admin.put(`/api/users/${pumId}`).send({ ...dataPum, pegawai_id: ctx.pegawai[2] });
    expect(res.status).toBe(400);
    expect(res.body.errors.pegawai_id).toContain('Operator DPBJ');
    expect((await admin.put(`/api/users/${pumId}`).send({ ...dataPum, pegawai_id: 99999 })).body.errors).toEqual({
      pegawai_id: 'Data pegawai tidak ditemukan',
    });
    expect((await admin.put(`/api/users/${pumId}`).send({ ...dataPum, pegawai_id: 'abc' })).body.errors).toEqual({
      pegawai_id: 'Data pegawai tidak valid',
    });

    // Profil: data pegawai + rekening; validasi sama dengan rekening pegawai; nomor dibersihkan.
    expect((await op.get('/api/auth/profil')).body.pegawai).toMatchObject({ id: ctx.pegawai[2], nama: 'Nurul Hidayah', rekening_bank: null });
    res = await op.put('/api/auth/profil').send({ rekening_bank: 'Bank Mandiri', rekening_nomor: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ rekening_nomor: 'Isi nomor rekening' });
    res = await op.put('/api/auth/profil').send({ rekening_bank: ' Bank  Mandiri ', rekening_nomor: '157-0001 234 567' });
    expect(res.status).toBe(200);
    expect(res.body.pegawai).toMatchObject({ rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234567' });
    // Tersimpan di master Pegawai → mengisi otomatis form pengajuan.
    expect((await admin.get(`/api/pegawai/${ctx.pegawai[2]}`)).body).toMatchObject({ rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234567' });
    // Kosongkan keduanya = hapus rekening.
    res = await op.put('/api/auth/profil').send({ rekening_bank: '', rekening_nomor: '' });
    expect(res.body.pegawai).toMatchObject({ rekening_bank: null, rekening_nomor: null });

    // Mengubah pengguna tanpa field pegawai_id (klien lama) tidak melepas tautan; null melepasnya.
    res = await admin.put(`/api/users/${opId}`).send(dataOp);
    expect(res.body.pegawai_id).toBe(ctx.pegawai[2]);
    res = await admin.put(`/api/users/${opId}`).send({ ...dataOp, pegawai_id: null });
    expect(res.body).toMatchObject({ pegawai_id: null, pegawai_nama: null });
    expect((await op.get('/api/auth/profil')).body).toEqual({ pegawai: null });
    // Setelah lepas, pegawai bisa ditautkan ke akun lain.
    expect((await admin.put(`/api/users/${pumId}`).send({ ...dataPum, pegawai_id: ctx.pegawai[2] })).status).toBe(200);
  });

  it('tautan saat membuat akun & menyetujui pendaftaran; menghapus pegawai melepas tautan', async () => {
    let res = await admin.post('/api/users').send({ username: 'op3@dpbj.test', nama: 'Operator Tiga', role: 'operator', password: 'rahasia1', pegawai_id: ctx.pegawai[3] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ pegawai_id: ctx.pegawai[3], pegawai_nama: 'Bambang Sutrisno' });
    res = await admin.post('/api/users').send({ username: 'op4@dpbj.test', nama: 'Operator Empat', role: 'operator', password: 'rahasia1', pegawai_id: ctx.pegawai[3] });
    expect(res.status).toBe(400);
    expect(res.body.errors.pegawai_id).toContain('Operator Tiga');

    expect((await request(ctx.app).post('/api/auth/daftar').send({ nama: 'Pendaftar Baru', username: 'baru@dpbj.test', password: 'rahasia1' })).status).toBe(201);
    const pendaftar = ((await admin.get('/api/users')).body as { id: number; username: string }[]).find((u) => u.username === 'baru@dpbj.test')!;
    res = await admin.post(`/api/users/${pendaftar.id}/setujui`).send({ role: 'operator', pegawai_id: ctx.pegawai[4] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'operator', aktif: true, pegawai_id: ctx.pegawai[4] });

    // Pegawai yang belum dipakai pengajuan boleh dihapus admin → tautan akun ikut lepas.
    expect((await admin.delete(`/api/pegawai/${ctx.pegawai[4]}`)).status).toBe(200);
    expect(((await admin.get('/api/users')).body as { id: number; pegawai_id: number | null }[]).find((u) => u.id === pendaftar.id)?.pegawai_id).toBeNull();
  });
});
