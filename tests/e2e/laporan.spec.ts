import fs from 'node:fs';
import { expect, masukAPI, test } from './fixtures';

async function bacaUnduhan(download: import('@playwright/test').Download): Promise<Buffer> {
  const lokasi = await download.path();
  return fs.readFileSync(lokasi);
}

test('rekap per pengajuan: unduh PDF & Excel', async ({ page }) => {
  await masukAPI(page, 'admin');
  await page.goto('/rekap');
  await expect(page.getByRole('heading', { name: 'Rekap & Laporan' })).toBeVisible();
  await expect(page.getByText(/^Rincian \(\d+\)$/)).toBeVisible();

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh PDF' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Rekap_Pengajuan_.*\.pdf$/);
  const isiPdf = await bacaUnduhan(pdf);
  expect(isiPdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(isiPdf.length).toBeGreaterThan(5_000);

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^Rekap_Pengajuan_.*\.xlsx$/);
  const isiXlsx = await bacaUnduhan(xlsx);
  expect(isiXlsx.subarray(0, 2).toString('latin1')).toBe('PK');
});

test('rekap per pegawai: filter, detail pegawai & PDF', async ({ page }) => {
  await masukAPI(page, 'admin');
  await page.goto('/rekap?tab=pegawai&periode=semua');
  await expect(page.getByText('Rekap per pegawai').first()).toBeVisible();
  const totalTeks = await page.locator('tfoot tr').last().textContent();
  expect(totalTeks).toContain('TOTAL');

  // Filter kategori konsumsi → kolom rumah tangga & perjadin bernilai 0 di baris total
  await page.getByLabel('Filter kategori').selectOption('konsumsi');
  await expect(page).toHaveURL(/kategori=konsumsi/);
  const kaki = page.locator('tfoot tr').last();
  await expect(kaki.locator('td').nth(2)).toHaveText('0');
  await expect(kaki.locator('td').nth(3)).toHaveText('0');

  await page.locator('tbody tr').first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Total diterima')).toBeVisible();
  const [pdf] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Unduh PDF pegawai' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Rekap_.*\.pdf$/);
  expect((await bacaUnduhan(pdf)).subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

test('PDF bukti pengajuan dari halaman detail & pratinjau berkas', async ({ page }) => {
  await masukAPI(page, 'pum');
  const r = await page.request.get('/api/pengajuan?status=selesai&limit=1');
  const id = (await r.json()).data[0].id as number;
  await page.goto(`/pengajuan/${id}`);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF', exact: true }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Bukti_[A-Z]{3}-\d{4}-\d{4}_\d{8}\.pdf$/);
  expect((await bacaUnduhan(pdf)).subarray(0, 5).toString('latin1')).toBe('%PDF-');

  // Pratinjau berkas (PDF) dalam modal
  await page.getByRole('button', { name: /^Lihat / }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('iframe')).toBeVisible();
  const src = await modal.locator('iframe').getAttribute('src');
  const berkas = await page.request.get(src!);
  expect(berkas.status()).toBe(200);
  expect(berkas.headers()['content-type']).toContain('application/pdf');
});
