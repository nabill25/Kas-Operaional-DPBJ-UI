import { expect, masukAPI, test } from './fixtures';

test('registrasi: daftar → menunggu persetujuan → admin menyetujui sebagai PUM → bisa masuk', async ({ page, browser, galat }) => {
  const email = `daftar${Date.now() % 100000}@dpbj.test`;
  await page.goto('/login');
  await page.getByRole('link', { name: 'Daftar di sini' }).click();
  await expect(page).toHaveURL(/\/daftar$/);
  await expect(page.getByRole('heading', { name: 'Daftar akun' })).toBeVisible();

  // Validasi di browser
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.getByText('Nama wajib diisi')).toBeVisible();
  await page.getByLabel('Nama lengkap').fill('Pendaftar Uji');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('rahasia123');
  await page.getByLabel('Ulangi password').fill('beda');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.getByText('Password tidak sama')).toBeVisible();

  await page.getByLabel('Ulangi password').fill('rahasia123');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pendaftaran terkirim' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Belum bisa masuk sebelum disetujui
  await page.getByRole('link', { name: 'Kembali ke halaman masuk' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('rahasia123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByText('masih menunggu persetujuan administrator')).toBeVisible();
  galat.length = 0; // 403 di atas memang disengaja

  // Admin: badge di menu Pengguna, lalu setujui sebagai PUM
  const ctxAdmin = await browser.newContext();
  const adm = await ctxAdmin.newPage();
  await masukAPI(adm, 'admin');
  await adm.goto('/pengguna');
  await expect(adm.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /Pengguna/ })).toContainText(/\d/);
  const baris = adm.locator(`[data-pendaftar="${email}"]`);
  await expect(baris).toBeVisible();
  await baris.getByRole('button', { name: 'Setujui' }).click();
  const dialog = adm.getByRole('dialog');
  await dialog.getByRole('radio', { name: /^PUM/ }).check();
  await dialog.getByRole('button', { name: 'Setujui & aktifkan' }).click();
  await expect(adm.getByText('disetujui sebagai PUM')).toBeVisible();
  await expect(baris).toHaveCount(0);
  await ctxAdmin.close();

  // Sekarang bisa masuk dengan peran PUM
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /Verifikasi PUM/ })).toBeVisible();
});

test('registrasi: admin menolak pendaftaran', async ({ page, browser }) => {
  const email = `tolak${Date.now() % 100000}@dpbj.test`;
  const r = await page.request.post('/api/auth/daftar', { data: { nama: 'Tidak Dikenal', username: email, password: 'rahasia123' } });
  expect(r.status()).toBe(201);

  await masukAPI(page, 'admin');
  await page.goto('/pengguna');
  const baris = page.locator(`[data-pendaftar="${email}"]`);
  await baris.getByRole('button', { name: 'Tolak' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tolak & hapus' }).click();
  await expect(page.getByText('Pendaftaran Tidak Dikenal ditolak')).toBeVisible();
  await expect(baris).toHaveCount(0);

  const ctx = await browser.newContext();
  const login = await ctx.request.post(`${new URL(page.url()).origin}/api/auth/login`, { data: { username: email, password: 'rahasia123' } });
  expect(login.status()).toBe(401);
  await ctx.close();
});
