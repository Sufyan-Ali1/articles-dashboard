import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { ClassificationForm } from '@/features/categories/classification-page';
import { useScope } from '@/hooks/use-private-query';
import type { Classification } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';

export function CategoryPicker({
  options,
  parents,
  value,
  onChange,
  disabled,
  loading,
  loadError,
  error,
}: {
  options: Classification[];
  parents: Classification[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  loading: boolean;
  loadError: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  const [dialogName, setDialogName] = useState<string | null>(null);
  const [created, setCreated] = useState<Classification[]>([]);
  const { user } = useAuth();
  const scope = useScope();
  const client = useQueryClient();
  const name = search.trim();
  const available = [
    ...new Map(
      [...options, ...created.filter((row) => row.is_active || value.includes(row.id))].map(
        (row) => [row.id, row],
      ),
    ).values(),
  ];
  const visible = available.filter((row) => row.name.toLowerCase().includes(name.toLowerCase()));
  const exact = [...parents, ...available].some(
    (row) => row.name.trim().toLowerCase() === name.toLowerCase(),
  );
  const canCreate = user?.role === 'admin' && !!name && !exact && !loading && !loadError;
  const full = value.length >= 100;
  const add = (record: Classification) => {
    setCreated((previous) => [...previous.filter((row) => row.id !== record.id), record]);
    client.setQueriesData<Classification[]>(
      { queryKey: ['classifications', ...scope, 'categories', 'all'], exact: true },
      (previous) =>
        previous
          ? [...previous.filter((row) => row.id !== record.id), record].sort((a, b) =>
              a.name.localeCompare(b.name),
            )
          : previous,
    );
    onChange([...new Set([...value, record.id])]);
    setSearch('');
  };
  return (
    <>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        <div className="relative">
          <Input
            aria-label="Search categories"
            placeholder="Find or add a category…"
            value={search}
            maxLength={150}
            className={canCreate ? 'pr-10' : undefined}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (canCreate && !disabled && !full) setDialogName(name);
              }
            }}
          />
          {canCreate && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-0.5 top-0.5 size-8"
              disabled={disabled || full}
              aria-label={`Add category "${name}"`}
              title={`Create "${name}"`}
              onClick={() => setDialogName(name)}
            >
              <Plus />
            </Button>
          )}
        </div>
        {canCreate && (
          <p className="mt-1 text-xs text-muted-foreground">
            Press + or Enter to set up this category.
          </p>
        )}
        <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border p-2">
          {visible.map((row) => (
            <label key={row.id} className="flex items-start gap-2 rounded px-1 py-1 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 accent-indigo-600"
                checked={value.includes(row.id)}
                disabled={disabled || (!value.includes(row.id) && (!row.is_active || full))}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...value, row.id] : value.filter((id) => id !== row.id),
                  )
                }
              />
              <span>
                {row.name}
                {!row.is_active && <span className="ml-1 text-amber-600">(inactive)</span>}
              </span>
            </label>
          ))}
          {!visible.length && (
            <p className="p-1 text-xs text-muted-foreground">
              {loading ? 'Loading categories…' : 'No matching categories.'}
            </p>
          )}
        </div>
        {full && (
          <p className="mt-1 text-xs text-muted-foreground">Maximum 100 categories per article.</p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </fieldset>
      <Dialog
        open={dialogName !== null}
        onOpenChange={(open) => {
          if (!open) setDialogName(null);
        }}
        title="Create category"
        description="Set up the category, then add it to this article."
      >
        {dialogName !== null && (
          <ClassificationForm
            kind="categories"
            records={parents}
            initialName={dialogName}
            onCreated={add}
            onClose={() => setDialogName(null)}
          />
        )}
      </Dialog>
    </>
  );
}
