import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Archive,
  CheckCheck,
  Eye,
  Feather,
  FileText,
  FolderTree,
  Inbox,
  Plus,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { canReview } from '@/lib/permissions';
import { collectPages } from '@/lib/api';
import { date, number } from '@/lib/utils';
import { articlesApi } from '@/features/articles/api';
import { requestsApi } from '@/features/article-requests/api';
import type { ArticleSummary, ArticleStatus } from '@/types/api';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Loading, PageHeader, Table } from '@/components/shared';
export default function DashboardPage() {
  const { user } = useAuth();
  const scope = useScope();
  const client = useQueryClient();
  const reviewer = canReview(user?.role);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const metrics = [
    {
      key: 'total',
      label: 'Total articles',
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-500/8',
      caption: 'Your content library',
      params: {},
    },
    {
      key: 'published',
      label: 'Published',
      icon: CheckCheck,
      color: 'text-emerald-600 bg-emerald-500/8',
      caption: 'Live and ready to read',
      params: { status: 'published' as ArticleStatus },
    },
    {
      key: 'draft',
      label: 'Drafts',
      icon: Feather,
      color: 'text-amber-600 bg-amber-500/8',
      caption: 'Stories in the making',
      params: { status: 'draft' as ArticleStatus },
    },
    {
      key: 'archived',
      label: 'Archived',
      icon: Archive,
      color: 'text-slate-500 bg-slate-500/8',
      caption: 'Safely set aside',
      params: { status: 'archived' as ArticleStatus },
    },
    {
      key: 'featured',
      label: 'Featured articles',
      icon: Star,
      color: 'text-amber-600 bg-amber-500/8',
      caption: 'Selected editorial highlights',
      params: { is_featured: true },
    },
  ];
  const counts = useQueries({
    queries: metrics.map((metric) => ({
      queryKey: ['dashboard', ...scope, 'count', metric.key],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        articlesApi.list({ ...metric.params, page_size: 1 }, signal),
      select: (response: Awaited<ReturnType<typeof articlesApi.list>>) => response.meta.total,
    })),
  });
  const views = useQuery({
    queryKey: ['dashboard', ...scope, 'views'],
    queryFn: async ({ signal }) => {
      setProgress({ loaded: 0, total: 0 });
      const articles = await collectPages<ArticleSummary>(
        '/admin/articles',
        { sort: 'created_at' },
        signal,
        (loaded, total) => setProgress({ loaded, total }),
      );
      return articles.reduce((sum, article) => sum + article.view_count, 0);
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const pending = useQuery({
    queryKey: ['dashboard', ...scope, 'pending'],
    queryFn: ({ signal }) => requestsApi.list({ status: 'pending', page_size: 1 }, signal),
    enabled: reviewer,
  });
  const recent = useQuery({
    queryKey: ['dashboard', ...scope, 'recent-articles'],
    queryFn: ({ signal }) => articlesApi.list({ page_size: 5, sort: '-created_at' }, signal),
  });
  const requests = useQuery({
    queryKey: ['dashboard', ...scope, 'recent-requests'],
    queryFn: ({ signal }) => requestsApi.list({ page_size: 4, sort: '-created_at' }, signal),
    enabled: reviewer,
  });
  return (
    <>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description={
          user?.role === 'author'
            ? 'Your ideas, your stories. Here’s how your articles are coming along.'
            : 'A fresh perspective on your publication. Here’s what’s happening.'
        }
        eyebrow="Workspace overview"
      >
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh dashboard"
          onClick={() => void client.invalidateQueries({ queryKey: ['dashboard'] })}
        >
          <RefreshCw />
        </Button>
        <Button asChild>
          <Link to="/articles/new">
            <Plus />
            Create article
          </Link>
        </Button>
      </PageHeader>
      {user?.role === 'author' && (
        <p className="mb-4 text-xs font-medium text-muted-foreground">
          All article metrics below are scoped to your own articles.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.slice(0, 4).map((metric, index) => (
          <Card key={metric.key} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <span className={`rounded-lg p-2 ${metric.color}`}>
                <metric.icon className="size-4" />
              </span>
            </div>
            <div className="mt-3">
              {counts[index].isPending ? (
                <div className="h-9 w-20 animate-pulse rounded bg-muted" />
              ) : counts[index].error ? (
                <span className="text-sm text-destructive">Unavailable</span>
              ) : (
                <p className="text-[30px] font-semibold leading-9 tracking-tight tabular-nums">
                  {number(counts[index].data ?? 0)}
                </p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{metric.caption}</p>
          </Card>
        ))}
      </div>
      <div className={`mt-4 grid gap-4 ${reviewer ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-lg bg-blue-500/8 p-2.5 text-blue-600">
            <Eye className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Total views</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {views.isPending ? (
                <span className="text-xs font-normal text-muted-foreground">
                  Calculating
                  {progress.total ? ` · ${progress.loaded}/${progress.total} articles` : '…'}
                </span>
              ) : views.error ? (
                <span className="text-sm font-normal text-destructive">Unavailable</span>
              ) : (
                number(views.data)
              )}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Raw API requests · snapshot</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-lg bg-amber-500/8 p-2.5 text-amber-600">
            <Star className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Featured articles</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {counts[4].isPending
                ? '…'
                : counts[4].error
                  ? 'Unavailable'
                  : number(counts[4].data ?? 0)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Across all editorial statuses</p>
          </div>
        </Card>
        {reviewer && (
          <Card className="flex items-center gap-4 p-5">
            <span className="rounded-lg bg-violet-500/8 p-2.5 text-violet-600">
              <Inbox className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {pending.isPending
                  ? '…'
                  : pending.error
                    ? 'Unavailable'
                    : number(pending.data.meta.total)}
              </p>
              <Link
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                to="/article-requests?status=pending"
              >
                Ready for your review
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </Card>
        )}
      </div>
      {(views.error || pending.error || counts.some((count) => count.error)) && (
        <div className="mt-4">
          <ErrorState
            compact
            error={views.error ?? pending.error ?? counts.find((count) => count.error)?.error}
            retry={() => void client.invalidateQueries({ queryKey: ['dashboard'] })}
          />
        </div>
      )}
      <div
        className={`mt-7 grid items-start gap-6 ${reviewer ? '2xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]' : ''}`}
      >
        <Card>
          <div className="flex items-center justify-between gap-3 border-b px-5 py-5">
            <div>
              <h2 className="text-sm font-semibold">Recent articles</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                The latest additions to your publication
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/articles">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {recent.isPending ? (
            <Loading />
          ) : recent.error ? (
            <div className="p-5">
              <ErrorState error={recent.error} retry={() => void recent.refetch()} />
            </div>
          ) : !recent.data.data.length ? (
            <EmptyState
              title="Your next chapter starts here"
              description="Write your first article and begin building your publication."
            >
              <Button asChild>
                <Link to="/articles/new">
                  <Plus />
                  Create article
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <Table label="Recent articles" headings={['Article', 'Status', 'Created', '']}>
              {recent.data.data.map((article) => (
                <tr key={article.id} className="hover:bg-muted/30">
                  <td className="min-w-48 px-5 py-4">
                    <Link
                      to={`/articles/${article.id}/edit`}
                      className="line-clamp-1 text-xs font-medium hover:text-primary"
                    >
                      {article.title}
                    </Link>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {article.author?.name ?? 'Unknown author'}
                      {article.article_type ? ` · ${article.article_type.name}` : ''}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[11px] text-muted-foreground">
                    {date(article.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      to={`/articles/${article.id}/edit`}
                      aria-label={`Open ${article.title}`}
                      className="inline-flex rounded p-1 text-muted-foreground hover:text-primary"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        {reviewer && (
          <Card>
            <div className="flex items-center justify-between gap-3 border-b px-5 py-5">
              <div>
                <h2 className="text-sm font-semibold">Recent requests</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">Ideas from your readers</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/article-requests">
                  View all
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            {requests.isPending ? (
              <Loading rows={4} />
            ) : requests.error ? (
              <div className="p-5">
                <ErrorState error={requests.error} retry={() => void requests.refetch()} />
              </div>
            ) : !requests.data?.data.length ? (
              <EmptyState
                title="All quiet for now"
                description="Reader suggestions will appear here when they arrive."
              />
            ) : (
              <div className="divide-y">
                {requests.data.data.map((request) => (
                  <Link
                    to={`/article-requests/${request.id}`}
                    key={request.id}
                    className="block px-5 py-4 hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
                        <Inbox className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-xs font-medium leading-5">
                          {request.topic}
                        </h3>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {request.name ?? 'Anonymous reader'} · {date(request.created_at)}
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={request.status} />
                        </div>
                      </div>
                      <ArrowRight className="mt-1 size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
      <section className="mt-7">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Keep things moving
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              to: '/articles/new',
              icon: Feather,
              label: 'Write a new story',
              description: 'Turn a good idea into your next article.',
            },
            {
              to: '/categories',
              icon: FolderTree,
              label: user?.role === 'admin' ? 'Manage categories' : 'Browse categories',
              description: 'Keep your content thoughtfully organized.',
            },
            ...(reviewer
              ? [
                  {
                    to: '/article-requests',
                    icon: Inbox,
                    label: 'Review reader requests',
                    description: 'Discover what your readers want next.',
                  },
                ]
              : []),
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-center gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/35"
            >
              <span className="rounded-lg bg-primary/6 p-2.5 text-primary">
                <action.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{action.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
