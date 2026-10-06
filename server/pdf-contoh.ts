/**
 * Membuat PDF satu halaman yang valid (xref benar) untuk berkas data demo.
 * Teks dibatasi ke ASCII agar aman untuk font standar Helvetica.
 */
export function buatPdfContoh(judul: string, baris: string[]): Buffer {
  const aman = (s: string) =>
    s
      .replace(/[^\x20-\x7e]/g, '-')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  let isi = '0.04 0.10 0.25 rg 0 792 595 50 re f\n'; // pita navy di atas
  isi += '1 0.82 0 rg 0 788 595 4 re f\n'; // garis kuning
  isi += `BT /F2 11 Tf 1 1 1 rg 40 812 Td (${aman('KAS OPERASIONAL DPBJ - UNIVERSITAS INDONESIA')}) Tj ET\n`;
  isi += `BT /F2 20 Tf 0.04 0.10 0.25 rg 40 740 Td (${aman(judul)}) Tj ET\n`;
  let y = 710;
  for (const b of baris) {
    isi += `BT /F1 11 Tf 0.2 0.25 0.35 rg 40 ${y} Td (${aman(b)}) Tj ET\n`;
    y -= 18;
  }
  isi += `BT /F1 9 Tf 0.5 0.5 0.5 rg 40 40 Td (${aman('Dokumen contoh untuk data demo - bukan dokumen resmi.')}) Tj ET\n`;

  const objek = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(isi, 'latin1')} >>\nstream\n${isi}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offset: number[] = [];
  objek.forEach((o, i) => {
    offset.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  for (const o of offset) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
