import type { Hasil } from '../shared/validation';

/** Error dengan status HTTP; ditangani error handler di app.ts → JSON { message, errors? }. */
export class HttpError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (message: string, errors?: Record<string, string>) =>
  new HttpError(400, message, errors);
export const unauthorized = (message = 'Sesi Anda berakhir, silakan masuk kembali') =>
  new HttpError(401, message);
export const forbidden = (message = 'Anda tidak memiliki akses untuk aksi ini') =>
  new HttpError(403, message);
export const notFound = (message = 'Data tidak ditemukan') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Ambil data hasil validasi atau lempar 400 dengan detail error per field. */
export function assertValid<T>(hasil: Hasil<T>): T {
  if (!hasil.ok) throw badRequest('Data belum valid, periksa kembali isian Anda', hasil.errors);
  return hasil.data;
}

/** Parse parameter id numerik; id tidak valid diperlakukan sebagai "tidak ditemukan". */
export function parseId(v: unknown, label = 'Data'): number {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw notFound(`${label} tidak ditemukan`);
  return n;
}

/** Ambil query string tunggal (Express bisa memberi array bila parameter diulang). */
export function q(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0].trim() : '';
  return typeof v === 'string' ? v.trim() : '';
}
