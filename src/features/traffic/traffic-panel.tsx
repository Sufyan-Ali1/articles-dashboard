import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Globe, RefreshCw } from 'lucide-react';
import { useScope } from '@/hooks/use-private-query';
import { Card, ErrorState, Loading } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { number } from '@/lib/utils';
import { trafficApi, type TrafficOverview } from './api';

export function useTrafficOverview(articleId?: string) {
  const scope = useScope();
  const [range, setRange] = useState('all');
  const query = useQuery({
    queryKey: ['traffic', ...scope, 'overview', articleId || 'all', range],
    queryFn: ({ signal }) =>
      trafficApi.overview(
        {
          ...(articleId ? { article_id: articleId } : {}),
          ...(range === 'all'
            ? {}
            : { start: new Date(Date.now() - Number(range) * 86400000).toISOString() }),
        },
        signal,
      ),
    refetchInterval: 60000,
  });
  return { query, range, setRange };
}
export function TrafficRange({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Period
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-36">
        <option value="all">All time</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </Select>
    </div>
  );
}
export function TrafficSummary({ data, range }: { data: TrafficOverview; range: string }) {
  const period = range === 'all' ? 'All recorded visits' : `Last ${range} days`;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Lifetime views', data.lifetime_views, 'Includes historical view counts'],
          ['Tracked views', data.views, period],
          ['Sessions', data.sessions, `${period} · browsing sessions, not people`],
        ].map(([label, value, caption]) => (
          <Card key={label} className="p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{number(Number(value))}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p>
          </Card>
        ))}
      </div>
      <div
        className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Traffic source cards"
      >
        {data.sources.map((source) => (
          <Card key={source.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{source.name}</h3>
              <Globe className="size-4 text-primary" />
            </div>
            {!source.is_active && <p className="mt-1 text-xs text-muted-foreground">Inactive</p>}
            <dl className="mt-4 flex justify-between gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Views</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{number(source.views)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sessions</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {number(source.sessions)}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Direct &amp; other referrals</h3>
          <dl className="mt-4 flex justify-between gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Views</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {number(data.unassigned_views)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sessions</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {number(data.unassigned_sessions)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Visits without a configured source
          </p>
        </Card>
      </div>
      {data.legacy_views > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {number(data.legacy_views)} historical views have no source attribution. They appear only
          in lifetime views.
        </p>
      )}
      {!data.sources.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          No managed sources yet.{' '}
          <Link className="text-primary hover:underline" to="/traffic-sources">
            Create a traffic source
          </Link>{' '}
          to start comparing platforms.
        </p>
      )}
    </>
  );
}
export function TrafficPanel({ articleId }: { articleId?: string }) {
  const { query, range, setRange } = useTrafficOverview(articleId);
  return (
    <section className="my-7" aria-label={articleId ? 'Article traffic' : 'Traffic overview'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Traffic Sources</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {articleId
              ? 'Where readers of this article come from.'
              : 'See which platforms bring readers to your publication.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TrafficRange value={range} onChange={setRange} />
          <Button
            size="icon"
            variant="outline"
            aria-label="Refresh traffic"
            onClick={() => void query.refetch()}
          >
            <RefreshCw />
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/traffic-sources">
              Manage sources <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      {query.isPending ? (
        <Loading rows={3} />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <TrafficSummary data={query.data.data} range={range} />
      )}
    </section>
  );
}
