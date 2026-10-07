import type { ApiErrorBody, PengajuanDetail } from '../../shared/types';

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors ?? {};
  }
}

let saatTidakTerotorisasi: (() => void) | null = null;

/** Dipanggil AuthProvider: apa yang dilakukan bila sesi berakhir (401) di tengah pemakaian. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  saatTidakTerotorisasi = fn;
}

function jalurAuthAwal(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/me');
}

function pesanGagal(status: number, body: Partial<ApiErrorBody> | null): string {
  if (body?.message) return body.message;
  if (status >= 500) return 'Tidak dapat terhubung ke server API. Pastikan server berjalan, lalu coba lagi.';
  return `Permintaan gagal (kode ${status})`;
}

export interface OpsiApi {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opsi: OpsiApi = {}): Promise<T> {
  const adaBody = opsi.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opsi.method ?? (adaBody ? 'POST' : 'GET'),
      headers: adaBody ? { 'Content-Type': 'application/json' } : undefined,
      body: adaBody ? JSON.stringify(opsi.body) : undefined,
      credentials: 'same-origin',
      signal: opsi.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan server berjalan.');
  }

  const teks = await res.text();
  let data: unknown = null;
  if (teks) {
    try {
      data = JSON.parse(teks);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const body = (data && typeof data === 'object' ? data : null) as Partial<ApiErrorBody> | null;
    if (res.status === 401 && !jalurAuthAwal(path)) saatTidakTerotorisasi?.();
    throw new ApiError(res.status, pesanGagal(res.status, body), body?.errors);
  }
  return data as T;
}

function pesanUnggahStorage(status: number): string {
  if (status === 413) return 'Ukuran file melebihi batas 10 MB';
  if (status === 400 || status === 415) return 'File ditolak penyimpanan. Pastikan tipe file didukung.';
  return `Unggahan ke penyimpanan gagal (kode ${status || 'jaringan'})`;
}

/**
 * Unggah berkas dengan progres. Tiga langkah:
 * 1) server memvalidasi dan memberi URL unggah bertanda tangan;
 * 2) browser mengirim file langsung ke Supabase Storage (tidak melewati fungsi server);
 * 3) server memeriksa isi file lalu mencatatnya sebagai berkas.
 */
export function unggahBerkas(
  pengajuanId: number,
  data: { file: File; jenis: string; nama_berkas?: string },
  onProgres?: (persen: number) => void,
): { hasil: Promise<PengajuanDetail>; batal: () => void } {
  let xhr: XMLHttpRequest | null = null;
  let dibatalkan = false;

  const hasil = (async () => {
    const siap = await api<{ key: string; url: string; contentType: string }>(
      `/pengajuan/${pengajuanId}/berkas/siapkan`,
      {
        body: { jenis: data.jenis, nama_berkas: data.nama_berkas, nama_asli: data.file.name, ukuran: data.file.size },
      },
    );
    if (dibatalkan) throw new ApiError(0, 'Unggahan dibatalkan');

    await new Promise<void>((resolve, reject) => {
      const req = new XMLHttpRequest();
      xhr = req;
      req.open('PUT', siap.url);
      req.setRequestHeader('Content-Type', siap.contentType);
      req.setRequestHeader('x-upsert', 'false');
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgres?.(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      };
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) resolve();
        else reject(new ApiError(req.status, pesanUnggahStorage(req.status)));
      };
      req.onerror = () => reject(new ApiError(0, 'Unggahan gagal: koneksi ke penyimpanan terputus'));
      req.onabort = () => reject(new ApiError(0, 'Unggahan dibatalkan'));
      req.send(data.file);
    });

    onProgres?.(97);
    const detail = await api<PengajuanDetail>(`/pengajuan/${pengajuanId}/berkas/konfirmasi`, {
      body: { key: siap.key, jenis: data.jenis, nama_berkas: data.nama_berkas, nama_asli: data.file.name },
    });
    onProgres?.(100);
    return detail;
  })();

  return {
    hasil,
    batal: () => {
      dibatalkan = true;
      xhr?.abort();
    },
  };
}

export function urlBerkas(id: number, unduh = false): string {
  return `/api/berkas/${id}/file${unduh ? '?unduh=1' : ''}`;
}

/** Ubah objek filter menjadi query string (nilai kosong diabaikan). */
export function keQuery(obj: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
