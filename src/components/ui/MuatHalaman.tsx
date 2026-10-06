import { Skeleton } from './Kosong';

/** Kerangka pemuatan halaman (dipakai saat halaman lazy dimuat). */
export function MuatHalaman() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  );
}
