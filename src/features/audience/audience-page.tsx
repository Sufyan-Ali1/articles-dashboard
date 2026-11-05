import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useScope } from '@/hooks/use-private-query';
import { useList } from '@/hooks/use-list';
import { dateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  TableCard,
} from '@/components/shared';
import { audienceApi, type ContactMessage } from './api';

export const reasonLabels = {
  general: 'General enquiry',
  correction: 'Correction',
  privacy: 'Privacy',
};

export default function AudiencePage({ kind }: { kind: 'subscribers' | 'messages' }) {
  const list = useList();
  const scope = useScope();
  const messages = kind === 'messages';
  const title = messages ? 'Contact messages' : 'Subscribers';
  const sorts = messages
    ? ['-created_at', 'created_at', 'name', 'email', 'reason']
    : ['-created_at', 'created_at', 'email'];
  const params = { ...list.base, sort: sorts.includes(list.sort) ? list.sort : '-created_at' };
  const query = useQuery({
    queryKey: ['audience', ...scope, kind, params],
    queryFn: ({ signal }) =>
      messages ? audienceApi.messages(params, signal) : audienceApi.subscribers(params, signal),
  });
  return (
    <>
      <PageHeader
        title={title}
        eyebrow="Readers"
        description={
          messages
            ? 'Read enquiries, corrections, and privacy requests from your website.'
            : 'See who has subscribed to updates from your publication.'
        }
      >
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw /> Refresh
        </Button>
      </PageHeader>
      <TableCard>
        <div className="table-controls">
          <div className="flex flex-wrap gap-3 border-b p-4">
            <SearchInput
              value={list.search}
              onChange={(value) => list.set('search', value)}
              placeholder={
                messages ? 'Search names, emails, or messages…' : 'Search subscriber emails…'
              }
            />
            <Select
              aria-label={`Sort ${title.toLowerCase()}`}
              className="w-full sm:w-44"
              value={params.sort}
              onChange={(event) => list.set('sort', event.target.value)}
            >
              <option value="-created_at">Newest first</option>
              <option value="created_at">Oldest first</option>
              <option value="email">Email A–Z</option>
              {messages && <option value="name">Name A–Z</option>}
              {messages && <option value="reason">Reason</option>}
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
              title={`No ${title.toLowerCase()} found`}
              description={
                list.search
                  ? 'Try another search or clear your filters.'
                  : messages
                    ? 'Website contact submissions will appear here.'
                    : 'Website newsletter signups will appear here.'
              }
            />
          ) : (
            <Table
              label={title}
              headings={
                messages
                  ? ['From', 'Reason', 'Message', 'Received', 'Actions']
                  : ['Email', 'Subscribed']
              }
            >
              {query.data.data.map((record) => {
                const contact = messages ? (record as ContactMessage) : null;
                return (
                  <tr key={record.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      {contact && (
                        <p className="mb-1 text-sm font-medium">
                          {contact.name || 'Anonymous reader'}
                        </p>
                      )}
                      <p className="break-all text-xs text-muted-foreground">{record.email}</p>
                    </td>
                    {contact && (
                      <td className="px-5 py-4">
                        <Badge>{reasonLabels[contact.reason]}</Badge>
                      </td>
                    )}
                    {contact && (
                      <td className="max-w-md px-5 py-4">
                        <p className="line-clamp-2 break-words text-xs">{contact.message}</p>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {dateTime(record.created_at)}
                    </td>
                    {contact && (
                      <td className="px-5 py-4">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/contact-messages/${record.id}`}>
                            Read message <ArrowUpRight />
                          </Link>
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
        {query.data && !query.error && <Pagination meta={query.data.meta} set={list.set} />}
      </TableCard>
    </>
  );
}

export function ContactDetailPage() {
  const { id } = useParams();
  const scope = useScope();
  const query = useQuery({
    queryKey: ['audience', ...scope, 'message', id],
    queryFn: ({ signal }) => audienceApi.message(id!, signal),
  });
  const contact = query.data?.data;
  return (
    <>
      <PageHeader title="Contact message" description="The complete submission from your reader.">
        <Button asChild variant="outline">
          <Link to="/contact-messages">
            <ArrowLeft /> All messages
          </Link>
        </Button>
      </PageHeader>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        contact && (
          <Card className="max-w-4xl p-6 sm:p-8">
            <Badge>{reasonLabels[contact.reason]}</Badge>
            <h2 className="mt-4 text-xl font-semibold">{contact.name || 'Anonymous reader'}</h2>
            <p className="mt-2 break-all text-sm">{contact.email}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Received {dateTime(contact.created_at)}
            </p>
            {contact.article_url && (
              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground">Related article URL</p>
                <p className="mt-1 break-all text-sm">{contact.article_url}</p>
              </div>
            )}
            <p className="mt-6 whitespace-pre-wrap break-words border-t pt-6 text-sm leading-7">
              {contact.message}
            </p>
          </Card>
        )
      )}
    </>
  );
}
