import { expect, masukAPI, test } from './fixtures';

test('login salah ditolak, login benar masuk dashboard, lalu keluar', async ({ page, galat }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();

  await page.getByLabel('Username').fill('operator');
  await page.getByLabel('Password', { exact: true }).fill('salah-sekali');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByText('Username atau password salah')).toBeVisible();
  galat.length = 0; // 401 di atas memang disengaja

  await page.getByLabel('Password', { exact: true }).fill('operator123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Selamat', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Menu akun' }).click();
  await page.getByRole('menuitem', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/pengajuan');
  await expect(page).toHaveURL(/\/login$/);
});

test('validasi form login kosong', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByText('Username wajib diisi')).toBeVisible();
  await expect(page.getByText('Password wajib diisi')).toBeVisible();
});

test('halaman dibatasi sesuai peran', async ({ page }) => {
  await masukAPI(page, 'pum');
  await page.goto('/pengajuan/baru');
  await expect(page.getByText('Tidak memiliki akses')).toBeVisible();
  await page.goto('/pengguna');
  await expect(page.getByText('Tidak memiliki akses')).toBeVisible();
  await page.goto('/verifikasi');
  await expect(page.getByRole('heading', { name: 'Verifikasi PUM' })).toBeVisible();
  // Menu PUM tidak memuat "Buat Pengajuan" / "Pengguna"
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(nav.getByRole('link', { name: 'Buat Pengajuan' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Pengguna' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Verifikasi PUM/ })).toBeVisible();

  // Operator tidak dapat membuka halaman Verifikasi PUM
  await page.request.post('/api/auth/logout');
  await masukAPI(page, 'operator');
  await page.goto('/verifikasi');
  await expect(page.getByText('Tidak memiliki akses')).toBeVisible();
});

test('halaman tidak dikenal menampilkan 404 yang ramah', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/halaman-tidak-ada');
  await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible();
});
