import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { isAdmin } from '@/lib/permissions';
import { number } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormActions,
  Loading,
  PageHeader,
  Table,
} from '@/components/shared';
import { trafficApi, type TrafficSource } from './api';
import { TrafficRange, TrafficSummary, useTrafficOverview } from './traffic-panel';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a source name.').max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.'),
  domains: z.string().max(6000),
});
type Values = z.infer<typeof schema>;
function SourceForm({ source, close }: { source?: TrafficSource; close: () => void }) {
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: source?.name || '',
      slug: source?.slug || '',
      domains: source?.referrer_domains.join(', ') || '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const body = {
        name: values.name,
        referrer_domains: values.domains.split(/[\s,]+/).filter(Boolean),
      };
      return source
        ? trafficApi.update(source.id, body)
        : trafficApi.create({ ...body, slug: values.slug });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['traffic'] });
      close();
    },
  });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <Field label="Source name" htmlFor="source-name" error={form.formState.errors.name?.message}>
        <Input
          id="source-name"
          autoFocus
          {...form.register('name', {
            onChange: (e) => {
              if (!source && !form.getFieldState('slug').isDirty)
                form.setValue(
                  'slug',
                  String(e.target.value)
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 100),
                );
            },
          })}
        />
      </Field>
      <Field
        label="Source key"
        htmlFor="source-slug"
        hint="A permanent identifier, for example linkedin."
        error={form.formState.errors.slug?.message}
      >
        <Input id="source-slug" readOnly={!!source} {...form.register('slug')} />
      </Field>
      <Field
        label="Referrer domains"
        htmlFor="source-domains"
        hint="Optional comma-separated hostnames, such as linkedin.com or lnkd.in. Subdomains match automatically; domains cannot overlap another source."
      >
        <Input
          id="source-domains"
          placeholder="linkedin.com, lnkd.in"
          {...form.register('domains')}
        />
      </Field>
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <FormActions
        pending={mutation.isPending}
        onCancel={close}
        label={source ? 'Save source' : 'Create source'}
      />
    </form>
  );
}
export default function SourcesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const client = useQueryClient();
  const { query, range, setRange } = useTrafficOverview();
  const [editing, setEditing] = useState<TrafficSource | 'new' | null>(null);
  const toggle = useMutation({
    mutationFn: (source: TrafficSource) =>
      trafficApi.update(source.id, { is_active: !source.is_active }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['traffic'] }),
  });
  return (
    <>
      <PageHeader
        title="Traffic Sources"
        eyebrow="Audience insights"
        description="Manage the platforms that bring readers to your articles."
      >
        <TrafficRange value={range} onChange={setRange} />
        {admin && (
          <Button onClick={() => setEditing('new')}>
            <Plus />
            New source
          </Button>
        )}
      </PageHeader>
      {!admin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Administrators manage sources. You can view traffic and create tracking links from an
          article.
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <TrafficSummary data={query.data.data} range={range} />
          <Card className="mt-6">
            <div className="border-b p-5">
              <h2 className="font-semibold">Source directory</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a source before generating its tracking links on an article. Inactive sources
                keep their historical counts.
              </p>
            </div>
            {query.data.data.sources.length ? (
              <Table
                label="Traffic sources"
                headings={['Source', 'Referrer domains', 'Views', 'Sessions', 'Status', 'Actions']}
              >
                {query.data.data.sources.map((source) => (
                  <tr key={source.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.slug}</p>
                    </td>
                    <td className="max-w-56 break-words px-5 py-4 text-xs">
                      {source.referrer_domains.join(', ') || 'Tracking links only'}
                    </td>
                    <td className="px-5 py-4 tabular-nums">{number(source.views)}</td>
                    <td className="px-5 py-4 tabular-nums">{number(source.sessions)}</td>
                    <td className="px-5 py-4 text-xs">
                      {source.is_active ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {admin ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${source.name}`}
                              onClick={() => setEditing(source)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={toggle.isPending}
                              onClick={() => toggle.mutate(source)}
                            >
                              {source.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <ConfirmDialog
                              title={`Delete ${source.name}?`}
                              description="Unused sources can be deleted. If this source has tracking links or recorded visits, deactivate it instead to keep its history."
                              onConfirm={async () => {
                                await trafficApi.delete(source.id);
                                await client.invalidateQueries({ queryKey: ['traffic'] });
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${source.name}`}
                              >
                                <Trash2 />
                              </Button>
                            </ConfirmDialog>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState
                title="No sources yet"
                description="Add LinkedIn, Instagram, or any other platform you use to share articles."
              >
                {admin && (
                  <Button onClick={() => setEditing('new')}>Create your first source</Button>
                )}
              </EmptyState>
            )}
          </Card>
        </>
      )}
      {toggle.error && (
        <div className="mt-4">
          <ErrorState compact error={toggle.error} />
        </div>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing === 'new' ? 'New traffic source' : 'Edit traffic source'}
        description="Use a stable key and optional referring domains to group traffic consistently."
      >
        {editing && (
          <SourceForm
            key={editing === 'new' ? 'new' : editing.id}
            source={editing === 'new' ? undefined : editing}
            close={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
