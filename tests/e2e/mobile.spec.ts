import { expect, masukAPI, test } from './fixtures';

test('mobile: tidak ada scroll horizontal di semua halaman utama', async ({ page }) => {
  await masukAPI(page, 'admin');
  const r = await page.request.get('/api/pengajuan?limit=1');
  const id = (await r.json()).data[0].id as number;
  for (const url of ['/', '/pengajuan', '/pengajuan/baru', `/pengajuan/${id}`, '/verifikasi', '/rekap', '/rekap?tab=pegawai', '/pegawai', '/pengguna', '/pengaturan', '/master/jenis-pengajuan', '/master/jenis-berkas', '/master/project-task', '/master/project-task?tab=task', '/master/bank']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    const ukuran = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      klien: document.documentElement.clientWidth,
    }));
    expect(ukuran.scroll, `overflow horizontal di ${url}`).toBeLessThanOrEqual(ukuran.klien);
  }
});

test('mobile: halaman masuk & daftar tanpa scroll horizontal', async ({ page }) => {
  for (const url of ['/login', '/daftar']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const ukuran = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, klien: document.documentElement.clientWidth }));
    expect(ukuran.scroll, `overflow horizontal di ${url}`).toBeLessThanOrEqual(ukuran.klien);
  }
});

test('mobile: menu drawer membuka & menavigasi', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('button', { name: 'Buka menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu navigasi' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: /Daftar Pengajuan/ }).click();
  await expect(page).toHaveURL(/\/pengajuan$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Daftar Pengajuan' })).toBeVisible();
});

test('mobile: login & form pengajuan dapat diisi', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('operator@dpbj.test');
  await page.getByLabel('Password', { exact: true }).fill('operator123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Konsumsi' }).click();
  await page.getByLabel('Nama kegiatan').fill('Rapat dari ponsel');
  await expect(page.getByRole('button', { name: 'Simpan draft' })).toBeVisible();
});
