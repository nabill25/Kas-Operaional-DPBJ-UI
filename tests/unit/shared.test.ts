import { describe, expect, it } from 'vitest';
import {
  formatAngka,
  formatRentangTanggal,
  formatRupiah,
  formatRupiahRingkas,
  formatTanggal,
  formatUkuran,
  lamaHari,
  tanggalLokalIso,
  waktuRelatif,
} from '../../shared/format';
import { hitungKelengkapan, parseBerkasNa } from '../../shared/kelengkapan';
import {
  isTanggalValid,
  validateCekBerkas,
  validateDataPum,
  validateInvoice,
  validatePegawai,
  validatePengajuan,
  validateTeruskan,
  validateUser,
} from '../../shared/validation';

describe('format', () => {
  it('angka & rupiah', () => {
    expect(formatAngka(0)).toBe('0');
    expect(formatAngka(999)).toBe('999');
    expect(formatAngka(1000)).toBe('1.000');
    expect(formatAngka(1250000)).toBe('1.250.000');
    expect(formatAngka(-45000)).toBe('-45.000');
    expect(formatRupiah(1250000)).toBe('Rp 1.250.000');
    expect(formatRupiah(null)).toBe('Rp 0');
    expect(formatRupiah(-5000)).toBe('-Rp 5.000');
  });

  it('rupiah ringkas untuk sumbu chart', () => {
    expect(formatRupiahRingkas(0)).toBe('0');
    expect(formatRupiahRingkas(950)).toBe('950');
    expect(formatRupiahRingkas(15_000)).toBe('15 rb');
    expect(formatRupiahRingkas(1_250_000)).toBe('1,3 jt');
    expect(formatRupiahRingkas(1_250_000, 2)).toBe('1,25 jt');
    expect(formatRupiahRingkas(12_000_000)).toBe('12 jt');
    expect(formatRupiahRingkas(2_500_000_000)).toBe('2,5 M');
  });

  it('tanggal Indonesia', () => {
    expect(formatTanggal('2026-10-06')).toBe('6 Oktober 2026');
    expect(formatTanggal('2026-01-31', 'pendek')).toBe('31 Jan 2026');
    expect(formatTanggal(null)).toBe('-');
    expect(formatTanggal('bukan tanggal')).toBe('-');
    expect(formatRentangTanggal('2026-10-06', '2026-10-08')).toBe('6–8 Okt 2026');
    expect(formatRentangTanggal('2026-09-28', '2026-10-02')).toBe('28 Sep – 2 Okt 2026');
    expect(formatRentangTanggal('2025-12-30', '2026-01-02')).toBe('30 Des 2025 – 2 Jan 2026');
    expect(formatRentangTanggal('2026-10-06', null)).toBe('6 Okt 2026');
  });

  it('lama hari inklusif (aman terhadap DST)', () => {
    expect(lamaHari('2026-10-01', '2026-10-01')).toBe(1);
    expect(lamaHari('2026-10-01', '2026-10-03')).toBe(3);
    expect(lamaHari('2026-03-28', '2026-04-02')).toBe(6);
    expect(lamaHari('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('tanggal lokal & waktu relatif', () => {
    expect(tanggalLokalIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    const now = Date.parse('2026-10-06T10:00:00Z');
    expect(waktuRelatif('2026-10-06T09:59:30Z', now)).toBe('baru saja');
    expect(waktuRelatif('2026-10-06T09:15:00Z', now)).toBe('45 menit lalu');
    expect(waktuRelatif('2026-10-06T05:00:00Z', now)).toBe('5 jam lalu');
    expect(waktuRelatif('2026-10-03T10:00:00Z', now)).toBe('3 hari lalu');
  });

  it('ukuran file', () => {
    expect(formatUkuran(512)).toBe('512 B');
    expect(formatUkuran(1536)).toBe('1,5 KB');
    expect(formatUkuran(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });
});

describe('validasi', () => {
  it('tanggal', () => {
    expect(isTanggalValid('2026-02-28')).toBe(true);
    expect(isTanggalValid('2028-02-29')).toBe(true);
    expect(isTanggalValid('2026-02-29')).toBe(false);
    expect(isTanggalValid('2026-13-01')).toBe(false);
    expect(isTanggalValid('26-01-01')).toBe(false);
    expect(isTanggalValid('1999-12-31')).toBe(false);
    expect(isTanggalValid(20260101)).toBe(false);
  });

  it('konsumsi valid → data bersih (angka dari string, teks dirapikan)', () => {
    const h = validatePengajuan({
      kategori: 'konsumsi',
      nama_kegiatan: '  Rapat   Koordinasi ',
      tanggal_kegiatan: '2026-10-06',
      jumlah_orang: '15',
      total: '750000',
      uang_siapa_id: '3',
      mekanisme: 'LS',
      jenis_konsumsi: 'makan_siang',
      catatan: '   ',
      peserta: [{ pegawai_id: 1, nilai: 1 }],
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data).toMatchObject({
      nama_kegiatan: 'Rapat Koordinasi',
      jumlah_orang: 15,
      total: 750000,
      uang_siapa_id: 3,
      jenis_konsumsi: 'makan_siang',
      catatan: null,
      peserta: [],
      lokasi_tujuan: null,
      tanggal_selesai: null,
    });
  });

  it('angka desimal & teks ditolak', () => {
    const h = validatePengajuan({
      kategori: 'konsumsi',
      nama_kegiatan: 'Rapat',
      tanggal_kegiatan: '2026-10-06',
      jumlah_orang: 2.5,
      total: '12.000',
      uang_siapa_id: 'abc',
      mekanisme: 'KO',
    });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(Object.keys(h.errors).sort()).toEqual(['jenis_konsumsi', 'jumlah_orang', 'total', 'uang_siapa_id']);
  });

  it('transport: total dari peserta, data konsumsi diabaikan', () => {
    const h = validatePengajuan({
      kategori: 'perjadin',
      nama_kegiatan: 'Perjalanan Dinas',
      tanggal_kegiatan: '2026-10-01',
      tanggal_selesai: '2026-10-03',
      lokasi_tujuan: 'Bandung',
      mekanisme: 'KO',
      jenis_uang: 'uang_transport',
      jenis_transport: 'luar_kota',
      uang_siapa_id: 9,
      total: 1,
      peserta: [
        { pegawai_id: 1, nilai: 500000 },
        { pegawai_id: 2, nilai: '250000' },
      ],
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data.total).toBe(750000);
    expect(h.data.jumlah_orang).toBe(2);
    expect(h.data.uang_siapa_id).toBeNull();
  });

  it('peserta transport kosong → pesan "wajib", bukan "harus > 0"', () => {
    const h = validatePengajuan({
      kategori: 'rumah_tangga',
      nama_kegiatan: 'Pengantaran Dokumen',
      tanggal_kegiatan: '2026-10-01',
      lokasi_tujuan: 'Rektorat',
      mekanisme: 'KO',
      peserta: [{ pegawai_id: null, nilai: null }],
    });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.errors['peserta.0.pegawai_id']).toBe('Pilih nama pegawai');
    expect(h.errors['peserta.0.nilai']).toBe('Nilai uang wajib diisi');
  });

  it('perjadin maksimal 366 hari', () => {
    const h = validatePengajuan({
      kategori: 'perjadin',
      nama_kegiatan: 'Perjalanan Dinas',
      tanggal_kegiatan: '2026-01-01',
      tanggal_selesai: '2027-06-01',
      lokasi_tujuan: 'Bandung',
      mekanisme: 'KO',
      jenis_uang: 'uang_harian',
      jenis_transport: 'luar_kota',
      peserta: [{ pegawai_id: 1, nilai: 1 }],
    });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.errors.tanggal_selesai).toContain('366');
  });

  it('pegawai, user, invoice', () => {
    expect(validatePegawai({ nama: 'Budi', nip: '19870101 201001 1 001' })).toMatchObject({
      ok: true,
      data: { nip: '198701012010011001' },
    });
    // Username = email login (Supabase Auth)
    expect(validateUser({ username: 'ab', nama: 'X', role: 'admin' }, 'ubah').ok).toBe(false);
    expect(validateUser({ username: 'budi.s', nama: 'Budi', role: 'pum' }, 'ubah').ok).toBe(false);
    expect(validateUser({ username: 'budi@ui', nama: 'Budi', role: 'pum' }, 'ubah').ok).toBe(false);
    expect(validateUser({ username: ' Budi.S@UI.ac.id ', nama: 'Budi', role: 'pum' }, 'ubah')).toMatchObject({
      ok: true,
      data: { username: 'budi.s@ui.ac.id', password: null, aktif: true },
    });
    expect(validateInvoice({ no_invoice_mdk: ' INV-1 ', tanggal_invoice_mdk: '2026-10-06' })).toMatchObject({
      ok: true,
      data: { no_invoice_mdk: 'INV-1', catatan: null },
    });
  });
});

describe('validasi PUM', () => {
  it('centang berkas', () => {
    expect(validateCekBerkas({ jenis: 'notulen', status: 'sesuai', catatan: 'abaikan' })).toEqual({
      ok: true,
      data: { jenis: 'notulen', status: 'sesuai', catatan: null },
    });
    expect(validateCekBerkas({ jenis: 'notulen', status: null })).toMatchObject({ ok: true, data: { status: null } });
    expect(validateCekBerkas({ jenis: 'notulen', status: 'revisi' })).toMatchObject({ ok: false, errors: { catatan: expect.any(String) } });
    expect(validateCekBerkas({ jenis: 'notulen', status: 'revisi', catatan: ' Buram ' })).toMatchObject({
      ok: true,
      data: { status: 'revisi', catatan: 'Buram' },
    });
    expect(validateCekBerkas({ jenis: '', status: 'oke' })).toMatchObject({
      ok: false,
      errors: { jenis: expect.any(String), status: expect.any(String) },
    });
  });

  it('project hosting, task name, teruskan', () => {
    expect(validateDataPum({ project_hosting: '  DPBJ   OPS ', task_name: '' })).toEqual({
      ok: true,
      data: { project_hosting: 'DPBJ OPS', task_name: null },
    });
    expect(validateDataPum({ project_hosting: 'x'.repeat(151) })).toMatchObject({ ok: false });
    expect(validateTeruskan({})).toEqual({ ok: true, data: { project_hosting: null, task_name: null, catatan: null } });
    expect(validateTeruskan({ catatan: 'y'.repeat(1001) })).toMatchObject({ ok: false, errors: { catatan: expect.any(String) } });
  });
});

describe('kelengkapan', () => {
  it('menghitung terpenuhi dari file & N/A', () => {
    const k = hitungKelengkapan(
      'perjadin',
      [{ jenis: 'surat_tugas' }, { jenis: 'surat_tugas' }, { jenis: 'lainnya' }],
      ['invoice_hotel', 'surat_tugas'],
    );
    expect(k.total).toBe(4);
    expect(k.terpenuhi).toBe(2);
    expect(k.persen).toBe(50);
    expect(k.lengkap).toBe(false);
    const st = k.items.find((i) => i.jenis === 'surat_tugas')!;
    expect(st).toMatchObject({ jumlah: 2, na: false, terpenuhi: true });
    expect(k.items.find((i) => i.jenis === 'invoice_hotel')).toMatchObject({ jumlah: 0, na: true, terpenuhi: true });
  });

  it('menghitung hasil centang PUM', () => {
    const cekDasar = { catatan: null, diperiksa_by: 1, diperiksa_by_nama: 'PUM', diperiksa_at: '2026-10-06T00:00:00Z' };
    const k = hitungKelengkapan(
      'rumah_tangga',
      [{ jenis: 'surat_tugas' }, { jenis: 'laporan_kegiatan' }],
      [],
      [
        { ...cekDasar, jenis: 'surat_tugas', status: 'sesuai' },
        { ...cekDasar, jenis: 'laporan_kegiatan', status: 'revisi', catatan: 'Tanda tangan kurang' },
      ],
    );
    expect(k).toMatchObject({ sesuai: 1, revisi: 1, semuaSesuai: false, lengkap: true });
    expect(k.items[1].cek).toMatchObject({ status: 'revisi', catatan: 'Tanda tangan kurang' });
    const semua = hitungKelengkapan('rumah_tangga', [], ['surat_tugas', 'laporan_kegiatan'], [
      { ...cekDasar, jenis: 'surat_tugas', status: 'sesuai' },
      { ...cekDasar, jenis: 'laporan_kegiatan', status: 'sesuai' },
    ]);
    expect(semua).toMatchObject({ sesuai: 2, semuaSesuai: true, lengkap: true });
    expect(hitungKelengkapan('konsumsi', [], [])).toMatchObject({ sesuai: 0, revisi: 0, semuaSesuai: false });
  });

  it('parse JSON N/A dengan aman', () => {
    expect(parseBerkasNa('["a",1,"b"]')).toEqual(['a', 'b']);
    expect(parseBerkasNa('rusak')).toEqual([]);
    expect(parseBerkasNa(null)).toEqual([]);
    expect(parseBerkasNa('{"a":1}')).toEqual([]);
  });
});
