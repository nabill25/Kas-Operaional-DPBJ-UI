import type { Page } from '@playwright/test';
import { expect, masukAPI, pilihPegawai, test } from './fixtures';

/** Posisi kotak isian (data-field = id input). */
async function kotak(page: Page, field: string) {
  const k = await page.locator(`[data-field="${field}"]`).boundingBox();
  expect(k, `kotak ${field}`).not.toBeNull();
  return k!;
}

/** Isian penerima ke-i sebaris dari kiri ke kanan (layar lebar). */
async function harusSebaris(page: Page, fields: string[]) {
  const daftar = await Promise.all(fields.map((f) => kotak(page, f)));
  for (let j = 1; j < daftar.length; j++) {
    expect(Math.abs(daftar[j].y - daftar[0].y), `${fields[j]} sebaris dengan ${fields[0]}`).toBeLessThan(2);
    expect(daftar[j].x, `${fields[j]} di kanan ${fields[j - 1]}`).toBeGreaterThan(daftar[j - 1].x + daftar[j - 1].width - 1);
  }
}

test('Perjadin: selalu LS, uang harian & transport + bank & rekening per orang, validasi, pengaju tanpa tambah pegawai, maks. 2 orang, berkas N/A', async ({ page }) => {
  const nama = `Perjalanan Dinas Uji ${Date.now()}`;

  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Transport Perjadin' }).click();

  await page.getByLabel('Nama kegiatan').fill(nama);
  await page.getByLabel('Lama kegiatan — dari').fill('2026-10-10');
  await page.getByLabel('Sampai').fill('2026-10-08');
  await page.getByLabel('Lokasi tujuan').fill('Bandung');
  // Mekanisme Perjadin selalu LS (master Jenis Pengajuan) → pilihan KO/LS tidak ditampilkan
  await expect(page.locator('[data-field="mekanisme"]')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'KO', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dalam Kota' }).click();
  // "Jenis uang" sudah tidak ada; jenis transport berada di samping lokasi tujuan
  await expect(page.getByText('Jenis uang')).toHaveCount(0);
  await harusSebaris(page, ['lokasi_tujuan', 'jenis_transport']);

  // Pengaju tidak menambah pegawai baru (master Pegawai dikelola admin): nama belum terdaftar → petunjuk ke admin
  await page.locator('#peserta-0-pegawai_id').click();
  await page.getByLabel('Cari pegawai').fill('Pegawai Belum Terdaftar');
  await expect(page.getByRole('option', { name: /sebagai pegawai baru/ })).toHaveCount(0);
  await expect(page.getByText('Nama belum terdaftar? Minta admin menambahkannya di Master Pegawai.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Cari pegawai')).toHaveCount(0);
  // Peserta 1: pegawai terdaftar tanpa rekening
  await pilihPegawai(page, 'peserta-0-pegawai_id', 'Rizky Pratama');
  await page.locator('#peserta-0-uang_harian').fill('450000');
  // Pegawai tanpa rekening di master → bank & nomor kosong (opsional)
  await expect(page.locator('#peserta-0-rekening_bank')).toHaveValue('');
  await expect(page.locator('#peserta-0-rekening_nomor')).toHaveValue('');

  // Peserta 2: rekening terisi otomatis dari master Pegawai
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await pilihPegawai(page, 'peserta-1-pegawai_id', 'Siti Rahmawati');
  await expect(page.getByRole('button', { name: 'Maksimal 2 orang' })).toBeDisabled();
  await expect(page.locator('#peserta-1-rekening_bank')).toHaveValue('BRI');
  await expect(page.locator('#peserta-1-rekening_nomor')).toHaveValue('034101000123305');
  await expect(page.locator('[data-baris-penerima="1"]')).toContainText('Dari data pegawai');
  // Nama | uang harian | uang transport | bank | no. rekening dalam satu baris
  await harusSebaris(page, ['peserta-1-pegawai_id', 'peserta-1-uang_harian', 'peserta-1-uang_transport', 'peserta-1-rekening_bank', 'peserta-1-rekening_nomor']);
  // No. rekening 15 digit tampil utuh
  expect(await page.locator('#peserta-1-rekening_nomor').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

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
  await expect(page.getByText('Rizky Pratama').first()).toBeVisible();
  await expect(page.getByText('Total (2 orang)')).toBeVisible();
  // Rekening penerima tersimpan di pengajuan (orang 1 tanpa rekening)
  await expect(page.getByTestId('rekening-peserta')).toHaveCount(1);
  await expect(page.locator('[data-peserta="1"]')).toContainText('BRI');
  await expect(page.locator('[data-peserta="1"]')).toContainText('034101000123305');
  expect(((await (await page.request.get(`/api/pengajuan/${page.url().split('/').pop()}`)).json()) as { mekanisme: string }).mekanisme).toBe('LS');
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

test('Rumah Tangga: selalu LS, minimal 1 orang, pegawai tidak dobel, nilai + bank & rekening per orang', async ({ page }) => {
  const nama = `Antar Dokumen Uji ${Date.now()}`;
  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Transport Rumah Tangga' }).click();
  // Mekanisme Rumah Tangga selalu LS → tanpa pilihan KO/LS & tanpa galat mekanisme
  await expect(page.locator('[data-field="mekanisme"]')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'LS', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  await expect(page.getByText('Nama kegiatan wajib diisi')).toBeVisible();
  await expect(page.getByText('Pilih nama pegawai')).toBeVisible();
  await expect(page.getByText('Nilai uang wajib diisi')).toBeVisible();
  await expect(page.getByText('Pilih mekanisme KO atau LS')).toHaveCount(0);

  await pilihPegawai(page, 'peserta-0-pegawai_id', 'Bambang Sutrisno');
  await expect(page.locator('#peserta-0-rekening_bank')).toHaveValue('');
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

  // Orang 2 punya rekening di master Pegawai → terisi otomatis; nama | nilai | bank | no. rekening sebaris
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await pilihPegawai(page, 'peserta-1-pegawai_id', 'Fitri Handayani');
  await expect(page.locator('#peserta-1-rekening_bank')).toHaveValue('BNI');
  await expect(page.locator('#peserta-1-rekening_nomor')).toHaveValue('0123456789');
  await harusSebaris(page, ['peserta-1-pegawai_id', 'peserta-1-nilai', 'peserta-1-rekening_bank', 'peserta-1-rekening_nomor']);
  await page.getByLabel('Nama kegiatan').fill(nama);
  await page.getByLabel('Tanggal kegiatan').fill('2026-10-05');
  await page.getByLabel('Lokasi tujuan').fill('Rektorat UI');
  await page.locator('#peserta-0-nilai').fill('100000');
  await page.locator('#peserta-1-nilai').fill('75000');
  // Bank tanpa nomor rekening ditolak; nomor dibersihkan dari spasi
  await page.locator('#peserta-0-rekening_bank').fill('Bank Mandiri');
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  await expect(page.getByText('Isi nomor rekening')).toBeVisible();
  await page.locator('#peserta-0-rekening_nomor').fill('157 0001 234 567');
  await page.getByRole('button', { name: 'Simpan draft' }).click();

  await expect(page).toHaveURL(/\/pengajuan\/\d+$/);
  await expect(page.getByRole('heading', { name: nama })).toBeVisible();
  const rekening = page.getByTestId('rekening-peserta');
  await expect(rekening).toHaveCount(2);
  await expect(rekening.nth(0)).toContainText('Bank Mandiri');
  await expect(rekening.nth(0)).toContainText('1570001234567');
  await expect(rekening.nth(1)).toContainText('BNI');
  await expect(rekening.nth(1)).toContainText('0123456789');
  expect(((await (await page.request.get(`/api/pengajuan/${page.url().split('/').pop()}`)).json()) as { mekanisme: string }).mekanisme).toBe('LS');
});
