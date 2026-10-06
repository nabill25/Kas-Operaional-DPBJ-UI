import { useEffect, useState } from 'react';

export function useDebounce<T>(nilai: T, jeda = 350): T {
  const [v, setV] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setV(nilai), jeda);
    return () => clearTimeout(t);
  }, [nilai, jeda]);
  return v;
}
