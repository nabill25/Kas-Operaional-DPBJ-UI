// Pembuatan laporan PDF di browser (jsPDF + autotable). Modul ini di-lazy-load saat tombol PDF ditekan.
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput, type UserOptions } from 'jspdf-autotable';
import {
  JENIS_BERKAS_LABEL,
  JENIS_TRANSPORT_LABEL,
  JENIS_UANG_LABEL,
  KATEGORI_INFO,
  KATEGORI_LIST,
  MEKANISME_LIST,
  STATUS_INFO,
  STATUS_LIST,
  AKSI_RIWAYAT_LABEL,
} from '../../../shared/constants';
import {
  formatAngka,
  formatRentangTanggal,
  formatRupiah,
  formatTanggal,
  formatWaktu,
  lamaHari,
  tanggalLokalIso,
} from '../../../shared/format';
import type {
  PengajuanDetail,
  RekapPegawaiData,
  RekapPegawaiDetail,
  RekapPengajuanData,
} from '../../../shared/types';

type RGB = [number, number, number];
const NAVY: RGB = [10, 26, 63];
const NAVY_MUDA: RGB = [52, 81, 154];
const KUNING: RGB = [255, 209, 0];
const KUNING_PUCAT: RGB = [255, 243, 184];
const ABU: RGB = [107, 117, 144];
const GARIS: RGB = [221, 227, 239];
const ZEBRA: RGB = [246, 248, 253];

/** Font standar jsPDF hanya mendukung Latin-1: ganti karakter tipografi umum, sisanya '?'. */
export function bersihkan(teks: string): string {
  return teks
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/·/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/gu, '?');
}

const b = (v: string | number | null | undefined) => bersihkan(v === null || v === undefined || v === '' ? '-' : String(v));

function akhirTabel(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function namaFile(dasar: string): string {
  const stempel = tanggalLokalIso().replace(/-/g, '');
  return `${dasar.replace(/[^A-Za-z0-9_-]+/g, '_')}_${stempel}.pdf`;
}

/** Kop di setiap halaman + footer nomor halaman. Dipanggil setelah semua konten selesai. */
function kopDanKaki(doc: jsPDF, judul: string, sub: string, dicetakOleh: string) {
  const n = doc.getNumberOfPages();
  const waktu = formatWaktu(new Date().toISOString());
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, w, 24, 'F');
    doc.setFillColor(...KUNING);
    doc.rect(0, 24, w, 1.4, 'F');
    // Lambang dompet sederhana
    doc.setFillColor(...KUNING);
    doc.roundedRect(12, 6.5, 13, 11, 2.2, 2.2, 'F');
    doc.setFillColor(...NAVY);
    doc.roundedRect(19, 10, 6, 4.2, 2.1, 2.1, 'F');
    doc.setFillColor(...KUNING);
    doc.circle(21.6, 12.1, 0.9, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text('KAS OPERASIONAL DPBJ', 29, 11.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 212, 236);
    doc.text('Universitas Indonesia', 29, 16.4);

    doc.setTextColor(...KUNING);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(bersihkan(judul), w - 12, 11.6, { align: 'right' });
    doc.setTextColor(200, 212, 236);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(bersihkan(sub), w - 12, 16.4, { align: 'right' });

    doc.setDrawColor(...GARIS);
    doc.setLineWidth(0.3);
    doc.line(12, h - 11, w - 12, h - 11);
    doc.setFontSize(7.3);
    doc.setTextColor(...ABU);
    doc.text(bersihkan(`Dicetak oleh ${dicetakOleh} - ${waktu}`), 12, h - 6.5);
    doc.text(`Halaman ${i} dari ${n}`, w - 12, h - 6.5, { align: 'right' });
  }
}

function judulBagian(doc: jsPDF, teks: string, y: number): number {
  doc.setFillColor(...KUNING);
  doc.rect(12, y - 3.6, 1.4, 4.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(bersihkan(teks), 15.5, y);
  return y + 3;
}

/** Pastikan masih ada ruang; jika tidak, pindah halaman. */
function cukupRuang(doc: jsPDF, y: number, butuh: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + butuh > h - 16) {
    doc.addPage();
    return 34;
  }
  return y;
}

const GAYA_TABEL: Partial<UserOptions> = {
  theme: 'grid',
  margin: { top: 32, left: 12, right: 12, bottom: 16 },
  styles: {
    font: 'helvetica',
    fontSize: 8,
    cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 },
    lineColor: GARIS,
    lineWidth: 0.2,
    textColor: [30, 41, 72],
    valign: 'middle',
  },
  headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
  footStyles: { fillColor: KUNING_PUCAT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: ZEBRA },
};

function tabel(doc: jsPDF, opsi: UserOptions) {
  autoTable(doc, { ...GAYA_TABEL, ...opsi });
}

/** Kotak-kotak ringkasan angka di bawah judul. */
function kotakRingkasan(doc: jsPDF, y: number, isi: { label: string; nilai: string; sub?: string }[]): number {
  const w = doc.internal.pageSize.getWidth() - 24;
  const jarak = 3;
  const lebar = (w - jarak * (isi.length - 1)) / isi.length;
  isi.forEach((k, i) => {
    const x = 12 + i * (lebar + jarak);
    doc.setFillColor(i === 0 ? NAVY[0] : 246, i === 0 ? NAVY[1] : 248, i === 0 ? NAVY[2] : 253);
    doc.setDrawColor(...GARIS);
    doc.roundedRect(x, y, lebar, 17, 2, 2, i === 0 ? 'F' : 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    if (i === 0) doc.setTextColor(200, 212, 236);
    else doc.setTextColor(...ABU);
    doc.text(bersihkan(k.label.toUpperCase()), x + 3.5, y + 5.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    if (i === 0) doc.setTextColor(...KUNING);
    else doc.setTextColor(...NAVY);
    doc.text(bersihkan(k.nilai), x + 3.5, y + 11.2);
    if (k.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      if (i === 0) doc.setTextColor(200, 212, 236);
      else doc.setTextColor(...ABU);
      doc.text(bersihkan(k.sub), x + 3.5, y + 14.9);
    }
  });
  return y + 22;
}

function judulDokumen(doc: jsPDF, judul: string, baris: string[]): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(bersihkan(judul), 12, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...ABU);
  let y = 41.5;
  for (const t of baris) {
    doc.text(bersihkan(t), 12, y);
    y += 4.4;
  }
  return y + 2;
}

export interface KeteranganFilter {
  periode: string;
  rincian: string[];
}

// ───────────────────────────── Rekap pengajuan ─────────────────────────────

export function pdfRekapPengajuan(data: RekapPengajuanData, filter: KeteranganFilter, dicetakOleh: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const r = data.ringkasan;
  let y = judulDokumen(doc, 'Laporan Rekap Pengajuan Kas Operasional', [
    `Periode: ${filter.periode}`,
    filter.rincian.length ? `Filter: ${filter.rincian.join(' | ')}` : 'Filter: semua kategori, semua mekanisme, status selain draft',
  ]);

  y = kotakRingkasan(doc, y, [
    { label: 'Total nilai', nilai: formatRupiah(r.nilai), sub: `${formatAngka(r.jumlah)} pengajuan` },
    ...KATEGORI_LIST.map((k) => ({
      label: KATEGORI_INFO[k].labelPendek,
      nilai: formatRupiah(r.perKategori[k].nilai),
      sub: `${r.perKategori[k].jumlah} pengajuan`,
    })),
    ...MEKANISME_LIST.map((m) => ({
      label: `Mekanisme ${m}`,
      nilai: formatRupiah(r.perMekanisme[m].nilai),
      sub: `${r.perMekanisme[m].jumlah} pengajuan`,
    })),
  ]);

  tabel(doc, {
    startY: y,
    head: [['Status', ...STATUS_LIST.map((s) => STATUS_INFO[s].label)]],
    body: [
      ['Jumlah', ...STATUS_LIST.map((s) => formatAngka(r.perStatus[s].jumlah))],
      ['Nilai', ...STATUS_LIST.map((s) => formatRupiah(r.perStatus[s].nilai))],
    ],
    tableWidth: 215,
    columnStyles: { 0: { fontStyle: 'bold' } },
  });
  y = akhirTabel(doc) + 7;
  y = judulBagian(doc, 'Rincian pengajuan', y);

  const body: RowInput[] = data.rows.map((p, i) => [
    i + 1,
    p.kode,
    formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai),
    KATEGORI_INFO[p.kategori].labelPendek,
    b(p.nama_kegiatan),
    b(p.penerima),
    p.mekanisme,
    STATUS_INFO[p.status].label,
    b(p.no_invoice_mdk),
    `${p.berkas_terpenuhi}/${p.berkas_wajib}`,
    formatAngka(p.total),
  ]);
  tabel(doc, {
    startY: y + 1,
    head: [['No', 'Kode', 'Tanggal', 'Kategori', 'Nama kegiatan', 'Penerima / uang siapa', 'Mek.', 'Status', 'No. Invoice MDK', 'Berkas', 'Nilai (Rp)']],
    body: body.map((row) => (row as (string | number)[]).map((c) => (typeof c === 'string' ? bersihkan(c) : c))),
    foot: [[{ content: `TOTAL (${formatAngka(data.rows.length)} pengajuan)`, colSpan: 10 }, formatAngka(r.nilai)]],
    showFoot: 'lastPage',
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 25, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 21 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 42 },
      6: { halign: 'center', cellWidth: 11 },
      7: { cellWidth: 21 },
      8: { cellWidth: 32 },
      9: { halign: 'center', cellWidth: 13 },
      10: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
    },
    footStyles: { halign: 'right' },
  });
  if (data.rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...ABU);
    doc.text('Tidak ada data untuk filter ini.', 12, akhirTabel(doc) + 8);
  }

  kopDanKaki(doc, 'REKAP PENGAJUAN', filter.periode, dicetakOleh);
  doc.save(namaFile(`Rekap_Pengajuan_${filter.periode}`));
}

// ───────────────────────────── Rekap per pegawai ─────────────────────────────

export function pdfRekapPegawai(data: RekapPegawaiData, filter: KeteranganFilter, dicetakOleh: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = judulDokumen(doc, 'Rekap Kas Operasional per Pegawai', [
    `Periode: ${filter.periode}`,
    filter.rincian.length ? `Filter: ${filter.rincian.join(' | ')}` : 'Filter: semua kategori, semua mekanisme, status selain draft',
    'Konsumsi dihitung dari "uang siapa"; transport dari nilai per orang.',
  ]);
  const totalKonsumsi = data.rows.reduce((s, r) => s + r.konsumsi, 0);
  const totalRt = data.rows.reduce((s, r) => s + r.rumah_tangga, 0);
  const totalPd = data.rows.reduce((s, r) => s + r.perjadin, 0);
  y = kotakRingkasan(doc, y, [
    { label: 'Total', nilai: formatRupiah(data.total), sub: `${data.rows.length} pegawai` },
    { label: 'Konsumsi', nilai: formatRupiah(totalKonsumsi) },
    { label: 'Rumah Tangga', nilai: formatRupiah(totalRt) },
    { label: 'Perjadin', nilai: formatRupiah(totalPd) },
  ]);
  tabel(doc, {
    startY: y,
    head: [['No', 'Nama pegawai', 'NIP/NUP', 'Jml', 'Konsumsi', 'Rumah Tangga', 'Perjadin', 'Total (Rp)']],
    body: data.rows.map((r, i) => [
      i + 1,
      bersihkan(r.nama) + (r.jabatan ? `\n${bersihkan(r.jabatan)}` : ''),
      b(r.nip),
      r.jumlah,
      formatAngka(r.konsumsi),
      formatAngka(r.rumah_tangga),
      formatAngka(r.perjadin),
      formatAngka(r.total),
    ]),
    foot: [
      [
        { content: 'TOTAL', colSpan: 4 },
        formatAngka(totalKonsumsi),
        formatAngka(totalRt),
        formatAngka(totalPd),
        formatAngka(data.total),
      ],
    ],
    showFoot: 'lastPage',
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 33 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 23 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
    },
    footStyles: { halign: 'right' },
  });
  kopDanKaki(doc, 'REKAP PER PEGAWAI', filter.periode, dicetakOleh);
  doc.save(namaFile(`Rekap_Pegawai_${filter.periode}`));
}

export function pdfRekapPegawaiDetail(data: RekapPegawaiDetail, filter: KeteranganFilter, dicetakOleh: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pg = data.pegawai;
  let y = judulDokumen(doc, `Rekap Pegawai: ${pg.nama}`, [
    [pg.nip ? `NIP/NUP ${pg.nip}` : null, pg.jabatan].filter(Boolean).join(' - ') || 'Pegawai',
    `Periode: ${filter.periode}`,
    filter.rincian.length ? `Filter: ${filter.rincian.join(' | ')}` : 'Filter: status selain draft',
  ]);
  y = kotakRingkasan(doc, y, [
    { label: 'Total diterima', nilai: formatRupiah(data.total), sub: `${new Set(data.items.map((i) => i.pengajuan_id)).size} pengajuan` },
    ...KATEGORI_LIST.map((k) => ({
      label: KATEGORI_INFO[k].labelPendek,
      nilai: formatRupiah(data.items.filter((i) => i.kategori === k).reduce((s, i) => s + i.nilai, 0)),
    })),
  ]);
  tabel(doc, {
    startY: y,
    head: [['No', 'Tanggal', 'Kode', 'Kategori', 'Kegiatan', 'Peran', 'Status', 'Nilai (Rp)']],
    body: data.items.map((it, i) => [
      i + 1,
      formatRentangTanggal(it.tanggal_kegiatan, it.tanggal_selesai),
      it.kode,
      KATEGORI_INFO[it.kategori].labelPendek,
      bersihkan(it.nama_kegiatan),
      it.peran === 'uang_siapa' ? 'Uang siapa' : 'Peserta',
      STATUS_INFO[it.status].label,
      formatAngka(it.nilai),
    ]),
    foot: [[{ content: 'TOTAL', colSpan: 7 }, formatAngka(data.total)]],
    showFoot: 'lastPage',
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 26 },
      2: { cellWidth: 25, fontStyle: 'bold' },
      3: { cellWidth: 21 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 18 },
      6: { cellWidth: 20 },
      7: { halign: 'right', cellWidth: 23, fontStyle: 'bold' },
    },
    footStyles: { halign: 'right' },
  });
  kopDanKaki(doc, 'REKAP PEGAWAI', filter.periode, dicetakOleh);
  doc.save(namaFile(`Rekap_${pg.nama}`));
}

// ───────────────────────────── Bukti / ringkasan satu pengajuan ─────────────────────────────

export async function pdfBuktiPengajuan(p: PengajuanDetail, dicetakOleh: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ABU);
  doc.text('BUKTI PENGAJUAN', 12, 35);
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  const judul = doc.splitTextToSize(bersihkan(p.nama_kegiatan), w - 24 - 52);
  doc.text(judul, 12, 42);
  let y = 42 + (judul.length - 1) * 6.2 + 6;

  // Lencana kode & status di kanan
  doc.setFillColor(...NAVY);
  doc.roundedRect(w - 12 - 50, 30, 50, 19, 2.5, 2.5, 'F');
  doc.setTextColor(...KUNING);
  doc.setFontSize(11.5);
  doc.text(p.kode, w - 12 - 25, 37.5, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(bersihkan(`Status: ${STATUS_INFO[p.status].label}`), w - 12 - 25, 43.5, { align: 'center' });

  y = Math.max(y, 55);
  y = kotakRingkasan(doc, y, [
    { label: 'Total pengajuan', nilai: formatRupiah(p.total), sub: `Mekanisme ${p.mekanisme}` },
    { label: 'Kategori', nilai: KATEGORI_INFO[p.kategori].labelPendek, sub: KATEGORI_INFO[p.kategori].jenis === 'transport' ? 'Transport' : 'Konsumsi' },
    { label: 'Kelengkapan berkas', nilai: `${p.kelengkapan.terpenuhi} / ${p.kelengkapan.total}`, sub: p.kelengkapan.lengkap ? 'Lengkap' : 'Belum lengkap' },
  ]);

  y = judulBagian(doc, 'Informasi kegiatan', y);
  const info: [string, string][] = [
    [p.kategori === 'perjadin' ? 'Lama kegiatan' : 'Tanggal kegiatan',
      p.kategori === 'perjadin'
        ? `${formatTanggal(p.tanggal_kegiatan)} s.d. ${formatTanggal(p.tanggal_selesai)} (${lamaHari(p.tanggal_kegiatan, p.tanggal_selesai)} hari)`
        : formatTanggal(p.tanggal_kegiatan)],
    ['Jumlah orang', `${formatAngka(p.jumlah_orang)} orang`],
    ['Mekanisme', p.mekanisme],
  ];
  if (p.kategori !== 'konsumsi') info.splice(1, 0, ['Lokasi tujuan', b(p.lokasi_tujuan)]);
  if (p.kategori === 'perjadin') {
    info.push(['Jenis uang', p.jenis_uang ? JENIS_UANG_LABEL[p.jenis_uang] : '-']);
    info.push(['Jenis transport', p.jenis_transport ? JENIS_TRANSPORT_LABEL[p.jenis_transport] : '-']);
  }
  if (p.kategori === 'konsumsi') {
    info.push(['Uang siapa', b(p.uang_siapa_nama)]);
    info.push(['Rata-rata per orang', formatRupiah(Math.round(p.total / Math.max(1, p.jumlah_orang)))]);
  }
  info.push(['Dibuat oleh', `${p.created_by_nama} - ${formatWaktu(p.created_at)}`]);
  if (p.catatan) info.push(['Catatan', p.catatan]);
  tabel(doc, {
    startY: y + 1,
    theme: 'plain',
    body: info.map(([k, v]) => [bersihkan(k), bersihkan(v)]),
    columnStyles: { 0: { cellWidth: 45, textColor: ABU }, 1: { fontStyle: 'bold' } },
    styles: { fontSize: 8.6, cellPadding: { top: 1.4, bottom: 1.4, left: 3.5, right: 2 } },
  });
  y = akhirTabel(doc) + 7;

  if (p.kategori !== 'konsumsi') {
    y = cukupRuang(doc, y, 30);
    y = judulBagian(doc, 'Penerima & nilai uang', y);
    tabel(doc, {
      startY: y + 1,
      head: [['No', 'Nama', 'NIP/NUP', 'Jabatan', 'Nilai (Rp)']],
      body: p.peserta.map((ps, i) => [i + 1, bersihkan(ps.nama), b(ps.nip), b(ps.jabatan), formatAngka(ps.nilai)]),
      foot: [[{ content: 'TOTAL', colSpan: 4 }, formatAngka(p.total)]],
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { fontStyle: 'bold' }, 4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' } },
      footStyles: { halign: 'right' },
    });
    y = akhirTabel(doc) + 7;
  }

  y = cukupRuang(doc, y, 30);
  y = judulBagian(doc, 'Kelengkapan berkas', y);
  const barisBerkas: RowInput[] = p.kelengkapan.items.map((it) => [
    it.label,
    'Wajib',
    it.jumlah > 0 ? `Ada (${it.jumlah} file)` : it.na ? 'Tidak diperlukan' : 'BELUM ADA',
    !it.cek ? '-' : it.cek.status === 'sesuai' ? 'Sesuai' : bersihkan(`Perlu revisi: ${it.cek.catatan ?? ''}`),
    bersihkan(p.berkas.filter((x) => x.jenis === it.jenis).map((x) => x.nama_asli).join(', ') || '-'),
  ]);
  for (const x of p.berkas.filter((x) => x.jenis === 'lainnya')) {
    barisBerkas.push([bersihkan(x.nama_berkas ?? JENIS_BERKAS_LABEL.lainnya), 'Tambahan', 'Ada', '-', bersihkan(x.nama_asli)]);
  }
  tabel(doc, {
    startY: y + 1,
    head: [['Dokumen', 'Sifat', 'Status', 'Cek PUM', 'File']],
    body: barisBerkas,
    columnStyles: { 0: { cellWidth: 36, fontStyle: 'bold' }, 1: { cellWidth: 17 }, 2: { cellWidth: 27 }, 3: { cellWidth: 38 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const isi = String(d.cell.raw);
      if (d.column.index === 2 && isi === 'BELUM ADA') {
        d.cell.styles.textColor = [194, 65, 12];
        d.cell.styles.fontStyle = 'bold';
      }
      if (d.column.index === 3 && isi === 'Sesuai') {
        d.cell.styles.textColor = [4, 120, 87];
        d.cell.styles.fontStyle = 'bold';
      }
      if (d.column.index === 3 && isi.startsWith('Perlu revisi')) {
        d.cell.styles.textColor = [180, 83, 9];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = akhirTabel(doc) + 7;

  y = cukupRuang(doc, y, 26);
  y = judulBagian(doc, 'Proses PUM & MDK', y);
  const lewatPum = p.status === 'diajukan_mdk' || p.status === 'selesai';
  const proses: [string, string][] = [
    ['Status', STATUS_INFO[p.status].label],
    ['Diajukan ke PUM', p.diajukan_at ? formatWaktu(p.diajukan_at) : 'Belum diajukan'],
    ['Pemeriksaan berkas PUM', `${p.kelengkapan.sesuai} / ${p.kelengkapan.total} sesuai${p.kelengkapan.revisi ? ` - ${p.kelengkapan.revisi} perlu revisi` : ''}`],
  ];
  if (p.status === 'dikembalikan') {
    proses.push(['Dikembalikan oleh', `${b(p.diproses_by_nama)} - ${formatWaktu(p.diproses_at)}`]);
    proses.push(['Alasan pengembalian', b(p.catatan_pum)]);
  }
  if (lewatPum) {
    proses.push(['Diteruskan ke MDK', `${b(p.diteruskan_by_nama)} - ${formatWaktu(p.diteruskan_at)}`]);
  }
  if (lewatPum || p.project_hosting || p.task_name) {
    proses.push(['Project hosting', b(p.project_hosting)]);
    proses.push(['Task name', b(p.task_name)]);
  }
  if (p.status === 'selesai') {
    proses.push(['No. Invoice MDK', b(p.no_invoice_mdk)]);
    proses.push(['Tanggal invoice', formatTanggal(p.tanggal_invoice_mdk)]);
    proses.push(['Invoice diinput oleh', `${b(p.diproses_by_nama)} - ${formatWaktu(p.diproses_at)}`]);
  }
  if (lewatPum && p.catatan_pum) proses.push(['Catatan PUM', p.catatan_pum]);
  tabel(doc, {
    startY: y + 1,
    theme: 'plain',
    body: proses.map(([k, v]) => [bersihkan(k), bersihkan(v)]),
    columnStyles: { 0: { cellWidth: 45, textColor: ABU }, 1: { fontStyle: 'bold' } },
    styles: { fontSize: 8.6, cellPadding: { top: 1.4, bottom: 1.4, left: 3.5, right: 2 } },
  });
  y = akhirTabel(doc) + 7;

  const riwayat = [...p.riwayat].reverse().slice(-14);
  if (riwayat.length > 0) {
    y = cukupRuang(doc, y, 30);
    y = judulBagian(doc, 'Riwayat aktivitas', y);
    tabel(doc, {
      startY: y + 1,
      head: [['Waktu', 'Aktivitas', 'Oleh', 'Keterangan']],
      body: riwayat.map((r) => [
        formatWaktu(r.created_at),
        bersihkan(AKSI_RIWAYAT_LABEL[r.aksi] ?? r.aksi),
        b(r.user_nama),
        b(r.keterangan),
      ]),
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 42, fontStyle: 'bold' }, 2: { cellWidth: 28 } },
      styles: { fontSize: 7.4 },
    });
    y = akhirTabel(doc) + 8;
  }

  // Blok tanda tangan
  y = cukupRuang(doc, y, 42);
  const kolom = (w - 24) / 2;
  const ttd = [
    { judul: 'Diajukan oleh,', nama: p.created_by_nama, peran: 'Operator / Pengaju DPBJ' },
    {
      judul: 'Diverifikasi & diteruskan ke MDK,',
      nama: p.status === 'diajukan_mdk' || p.status === 'selesai' ? (p.diteruskan_by_nama ?? '') : '',
      peran: 'PUM',
    },
  ];
  ttd.forEach((t, i) => {
    const x = 12 + i * kolom + kolom / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...NAVY);
    doc.text(t.judul, x, y + 2, { align: 'center' });
    doc.setDrawColor(...NAVY_MUDA);
    doc.setLineWidth(0.3);
    doc.line(x - 30, y + 26, x + 30, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(bersihkan(t.nama || '(..............................)'), x, y + 31, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...ABU);
    doc.text(t.peran, x, y + 35.5, { align: 'center' });
  });

  kopDanKaki(doc, 'BUKTI PENGAJUAN', p.kode, dicetakOleh);
  doc.save(namaFile(`Bukti_${p.kode}`));
}
