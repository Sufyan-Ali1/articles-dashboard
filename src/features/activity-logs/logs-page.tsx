import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, History } from 'lucide-react';
import { api, collectPages } from '@/lib/api';
import { useList } from '@/hooks/use-list';
import { useScope } from '@/hooks/use-private-query';
import { dateTime } from '@/lib/utils';
import type { ActivityLog, Page, Resource, User } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  Table,
} from '@/components/shared';
export function safeLogDetails(details: Record<string, unknown> | null): Record<string, unknown> {
  const allowed = ['changed_fields', 'old_status', 'new_status'];
  return Object.fromEntries(
    Object.entries(details ?? {})
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => [
        key,
        key === 'changed_fields' && Array.isArray(value)
          ? value.filter((item) => typeof item === 'string' && !/hash|token|secret/i.test(item))
          : typeof value === 'string'
            ? value
            : null,
      ]),
  );
}
export default function LogsPage() {
  const list = useList();
  const scope = useScope();
  const [detail, setDetail] = useState<string | null>(null);
  const params = {
    page: list.page,
    page_size: list.pageSize,
    sort: list.sort,
    user_id: list.params.get('user_id') || undefined,
    entity_type: list.params.get('entity_type') || undefined,
    entity_id: list.params.get('entity_id') || undefined,
  };
  const query = useQuery({
    queryKey: ['logs', ...scope, params],
    queryFn: ({ signal }) => api<Page<ActivityLog>>('/admin-logs', { params, signal }),
  });
  const users = useQuery({
    queryKey: ['users', ...scope, 'all'],
    queryFn: ({ signal }) => collectPages<User>('/users', { sort: 'name' }, signal),
  });
  const selected = useQuery({
    queryKey: ['logs', ...scope, 'detail', detail],
    queryFn: ({ signal }) => api<Resource<ActivityLog>>(`/admin-logs/${detail}`, { signal }),
    enabled: !!detail,
  });
  const username = (id: string | null) =>
    users.data?.find((user) => user.id === id)?.name ?? id ?? 'System / deleted user';
  return (
    <>
      <PageHeader
        title="Activity logs"
        description="A clear record of the changes made across your workspace."
        eyebrow="Administration"
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <Select
            aria-label="Filter by user"
            className="w-full sm:w-52"
            value={params.user_id ?? ''}
            onChange={(event) => list.set('user_id', event.target.value)}
          >
            <option value="">All team members</option>
            {users.data?.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by entity type"
            className="w-full sm:w-44"
            value={params.entity_type ?? ''}
            onChange={(event) => list.set('entity_type', event.target.value)}
          >
            <option value="">All entities</option>
            {['article', 'article_request', 'user', 'categories', 'tags', 'article_types'].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ),
            )}
          </Select>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              list.set(
                'entity_id',
                String(new FormData(event.currentTarget).get('entity_id') ?? '').trim(),
              );
            }}
          >
            <Input
              key={params.entity_id ?? 'empty'}
              name="entity_id"
              className="w-full sm:w-72"
              aria-label="Filter by entity UUID"
              placeholder="Entity UUID (exact match)"
              defaultValue={params.entity_id ?? ''}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              title="Enter a complete UUID or leave blank."
            />
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          <Select
            aria-label="Sort audit logs"
            className="w-full sm:w-44"
            value={list.sort}
            onChange={(event) => list.set('sort', event.target.value)}
          >
            <option value="-created_at">Newest first</option>
            <option value="created_at">Oldest first</option>
            <option value="action">Action A–Z</option>
            <option value="entity_type">Entity type</option>
          </Select>
        </div>
        {users.error && (
          <p role="status" className="px-5 pt-3 text-xs text-muted-foreground">
            User names could not load. Audit entries show user IDs.
          </p>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <div className="p-5">
            <ErrorState error={query.error} retry={() => void query.refetch()} />
          </div>
        ) : !query.data.data.length ? (
          <EmptyState
            title="No activity found"
            description="Changes made by your team will be recorded here."
          />
        ) : (
          <>
            <Table
              label="Activity logs"
              headings={['Action', 'User', 'Entity', 'Timestamp', 'Details']}
            >
              {query.data.data.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <History className="size-3.5 text-muted-foreground" />
                      {log.action}
                    </span>
                  </td>
                  <td className="max-w-56 break-all px-5 py-4 text-xs">{username(log.user_id)}</td>
                  <td className="px-5 py-4">
                    <Badge>{log.entity_type.replaceAll('_', ' ')}</Badge>
                    <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                      {log.entity_id ?? '—'}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                    {dateTime(log.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View log ${log.id}`}
                      onClick={() => setDetail(log.id)}
                    >
                      <Eye />
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {query.data && !query.error && <Pagination meta={query.data.meta} set={list.set} />}
      </Card>
      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title="Activity details"
        description="Safe audit metadata returned by the backend."
      >
        {selected.isPending ? (
          <Loading rows={3} />
        ) : selected.error ? (
          <ErrorState error={selected.error} retry={() => void selected.refetch()} />
        ) : (
          selected.data && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Action</p>
                <p className="mt-1 font-mono">{selected.data.data.action}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">User</p>
                <p className="mt-1 break-all">{username(selected.data.data.user_id)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timestamp</p>
                <p className="mt-1">{dateTime(selected.data.data.created_at)}</p>
              </div>
              <pre className="overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-6">
                {JSON.stringify(safeLogDetails(selected.data.data.details), null, 2)}
              </pre>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
