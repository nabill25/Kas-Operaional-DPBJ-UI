import { expect, masukAPI, pilihPegawai, test } from './fixtures';

test('Perjadin: uang harian & transport per orang, validasi, pegawai baru dari form, maks. 2 orang, berkas N/A', async ({ page }) => {
  const nama = `Perjalanan Dinas Uji ${Date.now()}`;
  const pegawaiBaru = `Pegawai Uji ${Date.now() % 100000}`;

  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Transport Perjadin' }).click();

  await page.getByLabel('Nama kegiatan').fill(nama);
  await page.getByLabel('Lama kegiatan — dari').fill('2026-10-10');
  await page.getByLabel('Sampai').fill('2026-10-08');
  await page.getByLabel('Lokasi tujuan').fill('Bandung');
  await page.getByRole('radio', { name: 'LS' }).click();
  await page.getByRole('radio', { name: 'Dalam Kota' }).click();
  // "Jenis uang" sudah tidak ada; jenis transport berada di samping mekanisme
  await expect(page.getByText('Jenis uang')).toHaveCount(0);
  const kotakMekanisme = await page.locator('[data-field="mekanisme"]').boundingBox();
  const kotakTransport = await page.locator('[data-field="jenis_transport"]').boundingBox();
  expect(Math.abs(kotakMekanisme!.y - kotakTransport!.y)).toBeLessThan(2);
  expect(kotakTransport!.x).toBeGreaterThan(kotakMekanisme!.x + kotakMekanisme!.width - 1);

  // Peserta 1: tambah pegawai baru langsung dari combobox
  await page.locator('#peserta-0-pegawai_id').click();
  await page.getByLabel('Cari pegawai').fill(pegawaiBaru);
  await page.getByRole('option', { name: new RegExp(`Tambah .${pegawaiBaru}. sebagai pegawai baru`) }).click();
  await page.locator('#pp-jabatan').fill('Staf Uji');
  await page.getByRole('button', { name: 'Simpan & pilih' }).click();
  await expect(page.locator('#peserta-0-pegawai_id')).toContainText(pegawaiBaru);
  await page.locator('#peserta-0-uang_harian').fill('450000');

  // Peserta 2
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await pilihPegawai(page, 'peserta-1-pegawai_id', 'Rizky Pratama');
  await expect(page.getByRole('button', { name: 'Maksimal 2 orang' })).toBeDisabled();

  // Tanggal sampai < dari dan uang orang 2 yang masih kosong ditolak
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  await expect(page.getByText('Tanggal selesai tidak boleh sebelum tanggal mulai')).toBeVisible();
  await expect(page.getByText('Isi uang harian dan/atau uang transport', { exact: true })).toBeVisible();
  await page.locator('#peserta-1-uang_harian').fill('200000');
  await page.locator('#peserta-1-uang_transport').fill('100000');
  await expect(page.getByText('Jumlah orang 2:')).toContainText('Rp 300.000');
  await expect(page.getByText('Total pengajuan · 2 orang', { exact: false })).toBeVisible();
  await expect(page.getByText('750.000').last()).toBeVisible();
  await page.getByLabel('Sampai').fill('2026-10-12');
  await expect(page.getByText('Lama kegiatan 3 hari')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan draft' }).click();

  // Detail
  await expect(page).toHaveURL(/\/pengajuan\/\d+$/);
  await expect(page.getByRole('heading', { name: nama })).toBeVisible();
  await expect(page.getByText(pegawaiBaru).first()).toBeVisible();
  await expect(page.getByText('Total (2 orang)')).toBeVisible();
  await expect(page.getByText('Rp 750.000').first()).toBeVisible();
  await expect(page.locator('[data-peserta="1"]')).toContainText('Uang harian');
  await expect(page.locator('[data-peserta="1"]')).toContainText('Rp 200.000');
  await expect(page.locator('[data-peserta="1"]')).toContainText('Uang transport');
  await expect(page.locator('[data-peserta="1"]')).toContainText('Rp 100.000');
  await expect(page.getByText('Harian Rp 650.000 · Transport Rp 100.000')).toBeVisible();
  await expect(page.getByText('Jenis uang')).toHaveCount(0);
  await expect(page.getByText('10–12 Okt 2026 (3 hari)')).toBeVisible();
  for (const jenis of ['surat_tugas', 'laporan_kegiatan', 'invoice_hotel', 'invoice_tiket']) {
    await expect(page.locator(`[data-berkas="${jenis}"]`)).toHaveAttribute('data-keadaan', 'kosong');
  }

  // Dalam kota: tandai invoice hotel & tiket tidak diperlukan
  for (const label of ['Invoice Hotel', 'Invoice Tiket']) {
    await page.getByRole('button', { name: `Opsi ${label}` }).click();
    await page.getByRole('menuitem', { name: 'Tandai tidak diperlukan' }).click();
  }
  await expect(page.locator('[data-berkas="invoice_hotel"]')).toHaveAttribute('data-keadaan', 'na');
  await expect(page.locator('[data-berkas="invoice_tiket"]')).toHaveAttribute('data-keadaan', 'na');
  await expect(page.getByText('2 dari 4 berkas wajib terpenuhi')).toBeVisible();

  // Ubah data: nilai diperbarui & total dihitung ulang
  await page.getByRole('link', { name: 'Ubah' }).click();
  await expect(page.locator('#peserta-1-uang_transport')).toHaveValue('100.000');
  await page.locator('#peserta-1-uang_transport').fill('150000');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(page).toHaveURL(/\/pengajuan\/\d+$/);
  await expect(page.getByText('Rp 800.000').first()).toBeVisible();
});

test('Rumah Tangga: minimal 1 orang & pegawai yang sama tidak bisa dipilih dua kali', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Transport Rumah Tangga' }).click();
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  await expect(page.getByText('Nama kegiatan wajib diisi')).toBeVisible();
  await expect(page.getByText('Pilih nama pegawai')).toBeVisible();
  await expect(page.getByText('Nilai uang wajib diisi')).toBeVisible();
  await expect(page.getByText('Pilih mekanisme KO atau LS')).toBeVisible();

  await pilihPegawai(page, 'peserta-0-pegawai_id', 'Bambang Sutrisno');
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await page.locator('#peserta-1-pegawai_id').click();
  await page.getByLabel('Cari pegawai').fill('Bambang Sutrisno');
  // Bambang sudah dipilih di baris 1 sehingga tidak muncul lagi
  await expect(page.getByRole('option', { name: /Bambang Sutrisno/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Hapus baris 2
  await page.getByRole('button', { name: 'Hapus orang 2' }).click();
  await expect(page.locator('#peserta-1-pegawai_id')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hapus orang 1' })).toBeDisabled();
});
