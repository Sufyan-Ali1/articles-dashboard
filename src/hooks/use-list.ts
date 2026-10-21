import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
export function useList(defaultSort = '-created_at') {
  const [params, setParams] = useSearchParams();
  const set = (name: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  };
  const page = Math.min(100000, Math.max(1, Math.trunc(Number(params.get('page'))) || 1));
  const pageSize = [10, 20, 50, 100].includes(Number(params.get('page_size')))
    ? Number(params.get('page_size'))
    : 20;
  return {
    params,
    set,
    page,
    pageSize,
    search: params.get('search') ?? '',
    sort: params.get('sort') ?? defaultSort,
    base: {
      page,
      page_size: pageSize,
      sort: params.get('sort') ?? defaultSort,
      search: params.get('search') || undefined,
    },
  };
}
export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
