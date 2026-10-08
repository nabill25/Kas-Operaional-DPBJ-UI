// Kamus master data (jenis pengajuan & jenis berkas) — dipakai server & client.
// Kode yang tidak dikenal (mis. jenis yang dihapus dari master) tetap punya tampilan cadangan agar halaman tidak rusak.
import {
  JENIS_BERKAS_LAINNYA,
  LABEL_BERKAS_LAINNYA,
  MAX_PESERTA_TRANSPORT,
  MODEL_FORM_INFO,
  modelPeserta,
  type JenisBerkas,
  type Kategori,
} from './constants.js';
import type { JenisBerkasMaster, JenisPengajuan, Konfig } from './types.js';

export function jenisCadangan(kode: Kategori): JenisPengajuan {
  return {
    kode,
    label: kode,
    label_pendek: kode,
    prefix: '',
    deskripsi: null,
    model: 'umum',
    maks_peserta: MAX_PESERTA_TRANSPORT,
    kata_kunci_task: null,
    warna: 'abu',
    ikon: 'file-text',
    aktif: false,
    bawaan: false,
    urutan: 999,
    berkas: [],
  };
}

/** Batas orang per pengajuan untuk jenis bermodel peserta (konsumsi: 0). */
export function maksPeserta(j: JenisPengajuan): number {
  if (!modelPeserta(j.model)) return 0;
  return j.maks_peserta ?? MAX_PESERTA_TRANSPORT;
}

export interface Kamus {
  konfig: Konfig;
  /** Info jenis pengajuan (cadangan bila kode tidak ada di master). */
  jenis: (kode: Kategori) => JenisPengajuan;
  /** Ada di master? */
  dikenal: (kode: Kategori) => boolean;
  /** Label jenis berkas (termasuk "Dokumen Lainnya"). */
  labelBerkas: (kode: JenisBerkas) => string;
  /** Info jenis berkas master (undefined untuk "lainnya" / kode tak dikenal). */
  berkas: (kode: JenisBerkas) => JenisBerkasMaster | undefined;
  /** Jenis pengajuan yang ditampilkan: aktif + nonaktif yang punya data (`adaData`), urut master. */
  jenisTampil: (adaData?: (kode: Kategori) => boolean) => JenisPengajuan[];
  /** Grup model: "Konsumsi" / "Transport" / "Umum". */
  grup: (kode: Kategori) => string;
}

export function buatKamus(konfig: Konfig): Kamus {
  const jp = new Map(konfig.jenisPengajuan.map((j) => [j.kode, j]));
  const jb = new Map(konfig.jenisBerkas.map((b) => [b.kode, b]));
  const urut = [...konfig.jenisPengajuan].sort((a, b) => a.urutan - b.urutan || a.kode.localeCompare(b.kode));
  const jenis = (kode: Kategori) => jp.get(kode) ?? jenisCadangan(kode);
  return {
    konfig,
    jenis,
    dikenal: (kode) => jp.has(kode),
    labelBerkas: (kode) => (kode === JENIS_BERKAS_LAINNYA ? LABEL_BERKAS_LAINNYA : (jb.get(kode)?.label ?? kode)),
    berkas: (kode) => jb.get(kode),
    jenisTampil: (adaData) => urut.filter((j) => j.aktif || (adaData?.(j.kode) ?? false)),
    grup: (kode) => MODEL_FORM_INFO[jenis(kode).model].grup,
  };
}

/** Kode unik dari label (huruf kecil, garis bawah), mis. "Kontrak Borongan" → "kontrak_borongan". */
export function kodeDariLabel(label: string, sudahAda: Iterable<string> = []): string {
  const dasar =
    label
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^[^a-z]+/, '')
      .slice(0, 36)
      .replace(/_+$/g, '') || 'jenis';
  const terpakai = new Set(sudahAda);
  terpakai.add(JENIS_BERKAS_LAINNYA);
  let kode = dasar.length >= 2 ? dasar : `${dasar}_x`;
  for (let i = 2; terpakai.has(kode); i++) kode = `${dasar.slice(0, 36)}_${i}`;
  return kode;
}
