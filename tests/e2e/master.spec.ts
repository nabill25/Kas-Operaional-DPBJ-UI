import { expect, masukAPI, test } from './fixtures';

test('admin: tambah pegawai, ubah, nonaktifkan, hapus', async ({ page, galat }) => {
  const nama = `Pegawai Master ${Date.now() % 100000}`;
  await masukAPI(page, 'admin');
  await page.goto('/pegawai');
  await page.getByRole('button', { name: 'Tambah Pegawai' }).click();
  await page.getByLabel('Nama lengkap').fill(nama);
  await page.getByLabel('NIP / NUP').fill('1990 0101 2020 1210 99');
  await page.getByLabel('Jabatan').fill('Staf Uji');
  await page.getByRole('button', { name: 'Tambah pegawai' }).click();
  await expect(page.getByText(`${nama} ditambahkan`)).toBeVisible();
  const daftar = page.getByRole('list', { name: 'Daftar pegawai' });
  const kartu = daftar.locator('li', { hasText: nama });
  await expect(kartu).toContainText('NIP 199001012020121099');

  // NIP duplikat ditolak
  await page.getByRole('button', { name: 'Tambah Pegawai' }).click();
  await page.getByLabel('Nama lengkap').fill('Duplikat');
  await page.getByLabel('NIP / NUP').fill('199001012020121099');
  await page.getByRole('button', { name: 'Tambah pegawai' }).click();
  await expect(page.getByText(`NIP/NUP sudah dipakai oleh ${nama}`)).toBeVisible();
  galat.length = 0; // respons 409/400 di atas memang disengaja (browser mencatatnya sebagai error jaringan)
  await page.getByRole('button', { name: 'Batal' }).click();

  // Ubah
  await kartu.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Ubah data' }).click();
  await page.getByLabel('Jabatan').fill('Staf Uji Senior');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(kartu).toContainText('Staf Uji Senior');

  // Nonaktifkan → pindah ke tab nonaktif
  await kartu.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(daftar.locator('li', { hasText: nama })).toHaveCount(0);
  await page.getByRole('radio', { name: /Nonaktif/ }).click();
  await expect(daftar.locator('li', { hasText: nama })).toBeVisible();

  // Hapus (belum pernah dipakai)
  await daftar.locator('li', { hasText: nama }).getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Hapus permanen' }).click();
  await page.getByRole('button', { name: 'Hapus pegawai' }).click();
  await expect(page.getByText(`${nama} dihapus`)).toBeVisible();
  await expect(daftar.locator('li', { hasText: nama })).toHaveCount(0);
});

test('admin: buat pengguna baru lalu pengguna tersebut bisa login', async ({ page, browser }) => {
  const username = `uji${Date.now() % 100000}@dpbj.test`;
  await masukAPI(page, 'admin');
  await page.goto('/pengguna');
  await page.getByRole('button', { name: 'Tambah Pengguna' }).click();
  await page.getByRole('textbox', { name: 'Nama', exact: true }).fill('Pengguna Uji');
  await page.getByRole('textbox', { name: 'Email (untuk login)', exact: true }).fill(username);
  await page.getByRole('radio', { name: /^PUM/ }).check();
  await page.locator('#u-password').fill('rahasia123');
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByText(`Akun ${username} dibuat`)).toBeVisible();
  await expect(page.getByText(`${username} · dibuat`, { exact: false })).toBeVisible();

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto('/login');
  await p2.getByLabel('Email').fill(username);
  await p2.getByLabel('Password', { exact: true }).fill('rahasia123');
  await p2.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(p2.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(p2.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /Verifikasi PUM/ })).toBeVisible();
  await ctx.close();
});

test('ganti password dari menu akun', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu akun' }).click();
  await page.getByRole('menuitem', { name: 'Ganti password' }).click();
  await page.locator('#pw-lama').fill('operator123');
  await page.locator('#pw-baru').fill('beda');
  await page.locator('#pw-ulang').fill('beda');
  await page.getByRole('button', { name: 'Simpan password' }).click();
  await expect(page.getByText('Password baru minimal 6 karakter')).toBeVisible();
  await page.locator('#pw-baru').fill('operator123');
  await page.locator('#pw-ulang').fill('operator123');
  await page.getByRole('button', { name: 'Simpan password' }).click();
  await expect(page.getByText('Password baru harus berbeda dari password lama')).toBeVisible();
});
