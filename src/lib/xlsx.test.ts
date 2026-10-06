import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buatXlsx, hurufKolom } from './xlsx';

describe('xlsx', () => {
  it('huruf kolom Excel', () => {
    expect(hurufKolom(0)).toBe('A');
    expect(hurufKolom(25)).toBe('Z');
    expect(hurufKolom(26)).toBe('AA');
    expect(hurufKolom(51)).toBe('AZ');
    expect(hurufKolom(701)).toBe('ZZ');
    expect(hurufKolom(702)).toBe('AAA');
  });

  it('membuat paket .xlsx lengkap dengan angka sebagai angka & teks ter-escape', () => {
    const data = buatXlsx({
      nama: 'Rekap: Pengajuan/2026',
      judul: ['Judul <Laporan> & "Uji"'],
      kolom: [
        { header: 'Nama', lebar: 20, tipe: 'teks' },
        { header: 'Nilai', lebar: 12, tipe: 'angka' },
      ],
      baris: [
        ['Rapat & Koordinasi', 1250000],
        ['Café Ünïcode – ✓', 0],
        [null, null],
      ],
      total: ['TOTAL', 1250000],
    });
    const isi = unzipSync(data);
    expect(Object.keys(isi).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
      ].sort(),
    );
    const sheet = strFromU8(isi['xl/worksheets/sheet1.xml']);
    const workbook = strFromU8(isi['xl/workbook.xml']);
    // Nama sheet tanpa karakter terlarang, maks. 31 karakter
    expect(workbook).toContain('name="Rekap  Pengajuan 2026"');
    // Judul ter-escape
    expect(sheet).toContain('Judul &lt;Laporan&gt; &amp; &quot;Uji&quot;');
    // Angka disimpan sebagai <v>, bukan string
    expect(sheet).toContain('<c r="B4" s="2"><v>1250000</v></c>');
    expect(sheet).toContain('<c r="B5" s="2"><v>0</v></c>');
    // Unicode dipertahankan (UTF-8)
    expect(sheet).toContain('Café Ünïcode – ✓');
    // Sel kosong
    expect(sheet).toContain('<c r="A6" s="0"/>');
    // Baris total bergaya tebal
    expect(sheet).toContain('<c r="B7" s="4"><v>1250000</v></c>');
    // Header dibekukan
    expect(sheet).toContain('ySplit="3"');
    // XML well-formed (parser DOM)
    for (const nama of Object.keys(isi)) {
      const xml = strFromU8(isi[nama]);
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      expect(doc.getElementsByTagName('parsererror').length, nama).toBe(0);
    }
  });
});
