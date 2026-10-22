import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Star } from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { useList } from '@/hooks/use-list';
import { useClassifications } from '@/features/categories/api';
import { articlesApi } from './api';
import { ArticleActions } from './article-actions';
import { date, number } from '@/lib/utils';
import type { ArticleFilters, ArticleStatus } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Select, Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import {
  TableCard,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
} from '@/components/shared';
export default function ArticlesPage() {
  const { user } = useAuth();
  const scope = useScope();
  const list = useList();
  const categories = useClassifications('categories');
  const tags = useClassifications('tags');
  const types = useClassifications('article-types');
  const status = list.params.get('status');
  const featured = list.params.get('is_featured');
  const filters: ArticleFilters = {
    ...list.base,
    status: ['draft', 'published', 'archived'].includes(status ?? '')
      ? (status as ArticleStatus)
      : undefined,
    category: list.params.get('category') || undefined,
    tag: list.params.get('tag') || undefined,
    article_type: list.params.get('article_type') || undefined,
    is_featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
    published_from: list.params.get('published_from') || undefined,
    published_to: list.params.get('published_to') || undefined,
  };
  const query = useQuery({
    queryKey: ['articles', ...scope, filters],
    queryFn: ({ signal }) => articlesApi.list(filters, signal),
  });
  return (
    <>
      <PageHeader
        title={user?.role === 'author' ? 'My articles' : 'Articles'}
        description="From the first idea to the final word. Manage every story here."
        eyebrow="Your publication"
      >
        <Button asChild>
          <Link to="/articles/new">
            <Plus />
            Create article
          </Link>
        </Button>
      </PageHeader>
      <TableCard>
        <div className="table-controls">
          <div className="flex flex-wrap items-center gap-1 border-b px-4 pt-2">
            {[
              { value: '', label: 'All articles' },
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Drafts' },
              { value: 'archived', label: 'Archived' },
            ].map((tab) => (
              <button
                key={tab.value}
                className={`border-b-2 px-3 py-3 text-xs font-medium ${(status ?? '') === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => list.set('status', tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 p-4">
            <SearchInput
              value={list.search}
              onChange={(value) => list.set('search', value)}
              placeholder="Search article titles…"
            />
            <Select
              aria-label="Filter by category"
              className="w-full sm:w-40"
              value={filters.category ?? ''}
              onChange={(e) => list.set('category', e.target.value)}
            >
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                  {!c.is_active ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by type"
              className="w-full sm:w-40"
              value={filters.article_type ?? ''}
              onChange={(e) => list.set('article_type', e.target.value)}
            >
              <option value="">All types</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Featured filter"
              className="w-full sm:w-36"
              value={featured ?? ''}
              onChange={(e) => list.set('is_featured', e.target.value)}
            >
              <option value="">Any featured state</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </Select>
            <Select
              aria-label="Sort articles"
              className="w-full sm:w-44"
              value={list.sort}
              onChange={(e) => list.set('sort', e.target.value)}
            >
              <option value="-created_at">Newest first</option>
              <option value="created_at">Oldest first</option>
              <option value="-updated_at">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="-title">Title Z–A</option>
              <option value="-view_count">Most viewed</option>
              <option value="view_count">Least viewed</option>
              <option value="-published_at">Recently published</option>
            </Select>
          </div>
          <details className="border-t px-4 py-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">More filters</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                Tag
                <Select
                  className="min-w-44"
                  value={filters.tag ?? ''}
                  onChange={(e) => list.set('tag', e.target.value)}
                >
                  <option value="">All tags</option>
                  {tags.data?.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Published from
                <Input
                  type="date"
                  value={filters.published_from?.slice(0, 10) ?? ''}
                  onChange={(e) =>
                    list.set('published_from', e.target.value ? `${e.target.value}T00:00:00Z` : '')
                  }
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Published through (UTC)
                <Input
                  type="date"
                  min={filters.published_from?.slice(0, 10)}
                  value={filters.published_to?.slice(0, 10) ?? ''}
                  onChange={(e) =>
                    list.set(
                      'published_to',
                      e.target.value ? `${e.target.value}T23:59:59.999999Z` : '',
                    )
                  }
                />
              </label>
            </div>
          </details>
        </div>
        <div className="table-content">
          {query.isPending ? (
            <Loading rows={7} />
          ) : query.error ? (
            <div className="p-5">
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            </div>
          ) : !query.data.data.length ? (
            <EmptyState
              title="No articles found"
              description={
                list.search || status || filters.category
                  ? 'Try adjusting your search or filters.'
                  : 'Every great publication starts with a first draft.'
              }
            >
              <Button asChild>
                <Link to="/articles/new">
                  <Plus />
                  Write your first article
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <Table
                label="Articles"
                headings={[
                  'Article',
                  'Author',
                  'Category',
                  'Type',
                  'Status',
                  'Views',
                  'Published',
                  'Actions',
                ]}
              >
                {query.data.data.map((article) => (
                  <tr key={article.id} className="hover:bg-muted/30">
                    <td className="min-w-72 max-w-md px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
                          {article.featured_image ? (
                            <img
                              className="size-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              src={article.featured_image}
                              alt={article.featured_image_alt ?? ''}
                            />
                          ) : (
                            <FileText className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/articles/${article.id}/edit`}
                            className="line-clamp-2 font-medium hover:text-primary"
                          >
                            {article.title}
                            {article.is_featured && (
                              <Star
                                className="ml-1.5 inline size-3 fill-amber-400 text-amber-500"
                                aria-label="Featured"
                              />
                            )}
                          </Link>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            /{article.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs">
                      {article.author?.name ?? 'Unknown author'}
                    </td>
                    <td className="min-w-32 px-5 py-4 text-xs text-muted-foreground">
                      {article.categories.map((c) => c.name).join(', ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {article.article_type?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-5 py-4 text-xs tabular-nums">{number(article.view_count)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {date(article.published_at)}
                    </td>
                    <td className="px-4 py-4">
                      <ArticleActions article={article} />
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
        {query.data && !query.error && <Pagination meta={query.data.meta} set={list.set} />}
      </TableCard>
      {[categories, tags, types].some((q) => q.error) && (
        <p role="status" className="mt-3 text-xs text-destructive">
          Some filter options could not load. Article results are still available.
        </p>
      )}
    </>
  );
}
