/** Latar "liquid": gumpalan warna lembut yang bergerak perlahan agar efek kaca terlihat hidup. */
export function Latar() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div
        className="absolute -top-[22%] -left-[12%] size-[62vmax] rounded-full animate-blob-1"
        style={{ background: 'radial-gradient(closest-side, var(--blob-a), transparent)' }}
      />
      <div
        className="absolute top-[8%] -right-[18%] size-[58vmax] rounded-full animate-blob-2"
        style={{ background: 'radial-gradient(closest-side, var(--blob-b), transparent)' }}
      />
      <div
        className="absolute -bottom-[28%] left-[18%] size-[64vmax] rounded-full animate-blob-3"
        style={{ background: 'radial-gradient(closest-side, var(--blob-c), transparent)' }}
      />
      <div
        className="absolute inset-0 opacity-50 dark:opacity-30"
        style={{
          backgroundImage: 'radial-gradient(color-mix(in oklab, var(--fg) 9%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 65%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 65%)',
        }}
      />
    </div>
  );
}
