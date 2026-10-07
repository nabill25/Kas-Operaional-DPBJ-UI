// Data demo realistis untuk test rekap/dashboard (dulu server/seed.ts). Hanya dipakai test.
import crypto from 'node:crypto';
import {
  BERKAS_WAJIB,
  JENIS_BERKAS_LABEL,
  KATEGORI_INFO,
  type JenisBerkas,
  type JenisNotifikasi,
  type JenisTransport,
  type JenisUang,
  type Kategori,
  type Mekanisme,
  type Role,
  type Status,
} from '../../shared/constants';
import { formatRupiah, formatTanggal, tanggalLokalIso } from '../../shared/format';
import type { Db } from '../../server/db-pg';
import { catatRiwayat, kodeBerikutnya, segarkanKelengkapan } from '../../server/services/pengajuan';
import { buatPdfContoh } from './pdf-contoh';

export const AKUN_DEMO: readonly { username: string; password: string; nama: string; role: Role }[] = [
  { username: 'operator@dpbj.test', password: 'operator123', nama: 'Operator DPBJ', role: 'operator' },
  { username: 'pum@dpbj.test', password: 'pum123', nama: 'Petugas PUM', role: 'pum' },
  { username: 'pimpinan@dpbj.test', password: 'pimpinan123', nama: 'Pimpinan DPBJ', role: 'pimpinan' },
  { username: 'admin@dpbj.test', password: 'admin123', nama: 'Admin Sistem', role: 'admin' },
];

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEGAWAI_DEMO: readonly [string, string | null, string, boolean][] = [
  ['Ahmad Fauzan', '198503122010011002', 'Kepala Seksi Pengadaan', true],
  ['Rizky Pratama', '199107082019031005', 'Pejabat Pengadaan', true],
  ['Nurul Hidayah', '198909152015042001', 'Staf Administrasi Pengadaan', true],
  ['Bambang Sutrisno', null, 'Pengemudi', true],
  ['Fitri Handayani', '199202202020122003', 'Staf Keuangan', true],
  ['Agus Setiawan', null, 'Staf Rumah Tangga', true],
  ['Maya Anggraini', '198712052012102001', 'Analis Pengadaan', true],
  ['Dimas Prasetyo', '199405182022031004', 'Staf Pengadaan', true],
  ['Siti Rahmawati', '199011232017012002', 'Sekretaris Direktorat', true],
  ['Yudi Kurniawan', null, 'Pengemudi', true],
  ['Laras Wulandari', '199308302021062001', 'Staf Pengadaan', false],
];

const KEGIATAN_KONSUMSI = [
  'Rapat Koordinasi Rencana Umum Pengadaan',
  'Rapat Evaluasi Penawaran Tender',
  'Rapat Pembahasan HPS Pekerjaan Konstruksi',
  'Rapat Klarifikasi dan Negosiasi Penyedia',
  'Rapat Kaji Ulang Dokumen Pemilihan',
  'Rapat Persiapan Pengadaan Alat Laboratorium',
  'Rapat Monitoring Pelaksanaan Kontrak',
  'Rapat Evaluasi Kinerja Penyedia',
  'Rapat Penyusunan Laporan Triwulan',
  'Rapat Koordinasi dengan Unit Kerja Fakultas',
  'Rapat Sosialisasi E-Purchasing',
  'Rapat Pembahasan Rancangan Kontrak',
];

const KEGIATAN_RT: readonly [string, string][] = [
  ['Pengantaran Dokumen Kontrak ke Rektorat', 'Gedung Rektorat UI, Depok'],
  ['Koordinasi Pengadaan di Kampus Salemba', 'Kampus UI Salemba, Jakarta Pusat'],
  ['Pengambilan Jaminan Pelaksanaan di Bank', 'Kantor Cabang Bank Mitra, Depok'],
  ['Pemeriksaan Barang di Gudang Logistik', 'Gudang Logistik UI, Depok'],
  ['Survei Lokasi Pekerjaan Renovasi', 'Fakultas Teknik UI, Depok'],
  ['Pengantaran Berkas ke Direktorat Keuangan', 'Direktorat Keuangan UI, Depok'],
];

const KEGIATAN_PERJADIN: readonly [string, string, JenisTransport][] = [
  ['Bimbingan Teknis Pengadaan Barang/Jasa', 'Bandung', 'luar_kota'],
  ['Monitoring Pekerjaan Konstruksi Kampus', 'Jakarta Pusat', 'dalam_kota'],
  ['Survei Harga Pasar Peralatan Laboratorium', 'Surabaya', 'luar_kota'],
  ['Rapat Koordinasi Pengadaan Nasional', 'Yogyakarta', 'luar_kota'],
  ['Workshop Katalog Elektronik', 'Jakarta Selatan', 'dalam_kota'],
  ['Pemeriksaan Hasil Pekerjaan Penyedia', 'Bogor', 'luar_kota'],
  ['Studi Banding Tata Kelola Pengadaan', 'Semarang', 'luar_kota'],
];

const TASK_NAME: Record<Kategori, string> = {
  konsumsi: 'Konsumsi Rapat',
  rumah_tangga: 'Transport Rumah Tangga',
  perjadin: 'Perjalanan Dinas',
};

interface RencanaBerkas {
  jenis: JenisBerkas;
  nama_berkas: string | null;
}

/** Isi database dengan akun, pegawai, dan ±56 pengajuan di semua status. `simpanFile` menyimpan isi berkas. */
export async function seedDemo(
  db: Db,
  simpanFile: (key: string, isi: Buffer) => void,
  sekarang: Date = new Date(),
): Promise<void> {
  const rnd = mulberry32(20261006);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const antara = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const bulatkan = (n: number, ke: number) => Math.max(ke, Math.round(n / ke) * ke);
  const JAM = 3_600_000;
  const MENIT = 60_000;
  const now = sekarang.getTime();
  const keJamKerja = (t: number): number => {
    const d = new Date(t);
    const jam = d.getHours() + d.getMinutes() / 60;
    if (jam < 8) d.setHours(8, antara(5, 55), 0, 0);
    else if (jam > 16.5) {
      d.setDate(d.getDate() + 1);
      d.setHours(8, antara(5, 55), 0, 0);
    }
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.getTime();
  };

  await db.tx(async (txDb) => {
    const awal = new Date(now - 340 * 86_400_000).toISOString();
    const userId = {} as Record<Role, number>;
    for (const a of AKUN_DEMO) {
      const akun = await txDb.get<{ id: string }>(
        'INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES (?, ?, now()) RETURNING id',
        a.username,
        a.password,
      );
      const res = await txDb.run(
        'INSERT INTO users (auth_id, username, nama, role, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, true, ?, ?) RETURNING id',
        akun!.id,
        a.username,
        a.nama,
        a.role,
        awal,
        awal,
      );
      userId[a.role] = res.lastInsertRowid;
    }

    const pg: Record<string, number> = {};
    for (const [nama, nip, jabatan, aktif] of PEGAWAI_DEMO) {
      const res = await txDb.run(
        'INSERT INTO pegawai (nama, nip, jabatan, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        nama,
        nip,
        jabatan,
        aktif,
        awal,
        awal,
      );
      pg[nama] = res.lastInsertRowid;
    }
    const pemegangUang = ['Nurul Hidayah', 'Fitri Handayani', 'Siti Rahmawati', 'Maya Anggraini', 'Ahmad Fauzan'];
    const pesertaRT = ['Bambang Sutrisno', 'Yudi Kurniawan', 'Agus Setiawan', 'Dimas Prasetyo'];
    const pesertaPD = ['Ahmad Fauzan', 'Rizky Pratama', 'Maya Anggraini', 'Dimas Prasetyo', 'Nurul Hidayah'];

    const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    const tanggalList: string[] = [];
    for (let i = 0; i < 52; i++) {
      const d = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - antara(3, 330));
      if (d.getDay() === 0) d.setDate(d.getDate() - 2);
      if (d.getDay() === 6) d.setDate(d.getDate() - 1);
      tanggalList.push(tanggalLokalIso(d));
    }
    for (const mundur of [1, 2, 4, 6]) {
      const d = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - mundur);
      tanggalList.push(tanggalLokalIso(d));
    }
    tanggalList.sort();

    const POLA_TERBARU: Status[] = [
      'draft', 'diajukan_pum', 'draft', 'diajukan_pum', 'dikembalikan', 'diajukan_mdk',
      'selesai', 'diajukan_pum', 'dikembalikan', 'diajukan_mdk', 'selesai', 'diajukan_mdk',
    ];
    const POLA_KATEGORI_TERBARU: Kategori[] = [
      'konsumsi', 'perjadin', 'rumah_tangga', 'konsumsi', 'perjadin', 'konsumsi',
      'rumah_tangga', 'perjadin', 'konsumsi', 'rumah_tangga', 'konsumsi', 'perjadin',
    ];
    const n = tanggalList.length;
    const pernahDikembalikan = new Set<number>([Math.floor(n * 0.35), Math.floor(n * 0.62)]);

    interface Waktu {
      dibuat: number;
      diajukan?: number;
      kembali?: number;
      diajukanUlang?: number;
      diteruskan?: number;
      diproses?: number;
    }
    interface Rencana {
      tanggal: string;
      kategori: Kategori;
      status: Status;
      waktu: Waktu;
      invoice?: { no: string; tanggal: string };
    }

    const rencana: Rencana[] = tanggalList.map((tanggal, i) => {
      const dariAkhir = n - 1 - i;
      const r = rnd();
      const kategori: Kategori =
        dariAkhir < POLA_KATEGORI_TERBARU.length
          ? POLA_KATEGORI_TERBARU[dariAkhir]
          : r < 0.45
            ? 'konsumsi'
            : r < 0.75
              ? 'rumah_tangga'
              : 'perjadin';
      const status: Status = dariAkhir < POLA_TERBARU.length ? POLA_TERBARU[dariAkhir] : 'selesai';
      const siklusKembali = pernahDikembalikan.has(i) && status === 'selesai';

      const [y, m, d] = tanggal.split('-').map(Number);
      const mulai = new Date(y, m - 1, d, 9, 0, 0).getTime();
      const nama: (keyof Waktu)[] = ['dibuat'];
      if (status !== 'draft') nama.push('diajukan');
      if (siklusKembali) nama.push('kembali', 'diajukanUlang');
      if (status === 'dikembalikan') nama.push('kembali');
      if (status === 'diajukan_mdk' || status === 'selesai') nama.push('diteruskan');
      if (status === 'selesai') nama.push('diproses');
      const jeda: Record<keyof Waktu, [number, number]> = {
        dibuat: [0, 30],
        diajukan: [2, 30],
        kembali: [18, 60],
        diajukanUlang: [4, 30],
        diteruskan: [18, 72],
        diproses: [24, 140],
      };
      const titik: number[] = [];
      for (const k of nama) {
        const dasar = titik.length ? titik[titik.length - 1] : mulai;
        let t = dasar + antara(jeda[k][0], jeda[k][1]) * JAM;
        if (titik.length && t < dasar + JAM) t = dasar + antara(1, 3) * JAM;
        titik.push(keJamKerja(t));
      }
      for (let k = titik.length - 1; k >= 0; k--) {
        const batas = k === titik.length - 1 ? now - 20 * MENIT : titik[k + 1] - 45 * MENIT;
        if (titik[k] > batas) titik[k] = batas;
      }
      const waktu = Object.fromEntries(nama.map((k, idx) => [k, titik[idx]])) as unknown as Waktu;
      return { tanggal, kategori, status, waktu };
    });

    const nomorPerTahun = new Map<number, number>();
    for (const x of rencana.filter((r) => r.status === 'selesai').sort((a, b) => a.waktu.diproses! - b.waktu.diproses!)) {
      const tgl = new Date(x.waktu.diproses!);
      const th = tgl.getFullYear();
      const no = (nomorPerTahun.get(th) ?? 0) + 1;
      nomorPerTahun.set(th, no);
      x.invoice = { no: `MDK/INV/${th}/${String(no * 7 + 100).padStart(4, '0')}`, tanggal: tanggalLokalIso(tgl) };
    }

    const iso = (t: number) => new Date(t).toISOString();
    const notif = async (
      penerima: number,
      waktu: number,
      d: { pengajuan_id: number; kode: string; jenis: JenisNotifikasi; judul: string; pesan: string },
    ) => {
      await txDb.run(
        `INSERT INTO notifikasi (user_id, pengajuan_id, kode, jenis, judul, pesan, dibaca_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        penerima,
        d.pengajuan_id,
        d.kode,
        d.jenis,
        d.judul,
        d.pesan,
        now - waktu > 3 * 86_400_000 ? iso(Math.min(now, waktu + 2 * JAM)) : null,
        iso(waktu),
      );
    };
    const cek = async (pengajuanId: number, jenis: string, status: 'sesuai' | 'revisi', catatan: string | null, waktu: number) => {
      await txDb.run(
        `INSERT INTO cek_berkas (pengajuan_id, jenis, status, catatan, diperiksa_by, diperiksa_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (pengajuan_id, jenis) DO UPDATE SET status = excluded.status, catatan = excluded.catatan,
           diperiksa_by = excluded.diperiksa_by, diperiksa_at = excluded.diperiksa_at`,
        pengajuanId,
        jenis,
        status,
        catatan,
        userId.pum,
        iso(waktu),
      );
    };

    let indeksPum = 0;
    for (const x of rencana) {
      const kode = await kodeBerikutnya(txDb, x.kategori, new Date(x.waktu.dibuat).getFullYear());
      const mekanisme: Mekanisme = rnd() < 0.65 ? 'KO' : 'LS';

      let nama: string;
      let lokasi: string | null = null;
      let tanggalSelesai: string | null = null;
      let jenisUang: JenisUang | null = null;
      let jenisTransport: JenisTransport | null = null;
      let uangSiapa: number | null = null;
      let jumlahOrang: number;
      let total: number;
      let catatan: string | null = null;
      const peserta: { pegawai_id: number; nilai: number }[] = [];

      if (x.kategori === 'konsumsi') {
        nama = pilih(KEGIATAN_KONSUMSI);
        jumlahOrang = antara(6, 30);
        total = bulatkan(jumlahOrang * antara(35, 85) * 1000, 5000);
        uangSiapa = pg[pilih(pemegangUang)];
        if (rnd() < 0.4) catatan = 'Snack rapat dan makan siang peserta.';
      } else if (x.kategori === 'rumah_tangga') {
        const [nm, lok] = pilih(KEGIATAN_RT);
        nama = nm;
        lokasi = lok;
        const jumlah = rnd() < 0.55 ? 2 : 1;
        const kandidat = [...pesertaRT].sort(() => rnd() - 0.5).slice(0, jumlah);
        for (const k of kandidat) peserta.push({ pegawai_id: pg[k], nilai: bulatkan(antara(50, 250) * 1000, 10000) });
        jumlahOrang = peserta.length;
        total = peserta.reduce((s, p) => s + p.nilai, 0);
      } else {
        const [nm, lok, jt] = pilih(KEGIATAN_PERJADIN);
        nama = nm;
        lokasi = lok;
        jenisTransport = jt;
        jenisUang = rnd() < 0.6 ? 'uang_harian' : 'uang_transport';
        const lama = jt === 'luar_kota' ? antara(2, 4) : antara(1, 2);
        const [y, m, d] = x.tanggal.split('-').map(Number);
        tanggalSelesai = tanggalLokalIso(new Date(y, m - 1, d + lama - 1));
        const jumlah = rnd() < 0.5 ? 2 : 1;
        const kandidat = [...pesertaPD].sort(() => rnd() - 0.5).slice(0, jumlah);
        for (const k of kandidat) {
          const nilai =
            jt === 'luar_kota'
              ? bulatkan(jenisUang === 'uang_harian' ? 480_000 * lama : antara(800, 1800) * 1000, 50_000)
              : bulatkan(antara(150, 450) * 1000, 25_000);
          peserta.push({ pegawai_id: pg[k], nilai });
        }
        jumlahOrang = peserta.length;
        total = peserta.reduce((s, p) => s + p.nilai, 0);
      }

      const wajib = BERKAS_WAJIB[x.kategori];
      const na: string[] = x.kategori === 'perjadin' && jenisTransport === 'dalam_kota' ? ['invoice_hotel', 'invoice_tiket'] : [];
      let diunggah: RencanaBerkas[] = wajib.filter((j) => !na.includes(j)).map((j) => ({ jenis: j, nama_berkas: null }));
      let menyusul: RencanaBerkas | null = null;
      let kurang: RencanaBerkas | null = null;
      if (x.status === 'draft') diunggah = diunggah.slice(0, 1);
      if (x.status === 'dikembalikan' && diunggah.length > 1) kurang = diunggah.pop() ?? null;
      if (x.waktu.kembali && x.waktu.diajukanUlang && diunggah.length > 1) menyusul = diunggah.pop() ?? null;
      if (x.kategori === 'konsumsi' && x.status === 'selesai' && rnd() < 0.4) {
        diunggah.push({ jenis: 'lainnya', nama_berkas: 'Foto Dokumentasi Kegiatan' });
      }
      const alasanKembali = (b: RencanaBerkas | null) =>
        b ? `${JENIS_BERKAS_LABEL[b.jenis]} belum dilampirkan, mohon dilengkapi.` : 'Data kegiatan perlu diperbaiki.';

      const proyek = x.status === 'diajukan_mdk' || x.status === 'selesai';
      const tahunTeruskan = x.waktu.diteruskan ? new Date(x.waktu.diteruskan).getFullYear() : null;
      const terakhir =
        x.waktu.diproses ?? x.waktu.diteruskan ?? x.waktu.kembali ?? x.waktu.diajukanUlang ?? x.waktu.diajukan ??
        x.waktu.dibuat + (diunggah.length + na.length) * 4 * MENIT;

      const { lastInsertRowid: id } = await txDb.run(
        `INSERT INTO pengajuan (kode, kategori, nama_kegiatan, tanggal_kegiatan, tanggal_selesai, jumlah_orang, lokasi_tujuan,
           mekanisme, jenis_uang, jenis_transport, uang_siapa_id, total, catatan, berkas_na, status,
           no_invoice_mdk, tanggal_invoice_mdk, catatan_pum, project_hosting, task_name,
           created_by, updated_by, diajukan_at, diteruskan_by, diteruskan_at, diproses_by, diproses_at, created_at, updated_at, berkas_terpenuhi, berkas_wajib)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?) RETURNING id`,
        kode,
        x.kategori,
        nama,
        x.tanggal,
        tanggalSelesai,
        jumlahOrang,
        lokasi,
        mekanisme,
        jenisUang,
        jenisTransport,
        uangSiapa,
        total,
        catatan,
        JSON.stringify(na),
        x.status,
        x.invoice?.no ?? null,
        x.invoice?.tanggal ?? null,
        x.status === 'dikembalikan' ? alasanKembali(kurang) : null,
        proyek ? `DPBJ-OPS-${tahunTeruskan}` : null,
        proyek ? TASK_NAME[x.kategori] : null,
        userId.operator,
        x.status === 'draft' || x.status === 'diajukan_pum' ? userId.operator : userId.pum,
        x.status === 'draft' ? null : iso(x.waktu.diajukanUlang ?? x.waktu.diajukan!),
        x.waktu.diteruskan ? userId.pum : null,
        x.waktu.diteruskan ? iso(x.waktu.diteruskan) : null,
        x.waktu.diproses || x.status === 'dikembalikan' ? userId.pum : null,
        x.waktu.diproses ? iso(x.waktu.diproses) : x.status === 'dikembalikan' ? iso(x.waktu.kembali!) : null,
        iso(x.waktu.dibuat),
        iso(Math.min(terakhir, now)),
        wajib.length
      );
      
      for (let i = 0; i < peserta.length; i++) {
        const p = peserta[i];
        await txDb.run(
          'INSERT INTO pengajuan_peserta (pengajuan_id, pegawai_id, nilai, urutan) VALUES (?, ?, ?, ?)',
          id,
          p.pegawai_id,
          p.nilai,
          i + 1,
        );
      }

      const ref = { id, kode };
      const ringkas = `${nama} · ${formatRupiah(total)}`;
      await catatRiwayat(txDb, ref, userId.operator, 'dibuat', `${KATEGORI_INFO[x.kategori].label} · ${formatRupiah(total)}`, iso(x.waktu.dibuat));

      const simpanBerkas = async (b: RencanaBerkas, waktu: number) => {
        const label = b.nama_berkas ?? JENIS_BERKAS_LABEL[b.jenis];
        const namaFile = `${id}/${crypto.randomUUID()}.pdf`;
        const isi = buatPdfContoh(label, [
          `Kode pengajuan : ${kode}`,
          `Kegiatan       : ${nama}`,
          `Tanggal        : ${formatTanggal(x.tanggal)}`,
          `Nilai          : ${formatRupiah(total)}`,
        ]);
        simpanFile(namaFile, isi);
        const namaAsli = `${label.replace(/[^A-Za-z0-9]+/g, '_')}_${kode}.pdf`;
        await txDb.run(
          `INSERT INTO berkas (pengajuan_id, jenis, nama_berkas, nama_asli, nama_file, mime, ukuran, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?)`,
          id,
          b.jenis,
          b.nama_berkas,
          namaAsli,
          namaFile,
          isi.length,
          userId.operator,
          iso(waktu),
        );
        await catatRiwayat(txDb, ref, userId.operator, 'berkas_diunggah', `${label}: ${namaAsli}`, iso(waktu));
      };

      for (let i = 0; i < diunggah.length; i++) {
        await simpanBerkas(diunggah[i], x.waktu.dibuat + (i + 1) * 4 * MENIT);
      }
      
      for (let i = 0; i < na.length; i++) {
        await catatRiwayat(
          txDb,
          ref,
          userId.operator,
          'berkas_na',
          JENIS_BERKAS_LABEL[na[i] as JenisBerkas],
          iso(x.waktu.dibuat + (diunggah.length + i + 1) * 4 * MENIT),
        );
      }

      const totalWajib = wajib.length;
      if (x.waktu.diajukan) {
        const terpenuhiAwal = diunggah.filter((b) => b.jenis !== 'lainnya').length + na.length;
        await catatRiwayat(
          txDb,
          ref,
          userId.operator,
          'diajukan',
          `Berkas ${terpenuhiAwal < totalWajib ? 'belum lengkap' : 'lengkap'} (${terpenuhiAwal}/${totalWajib})`,
          iso(x.waktu.diajukan),
        );
        await notif(userId.pum, x.waktu.diajukan, {
          pengajuan_id: id,
          kode,
          jenis: 'diajukan',
          judul: 'Pengajuan baru menunggu pemeriksaan',
          pesan: `${ringkas} · oleh Operator DPBJ`,
        });
      }

      if (x.waktu.kembali && x.waktu.diajukanUlang) {
        const tKembali = x.waktu.kembali;
        if (menyusul) {
          await catatRiwayat(txDb, ref, userId.pum, 'berkas_revisi', `${JENIS_BERKAS_LABEL[menyusul.jenis]}: belum dilampirkan`, iso(tKembali - 5 * MENIT));
        }
        await catatRiwayat(txDb, ref, userId.pum, 'dikembalikan', alasanKembali(menyusul), iso(tKembali));
        await notif(userId.operator, tKembali, {
          pengajuan_id: id,
          kode,
          jenis: 'dikembalikan',
          judul: 'Pengajuan dikembalikan PUM',
          pesan: alasanKembali(menyusul),
        });
        if (menyusul) await simpanBerkas(menyusul, tKembali + 30 * MENIT);
        await catatRiwayat(txDb, ref, userId.operator, 'diajukan', `Diajukan ulang · Berkas lengkap (${totalWajib}/${totalWajib})`, iso(x.waktu.diajukanUlang));
        await notif(userId.pum, x.waktu.diajukanUlang, {
          pengajuan_id: id,
          kode,
          jenis: 'diajukan',
          judul: 'Pengajuan diajukan ulang',
          pesan: `${ringkas} · oleh Operator DPBJ`,
        });
      }

      if (x.status === 'diajukan_pum') {
        if (indeksPum++ === 0) {
          for (let i = 0; i < Math.min(2, wajib.length); i++) {
            const j = wajib[i];
            const t = x.waktu.diajukan! + (i + 1) * 20 * MENIT;
            if (t < now) {
              await cek(id, j, 'sesuai', null, t);
              await catatRiwayat(txDb, ref, userId.pum, 'berkas_dicek', JENIS_BERKAS_LABEL[j], iso(t));
            }
          }
        }
      }
      if (x.status === 'dikembalikan') {
        const tKembali = x.waktu.kembali!;
        for (let i = 0; i < wajib.length; i++) {
          const j = wajib[i];
          const t = tKembali - (wajib.length - i) * 4 * MENIT;
          if (kurang && j === kurang.jenis) {
            await cek(id, j, 'revisi', 'Belum dilampirkan', t);
            await catatRiwayat(txDb, ref, userId.pum, 'berkas_revisi', `${JENIS_BERKAS_LABEL[j]}: Belum dilampirkan`, iso(t));
          } else {
            await cek(id, j, 'sesuai', null, t);
            await catatRiwayat(txDb, ref, userId.pum, 'berkas_dicek', JENIS_BERKAS_LABEL[j], iso(t));
          }
        }
        await catatRiwayat(txDb, ref, userId.pum, 'dikembalikan', alasanKembali(kurang), iso(tKembali));
        await notif(userId.operator, tKembali, {
          pengajuan_id: id,
          kode,
          jenis: 'dikembalikan',
          judul: 'Pengajuan dikembalikan PUM',
          pesan: alasanKembali(kurang),
        });
      }
      if (x.waktu.diteruskan) {
        const tTeruskan = x.waktu.diteruskan;
        for (let i = 0; i < wajib.length; i++) {
          const j = wajib[i];
          const t = tTeruskan - (wajib.length - i) * 4 * MENIT;
          await cek(id, j, 'sesuai', null, t);
          await catatRiwayat(txDb, ref, userId.pum, 'berkas_dicek', JENIS_BERKAS_LABEL[j], iso(t));
        }
        await catatRiwayat(
          txDb,
          ref,
          userId.pum,
          'diteruskan_mdk',
          `Berkas ${totalWajib}/${totalWajib} sesuai · Project: DPBJ-OPS-${tahunTeruskan} · Task: ${TASK_NAME[x.kategori]}`,
          iso(tTeruskan),
        );
        await notif(userId.operator, tTeruskan, {
          pengajuan_id: id,
          kode,
          jenis: 'diteruskan_mdk',
          judul: 'Berkas disetujui PUM & diteruskan ke MDK',
          pesan: `${nama} · menunggu invoice MDK`,
        });
      }
      if (x.status === 'selesai' && x.waktu.diproses && x.invoice) {
        await catatRiwayat(txDb, ref, userId.pum, 'selesai', `No. Invoice MDK: ${x.invoice.no}`, iso(x.waktu.diproses));
        await notif(userId.operator, x.waktu.diproses, {
          pengajuan_id: id,
          kode,
          jenis: 'selesai',
          judul: 'Pengajuan selesai (paid)',
          pesan: `No. Invoice MDK: ${x.invoice.no} · ${formatRupiah(total)}`,
        });
      }
      await segarkanKelengkapan(txDb, id);
    }
  });
}
