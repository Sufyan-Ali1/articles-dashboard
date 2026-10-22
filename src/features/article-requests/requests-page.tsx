import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, MessageSquare, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { useList } from '@/hooks/use-list';
import { requestsApi } from './api';
import { api } from '@/lib/api';
import { date, dateTime, nullable } from '@/lib/utils';
import type { ArticleRequest, RequestStatus, Resource, User } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import {
  Card,
  TableCard,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormActions,
  Loading,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
} from '@/components/shared';
const statuses = ['pending', 'accepted', 'rejected', 'completed'] as const;
export const requestReviewSchema = z.object({
  status: z.enum(statuses),
  admin_notes: z
    .string()
    .trim()
    .max(10000)
    .refine((value) => !/<\s*\/?[a-zA-Z!]/.test(value), 'Notes must be plain text, without HTML.'),
});
export default function RequestsPage() {
  const list = useList();
  const scope = useScope();
  const { user } = useAuth();
  const client = useQueryClient();
  const status = list.params.get('status');
  const params = {
    ...list.base,
    status: statuses.includes(status as RequestStatus) ? (status as RequestStatus) : undefined,
  };
  const query = useQuery({
    queryKey: ['requests', ...scope, params],
    queryFn: ({ signal }) => requestsApi.list(params, signal),
  });
  return (
    <>
      <PageHeader
        title="Article requests"
        description="Good ideas can come from anywhere. Find your next story here."
        eyebrow="Reader ideas"
      />
      <TableCard>
        <div className="table-controls">
          <div className="flex flex-wrap gap-3 border-b p-4">
            <SearchInput
              placeholder="Search requested topics…"
              value={list.search}
              onChange={(value) => list.set('search', value)}
            />
            <Select
              aria-label="Request status"
              className="w-full sm:w-40"
              value={status ?? ''}
              onChange={(event) => list.set('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Sort requests"
              className="w-full sm:w-44"
              value={list.sort}
              onChange={(event) => list.set('sort', event.target.value)}
            >
              <option value="-created_at">Newest first</option>
              <option value="created_at">Oldest first</option>
              <option value="-updated_at">Recently updated</option>
              <option value="topic">Topic A–Z</option>
              <option value="status">Status</option>
            </Select>
          </div>
        </div>
        <div className="table-content">
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <div className="p-5">
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            </div>
          ) : !query.data.data.length ? (
            <EmptyState
              title="No requests found"
              description="Reader-submitted topics will appear here. Try changing your filters."
            />
          ) : (
            <>
              <Table
                label="Article requests"
                headings={['Topic', 'Submitted by', 'Status', 'Received', 'Actions']}
              >
                {query.data.data.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/30">
                    <td className="max-w-lg px-5 py-4">
                      <Link
                        to={`/article-requests/${request.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {request.topic}
                      </Link>
                      {request.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {request.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs">{request.name ?? 'Anonymous reader'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.email ?? 'No email provided'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {date(request.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/article-requests/${request.id}`}>
                            Review
                            <ArrowUpRight />
                          </Link>
                        </Button>
                        {user?.role === 'admin' && (
                          <ConfirmDialog
                            title="Delete request?"
                            description="This request and its review notes will be permanently deleted."
                            onConfirm={async () => {
                              await requestsApi.delete(request.id);
                              await Promise.all([
                                client.invalidateQueries({ queryKey: ['requests'] }),
                                client.invalidateQueries({ queryKey: ['dashboard'] }),
                                client.invalidateQueries({ queryKey: ['logs'] }),
                              ]);
                              toast.success('Request deleted.');
                            }}
                          >
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete request ${request.topic}`}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
        {query.data && !query.error && <Pagination meta={query.data.meta} set={list.set} />}
      </TableCard>
    </>
  );
}
function ReviewForm({ request }: { request: ArticleRequest }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const scope = useScope();
  const form = useForm<z.infer<typeof requestReviewSchema>>({
    resolver: zodResolver(requestReviewSchema),
    defaultValues: { status: request.status, admin_notes: request.admin_notes ?? '' },
  });
  const reviewer = useQuery({
    queryKey: ['users', ...scope, request.reviewed_by],
    queryFn: ({ signal }) => api<Resource<User>>(`/users/${request.reviewed_by}`, { signal }),
    enabled: !!request.reviewed_by && user?.role === 'admin' && request.reviewed_by !== user.id,
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof requestReviewSchema>) =>
      requestsApi.update(request.id, {
        status: values.status,
        admin_notes: nullable(values.admin_notes),
      }),
    onSuccess: async (result) => {
      form.reset({ status: result.data.status, admin_notes: result.data.admin_notes ?? '' });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['requests'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['logs'] }),
      ]);
      toast.success('Review saved.');
    },
  });
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-xs font-medium text-primary">
          <MessageSquare className="size-4" />
          Reader suggestion
        </div>
        <h2 className="text-2xl font-semibold leading-snug tracking-tight">{request.topic}</h2>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
          {request.description || 'No additional description provided.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-8 border-t pt-5 text-xs">
          <div>
            <p className="mb-1 text-muted-foreground">Submitted by</p>
            <p className="flex items-center gap-1.5">
              <UserRound className="size-3.5" />
              {request.name ?? 'Anonymous reader'}
            </p>
            {request.email && <p className="mt-1 text-muted-foreground">{request.email}</p>}
          </div>
          <div>
            <p className="mb-1 text-muted-foreground">Received</p>
            <p>{dateTime(request.created_at)}</p>
          </div>
        </div>
        <div className="mt-6">
          <Notice>
            Submissions are immutable. Reviewing a request does not generate or publish an article.
          </Notice>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-5 font-semibold">Editorial review</h2>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            label="Status"
            htmlFor="review-status"
            error={form.formState.errors.status?.message}
          >
            <Select id="review-status" {...form.register('status')}>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Admin notes"
            htmlFor="admin-notes"
            hint="Private notes. Plain text only; up to 10,000 characters."
            error={form.formState.errors.admin_notes?.message}
          >
            <Textarea
              id="admin-notes"
              className="min-h-48"
              placeholder="Add context for your editorial team…"
              {...form.register('admin_notes')}
            />
          </Field>
          {mutation.error && <ErrorState compact error={mutation.error} />}
          <FormActions
            pending={mutation.isPending}
            onCancel={() => form.reset()}
            label="Save review"
          />
        </form>
        <dl className="mt-5 space-y-3 border-t pt-5 text-xs">
          <div>
            <dt className="text-muted-foreground">Reviewer</dt>
            <dd className="mt-1 break-all">
              {request.reviewed_by === user?.id
                ? user.name
                : (reviewer.data?.data.name ?? request.reviewed_by ?? 'Not reviewed')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="mt-1">{dateTime(request.updated_at)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
export function RequestDetailPage() {
  const { id } = useParams();
  const scope = useScope();
  const query = useQuery({
    queryKey: ['requests', ...scope, 'detail', id],
    queryFn: ({ signal }) => requestsApi.detail(id!, signal),
    refetchOnWindowFocus: false,
  });
  return (
    <>
      <PageHeader
        title="Request details"
        description="Turn a reader’s curiosity into your next editorial decision."
      >
        <Button variant="outline" asChild>
          <Link to="/article-requests">
            <ArrowLeft />
            All requests
          </Link>
        </Button>
      </PageHeader>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ReviewForm key={query.data.data.updated_at} request={query.data.data} />
      )}
    </>
  );
}
