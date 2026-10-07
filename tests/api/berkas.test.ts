import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_CONTOH,
  buatKonteks,
  dataKonsumsi,
  dataPerjadin,
  jumlahObjekStorage,
  masuk,
  unggah as unggahBerkas,
  type Agent,
  type Konteks,
} from './helpers';

let ctx: Konteks;
let op: Agent;
let pum: Agent;

beforeEach(async () => {
  ctx = await buatKonteks();
  op = await masuk(ctx, 'operator');
  pum = await masuk(ctx, 'pum');
});
afterEach(() => ctx.tutup());

async function buatKonsumsi(): Promise<number> {
  return (await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]))).body.id as number;
}

function unggah(agent: Agent, id: number, jenis: string, file: Buffer, nama: string, namaBerkas?: string) {
  return unggahBerkas(ctx, agent, id, jenis, file, nama, namaBerkas);
}

describe('Berkas', () => {
  it('unggah PDF memperbarui kelengkapan & file bisa diunduh utuh', async () => {
    const id = await buatKonsumsi();
    const res = await unggah(op, id, 'notulen', FILE_CONTOH.pdf, 'notulen-rapat.pdf');
    expect(res.status).toBe(201);
    expect(res.body.berkas_terpenuhi).toBe(1);
    expect(res.body.kelengkapan).toMatchObject({ terpenuhi: 1, total: 4, lengkap: false, persen: 25 });
    const b = res.body.berkas[0];
    expect(b).toMatchObject({ jenis: 'notulen', nama_asli: 'notulen-rapat.pdf', mime: 'application/pdf', uploaded_by_nama: 'Operator DPBJ' });
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'berkas_diunggah', keterangan: 'Notula: notulen-rapat.pdf' });
    expect(res.body.kelengkapan.items[0]).toMatchObject({ jenis: 'notulen', label: 'Notula' });

    // Isi yang tersimpan di storage identik dengan file yang diunggah; kuncinya berawalan id pengajuan.
    const key = (await ctx.db.get<{ nama_file: string }>('SELECT nama_file FROM berkas WHERE id = ?', b.id))!.nama_file;
    expect(key).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.pdf$`));
    expect(Buffer.compare(ctx.storage.objek.get(key)!, FILE_CONTOH.pdf)).toBe(0);

    // Lihat (inline) & unduh: dialihkan ke URL bertanda tangan sementara, unduh membawa nama file asli.
    const lihat = await op.get(`/api/berkas/${b.id}/file`).redirects(0);
    expect(lihat.status).toBe(302);
    expect(lihat.headers['cache-control']).toContain('no-store');
    const urlLihat = new URL(lihat.headers.location);
    expect(urlLihat.pathname).toBe(`/object/sign/berkas/${key}`);
    expect(urlLihat.searchParams.get('download')).toBeNull();
    expect(Number(urlLihat.searchParams.get('detik'))).toBeLessThanOrEqual(600);

    const unduh = await op.get(`/api/berkas/${b.id}/file?unduh=1`).redirects(0);
    expect(unduh.status).toBe(302);
    expect(new URL(unduh.headers.location).searchParams.get('download')).toBe('notulen-rapat.pdf');
  });

  it('konfirmasi unggahan menolak kunci palsu, file yang belum terunggah, ukuran palsu & konfirmasi ganda', async () => {
    const id = await buatKonsumsi();
    const lain = await buatKonsumsi();
    const siapkan = (pid: number, ukuran = FILE_CONTOH.pdf.length) =>
      op.post(`/api/pengajuan/${pid}/berkas/siapkan`).send({ jenis: 'notulen', nama_asli: 'n.pdf', ukuran });
    const konfirmasi = (pid: number, key: string) =>
      op.post(`/api/pengajuan/${pid}/berkas/konfirmasi`).send({ key, jenis: 'notulen', nama_asli: 'n.pdf' });

    // Kunci milik pengajuan lain tidak boleh dicatat ke pengajuan ini
    const s1 = await siapkan(lain);
    ctx.storage.taruh(s1.body.key, FILE_CONTOH.pdf);
    expect((await konfirmasi(id, s1.body.key)).status).toBe(400);
    expect((await konfirmasi(id, `${id}/../${s1.body.key}`)).status).toBe(400);

    // Belum diunggah ke storage
    const s2 = await siapkan(id);
    const belum = await konfirmasi(id, s2.body.key);
    expect(belum.status).toBe(400);
    expect(belum.body.message).toContain('belum terunggah');

    // Klien mengaku kecil tapi isinya > 10 MB → ditolak saat konfirmasi & objek dihapus
    const s3 = await siapkan(id);
    ctx.storage.taruh(s3.body.key, Buffer.concat([FILE_CONTOH.pdf, Buffer.alloc(10 * 1024 * 1024 + 10)]));
    const besar = await konfirmasi(id, s3.body.key);
    expect(besar.status).toBe(413);
    expect(ctx.storage.objek.has(s3.body.key)).toBe(false);

    // Konfirmasi ganda untuk kunci yang sama
    const s4 = await siapkan(id);
    ctx.storage.taruh(s4.body.key, FILE_CONTOH.pdf);
    expect((await konfirmasi(id, s4.body.key)).status).toBe(201);
    expect((await konfirmasi(id, s4.body.key)).status).toBe(409);
    expect((await op.get(`/api/pengajuan/${id}`)).body.berkas).toHaveLength(1);

    // Ukuran yang dilaporkan tidak valid
    expect((await siapkan(id, 0)).status).toBe(400);
  });

  it('nama file UTF-8 dipertahankan', async () => {
    const id = await buatKonsumsi();
    const nama = 'Notulen Rapat – Ruang Lt.2 (révisi).pdf';
    const res = await unggah(op, id, 'notulen', FILE_CONTOH.pdf, nama);
    expect(res.status).toBe(201);
    expect(res.body.berkas[0].nama_asli).toBe(nama);
  });

  it('menolak ekstensi terlarang & isi yang tidak cocok, tanpa meninggalkan file yatim', async () => {
    const id = await buatKonsumsi();
    let res = await unggah(op, id, 'notulen', Buffer.from('MZ...'), 'virus.exe');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Tipe file tidak didukung');

    res = await unggah(op, id, 'notulen', Buffer.from('<html>bukan pdf</html>'), 'palsu.pdf');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Isi file tidak sesuai');

    res = await unggah(op, id, 'notulen', FILE_CONTOH.png, 'gambar.jpg');
    expect(res.status).toBe(400);

    expect(jumlahObjekStorage(ctx)).toBe(0);
    expect((await op.get(`/api/pengajuan/${id}`)).body.berkas).toHaveLength(0);
  });

  it('menerima gambar & dokumen Office yang valid', async () => {
    const id = await buatKonsumsi();
    expect((await unggah(op, id, 'undangan', FILE_CONTOH.png, 'undangan.png')).status).toBe(201);
    expect((await unggah(op, id, 'invoice', FILE_CONTOH.jpg, 'invoice.JPG')).status).toBe(201);
    const res = await unggah(op, id, 'daftar_hadir', FILE_CONTOH.docx, 'daftar-hadir.docx');
    expect(res.status).toBe(201);
    expect(res.body.berkas.map((b: { mime: string }) => b.mime)).toEqual([
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
  });

  it('jenis berkas harus sesuai kategori', async () => {
    const id = await buatKonsumsi();
    const res = await unggah(op, id, 'invoice_hotel', FILE_CONTOH.pdf, 'hotel.pdf');
    expect(res.status).toBe(400);
    expect(res.body.errors.jenis).toBeTruthy();
    expect(jumlahObjekStorage(ctx)).toBe(0);
  });

  it('dokumen lainnya wajib diberi nama & tidak dihitung sebagai berkas wajib', async () => {
    const id = await buatKonsumsi();
    let res = await unggah(op, id, 'lainnya', FILE_CONTOH.pdf, 'foto.pdf', '');
    expect(res.status).toBe(400);
    expect(res.body.errors.nama_berkas).toBeTruthy();
    res = await unggah(op, id, 'lainnya', FILE_CONTOH.pdf, 'foto.pdf', 'Foto Dokumentasi');
    expect(res.status).toBe(201);
    expect(res.body.berkas[0].nama_berkas).toBe('Foto Dokumentasi');
    expect(res.body.berkas_terpenuhi).toBe(0);
  });

  it('file melebihi 10 MB ditolak (413)', async () => {
    const id = await buatKonsumsi();
    const besar = Buffer.concat([FILE_CONTOH.pdf, Buffer.alloc(10 * 1024 * 1024 + 10)]);
    const res = await unggah(op, id, 'notulen', besar, 'besar.pdf');
    expect(res.status).toBe(413);
    expect(res.body.message).toContain('10 MB');
    expect(jumlahObjekStorage(ctx)).toBe(0);
  });

  it('hapus berkas menghapus file fisik & menurunkan kelengkapan', async () => {
    const id = await buatKonsumsi();
    const up = await unggah(op, id, 'notulen', FILE_CONTOH.pdf, 'n.pdf');
    expect(jumlahObjekStorage(ctx)).toBe(1);
    const res = await op.delete(`/api/berkas/${up.body.berkas[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.berkas_terpenuhi).toBe(0);
    expect(res.body.riwayat[0].aksi).toBe('berkas_dihapus');
    expect(jumlahObjekStorage(ctx)).toBe(0);
  });

  it('tanda N/A (tidak diperlukan) untuk berkas wajib', async () => {
    const id = (
      await op.post('/api/pengajuan').send(
        dataPerjadin([{ pegawai_id: ctx.pegawai[0], nilai: 300_000 }], { jenis_transport: 'dalam_kota' }),
      )
    ).body.id as number;

    let res = await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'invoice_hotel', na: true });
    expect(res.status).toBe(200);
    expect(res.body.berkas_na).toEqual(['invoice_hotel']);
    expect(res.body.kelengkapan.terpenuhi).toBe(1);

    res = await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'invoice_tiket', na: true });
    await unggah(op, id, 'surat_tugas', FILE_CONTOH.pdf, 'st.pdf');
    res = await unggah(op, id, 'laporan_kegiatan', FILE_CONTOH.pdf, 'lap.pdf');
    expect(res.body.kelengkapan).toMatchObject({ terpenuhi: 4, total: 4, lengkap: true });
    expect(res.body.berkas_terpenuhi).toBe(4);

    // N/A pada jenis yang sudah ada file → 409; jenis bukan wajib → 400
    expect((await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'surat_tugas', na: true })).status).toBe(409);
    expect((await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'notulen', na: true })).status).toBe(400);
    expect((await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'invoice_hotel' })).status).toBe(400);

    // Unggah file untuk jenis N/A → tanda N/A dilepas otomatis
    res = await unggah(op, id, 'invoice_hotel', FILE_CONTOH.pdf, 'hotel.pdf');
    expect(res.body.berkas_na).toEqual(['invoice_tiket']);
    expect(res.body.kelengkapan.terpenuhi).toBe(4);

    // Batalkan N/A
    res = await op.put(`/api/pengajuan/${id}/berkas-na`).send({ jenis: 'invoice_tiket', na: false });
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'berkas_na_batal', keterangan: 'Invoice Tiket' });
    expect(res.body.kelengkapan).toMatchObject({ terpenuhi: 3, lengkap: false });

    // Filter kelengkapan di daftar
    const belum = await op.get('/api/pengajuan?kelengkapan=belum_lengkap');
    expect(belum.body.total).toBe(1);
    const lengkap = await op.get('/api/pengajuan?kelengkapan=lengkap');
    expect(lengkap.body.total).toBe(0);
  });

  it('PUM boleh melihat/unduh berkas pengajuan yang diajukan, tapi tidak boleh mengubah berkas', async () => {
    const id = await buatKonsumsi();
    const up = await unggah(op, id, 'notulen', FILE_CONTOH.pdf, 'n.pdf');
    const berkasId = up.body.berkas[0].id as number;
    // Saat draft, PUM tidak bisa melihat
    expect((await pum.get(`/api/berkas/${berkasId}/file`).redirects(0)).status).toBe(404);
    await op.post(`/api/pengajuan/${id}/ajukan`);
    expect((await pum.get(`/api/berkas/${berkasId}/file`).redirects(0)).status).toBe(302);
    expect((await pum.delete(`/api/berkas/${berkasId}`)).status).toBe(403);
    expect((await unggah(pum, id, 'undangan', FILE_CONTOH.pdf, 'u.pdf')).status).toBe(403);
    // Operator pun tidak bisa mengubah berkas saat diajukan
    expect((await op.delete(`/api/berkas/${berkasId}`)).status).toBe(409);
  });

  it('hapus pengajuan juga menghapus file-filenya', async () => {
    const id = await buatKonsumsi();
    await unggah(op, id, 'notulen', FILE_CONTOH.pdf, 'n.pdf');
    await unggah(op, id, 'undangan', FILE_CONTOH.pdf, 'u.pdf');
    expect(jumlahObjekStorage(ctx)).toBe(2);
    expect((await op.delete(`/api/pengajuan/${id}`)).status).toBe(200);
    expect(jumlahObjekStorage(ctx)).toBe(0);
    expect((await ctx.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM berkas'))!.c).toBe(0);
  });

  it('objek hilang dari storage → 404 yang jelas', async () => {
    const id = await buatKonsumsi();
    const up = await unggah(op, id, 'notulen', FILE_CONTOH.pdf, 'n.pdf');
    const namaFile = (await ctx.db.get<{ nama_file: string }>('SELECT nama_file FROM berkas WHERE id = ?', up.body.berkas[0].id))!.nama_file;
    ctx.storage.objek.delete(namaFile);
    const res = await op.get(`/api/berkas/${up.body.berkas[0].id}/file`).redirects(0);
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('tidak ditemukan');
  });
});
