import { expect, masukAPI, test } from './fixtures';

test('dashboard: KPI, grafik + tampilan tabel, tema gelap, notifikasi', async ({ page }) => {
  await masukAPI(page, 'admin');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // Kartu KPI berupa tautan "<label> <angka> …" (label status yang sama juga muncul sebagai badge di "Perlu tindakan").
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const label of ['Diajukan ke PUM', 'Diajukan ke MDK', 'Selesai (Paid)', 'Dikembalikan (revisi)', 'Berkas belum lengkap', 'Draft belum diajukan']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${esc(label)} \\d`) })).toBeVisible();
  }
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await expect(page.getByLabel('Legenda kategori').first()).toContainText('Konsumsi');

  // Grafik ↔ tabel (aksesibilitas)
  await page.getByRole('button', { name: 'Tabel' }).click();
  await expect(page.getByRole('cell', { name: 'Januari' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Desember' })).toBeVisible();
  await page.getByRole('button', { name: 'Grafik' }).click();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  // Tema gelap tersimpan
  await page.getByRole('button', { name: 'Ganti ke tema gelap' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Ganti ke tema terang' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  // Notifikasi
  await page.getByRole('button', { name: /^Notifikasi/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifikasi' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Pindah tahun
  const tahunLalu = String(new Date().getFullYear() - 1);
  const ada = await page.getByLabel('Pilih tahun').locator(`option[value="${tahunLalu}"]`).count();
  if (ada) {
    await page.keyboard.press('Escape');
    await page.getByLabel('Pilih tahun').selectOption(tahunLalu);
    await expect(page.getByText(`Total nilai pengajuan ${tahunLalu}`)).toBeVisible();
  }
});

test('navigasi kartu KPI membuka daftar terfilter', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('link', { name: /Dikembalikan \(revisi\)/ }).click();
  await expect(page).toHaveURL(/\/pengajuan\?status=dikembalikan/);
  await expect(page.getByRole('heading', { name: 'Daftar Pengajuan' })).toBeVisible();
  const baris = page.locator('tbody tr');
  await expect(baris.first()).toBeVisible();
  for (const teks of await baris.allTextContents()) expect(teks).toContain('Dikembalikan');
});

test('pencarian dari topbar menuju daftar', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByPlaceholder('Cari kode, kegiatan, nama…').fill('Rapat');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pengajuan\?q=Rapat/);
  await expect(page.getByPlaceholder('Cari kode, kegiatan, lokasi, nama pegawai, no. invoice, project/task…')).toHaveValue('Rapat');
  const teksBaris = await page.locator('tbody tr').allTextContents();
  expect(teksBaris.length).toBeGreaterThan(0);
  expect(teksBaris.some((t) => t.toLowerCase().includes('rapat'))).toBe(true);
  // Pencarian juga mencakup project costing (tidak tampil di tabel) → setiap hasil dicek lewat API
  const { data } = (await (await page.request.get('/api/pengajuan?q=Rapat&limit=100')).json()) as {
    data: Record<'kode' | 'nama_kegiatan' | 'penerima' | 'lokasi_tujuan' | 'no_invoice_mdk' | 'project_hosting' | 'task_name', string | null>[];
  };
  expect(data.length).toBeGreaterThanOrEqual(teksBaris.length);
  for (const p of data) expect(Object.values(p).join(' ').toLowerCase()).toContain('rapat');
});
