import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useScope } from '@/hooks/use-private-query';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  FormActions,
  Loading,
  Table,
} from '@/components/shared';
import { trafficApi, trackingUrl, type TrafficSource } from './api';
const schema = z.object({
  source_id: z.string().min(1, 'Select a source.'),
  code: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.'),
  medium: z.string().min(1).max(100),
  campaign: z.string().trim().max(150),
  content: z.string().trim().max(150),
});
type Values = z.infer<typeof schema>;
function LinkForm({
  articleId,
  slug,
  sources,
  close,
}: {
  articleId: string;
  slug: string;
  sources: TrafficSource[];
  close: () => void;
}) {
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { source_id: '', code: '', medium: 'social', campaign: '', content: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      trafficApi.createLink({
        article_id: articleId,
        source_id: values.source_id,
        code: values.code,
        medium: values.medium,
        ...(values.campaign ? { campaign: values.campaign } : {}),
        ...(values.content ? { content: values.content } : {}),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['traffic'] });
      close();
    },
  });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <Field
        label="Traffic source"
        htmlFor="link-source"
        error={form.formState.errors.source_id?.message}
      >
        <Select
          id="link-source"
          {...form.register('source_id', {
            onChange: (event) => {
              const source = sources.find((item) => item.id === event.target.value);
              if (source && !form.getFieldState('code').isDirty)
                form.setValue(
                  'code',
                  `${slug.slice(0, 35).replace(/-$/, '')}-${source.slug.slice(0, 30).replace(/-$/, '')}-${crypto.randomUUID().slice(0, 6)}`,
                );
            },
          })}
        >
          <option value="">Select a source</option>
          {sources
            .filter((source) => source.is_active)
            .map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field
        label="Link code"
        htmlFor="link-code"
        hint="The shared URL will be /r/this-code. Use a different link for each placement."
        error={form.formState.errors.code?.message}
      >
        <Input id="link-code" {...form.register('code')} />
      </Field>
      <Field label="Medium" htmlFor="link-medium">
        <Select id="link-medium" {...form.register('medium')}>
          <option value="social">Social</option>
          <option value="referral">Referral</option>
          <option value="email">Email</option>
          <option value="organic">Organic search</option>
        </Select>
      </Field>
      <Field label="Campaign (optional)" htmlFor="link-campaign">
        <Input id="link-campaign" maxLength={150} {...form.register('campaign')} />
      </Field>
      <Field
        label="Placement (optional)"
        htmlFor="link-content"
        hint="For example comment-01, profile-bio, or post-02."
      >
        <Input id="link-content" maxLength={150} {...form.register('content')} />
      </Field>
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <FormActions pending={mutation.isPending} onCancel={close} label="Create tracking link" />
    </form>
  );
}
export function ArticleLinks({
  articleId,
  slug,
  published,
}: {
  articleId: string;
  slug: string;
  published: boolean;
}) {
  const scope = useScope();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const sources = useQuery({
    queryKey: ['traffic', ...scope, 'sources'],
    queryFn: ({ signal }) => trafficApi.sources(signal),
  });
  const links = useQuery({
    queryKey: ['traffic', ...scope, 'links', articleId],
    queryFn: ({ signal }) => trafficApi.links(articleId, signal),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      trafficApi.toggleLink(id, active),
    onSuccess: () => client.invalidateQueries({ queryKey: ['traffic'] }),
  });
  return (
    <Card className="mb-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">Share &amp; track</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {published
              ? 'Share a short link to attribute visits to a source. Readers land on a clean article URL.'
              : 'Publish this article before creating new tracking links.'}
          </p>
        </div>
        <Button
          size="sm"
          disabled={
            !published ||
            sources.isPending ||
            !!sources.error ||
            !sources.data?.some((source) => source.is_active)
          }
          onClick={() => setOpen(true)}
        >
          <Plus />
          New tracking link
        </Button>
      </div>
      {sources.error && (
        <ErrorState compact error={sources.error} retry={() => void sources.refetch()} />
      )}
      {sources.data && !sources.data.some((source) => source.is_active) && (
        <p className="p-5 text-sm">
          Create or activate a source in{' '}
          <Link className="text-primary hover:underline" to="/traffic-sources">
            Traffic Sources
          </Link>{' '}
          first.
        </p>
      )}
      {links.isPending ? (
        <Loading rows={2} />
      ) : links.error ? (
        <ErrorState error={links.error} retry={() => void links.refetch()} />
      ) : links.data.length ? (
        <Table
          label="Article tracking links"
          headings={['Link', 'Source', 'Campaign / placement', 'Status', 'Actions']}
        >
          {links.data.map((link) => (
            <tr key={link.id}>
              <td className="max-w-80 break-all px-5 py-4 text-xs">
                {trackingUrl(link.code) || 'Configure VITE_SITE_URL'}
                <p className="mt-1 text-[11px] text-muted-foreground">{link.medium}</p>
              </td>
              <td className="px-5 py-4 text-xs">
                {sources.data?.find((source) => source.id === link.source_id)?.name || link.source}
              </td>
              <td className="px-5 py-4 text-xs">
                {link.campaign || '—'}
                <p className="mt-1 text-muted-foreground">{link.content || '—'}</p>
              </td>
              <td className="px-5 py-4 text-xs">
                {sources.data?.find((source) => source.id === link.source_id)?.is_active === false
                  ? 'Source inactive'
                  : link.is_active
                    ? 'Active'
                    : 'Inactive'}
              </td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Copy ${link.code}`}
                    disabled={!trackingUrl(link.code)}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(trackingUrl(link.code)!);
                        toast.success('Tracking link copied.');
                      } catch {
                        toast.error('Could not copy. Select and copy the link text instead.');
                      }
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: link.id, active: !link.is_active })}
                  >
                    {link.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState
          title="No tracking links yet"
          description="Create a link for each platform or comment where you share this article."
        />
      )}
      {toggle.error && (
        <div className="p-5">
          <ErrorState compact error={toggle.error} />
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New tracking link"
        description="Choose a configured source and identify this sharing placement."
      >
        {open && sources.data && (
          <LinkForm
            articleId={articleId}
            slug={slug}
            sources={sources.data}
            close={() => setOpen(false)}
          />
        )}
      </Dialog>
    </Card>
  );
}
