// Penulis XLSX minimal (Office Open XML) — menghasilkan file .xlsx asli tanpa dependensi berat.
// Angka disimpan sebagai angka (format #,##0) sehingga bisa langsung dijumlah/difilter di Excel.
import { strToU8, zipSync } from 'fflate';

export interface KolomXlsx {
  header: string;
  lebar: number;
  tipe: 'teks' | 'angka';
}

export interface SheetXlsx {
  nama: string;
  /** Baris judul di atas tabel (tebal). */
  judul: string[];
  kolom: KolomXlsx[];
  baris: (string | number | null)[][];
  total?: (string | number | null)[];
}

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Gaya sel (indeks cellXfs di styles.xml). */
const GAYA = { biasa: 0, header: 1, angka: 2, totalTeks: 3, totalAngka: 4, judul: 5 } as const;

function esc(teks: string): string {
  return teks
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function hurufKolom(indeks: number): string {
  let n = indeks + 1;
  let s = '';
  while (n > 0) {
    const sisa = (n - 1) % 26;
    s = String.fromCharCode(65 + sisa) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sel(ref: string, nilai: string | number | null, gaya: number, angka: boolean): string {
  if (nilai === null || nilai === undefined || nilai === '') return `<c r="${ref}" s="${gaya}"/>`;
  if (angka && typeof nilai === 'number' && Number.isFinite(nilai)) {
    return `<c r="${ref}" s="${gaya}"><v>${nilai}</v></c>`;
  }
  return `<c r="${ref}" s="${gaya}" t="inlineStr"><is><t xml:space="preserve">${esc(String(nilai))}</t></is></c>`;
}

function xmlSheet(s: SheetXlsx): string {
  const baris: string[] = [];
  let r = 1;
  for (const j of s.judul) {
    baris.push(`<row r="${r}">${sel(`A${r}`, j, GAYA.judul, false)}</row>`);
    r++;
  }
  if (s.judul.length) r++; // baris kosong pemisah
  const barisHeader = r;
  baris.push(
    `<row r="${r}">${s.kolom.map((k, i) => sel(`${hurufKolom(i)}${r}`, k.header, GAYA.header, false)).join('')}</row>`,
  );
  r++;
  for (const isi of s.baris) {
    baris.push(
      `<row r="${r}">${s.kolom
        .map((k, i) => sel(`${hurufKolom(i)}${r}`, isi[i] ?? null, k.tipe === 'angka' ? GAYA.angka : GAYA.biasa, k.tipe === 'angka'))
        .join('')}</row>`,
    );
    r++;
  }
  if (s.total) {
    baris.push(
      `<row r="${r}">${s.kolom
        .map((k, i) =>
          sel(
            `${hurufKolom(i)}${r}`,
            s.total?.[i] ?? null,
            k.tipe === 'angka' ? GAYA.totalAngka : GAYA.totalTeks,
            k.tipe === 'angka',
          ),
        )
        .join('')}</row>`,
    );
  }
  const kolom = s.kolom.map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${k.lebar}" customWidth="1"/>`).join('');
  const bekuan = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${barisHeader}" topLeftCell="A${barisHeader + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${NS}" xmlns:r="${NS_R}">${bekuan}<cols>${kolom}</cols><sheetData>${baris.join('')}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0A1A3F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3B8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Nama sheet Excel: maks. 31 karakter, tanpa : \ / ? * [ ] */
function namaSheet(nama: string): string {
  return nama.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

export function buatXlsx(sheet: SheetXlsx): Uint8Array {
  const file = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets><sheet name="${esc(namaSheet(sheet.nama))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(xmlSheet(sheet)),
  };
  return zipSync(file, { level: 6 });
}

export function unduhXlsx(sheet: SheetXlsx, namaFile: string): void {
  const data = buatXlsx(sheet);
  const blob = new Blob([data as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile.endsWith('.xlsx') ? namaFile : `${namaFile}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
