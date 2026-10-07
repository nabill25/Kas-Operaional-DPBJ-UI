import { expect, masukAPI, test } from './fixtures';

const aksen = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-kuning-500').trim().toLowerCase());

test('pengaturan: tema warna Kuning UI diterapkan, tersimpan, dan terpisah dari mode gelap', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu akun' }).click();
  await page.getByRole('menuitem', { name: 'Pengaturan' }).click();
  await expect(page).toHaveURL(/\/pengaturan$/);
  await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-warna', 'dpbj');
  expect(await aksen(page)).toBe('#ffd100');

  // Pilih Kuning UI → kuning resmi UI #F6DB00
  await page.locator('[data-warna-opsi="ui"]').click();
  await expect(html).toHaveAttribute('data-warna', 'ui');
  await expect(page.locator('[data-warna-opsi="ui"]')).toHaveAttribute('data-terpilih', 'ya');
  await expect(page.getByRole('radio', { name: /Kuning UI/ })).toBeChecked();
  expect(await aksen(page)).toBe('#f6db00');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#(F4F3ED|0C0C0B)$/);

  // Tersimpan setelah muat ulang (diterapkan sebelum render)
  await page.reload();
  await expect(html).toHaveAttribute('data-warna', 'ui');
  expect(await aksen(page)).toBe('#f6db00');

  // Mode terang/gelap tetap diatur terpisah
  const gelapAwal = await html.evaluate((el) => el.classList.contains('dark'));
  await page.getByRole('button', { name: gelapAwal ? 'Ganti ke tema terang' : 'Ganti ke tema gelap' }).click();
  await expect.poll(() => html.evaluate((el) => el.classList.contains('dark'))).toBe(!gelapAwal);
  await expect(html).toHaveAttribute('data-warna', 'ui');

  // Kembali ke bawaan
  await page.locator('[data-warna-opsi="dpbj"]').click();
  await expect(html).toHaveAttribute('data-warna', 'dpbj');
  expect(await aksen(page)).toBe('#ffd100');
});

test('pengaturan: tersedia untuk semua peran & menampilkan info akun', async ({ page }) => {
  for (const peran of ['pimpinan', 'pum'] as const) {
    await page.request.post('/api/auth/logout');
    await masukAPI(page, peran);
    await page.goto('/pengaturan');
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
    await expect(page.getByText(`${peran}@dpbj.test`)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Pengaturan' })).toHaveAttribute('aria-current', 'page');
  }
});
