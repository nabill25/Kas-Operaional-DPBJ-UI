import { expect, keluarAPI, masukAPI, pilihPegawai, test, unggahBerkas } from './fixtures';

const TAHUN = new Date().getFullYear();

test('admin menambah jenis pengajuan baru (Kontrak Borongan, model Umum) → operator membuat pengajuannya', async ({ page }) => {
  await masukAPI(page, 'admin');
  await page.goto('/master/jenis-pengajuan');
  await expect(page.getByRole('heading', { name: 'Master Jenis Pengajuan' })).toBeVisible();
  for (const kode of ['konsumsi', 'rumah_tangga', 'perjadin']) await expect(page.locator(`[data-jenis-pengajuan="${kode}"]`)).toBeVisible();
  await expect(page.locator('[data-jenis-pengajuan="konsumsi"]')).toContainText('KSM-YYYY-NNNN');
  await expect(page.locator('[data-jenis-pengajuan="konsumsi"]')).toContainText('1. Notula');

  await page.getByRole('button', { name: 'Tambah Jenis Pengajuan' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nama jenis pengajuan' }).fill('Kontrak Borongan');
  await dialog.getByRole('textbox', { name: 'Nama singkat' }).fill('Borongan');
  await dialog.locator('#jp-prefix').fill('kbr');
  await expect(dialog.locator('#jp-prefix')).toHaveValue('KBR');
  await dialog.locator('#jp-deskripsi').fill('Honor pegawai kontrak borongan per periode');
  await expect(dialog.getByRole('radio', { name: /Umum \(pegawai \+ nilai per orang\)/ })).toBeChecked();
  await dialog.locator('#jp-maks').fill('3');
  for (const nama of ['Laporan Pekerjaan', 'Presensi', 'Kontrak']) {
    await dialog.getByLabel('Pilih jenis berkas').selectOption({ label: nama });
    await dialog.getByRole('button', { name: 'Tambah berkas wajib' }).click();
  }
  await dialog.getByRole('button', { name: 'Naikkan Kontrak' }).click();
  await expect(dialog.getByRole('list', { name: 'Berkas wajib terpilih' }).getByRole('listitem')).toHaveText([
    /Laporan Pekerjaan/,
    /Kontrak/,
    /Presensi/,
  ]);
  await dialog.locator('#jp-kata-kunci').fill('tenaga lepas');
  await dialog.getByTitle('Ungu').click();
  await expect(dialog.getByRole('radio', { name: 'Ungu' })).toBeChecked();
  await dialog.locator('label:has(input[name="ikon"][value="hard-hat"])').click();
  await expect(dialog.getByRole('radio', { name: 'Ikon hard-hat' })).toBeChecked();
  // Memilih warna/ikon tidak menggeser panel dialog (judul tetap terlihat, tanpa ruang kosong di bawah).
  expect(await dialog.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(dialog.getByRole('heading', { name: 'Tambah jenis pengajuan' })).toBeInViewport();
  await expect(dialog.getByTestId('pratinjau-jenis')).toHaveText('Borongan');
  await dialog.getByRole('button', { name: 'Tambah jenis pengajuan' }).click();
  await expect(dialog).toBeHidden();
  const kartu = page.locator('[data-jenis-pengajuan="kontrak_borongan"]');
  await expect(kartu).toContainText('Kontrak Borongan');
  await expect(kartu).toContainText('KBR-YYYY-NNNN');
  await expect(kartu).toContainText('Maks. 3 orang');
  await expect(kartu.getByRole('list', { name: 'Berkas wajib Kontrak Borongan' }).getByRole('listitem')).toHaveText([
    '1. Laporan Pekerjaan',
    '2. Kontrak',
    '3. Presensi',
  ]);

  // Operator: jenis baru muncul di Buat Pengajuan dengan form model Umum.
  await keluarAPI(page);
  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  const pilih = page.getByRole('button', { name: 'Pilih Kontrak Borongan' });
  await expect(pilih).toContainText('Maks. 3 orang per pengajuan');
  await expect(pilih).toContainText('Presensi');
  await pilih.click();
  await expect(page.getByRole('heading', { name: 'Pengajuan Kontrak Borongan' })).toBeVisible();
  await expect(page.locator('#lokasi_tujuan')).toHaveCount(0);
  await page.getByLabel('Nama kegiatan').fill('Honor Borongan September');
  await page.locator('#tanggal_kegiatan').fill(`${TAHUN}-09-01`);
  await page.locator('#tanggal_selesai').fill(`${TAHUN}-09-30`);
  await expect(page.getByText('Periode 30 hari')).toBeVisible();
  await page.getByRole('radio', { name: 'LS' }).click();
  await pilihPegawai(page, 'peserta-0-pegawai_id', 'Ahmad Fauzan');
  await page.locator('#peserta-0-nilai').fill('2500000');
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await pilihPegawai(page, 'peserta-1-pegawai_id', 'Bambang Sutrisno');
  await page.locator('#peserta-1-nilai').fill('1500000');
  await page.getByRole('button', { name: 'Tambah orang' }).click();
  await expect(page.getByRole('button', { name: 'Maksimal 3 orang' })).toBeDisabled();
  await page.getByRole('button', { name: 'Hapus orang 3' }).click();
  await page.getByRole('button', { name: 'Simpan draft' }).click();

  await expect(page).toHaveURL(/\/pengajuan\/\d+$/);
  await expect(page.getByText(new RegExp(`^KBR-${TAHUN}-0001$`)).first()).toBeVisible();
  await expect(page.getByText('Rp 4.000.000').first()).toBeVisible();
  const baris = page.getByRole('list', { name: 'Kelengkapan berkas' }).locator('[data-berkas]');
  await expect(baris).toHaveCount(3);
  await expect(baris.nth(0)).toHaveAttribute('data-berkas', 'laporan_pekerjaan');
  await expect(baris.nth(1)).toHaveAttribute('data-berkas', 'kontrak');
  await expect(baris.nth(2)).toHaveAttribute('data-berkas', 'presensi');
  await unggahBerkas(page, 'presensi');

  // Daftar: 4 jenis → filter kategori berupa dropdown.
  await page.goto('/pengajuan');
  await page.getByLabel('Kategori').selectOption('kontrak_borongan');
  await expect(page).toHaveURL(/kategori=kontrak_borongan/);
  await expect(page.getByText('Honor Borongan September').first()).toBeVisible();
});

test('rekening pegawai mengisi otomatis rekening "uang siapa" & bisa dicatat dari halaman Pegawai', async ({ page }) => {
  await masukAPI(page, 'operator');
  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Konsumsi' }).click();
  const bank = page.locator('#rekening_bank');
  const nomor = page.locator('#rekening_nomor');
  const sumber = page.getByTestId('sumber-rekening');

  await pilihPegawai(page, 'uang_siapa_id', 'Nurul Hidayah');
  await expect(bank).toHaveValue('Bank Mandiri');
  await expect(nomor).toHaveValue('1570001234561');
  await expect(sumber).toContainText('diisi otomatis dari data pegawai');
  // Ganti pemilik uang → rekening otomatis ikut berganti.
  await pilihPegawai(page, 'uang_siapa_id', 'Fitri Handayani');
  await expect(bank).toHaveValue('BNI');
  await expect(nomor).toHaveValue('0123456789');
  // Diubah manual → tidak ditimpa saat pemilik uang diganti ke pegawai tanpa rekening.
  await nomor.fill('0123456780');
  await expect(page.getByRole('button', { name: /Pakai rekening data pegawai: BNI 0123456789/ })).toBeVisible();
  await pilihPegawai(page, 'uang_siapa_id', 'Ahmad Fauzan');
  await expect(nomor).toHaveValue('0123456780');
  await expect(sumber).toContainText('belum tercatat di master Pegawai');

  // Catat rekening Ahmad Fauzan dari halaman Pegawai.
  await page.goto('/pegawai');
  await page.getByRole('button', { name: 'Aksi untuk Ahmad Fauzan' }).click();
  await page.getByRole('menuitem', { name: 'Ubah data' }).click();
  await page.locator('#pg-rekening-bank').fill('BRI');
  await page.locator('#pg-rekening-nomor').fill('0341 0100 0999 307');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const kartu = page.getByRole('listitem').filter({ hasText: 'Ahmad Fauzan' });
  await expect(kartu.getByTestId('rekening-pegawai')).toHaveText('BRI · 034101000999307');

  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Konsumsi' }).click();
  await pilihPegawai(page, 'uang_siapa_id', 'Ahmad Fauzan');
  await expect(bank).toHaveValue('BRI');
  await expect(nomor).toHaveValue('034101000999307');
});

test('admin: master Bank menjadi saran isian rekening; master Project & Task muncul di kotak cari PUM', async ({ page }) => {
  await masukAPI(page, 'admin');
  await page.goto('/master/bank');
  await expect(page.getByRole('heading', { name: 'Master Bank' })).toBeVisible();
  await page.getByRole('button', { name: 'Tambah Bank' }).click();
  await page.getByRole('dialog').locator('#bank-nama').fill('Bank Nagari');
  await page.getByRole('dialog').getByRole('button', { name: 'Tambah bank' }).click();
  await expect(page.locator('[data-bank="Bank Nagari"]')).toBeVisible();

  await page.goto('/pengajuan/baru');
  await page.getByRole('button', { name: 'Pilih Konsumsi' }).click();
  await expect(page.locator('#saran-bank option[value="Bank Nagari"]')).toHaveCount(1);
  await expect(page.locator('#saran-bank option[value="Bank Mandiri"]')).toHaveCount(1);

  // Project & Task: tambah task, lalu project yang memakai task itu.
  await page.goto('/master/project-task?tab=task');
  await page.getByRole('button', { name: 'Tambah Task' }).click();
  await page.locator('#tk-kode').fill('721999');
  await page.locator('#tk-nama').fill('Honor Kontrak Borongan');
  await expect(page.getByRole('dialog')).toContainText('721999_Honor Kontrak Borongan');
  await page.getByRole('dialog').getByRole('button', { name: 'Tambah task' }).click();
  await expect(page.locator('[data-task="721999"]')).toBeVisible();

  await page.getByRole('radio', { name: /Project Costing/ }).click();
  await page.getByRole('button', { name: 'Tambah Project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#pr-kode').fill('D0099.01.01.6.001');
  await dialog.locator('#pr-nama').fill('Kontrak Borongan Kantor');
  await dialog.getByPlaceholder('Cari kode atau nama task…').fill('721999');
  await dialog.getByRole('checkbox', { name: /Honor Kontrak Borongan/ }).check();
  await expect(dialog).toContainText('1 dipilih');
  await dialog.getByRole('button', { name: 'Tambah project' }).click();
  await expect(page.locator('[data-project="D0099.01.01.6.001"]')).toContainText('Honor Kontrak Borongan');

  // PUM: project baru ada di kotak cari & task-nya otomatis terisi bila hanya satu pilihan cocok.
  await keluarAPI(page);
  await masukAPI(page, 'pum');
  const r = await page.request.get('/api/pengajuan?status=diverifikasi_pum&limit=1');
  const id = (await r.json()).data[0].id as number;
  await page.goto(`/pengajuan/${id}`);
  await page.getByRole('button', { name: 'Aksi PUM' }).click();
  await page.getByRole('menuitem', { name: 'Ubah project costing / task name' }).click();
  await page.getByRole('combobox', { name: 'Project Costing' }).click();
  await page.getByRole('textbox', { name: 'Cari project' }).fill('D0099');
  await page.getByRole('option', { name: /Kontrak Borongan Kantor/ }).click();
  await expect(page.getByRole('combobox', { name: 'Project Costing' })).toContainText('Kontrak Borongan Kantor');
  await page.getByRole('combobox', { name: 'Task Name' }).click();
  await expect(page.getByRole('option', { name: /721999/ })).toBeVisible();
});

test('menu & halaman Master Data (selain Pegawai) hanya untuk admin', async ({ page }) => {
  await masukAPI(page, 'pum');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(nav.getByRole('link', { name: 'Pegawai' })).toBeVisible();
  for (const nama of ['Jenis Pengajuan', 'Jenis Berkas', 'Project & Task', 'Bank']) {
    await expect(nav.getByRole('link', { name: nama })).toHaveCount(0);
  }
  await page.goto('/master/jenis-pengajuan');
  await expect(page.getByText(/tidak memiliki akses/i).first()).toBeVisible();

  await keluarAPI(page);
  await masukAPI(page, 'admin');
  await page.goto('/');
  for (const nama of ['Jenis Pengajuan', 'Jenis Berkas', 'Project & Task', 'Bank']) {
    await expect(nav.getByRole('link', { name: nama })).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Jenis Berkas' }).click();
  await expect(page.getByRole('heading', { name: 'Master Jenis Berkas' })).toBeVisible();
  await expect(page.locator('[data-jenis-berkas="notulen"]')).toContainText('Wajib pada: Konsumsi');
});
