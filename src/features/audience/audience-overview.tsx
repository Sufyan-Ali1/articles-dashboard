import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScope } from '@/hooks/use-private-query';
import { Card, EmptyState, ErrorState, Loading } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { date, number } from '@/lib/utils';
import { audienceApi } from './api';
import { reasonLabels } from './audience-page';

export function AudienceOverview() {
  const scope = useScope();
  const subscribers = useQuery({
    queryKey: ['dashboard', ...scope, 'subscribers'],
    queryFn: ({ signal }) => audienceApi.subscribers({ page_size: 3, sort: '-created_at' }, signal),
  });
  const messages = useQuery({
    queryKey: ['dashboard', ...scope, 'contact-messages'],
    queryFn: ({ signal }) => audienceApi.messages({ page_size: 3, sort: '-created_at' }, signal),
  });
  return (
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
      {(
        [
          { title: 'Subscribers', path: '/subscribers', query: subscribers },
          { title: 'Contact messages', path: '/contact-messages', query: messages },
        ] as const
      ).map(({ title, path, query }) => (
        <Card key={path}>
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              {query.data && !query.error && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {number(query.data.meta.total)} total · Latest submissions
                </p>
              )}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={path}>
                View all <ArrowRight />
              </Link>
            </Button>
          </div>
          {query.isPending ? (
            <Loading rows={3} />
          ) : query.error ? (
            <div className="p-5">
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            </div>
          ) : !query.data.data.length ? (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              description="New website submissions will appear here."
            />
          ) : (
            <div className="divide-y">
              {query.data.data.map((record) => (
                <div key={record.id} className="px-5 py-4">
                  {'message' in record ? (
                    <Link
                      className="block hover:text-primary"
                      to={`/contact-messages/${record.id}`}
                    >
                      <p className="text-xs font-medium">
                        {record.name || record.email} · {reasonLabels[record.reason]}
                      </p>
                      <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                        {record.message}
                      </p>
                    </Link>
                  ) : (
                    <p className="break-all text-xs font-medium">{record.email}</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {date(record.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
