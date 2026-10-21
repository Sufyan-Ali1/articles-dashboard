import { useQuery } from '@tanstack/react-query';
import { api, collectPages } from '@/lib/api';
import { useScope } from '@/hooks/use-private-query';
import { useAuth } from '@/features/auth/auth';
import type {
  Classification,
  ClassificationInput,
  ClassificationKind,
  ListParams,
  Page,
  Resource,
} from '@/types/api';
export const classificationsApi = {
  list: (
    kind: ClassificationKind,
    params: ListParams & { include_inactive?: boolean },
    signal?: AbortSignal,
  ) => api<Page<Classification>>(`/${kind}`, { params, signal }),
  save: (kind: ClassificationKind, body: ClassificationInput, id?: string) =>
    api<Resource<Classification>>(`/${kind}${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      body,
    }),
  delete: (kind: ClassificationKind, id: string) =>
    api<void>(`/${kind}/${id}`, { method: 'DELETE' }),
  activate: (kind: ClassificationKind, id: string, is_active: boolean) =>
    api<Resource<Classification>>(`/${kind}/${id}`, { method: 'PATCH', body: { is_active } }),
};
export function useClassifications(kind: ClassificationKind) {
  const scope = useScope();
  const { user } = useAuth();
  return useQuery({
    queryKey: ['classifications', ...scope, kind, 'all'],
    queryFn: ({ signal }) =>
      collectPages<Classification>(
        `/${kind}`,
        { sort: 'name', ...(user?.role === 'admin' ? { include_inactive: true } : {}) },
        signal,
      ),
  });
}
export function descendants(records: Classification[], id: string): Set<string> {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records)
      if (record.parent_id && result.has(record.parent_id) && !result.has(record.id)) {
        result.add(record.id);
        changed = true;
      }
  }
  return result;
}
export function categoryRows(
  records: Classification[],
  search = '',
): { record: Classification; depth: number }[] {
  const included = new Set<string>();
  const map = new Map(records.map((r) => [r.id, r]));
  for (const row of records)
    if (!search || row.name.toLowerCase().includes(search.toLowerCase())) {
      let current: Classification | undefined = row;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        included.add(current.id);
        current = current.parent_id ? map.get(current.parent_id) : undefined;
      }
    }
  const result: { record: Classification; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (record: Classification, depth: number) => {
    if (seen.has(record.id)) return;
    seen.add(record.id);
    if (included.has(record.id)) result.push({ record, depth });
    records.filter((r) => r.parent_id === record.id).forEach((r) => visit(r, depth + 1));
  };
  records.filter((r) => !r.parent_id || !map.has(r.parent_id)).forEach((r) => visit(r, 0));
  records.filter((r) => !seen.has(r.id)).forEach((r) => visit(r, 0));
  return result;
}
