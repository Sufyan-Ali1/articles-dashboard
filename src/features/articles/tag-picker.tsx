import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { classificationsApi } from '@/features/categories/api';
import { useScope } from '@/hooks/use-private-query';
import type { Classification } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/shared';

export function TagPicker({
  options,
  value,
  onChange,
  disabled,
  loading,
  loadError,
  error,
}: {
  options: Classification[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  loading: boolean;
  loadError: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const scope = useScope();
  const client = useQueryClient();
  const name = search.trim();
  const exact = options.some((tag) => tag.name.trim().toLowerCase() === name.toLowerCase());
  const visible = options.filter((tag) => tag.name.toLowerCase().includes(name.toLowerCase()));
  const create = useMutation({
    mutationFn: (name: string) =>
      classificationsApi.save('tags', { name, description: null, is_active: true }),
    onSuccess: ({ data }) => {
      client.setQueriesData<Classification[]>(
        { queryKey: ['classifications', ...scope, 'tags'] },
        (previous) =>
          previous
            ? [...previous.filter((tag) => tag.id !== data.id), data].sort((a, b) =>
                a.name.localeCompare(b.name),
              )
            : previous,
      );
      onChange([...new Set([...value, data.id])]);
      setSearch('');
      void client.invalidateQueries({ queryKey: ['classifications', ...scope, 'tags'] });
    },
  });
  const canCreate = user?.role === 'admin' && !!name && !exact && !loading && !loadError;
  const busy = disabled || create.isPending;
  const full = value.length >= 100;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">Tags</legend>
      <div className="relative">
        <Input
          aria-label="Search tags"
          placeholder="Find or add a tag…"
          value={search}
          maxLength={150}
          className={canCreate ? 'pr-10' : undefined}
          disabled={busy}
          onChange={(event) => {
            setSearch(event.target.value);
            create.reset();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (canCreate && !busy && !full) create.mutate(name);
            }
          }}
        />
        {canCreate && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-0.5 top-0.5 size-8"
            disabled={busy || full}
            aria-label={`Add tag "${name}"`}
            title={`Create and select "${name}"`}
            onClick={() => create.mutate(name)}
          >
            {create.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          </Button>
        )}
      </div>
      {canCreate && (
        <p className="mt-1 text-xs text-muted-foreground">
          Press + or Enter to create and select this tag.
        </p>
      )}
      <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border p-2">
        {visible.map((tag) => (
          <label key={tag.id} className="flex items-start gap-2 rounded px-1 py-1 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 accent-indigo-600"
              checked={value.includes(tag.id)}
              disabled={busy || (!value.includes(tag.id) && (!tag.is_active || full))}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...value, tag.id] : value.filter((id) => id !== tag.id),
                )
              }
            />
            <span>
              {tag.name}
              {!tag.is_active && <span className="ml-1 text-amber-600">(inactive)</span>}
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="p-1 text-xs text-muted-foreground">
            {loading ? 'Loading tags…' : 'No matching tags.'}
          </p>
        )}
      </div>
      {full && <p className="mt-1 text-xs text-muted-foreground">Maximum 100 tags per article.</p>}
      {create.error && (
        <div className="mt-2">
          <ErrorState compact error={create.error} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
