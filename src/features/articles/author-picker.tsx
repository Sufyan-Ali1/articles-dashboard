import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { api, collectPages } from '@/lib/api';
import { useScope } from '@/hooks/use-private-query';
import type { Article, Resource } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { ErrorState, Field } from '@/components/shared';
import type { ArticleFormValues } from './validation';

interface AuthorProfile {
  id: string;
  name: string;
  specialization: string;
  is_active: boolean;
}

export function AuthorPicker({
  form,
  disabled,
  canCreate,
  selected,
}: {
  form: UseFormReturn<ArticleFormValues>;
  disabled: boolean;
  canCreate: boolean;
  selected?: Article['author'];
}) {
  const scope = useScope();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const authors = useQuery({
    queryKey: ['authors', ...scope],
    queryFn: ({ signal }) =>
      collectPages<AuthorProfile>('/admin/authors', { sort: 'name' }, signal),
  });
  const create = useMutation({
    mutationFn: () =>
      api<Resource<AuthorProfile>>('/admin/authors', {
        method: 'POST',
        body: { name: name.trim(), specialization: specialization.trim() },
      }),
    onSuccess: async ({ data }) => {
      await client.invalidateQueries({ queryKey: ['authors'] });
      form.setValue('author_id', data.id, { shouldDirty: true, shouldValidate: true });
      setCreating(false);
      setName('');
      setSpecialization('');
    },
  });
  const options = authors.data ?? [];
  return (
    <div className="space-y-3">
      <Field
        label="Author"
        htmlFor="article-author"
        error={form.formState.errors.author_id?.message}
        hint="This author appears on the public article."
      >
        <Select
          id="article-author"
          disabled={disabled || authors.isPending}
          {...form.register('author_id')}
        >
          <option value="">{authors.isPending ? 'Loading authors…' : 'Choose an author'}</option>
          {selected && !options.some((row) => row.id === selected.id) && (
            <option value={selected.id}>{selected.name}</option>
          )}
          {options.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} — {row.specialization}
            </option>
          ))}
        </Select>
      </Field>
      {authors.error && (
        <ErrorState compact error={authors.error} retry={() => void authors.refetch()} />
      )}
      {canCreate && !creating && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setCreating(true)}
        >
          New author
        </Button>
      )}
      {creating && (
        <div className="space-y-3 rounded-md border p-3">
          <Field label="Author name" htmlFor="new-author-name">
            <Input
              id="new-author-name"
              value={name}
              maxLength={150}
              disabled={create.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Specialization"
            htmlFor="new-author-specialization"
            hint="For example AI or Technology."
          >
            <Input
              id="new-author-specialization"
              value={specialization}
              maxLength={10000}
              disabled={create.isPending}
              onChange={(event) => setSpecialization(event.target.value)}
            />
          </Field>
          {create.error && <ErrorState compact error={create.error} />}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={disabled || create.isPending || !name.trim() || !specialization.trim()}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Saving…' : 'Save author'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
