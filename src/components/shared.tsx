import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Search,
  RotateCw,
} from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ApiError, message } from '@/lib/api';
import { Button } from './ui/button';
import { Input, Select } from './ui/input';
import type { Page } from '@/types/api';

export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card shadow-xs ${className}`}>{children}</section>
  );
}
export function ErrorState({
  error,
  retry,
  compact = false,
}: {
  error: unknown;
  retry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-destructive/20 bg-destructive/5 ${compact ? 'p-3 text-sm' : 'p-6'}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="font-medium">
            {error instanceof ApiError && error.status === 403
              ? 'Access restricted'
              : error instanceof ApiError && error.status === 404
                ? 'Record not found'
                : 'Unable to complete this request'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{message(error)}</p>
          {error instanceof ApiError && error.requestId && (
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              Request ID: {error.requestId}
            </p>
          )}
          {error instanceof ApiError && error.retryAfter && (
            <p className="mt-1 text-xs">Try again in {error.retryAfter} seconds.</p>
          )}
          {retry && (
            <Button className="mt-3" variant="outline" size="sm" onClick={retry}>
              <RotateCw />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  description = 'New records will appear here.',
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <div className="mb-4 rounded-xl border bg-muted/50 p-3">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mb-5 mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading content" className="space-y-4 p-6">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 motion-reduce:animate-none">
          <div className="size-9 rounded-lg bg-muted" />
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="ml-auto h-4 w-1/5 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
export function Spinner() {
  return <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function FormActions({
  pending,
  onCancel,
  label = 'Save changes',
}: {
  pending: boolean;
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t pt-5">
      <Button variant="outline" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}
        {label}
      </Button>
    </div>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  children,
  destructive = true,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  children: ReactNode;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError(null);
        }
      }}
    >
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {error != null && (
            <div className="mt-4">
              <ErrorState compact error={error} />
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (e) {
                  setError(e);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Spinner />}Confirm
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);
  return (
    <div className="relative min-w-48 flex-1 sm:max-w-80">
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
      <Input
        aria-label={placeholder}
        className="pl-9"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export function Pagination({
  meta,
  set,
}: {
  meta: Page<unknown>['meta'];
  set: (name: string, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs text-muted-foreground">
      <span>
        {meta.total === 0
          ? '0 results'
          : meta.page > meta.pages
            ? `No results on this page · ${meta.total} total`
            : `${(meta.page - 1) * meta.page_size + 1}–${Math.min(meta.page * meta.page_size, meta.total)} of ${meta.total} results`}
      </span>
      <div className="flex items-center gap-3">
        {meta.page > Math.max(meta.pages, 1) && (
          <Button variant="outline" size="sm" onClick={() => set('page', '1')}>
            First page
          </Button>
        )}
        <Select
          aria-label="Rows per page"
          className="h-8 w-20 text-xs"
          value={meta.page_size}
          onChange={(e) => set('page_size', e.target.value)}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </Select>
        <span>
          Page {meta.pages ? meta.page : 0} of {meta.pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Previous page"
          disabled={meta.page <= 1}
          onClick={() => set('page', String(meta.page - 1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Next page"
          disabled={meta.page >= meta.pages}
          onClick={() => set('page', String(meta.page + 1))}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
export function Table({
  headings,
  children,
  label,
}: {
  headings: string[];
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/35">
            {headings.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}
