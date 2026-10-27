import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus, Shapes, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { classificationsApi, useClassifications, descendants, categoryRows } from './api';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { useList } from '@/hooks/use-list';
import { message } from '@/lib/api';
import { date, nullable, slugify } from '@/lib/utils';
import type { Classification, ClassificationKind } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
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

export const classificationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(150),
  slug: z
    .string()
    .trim()
    .max(180)
    .refine(
      (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Use lowercase letters, digits, and single hyphens.',
    ),
  description: z.string().trim().max(10000),
  is_active: z.boolean(),
  parent_id: z.string(),
});
const labels = {
  categories: {
    title: 'Categories',
    singular: 'category',
    description: 'Give every story a place to belong.',
    icon: FolderTree,
  },
  tags: {
    title: 'Tags',
    singular: 'tag',
    description: 'Connect ideas and help readers discover more.',
    icon: Tags,
  },
  'article-types': {
    title: 'Article types',
    singular: 'article type',
    description: 'Organize the formats your publication does best.',
    icon: Shapes,
  },
};
export function ClassificationForm({
  kind,
  record,
  records,
  onClose,
  initialName = '',
  onCreated,
}: {
  initialName?: string;
  onCreated?: (record: Classification) => void;
  kind: ClassificationKind;
  record?: Classification;
  records: Classification[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const label = labels[kind];
  const form = useForm<z.infer<typeof classificationSchema>>({
    resolver: zodResolver(classificationSchema),
    defaultValues: {
      name: record?.name ?? initialName,
      slug: record?.slug ?? '',
      description: record?.description ?? '',
      is_active: record?.is_active ?? true,
      parent_id: record?.parent_id ?? '',
    },
  });
  const blocked = record ? descendants(records, record.id) : new Set<string>();
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof classificationSchema>) =>
      classificationsApi.save(
        kind,
        {
          name: values.name,
          ...(values.slug ? { slug: values.slug } : {}),
          description: nullable(values.description),
          is_active: values.is_active,
          ...(kind === 'categories' ? { parent_id: values.parent_id || null } : {}),
        },
        record?.id,
      ),
    onSuccess: ({ data }) => {
      onCreated?.(data);
      void client.invalidateQueries({ queryKey: ['classifications'] });
      if (!onCreated) void client.invalidateQueries({ queryKey: ['articles'] });
      void client.invalidateQueries({ queryKey: ['logs'] });
      toast.success(
        `${label.singular[0].toUpperCase() + label.singular.slice(1)} ${record ? 'updated' : 'created'}.`,
      );
      onClose();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.stopPropagation();
        void form.handleSubmit((values) => mutation.mutate(values))(event);
      }}
    >
      <Field label="Name" htmlFor="classification-name" error={form.formState.errors.name?.message}>
        <Input id="classification-name" autoFocus {...form.register('name')} />
      </Field>
      <Field
        label="Slug"
        htmlFor="classification-slug"
        hint="Leave blank to generate from the name."
        error={form.formState.errors.slug?.message}
      >
        <div className="flex gap-2">
          <Input
            id="classification-slug"
            placeholder="generated-from-name"
            {...form.register('slug')}
          />
          <Button
            variant="outline"
            onClick={() =>
              form.setValue(
                'slug',
                slugify(form.getValues('name')).slice(0, 180).replace(/-$/, ''),
                { shouldDirty: true, shouldValidate: true },
              )
            }
          >
            Generate
          </Button>
        </div>
      </Field>
      <Field
        label="Description"
        htmlFor="classification-description"
        error={form.formState.errors.description?.message}
      >
        <Textarea id="classification-description" {...form.register('description')} />
      </Field>
      {kind === 'categories' && (
        <Field label="Parent category" htmlFor="parent">
          <Select id="parent" {...form.register('parent_id')}>
            <option value="">No parent (top level)</option>
            {categoryRows(records)
              .filter((r) => !blocked.has(r.record.id))
              .map(({ record: option, depth }) => (
                <option key={option.id} value={option.id}>
                  {'— '.repeat(depth)}
                  {option.name}
                  {!option.is_active ? ' (inactive)' : ''}
                </option>
              ))}
          </Select>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-indigo-600"
          {...form.register('is_active')}
        />
        Active and available for articles
      </label>
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <FormActions
        pending={mutation.isPending}
        onCancel={onClose}
        label={record ? 'Save changes' : `Create ${label.singular}`}
      />
    </form>
  );
}
export default function ClassificationPage({ kind }: { kind: ClassificationKind }) {
  const { user } = useAuth();
  const scope = useScope();
  const list = useList('name');
  const client = useQueryClient();
  const label = labels[kind];
  const admin = user?.role === 'admin';
  const [editing, setEditing] = useState<Classification | 'new' | null>(null);
  const all = useClassifications(kind);
  const page = useQuery({
    queryKey: ['classifications', ...scope, kind, list.base],
    queryFn: ({ signal }) =>
      classificationsApi.list(
        kind,
        { ...list.base, ...(admin ? { include_inactive: true } : {}) },
        signal,
      ),
    enabled: kind !== 'categories',
  });
  const source = kind === 'categories' ? all : page;
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['classifications'] });
    void client.invalidateQueries({ queryKey: ['articles'] });
    void client.invalidateQueries({ queryKey: ['logs'] });
  };
  const toggle = useMutation({
    mutationFn: (record: Classification) =>
      classificationsApi.activate(kind, record.id, !record.is_active),
    onSuccess: () => {
      invalidate();
      toast.success('Availability updated.');
    },
    onError: (error) => toast.error(message(error)),
  });
  const rows =
    kind === 'categories'
      ? categoryRows(all.data ?? [], list.search)
      : (page.data?.data ?? []).map((record) => ({ record, depth: 0 }));
  return (
    <>
      <PageHeader title={label.title} description={label.description} eyebrow="Content library">
        {admin && (
          <Button onClick={() => setEditing('new')}>
            <Plus />
            New {label.singular}
          </Button>
        )}
      </PageHeader>
      {!admin && (
        <div className="mb-5">
          <Notice>
            You can browse active {label.title.toLowerCase()}. An administrator manages this
            library.
          </Notice>
        </div>
      )}
      <TableCard>
        <div className="table-controls">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <SearchInput
              value={list.search}
              onChange={(value) => list.set('search', value)}
              placeholder={`Search ${label.title.toLowerCase()}…`}
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {kind === 'categories'
                ? `${all.data?.length ?? '—'} categories`
                : `${page.data?.meta.total ?? '—'} ${label.title.toLowerCase()}`}
            </span>
            {kind !== 'categories' && (
              <Select
                aria-label="Sort classifications"
                className="w-40"
                value={list.sort}
                onChange={(e) => list.set('sort', e.target.value)}
              >
                <option value="name">Name A–Z</option>
                <option value="-name">Name Z–A</option>
                <option value="-created_at">Newest first</option>
                <option value="-updated_at">Recently updated</option>
              </Select>
            )}
          </div>
        </div>
        <div className="table-content">
          {source.isPending ? (
            <Loading />
          ) : source.error ? (
            <div className="p-5">
              <ErrorState error={source.error} retry={() => void source.refetch()} />
            </div>
          ) : !rows.length ? (
            <EmptyState
              title={list.search ? 'No matches found' : `No ${label.title.toLowerCase()} yet`}
              description={
                list.search
                  ? 'Try a different search term.'
                  : `Create your first ${label.singular} to organize your content.`
              }
            >
              {admin && !list.search && (
                <Button onClick={() => setEditing('new')}>
                  <Plus />
                  New {label.singular}
                </Button>
              )}
            </EmptyState>
          ) : (
            <>
              <Table
                label={label.title}
                headings={['Name', 'Slug', 'Status', 'Created', ...(admin ? ['Actions'] : [])]}
              >
                {rows.map(({ record, depth }) => (
                  <tr key={record.id} className="group hover:bg-muted/30">
                    <td className="min-w-56 px-5 py-4">
                      <div
                        className="flex items-start gap-3"
                        style={{ paddingLeft: `${Math.min(depth, 12) * 18}px` }}
                      >
                        <div className="mt-0.5 rounded-md bg-primary/5 p-2 text-primary">
                          <label.icon className="size-4" />
                        </div>
                        <div>
                          <span className="font-medium">{record.name}</span>
                          {record.description && (
                            <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
                              {record.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                      {record.slug}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={record.is_active ? 'green' : 'neutral'}>
                        {record.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {date(record.created_at)}
                    </td>
                    {admin && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggle.mutate(record)}
                            disabled={toggle.isPending}
                          >
                            {record.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${record.name}`}
                            onClick={() => setEditing(record)}
                          >
                            <Pencil />
                          </Button>
                          <ConfirmDialog
                            title={`Delete ${label.singular}?`}
                            description={`“${record.name}” will be permanently removed. Referenced classifications and parent categories cannot be deleted.`}
                            onConfirm={async () => {
                              await classificationsApi.delete(kind, record.id);
                              invalidate();
                              toast.success(`${label.singular} deleted.`);
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${record.name}`}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
        {kind !== 'categories' && page.data && !page.error && (
          <Pagination meta={page.data.meta} set={list.set} />
        )}
      </TableCard>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={`${editing === 'new' ? 'New' : 'Edit'} ${label.singular}`}
        description="Changes are applied to your content library immediately."
      >
        {editing !== null && (
          <ClassificationForm
            key={editing === 'new' ? 'new' : editing.id}
            kind={kind}
            record={editing === 'new' ? undefined : editing}
            records={all.data ?? []}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
