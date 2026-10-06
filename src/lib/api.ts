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

/** Unggah berkas dengan progres (XHR, karena fetch belum mendukung progres upload). */
export function unggahBerkas(
  pengajuanId: number,
  data: { file: File; jenis: string; nama_berkas?: string },
  onProgres?: (persen: number) => void,
): { hasil: Promise<PengajuanDetail>; batal: () => void } {
  const xhr = new XMLHttpRequest();
  const hasil = new Promise<PengajuanDetail>((resolve, reject) => {
    const form = new FormData();
    form.append('jenis', data.jenis);
    if (data.nama_berkas) form.append('nama_berkas', data.nama_berkas);
    form.append('file', data.file);

    xhr.open('POST', `/api/pengajuan/${pengajuanId}/berkas`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgres?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgres?.(100);
        resolve(body as PengajuanDetail);
        return;
      }
      if (xhr.status === 401) saatTidakTerotorisasi?.();
      const b = (body && typeof body === 'object' ? body : null) as Partial<ApiErrorBody> | null;
      reject(new ApiError(xhr.status, pesanGagal(xhr.status, b), b?.errors));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Unggahan gagal: koneksi ke server terputus'));
    xhr.onabort = () => reject(new ApiError(0, 'Unggahan dibatalkan'));
    xhr.send(form);
  });
  return { hasil, batal: () => xhr.abort() };
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
