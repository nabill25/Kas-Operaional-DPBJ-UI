import { test as base, expect, type Page } from '@playwright/test';

export const AKUN = { admin: 'admin123', operator: 'operator123', pum: 'pum123', pimpinan: 'pimpinan123' } as const;
export type Peran = keyof typeof AKUN;
/** Login memakai email (Supabase Auth); akun demo dibuat tests/support/seed-demo.ts. */
export const EMAIL: Record<Peran, string> = {
  admin: 'admin@dpbj.test',
  operator: 'operator@dpbj.test',
  pum: 'pum@dpbj.test',
  pimpinan: 'pimpinan@dpbj.test',
};

/**
 * Fixture otomatis: setiap test GAGAL bila ada error JavaScript di halaman atau console.error.
 * Test yang sengaja memicu error (mis. login salah) dapat mengosongkan `galat`.
 */
export const test = base.extend<{ galat: string[] }>({
  galat: [
    async ({ page }, pakai) => {
      const galat: string[] = [];
      page.on('pageerror', (e) => galat.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') galat.push(`console.error: ${m.text()}`);
      });
      await pakai(galat);
      expect(galat, `Error di browser:\n${galat.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Login lewat API (cookie dibagi dengan halaman) — cepat untuk test yang tidak menguji form login. */
export async function masukAPI(page: Page, peran: Peran): Promise<void> {
  const r = await page.request.post('/api/auth/login', { data: { username: EMAIL[peran], password: AKUN[peran] } });
  expect(r.ok(), `login ${peran} gagal: ${r.status()}`).toBeTruthy();
}

export async function keluarAPI(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout');
}

const PDF_MINI = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

export function filePdf(nama: string) {
  return { name: nama, mimeType: 'application/pdf', buffer: PDF_MINI };
}

/** Unggah berkas pada baris kelengkapan tertentu lalu tunggu statusnya menjadi "ada". */
export async function unggahBerkas(page: Page, jenis: string, nama = `${jenis}.pdf`): Promise<void> {
  const baris = page.locator(`[data-berkas="${jenis}"]`);
  await baris.locator('input[type="file"]').setInputFiles(filePdf(nama));
  await expect(baris).toHaveAttribute('data-keadaan', 'ada');
}

/** PUM mencentang satu berkas wajib sebagai "Sesuai" lalu tunggu tersimpan. */
export async function centangSesuai(page: Page, jenis: string): Promise<void> {
  const baris = page.locator(`[data-berkas="${jenis}"]`);
  await baris.locator('label', { hasText: 'Sesuai' }).click();
  await expect(baris).toHaveAttribute('data-cek', 'sesuai');
  await expect(baris.getByRole('checkbox')).toBeChecked();
}

/** Pilih pegawai pada combobox PegawaiPicker berdasarkan id pemicu. */
export async function pilihPegawai(page: Page, idPemicu: string, nama: string): Promise<void> {
  await page.locator(`#${idPemicu}`).click();
  await page.getByLabel('Cari pegawai').fill(nama);
  await page.getByRole('option', { name: new RegExp(nama) }).first().click();
  await expect(page.locator(`#${idPemicu}`)).toContainText(nama);
  // Tunggu popup benar-benar tertutup (animasi keluar) agar pemilih berikutnya tidak bertemu dua kotak cari.
  await expect(page.getByLabel('Cari pegawai')).toHaveCount(0);
}
