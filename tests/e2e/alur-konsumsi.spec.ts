import { centangSesuai, expect, keluarAPI, masukAPI, pilihPegawai, test, unggahBerkas } from './fixtures';

const BERKAS_KONSUMSI = ['notulen', 'undangan', 'invoice', 'daftar_hadir'];

test('alur lengkap Konsumsi: rekening → ajukan ke PUM → centang berkas → teruskan ke MDK (project/task dari master) → invoice → sudah dibayarkan', async ({ page }) => {
  const nama = `Rapat Uji E2E ${Date.now()}`;

  // 1. Operator membuat draft
  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Konsumsi' }).click();
  await page.getByLabel('Nama kegiatan').fill(nama);
  await page.getByLabel('Tanggal kegiatan').fill('2026-10-01');
  await page.getByLabel('Jumlah orang').fill('12');
  await page.getByLabel('Jumlah uang yang digunakan').fill('1500000');
  await expect(page.getByLabel('Jumlah uang yang digunakan')).toHaveValue('1.500.000');
  await pilihPegawai(page, 'uang_siapa_id', 'Nurul Hidayah');
  // Rekening uang siapa (opsional): bukan Bank Mandiri → catatan biaya transfer ditonjolkan
  await page.locator('#rekening_bank').fill('BNI');
  await page.locator('#rekening_nomor').fill('0123 456 789');
  await expect(page.getByText('Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening.')).toBeVisible();
  await page.getByRole('radio', { name: 'KO' }).click();
  await expect(page.getByText('Rp 125.000')).toBeVisible(); // rata-rata per orang
  // Jenis konsumsi wajib dipilih: simpan tanpa memilih → ditandai, lalu pilih
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  await expect(page.getByText('Pilih jenis konsumsi')).toBeVisible();
  await page.locator('[data-jenis-konsumsi="kudapan_makan_siang"]').click();
  await expect(page.getByRole('radio', { name: 'Kudapan + Makan Siang' })).toBeChecked();
  await page.getByRole('button', { name: 'Simpan draft' }).click();

  await expect(page).toHaveURL(/\/pengajuan\/\d+$/);
  const id = Number(page.url().split('/').pop());
  await expect(page.getByRole('heading', { name: nama })).toBeVisible();
  await expect(page.getByText('Kudapan + Makan Siang')).toBeVisible(); // jenis konsumsi di Informasi kegiatan
  const uangSiapa = page.getByTestId('uang-siapa');
  await expect(uangSiapa).toContainText('Nurul Hidayah');
  await expect(uangSiapa).toContainText('BNI');
  await expect(uangSiapa).toContainText('0123456789');
  await expect(uangSiapa).toContainText('Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening.');
  await expect(uangSiapa.getByRole('button', { name: 'Sudah dibayarkan' })).toHaveCount(0); // hanya PUM
  await expect(page.getByText('Draft tersimpan! Langkah berikutnya:')).toBeVisible();
  const kode = (await page.getByText(/^KSM-\d{4}-\d{4}$/).first().textContent())!.trim();

  // 2. Unggah 4 berkas wajib (label tampil "Notula", kunci internal tetap `notulen`)
  await expect(page.locator('[data-berkas="notulen"]')).toContainText('Notula');
  for (const jenis of BERKAS_KONSUMSI) await unggahBerkas(page, jenis);
  await expect(page.getByText('Semua berkas wajib sudah terpenuhi')).toBeVisible();

  // 3. Ajukan ke PUM → terkunci untuk pengaju
  await page.getByRole('button', { name: 'Ajukan ke PUM' }).click();
  await page.getByRole('button', { name: 'Ajukan sekarang' }).click();
  await expect(page.getByRole('button', { name: 'Tarik kembali' })).toBeVisible();
  await expect(page.getByText('Pengajuan sedang diperiksa PUM — berkas terkunci.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-berkas="notulen"] input[type="file"]')).toHaveCount(0);

  // 4. PUM menerima notifikasi otomatis & melihat antrian
  await keluarAPI(page);
  await masukAPI(page, 'pum');
  await page.goto('/verifikasi');
  await expect(page.getByRole('heading', { name: 'Verifikasi PUM' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Notifikasi, \d+ belum dibaca$/ })).toBeVisible();
  const kartu = page.locator(`[data-kode="${kode}"]`);
  await expect(kartu).toContainText('Dicek 0/4 sesuai');
  await kartu.getByRole('link', { name: 'Periksa berkas' }).click();
  await expect(page).toHaveURL(new RegExp(`/pengajuan/${id}$`));

  // 5. Belum bisa diteruskan sebelum semua berkas dicentang sesuai
  const teruskanHeader = page.getByRole('button', { name: 'Teruskan ke MDK', exact: true });
  await expect(teruskanHeader).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Setujui & teruskan ke MDK' })).toBeDisabled();
  for (const jenis of BERKAS_KONSUMSI) await centangSesuai(page, jenis);
  await expect(page.getByTestId('kartu-pum')).toContainText('Semua berkas sesuai');
  await expect(page.getByTestId('aksi-pum')).toContainText('Semua berkas wajib sesuai.');

  // 6. Teruskan ke MDK dengan project hosting & task name
  await teruskanHeader.click();
  const dialog = page.getByRole('dialog', { name: 'Setujui & teruskan ke MDK' });
  await expect(dialog).toContainText('Semua berkas wajib sudah dicentang sesuai (4/4)');
  // Project dipilih lewat kotak cari (master Kasubdit); task Konsumsi project itu terisi otomatis
  await dialog.getByRole('combobox', { name: 'Project Hosting' }).click();
  await page.getByLabel('Cari project').fill('tata kelola');
  await page.getByRole('option', { name: /D0030\.09\.01\.6\.002/ }).click();
  await expect(dialog.getByRole('combobox', { name: 'Project Hosting' })).toContainText('Koordinasi Tata Kelola Pengadaan');
  await expect(dialog.getByRole('combobox', { name: 'Task Name' })).toContainText('Beban Konsumsi');
  await expect(dialog.getByText('Terisi otomatis: task Konsumsi untuk project ini')).toBeVisible();
  // Daftar task dibatasi pada task project terpilih
  await dialog.getByRole('combobox', { name: 'Task Name' }).click();
  await page.getByLabel('Cari task').fill('honor');
  await expect(page.getByText('Tidak ada yang cocok di daftar.')).toBeVisible();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Teruskan ke MDK' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Disetujui PUM & diteruskan ke MDK — menunggu invoice')).toBeVisible();
  await expect(page.getByTestId('kartu-pum')).toContainText('D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan');
  await expect(page.getByTestId('kartu-pum')).toContainText('723207_Beban Konsumsi');

  // 7. Invoice dari MDK (di luar sistem) diinput PUM → selesai (paid)
  await page.getByRole('button', { name: 'Input No. Invoice MDK' }).click();
  await page.locator('#no_invoice_mdk').fill('MDK/INV/E2E/0001');
  await page.getByRole('button', { name: 'Simpan invoice — selesai (paid)' }).click();
  await expect(page.getByText('MDK/INV/E2E/0001').first()).toBeVisible();
  await expect(page.getByText('Selesai (Paid)').first()).toBeVisible();

  // 7b. PUM menandai uang sudah dibayarkan ke pemilik uang (tombol di dekat "Uang siapa")
  await uangSiapa.getByRole('button', { name: 'Sudah dibayarkan' }).click();
  await page.getByRole('button', { name: 'Ya, sudah dibayarkan' }).click();
  await expect(uangSiapa.getByRole('button', { name: 'Sudah dibayarkan' })).toHaveCount(0);
  await expect(uangSiapa).toContainText('Sudah dibayarkan');
  await expect(uangSiapa).toContainText('oleh Petugas PUM');
  await expect(page.getByText('Uang ditandai sudah dibayarkan').first()).toBeVisible(); // riwayat

  // 8. Operator menerima notifikasi otomatis; membuka notifikasi menandainya dibaca
  await keluarAPI(page);
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('button', { name: /^Notifikasi, \d+ belum dibaca$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notifikasi' });
  await expect(panel.getByRole('link').filter({ hasText: kode }).filter({ hasText: 'Berkas disetujui PUM & diteruskan ke MDK' })).toBeVisible();
  await expect(panel.getByRole('link').filter({ hasText: kode }).filter({ hasText: 'Uang konsumsi sudah dibayarkan' })).toBeVisible();
  await panel.getByRole('link').filter({ hasText: kode }).filter({ hasText: 'Pengajuan selesai (paid)' }).click();
  await expect(page).toHaveURL(new RegExp(`/pengajuan/${id}$`));
  await expect(page.getByText('MDK/INV/E2E/0001').first()).toBeVisible();
  await expect
    .poll(async () => {
      const n = (await (await page.request.get('/api/notifikasi')).json()) as { items: { pengajuan_id: number; dibaca: boolean }[] };
      return n.items.filter((x) => x.pengajuan_id === id && !x.dibaca).length;
    })
    .toBe(0);

  await page.goto(`/pengajuan?status=selesai&q=${encodeURIComponent(kode)}`);
  await expect(page.getByText(kode).first()).toBeVisible();
  await expect(page.getByText('MDK/INV/E2E/0001').first()).toBeVisible();
});

test('PUM menandai berkas perlu revisi & mengembalikan; pengaju dinotifikasi, memperbaiki, lalu mengajukan ulang', async ({ page }) => {
  await masukAPI(page, 'pum');
  const r = await page.request.get('/api/pengajuan?status=diajukan_pum&sort=antrian&limit=1');
  const { id, kode } = (await r.json()).data[0] as { id: number; kode: string };
  const detail = (await (await page.request.get(`/api/pengajuan/${id}`)).json()) as {
    kelengkapan: { items: { jenis: string; label: string }[] };
  };
  const { jenis, label } = detail.kelengkapan.items[0];

  await page.goto(`/pengajuan/${id}`);
  const baris = page.locator(`[data-berkas="${jenis}"]`);
  await baris.getByRole('button', { name: `${label} perlu revisi` }).click();
  await baris.getByLabel(`Apa yang perlu direvisi pada ${label}?`).fill('Tanda tangan ketua belum ada');
  await baris.getByRole('button', { name: 'Simpan catatan revisi' }).click();
  await expect(baris).toHaveAttribute('data-cek', 'revisi');
  await expect(baris).toContainText('Tanda tangan ketua belum ada');

  // Kembalikan dengan alasan; berkas revisi ikut ditampilkan
  await page.getByRole('button', { name: 'Kembalikan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Kembalikan berkas ke pengaju' });
  await expect(dialog).toContainText('Tanda tangan ketua belum ada');
  await dialog.getByRole('button', { name: 'Kembalikan ke pengaju' }).click();
  await expect(dialog.getByText('Alasan pengembalian wajib diisi')).toBeVisible();
  await dialog.getByRole('button', { name: 'Berkas belum lengkap, mohon dilengkapi.' }).click();
  await dialog.getByRole('button', { name: 'Kembalikan ke pengaju' }).click();
  await expect(page.getByText(`${kode} dikembalikan ke pengaju`)).toBeVisible();
  await expect(page.getByText('Dikembalikan', { exact: true }).first()).toBeVisible();

  // Pengaju: notifikasi & catatan pengembalian
  await keluarAPI(page);
  await masukAPI(page, 'operator');
  await page.goto('/');
  await page.getByRole('button', { name: /^Notifikasi, \d+ belum dibaca$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notifikasi' });
  await panel.getByRole('link').filter({ hasText: kode }).filter({ hasText: 'Pengajuan dikembalikan PUM' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/pengajuan/${id}$`));
  const catatan = page.getByTestId('catatan-pengembalian');
  await expect(catatan).toContainText('Berkas belum lengkap, mohon dilengkapi.');
  await expect(catatan).toContainText('Tanda tangan ketua belum ada');

  // Ganti berkas yang direvisi → tanda revisi hilang (perlu diperiksa ulang), lalu ajukan ulang
  await unggahBerkas(page, jenis, `${jenis}-revisi.pdf`);
  await expect(baris).toHaveAttribute('data-cek', 'belum');
  await page.getByRole('button', { name: 'Ajukan ulang ke PUM' }).click();
  await page.getByRole('button', { name: /Ajukan sekarang|Tetap ajukan/ }).click();
  await expect(page.getByRole('button', { name: 'Tarik kembali' })).toBeVisible();
  await expect(page.getByText('Diajukan ulang.')).toBeVisible();
});

test('Pimpinan hanya memantau: tanpa menu & tombol aksi', async ({ page }) => {
  await masukAPI(page, 'pimpinan');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Pengajuan berjalan')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(nav.getByRole('link', { name: 'Rekap & Laporan' })).toBeVisible();
  for (const menu of ['Buat Pengajuan', /Verifikasi PUM/, 'Pengguna']) {
    await expect(nav.getByRole('link', { name: menu })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: /^Notifikasi/ })).toHaveCount(0);

  const r = await page.request.get('/api/pengajuan?status=diajukan_pum&limit=1');
  const id = (await r.json()).data[0].id as number;
  await page.goto(`/pengajuan/${id}`);
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  for (const tombol of ['Ajukan ke PUM', 'Tarik kembali', 'Kembalikan', 'Teruskan ke MDK', 'Input No. Invoice MDK', 'Aksi PUM']) {
    await expect(page.getByRole('button', { name: tombol, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: 'Ubah', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByTestId('kartu-pum')).toBeVisible();

  await page.goto('/verifikasi');
  await expect(page.getByText('Tidak memiliki akses')).toBeVisible();
  await page.goto('/pengajuan/baru');
  await expect(page.getByText('Tidak memiliki akses')).toBeVisible();
  // Draft tidak terlihat oleh pimpinan
  const draft = await page.request.get('/api/pengajuan?status=draft');
  expect((await draft.json()).total).toBe(0);
});
