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
import {
  AKSI_RIWAYAT_LABEL,
  STATUS_BISA_DIBAYARKAN,
  STATUS_INFO,
  STATUS_LEWAT_VERIFIKASI,
  STATUS_LIST,
  isBankMandiri,
} from '../../shared/constants';
import { hitungKelengkapan, parseBerkasDaftar, parseBerkasNa } from '../../shared/kelengkapan';
import { buatKamus, kodeDariLabel, maksPeserta } from '../../shared/konfig';
import { cariProject, cocokKataKunci, susunProjectTask, taskOtomatis } from '../../shared/project-task';
import {
  isTanggalValid,
  validateBank,
  validateCekBerkas,
  validateDataPum,
  validateInvoice,
  validateJenisBerkas,
  validateJenisPengajuan,
  validatePegawai,
  validatePengajuan as validatePengajuanJenis,
  validateProject,
  validateTask,
  validateUser,
  validateVerifikasi,
} from '../../shared/validation';
import { JENIS_BORONGAN_UJI, KONFIG_UJI, KONFIG_UJI_BORONGAN, jenisUji, masterProjectTaskUji } from '../support/konfig-uji';

/** Validasi pengajuan dengan jenis dari master uji (kategori tak dikenal → undefined). */
const validatePengajuan = (raw: Record<string, unknown>) => validatePengajuanJenis(raw, jenisUji(String(raw.kategori)));
const kamus = buatKamus(KONFIG_UJI);
const label = (k: string) => kamus.labelBerkas(k);
const wajib = (kategori: string) => kamus.jenis(kategori).berkas;

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

  it('perjadin: nilai per orang = uang harian + uang transport, data konsumsi & jenis uang diabaikan', () => {
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
      rekening_bank: 'BNI',
      rekening_nomor: '0123456789',
      total: 1,
      peserta: [
        { pegawai_id: 1, nilai: 1, uang_harian: 300000, uang_transport: 200000 },
        { pegawai_id: 2, uang_transport: '250000' },
      ],
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data.total).toBe(750000);
    expect(h.data.jumlah_orang).toBe(2);
    expect(h.data.uang_siapa_id).toBeNull();
    expect(h.data.jenis_uang).toBeNull();
    expect(h.data).toMatchObject({ rekening_bank: null, rekening_nomor: null });
    expect(h.data.peserta).toEqual([
      { pegawai_id: 1, nilai: 500000, uang_harian: 300000, uang_transport: 200000 },
      { pegawai_id: 2, nilai: 250000, uang_harian: 0, uang_transport: 250000 },
    ]);
  });

  it('perjadin: uang kosong, negatif, atau bukan angka ditolak per orang', () => {
    const h = validatePengajuan({
      kategori: 'perjadin',
      nama_kegiatan: 'Perjalanan Dinas',
      tanggal_kegiatan: '2026-10-01',
      tanggal_selesai: '2026-10-01',
      lokasi_tujuan: 'Bandung',
      mekanisme: 'KO',
      jenis_transport: 'dalam_kota',
      peserta: [
        { pegawai_id: null, uang_harian: '', uang_transport: null },
        { pegawai_id: 2, uang_harian: -1, uang_transport: 'abc' },
      ],
    });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.errors).toEqual({
      'peserta.0.pegawai_id': 'Pilih nama pegawai',
      'peserta.0.uang_harian': 'Isi uang harian dan/atau uang transport',
      'peserta.1.uang_harian': 'Uang harian tidak boleh negatif',
      'peserta.1.uang_transport': 'Uang transport harus berupa angka',
    });
  });

  it('konsumsi: rekening opsional, berpasangan, nomor dirapikan', () => {
    const dasar = {
      kategori: 'konsumsi',
      nama_kegiatan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-10-06',
      jumlah_orang: 5,
      total: 100000,
      uang_siapa_id: 1,
      mekanisme: 'KO',
      jenis_konsumsi: 'kudapan',
    };
    expect(validatePengajuan(dasar)).toMatchObject({ ok: true, data: { rekening_bank: null, rekening_nomor: null } });
    expect(validatePengajuan({ ...dasar, rekening_bank: ' Bank  Mandiri ', rekening_nomor: '157-00.01 234' })).toMatchObject({
      ok: true,
      data: { rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234' },
    });
    expect(validatePengajuan({ ...dasar, rekening_bank: 'BRI', rekening_nomor: '' })).toMatchObject({
      ok: false,
      errors: { rekening_nomor: 'Isi nomor rekening' },
    });
    expect(validatePengajuan({ ...dasar, rekening_bank: 'X', rekening_nomor: '12345' })).toMatchObject({
      ok: false,
      errors: { rekening_bank: 'Nama bank minimal 2 karakter' },
    });
  });

  it('bank Mandiri (bebas biaya transfer) dikenali dari namanya', () => {
    expect(isBankMandiri('Bank Mandiri')).toBe(true);
    expect(isBankMandiri('mandiri')).toBe(true);
    expect(isBankMandiri('PT Bank Mandiri (Persero) Tbk')).toBe(true);
    expect(isBankMandiri('Bank Syariah Mandiri')).toBe(false);
    expect(isBankMandiri('BNI')).toBe(false);
    expect(isBankMandiri('Mandiriku')).toBe(false);
    expect(isBankMandiri(null)).toBe(false);
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
      jenis_transport: 'luar_kota',
      peserta: [{ pegawai_id: 1, uang_harian: 1 }],
    });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.errors.tanggal_selesai).toContain('366');
  });

  it('master project costing & task name (dari database) disusun & dicari', () => {
    const daftar = susunProjectTask(masterProjectTaskUji());
    expect(daftar.project).toHaveLength(15);
    expect(daftar.task).toHaveLength(18);
    expect(daftar.project[0]).toMatchObject({ project: 'D0030.06.01.6.001:Penguatan Manajemen Kontrak', kode: 'D0030.06.01.6.001' });
    expect(daftar.task[0]).toEqual({ task: '721702_Honor Moderator/Pembicara/Fasilitator', kode: '721702', nama: 'Honor Moderator/Pembicara/Fasilitator' });
    // Nama project boleh berisi "&" dan koma
    expect(cariProject(daftar, 'D0030.10.01.6.005:Undangan, penugasan, koordinasi kelembagaan & temuan')?.tasks.map((t) => t.kode)).toEqual([
      '723216',
    ]);
    // Task terisi otomatis hanya bila tepat satu task cocok dengan kata kunci jenis pengajuan
    const koordinasi = 'D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan';
    expect(taskOtomatis(daftar, 'konsumsi', koordinasi)).toBe('723207_Beban Konsumsi');
    expect(taskOtomatis(daftar, 'transportasi rumah tangga', koordinasi)).toBe('723216_Beban Transportasi Rumah Tangga');
    expect(taskOtomatis(daftar, 'perjadin', koordinasi)).toBeNull();
    expect(taskOtomatis(daftar, 'konsumsi', 'D0030.06.01.6.001:Penguatan Manajemen Kontrak')).toBeNull();
    expect(taskOtomatis(daftar, 'konsumsi', 'Project lain')).toBeNull();
    expect(taskOtomatis(daftar, null, koordinasi)).toBeNull();
    // Kata kunci: tanpa membedakan huruf besar/kecil, beberapa dipisah koma
    expect(cocokKataKunci('perjadin', 'Beban Tiket - Perjadin Luar Negeri')).toBe(true);
    expect(cocokKataKunci('konsumsi', 'Beban Transportasi Rumah Tangga')).toBe(false);
    expect(cocokKataKunci(' honor narasumber , TENAGA LEPAS', 'Honor Tenaga Lepas')).toBe(true);
    expect(cocokKataKunci(' , ', 'Honor Tenaga Lepas')).toBe(false);
    // Task/project nonaktif tidak ditawarkan
    const m = masterProjectTaskUji();
    m.task[0].aktif = false;
    m.project[0].aktif = false;
    const tanpa = susunProjectTask(m);
    expect(tanpa.project).toHaveLength(14);
    expect(tanpa.task.some((t) => t.kode === m.task[0].kode)).toBe(false);
  });

  it('jenis pengajuan model Umum: tanpa lokasi, periode opsional, batas orang dari master', () => {
    const dasar = {
      kategori: 'kontrak_borongan',
      nama_kegiatan: 'Honor Borongan',
      tanggal_kegiatan: '2026-09-01',
      mekanisme: 'LS',
      lokasi_tujuan: 'diabaikan',
      jenis_transport: 'luar_kota',
      peserta: [{ pegawai_id: 1, nilai: '1500000', uang_harian: 9 }],
    };
    expect(validatePengajuan(dasar)).toMatchObject({
      ok: true,
      data: { lokasi_tujuan: null, tanggal_selesai: null, jenis_transport: null, total: 1_500_000, peserta: [{ pegawai_id: 1, nilai: 1_500_000, uang_harian: null }] },
    });
    expect(validatePengajuan({ ...dasar, tanggal_selesai: '2026-09-30' })).toMatchObject({ ok: true, data: { tanggal_selesai: '2026-09-30' } });
    expect(validatePengajuan({ ...dasar, tanggal_selesai: '2026-08-01' })).toMatchObject({
      ok: false,
      errors: { tanggal_selesai: 'Tanggal selesai tidak boleh sebelum tanggal mulai' },
    });
    expect(validatePengajuan({ ...dasar, tanggal_kegiatan: '' })).toMatchObject({ ok: false, errors: { tanggal_kegiatan: 'Tanggal wajib diisi' } });
    const empat = [1, 2, 3, 4].map((id) => ({ pegawai_id: id, nilai: 1 }));
    expect(validatePengajuan({ ...dasar, peserta: empat })).toMatchObject({ ok: false, errors: { peserta: 'Maksimal 3 orang per pengajuan' } });
    expect(maksPeserta(JENIS_BORONGAN_UJI)).toBe(3);
    expect(maksPeserta(KONFIG_UJI.jenisPengajuan[0])).toBe(0);
    // Kategori tak dikenal / jenis tidak cocok
    expect(validatePengajuan({ ...dasar, kategori: 'tidak_ada' })).toEqual({ ok: false, errors: { kategori: 'Jenis pengajuan tidak valid' } });
    expect(validatePengajuanJenis({ ...dasar, kategori: 'konsumsi' }, JENIS_BORONGAN_UJI)).toEqual({
      ok: false,
      errors: { kategori: 'Jenis pengajuan tidak valid' },
    });
  });

  it('kamus master: label, jenis cadangan, jenis yang ditampilkan', () => {
    const k = buatKamus({
      ...KONFIG_UJI_BORONGAN,
      jenisPengajuan: KONFIG_UJI_BORONGAN.jenisPengajuan.map((j) => (j.kode === 'perjadin' ? { ...j, aktif: false } : j)),
    });
    expect(k.labelBerkas('notulen')).toBe('Notula');
    expect(k.labelBerkas('lainnya')).toBe('Dokumen Lainnya');
    expect(k.labelBerkas('kode_lama')).toBe('kode_lama');
    expect(k.jenis('tidak_ada')).toMatchObject({ kode: 'tidak_ada', label: 'tidak_ada', model: 'umum', warna: 'abu', berkas: [] });
    expect(k.dikenal('tidak_ada')).toBe(false);
    expect(k.grup('perjadin')).toBe('Transport');
    expect(k.grup('kontrak_borongan')).toBe('Umum');
    expect(k.jenisTampil().map((j) => j.kode)).toEqual(['konsumsi', 'rumah_tangga', 'kontrak_borongan']);
    expect(k.jenisTampil((kode) => kode === 'perjadin').map((j) => j.kode)).toEqual(['konsumsi', 'rumah_tangga', 'perjadin', 'kontrak_borongan']);
  });

  it('kode master dari nama', () => {
    expect(kodeDariLabel('Kontrak Borongan')).toBe('kontrak_borongan');
    expect(kodeDariLabel('  Honor (Narasumber) & Moderator ')).toBe('honor_narasumber_moderator');
    expect(kodeDariLabel('Kontrak Borongan', ['kontrak_borongan', 'kontrak_borongan_2'])).toBe('kontrak_borongan_3');
    expect(kodeDariLabel('123 Arsip')).toBe('arsip');
    expect(kodeDariLabel('Lainnya')).toBe('lainnya_2');
    expect(kodeDariLabel('Ç')).toBe('c_x');
    expect(kodeDariLabel('!!!')).toBe('jenis');
    expect(kodeDariLabel('x'.repeat(80))).toMatch(/^x{36}$/);
  });

  it('validasi master data', () => {
    const jp = {
      label: ' Kontrak  Borongan ',
      prefix: 'kbr',
      model: 'umum',
      maks_peserta: '5',
      warna: 'ungu',
      ikon: 'hard-hat',
      berkas: ['presensi', 'kontrak'],
    };
    expect(validateJenisPengajuan(jp)).toEqual({
      ok: true,
      data: {
        label: 'Kontrak Borongan',
        label_pendek: 'Kontrak Borongan',
        prefix: 'KBR',
        deskripsi: null,
        model: 'umum',
        maks_peserta: 5,
        kata_kunci_task: null,
        warna: 'ungu',
        ikon: 'hard-hat',
        aktif: true,
        berkas: ['presensi', 'kontrak'],
      },
    });
    expect(validateJenisPengajuan({ ...jp, model: 'perjadin' }, 'konsumsi')).toMatchObject({ ok: true, data: { model: 'konsumsi', maks_peserta: null } });
    expect(validateJenisPengajuan({ ...jp, label: 'Nama Jenis Pengajuan Yang Sangat Panjang' })).toMatchObject({
      ok: false,
      errors: { label_pendek: expect.any(String) },
    });
    expect(validateJenisPengajuan({ ...jp, berkas: ['presensi', 'presensi'] })).toMatchObject({ ok: false, errors: { berkas: expect.stringContaining('dua kali') } });
    expect(validateJenisPengajuan({ ...jp, prefix: 'KB1', aktif: 'ya' })).toMatchObject({
      ok: false,
      errors: { prefix: expect.any(String), aktif: expect.any(String) },
    });
    expect(validateJenisPengajuan({ ...jp, maks_peserta: 51 })).toMatchObject({ ok: false, errors: { maks_peserta: 'Batas jumlah orang 1–50' } });

    expect(validateJenisBerkas({ label: ' Presensi  Bulanan ', keterangan: '' })).toEqual({
      ok: true,
      data: { label: 'Presensi Bulanan', keterangan: null, aktif: true },
    });
    expect(validateJenisBerkas({ label: 'dokumen lainnya' })).toMatchObject({ ok: false });
    expect(validateBank({ nama: ' Bank  Jago ', aktif: false })).toEqual({ ok: true, data: { nama: 'Bank Jago', aktif: false } });
    expect(validateBank({ nama: 'B' })).toMatchObject({ ok: false });

    expect(validateProject({ kode: ' D0030.07.01.6.001 ', nama: 'Sosialisasi', task_ids: ['3', 3, 4] })).toEqual({
      ok: true,
      data: { kode: 'D0030.07.01.6.001', nama: 'Sosialisasi', aktif: true, task_ids: [3, 4] },
    });
    expect(validateProject({ kode: 'D1:2', nama: 'X Y' })).toMatchObject({ ok: false, errors: { kode: expect.any(String) } });
    expect(validateProject({ kode: 'D1', nama: 'Proyek', task_ids: [0] })).toMatchObject({ ok: false, errors: { task_ids: expect.any(String) } });
    expect(validateTask({ kode: '723207', nama: 'Beban Konsumsi' })).toEqual({ ok: true, data: { kode: '723207', nama: 'Beban Konsumsi', aktif: true } });
    expect(validateTask({ kode: '7232_07', nama: 'Beban' })).toMatchObject({ ok: false, errors: { kode: expect.any(String) } });
    expect(validateTask({ kode: '1', nama: 'x'.repeat(120) })).toMatchObject({ ok: true });
    expect(validateTask({ kode: 'x'.repeat(30), nama: 'y'.repeat(120) })).toMatchObject({ ok: false, errors: { nama: expect.stringContaining('150') } });
  });

  it('pegawai, user, invoice', () => {
    expect(validatePegawai({ nama: 'Budi', nip: '19870101 201001 1 001' })).toMatchObject({
      ok: true,
      data: { nip: '198701012010011001', rekening_bank: null, rekening_nomor: null },
    });
    expect(validatePegawai({ nama: 'Budi', rekening_bank: ' BNI ', rekening_nomor: '0123.456-789' })).toMatchObject({
      ok: true,
      data: { rekening_bank: 'BNI', rekening_nomor: '0123456789' },
    });
    expect(validatePegawai({ nama: 'Budi', rekening_nomor: '0123456789' })).toEqual({ ok: false, errors: { rekening_bank: 'Isi nama bank' } });
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

  it('project costing, task name, verifikasi', () => {
    expect(validateDataPum({ project_hosting: '  DPBJ   OPS ', task_name: '' })).toEqual({
      ok: true,
      data: { project_hosting: 'DPBJ OPS', task_name: null },
    });
    expect(validateDataPum({ project_hosting: 'x'.repeat(151) })).toMatchObject({ ok: false });
    expect(validateVerifikasi({})).toEqual({ ok: true, data: { project_hosting: null, task_name: null, catatan: null } });
    expect(validateVerifikasi({ catatan: 'y'.repeat(1001) })).toMatchObject({ ok: false, errors: { catatan: expect.any(String) } });
  });

  it('alur 5 tahap: Diajukan ke PUM → Diverifikasi PUM → Diajukan ke MDK → Selesai (Paid)', () => {
    expect(STATUS_LIST).toEqual(['draft', 'diajukan_pum', 'dikembalikan', 'diverifikasi_pum', 'diajukan_mdk', 'selesai']);
    expect(STATUS_LIST.map((s) => STATUS_INFO[s].label)).toEqual([
      'Draft',
      'Diajukan ke PUM',
      'Dikembalikan',
      'Diverifikasi PUM',
      'Diajukan ke MDK',
      'Selesai (Paid)',
    ]);
    expect(STATUS_LEWAT_VERIFIKASI).toEqual(['diverifikasi_pum', 'diajukan_mdk', 'selesai']);
    expect(STATUS_BISA_DIBAYARKAN).toEqual(['diajukan_pum', 'diverifikasi_pum', 'diajukan_mdk', 'selesai']);
    expect(AKSI_RIWAYAT_LABEL.diverifikasi).toBe('Diverifikasi PUM');
    expect(AKSI_RIWAYAT_LABEL.diajukan_mdk).toBe('Diajukan ke MDK (invoice diinput)');
    expect(AKSI_RIWAYAT_LABEL.selesai).toBe('Selesai (paid)');
  });
});

describe('kelengkapan', () => {
  it('menghitung terpenuhi dari file & N/A', () => {
    const k = hitungKelengkapan(
      wajib('perjadin'),
      label,
      [{ jenis: 'surat_tugas' }, { jenis: 'surat_tugas' }, { jenis: 'lainnya' }],
      ['invoice_hotel', 'surat_tugas'],
    );
    expect(k.items.map((i) => i.label)).toEqual(['Surat Tugas', 'Laporan Kegiatan', 'Invoice Hotel', 'Invoice Tiket']);
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
      wajib('rumah_tangga'),
      label,
      [{ jenis: 'surat_tugas' }, { jenis: 'laporan_kegiatan' }],
      [],
      [
        { ...cekDasar, jenis: 'surat_tugas', status: 'sesuai' },
        { ...cekDasar, jenis: 'laporan_kegiatan', status: 'revisi', catatan: 'Tanda tangan kurang' },
      ],
    );
    expect(k).toMatchObject({ sesuai: 1, revisi: 1, semuaSesuai: false, lengkap: true });
    expect(k.items[1].cek).toMatchObject({ status: 'revisi', catatan: 'Tanda tangan kurang' });
    const semua = hitungKelengkapan(wajib('rumah_tangga'), label, [], ['surat_tugas', 'laporan_kegiatan'], [
      { ...cekDasar, jenis: 'surat_tugas', status: 'sesuai' },
      { ...cekDasar, jenis: 'laporan_kegiatan', status: 'sesuai' },
    ]);
    expect(semua).toMatchObject({ sesuai: 2, semuaSesuai: true, lengkap: true });
    expect(hitungKelengkapan(wajib('konsumsi'), label, [], [])).toMatchObject({ sesuai: 0, revisi: 0, semuaSesuai: false });
    // Jenis tanpa berkas wajib: lengkap & boleh diverifikasi tanpa centang.
    expect(hitungKelengkapan([], label, [{ jenis: 'lainnya' }], [])).toMatchObject({ total: 0, persen: 100, lengkap: true, semuaSesuai: true });
  });

  it('parse JSON N/A dengan aman', () => {
    expect(parseBerkasNa('["a",1,"b"]')).toEqual(['a', 'b']);
    expect(parseBerkasNa('rusak')).toEqual([]);
    expect(parseBerkasNa(null)).toEqual([]);
    expect(parseBerkasNa('{"a":1}')).toEqual([]);
    // Daftar berkas wajib per pengajuan: null = belum tercatat (ikut master)
    expect(parseBerkasDaftar('["notulen","undangan"]')).toEqual(['notulen', 'undangan']);
    expect(parseBerkasDaftar('[]')).toEqual([]);
    expect(parseBerkasDaftar(null)).toBeNull();
    expect(parseBerkasDaftar('rusak')).toBeNull();
  });
});
