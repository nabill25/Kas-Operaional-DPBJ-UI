/**
 * Baca environment variable secara toleran terhadap kesalahan umum saat mengisi dashboard Vercel:
 * nama tidak peka huruf besar/kecil (mis. "supabase_service_role_key"), serta spasi/kutip di tepi nilai dibuang.
 * Nama pertama yang berisi nilai yang dipakai.
 */
export function bacaEnv(env: NodeJS.ProcessEnv, ...nama: string[]): string | undefined {
  for (const n of nama) {
    const kunci = n in env ? n : Object.keys(env).find((k) => k.toUpperCase() === n.toUpperCase());
    const nilai = kunci === undefined ? undefined : env[kunci];
    const bersih = nilai
      ?.trim()
      .replace(/^(["'])([\s\S]*)\1$/, '$2')
      .trim();
    if (bersih) return bersih;
  }
  return undefined;
}

/** Isi payload JWT (tanpa verifikasi tanda tangan) — hanya untuk memeriksa jenis kunci Supabase. */
export function payloadJwt(token: string): Record<string, unknown> | null {
  const bagian = token.split('.');
  if (bagian.length !== 3) return null;
  try {
    const isi = JSON.parse(Buffer.from(bagian[1], 'base64url').toString('utf8')) as unknown;
    return isi && typeof isi === 'object' ? (isi as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
