import { cn } from '@/lib/utils';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        {
          neutral: 'bg-muted text-muted-foreground ring-border',
          green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/15',
          blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/15',
          amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/15',
          red: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/15',
          purple: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-indigo-500/15',
        }[tone],
      )}
    >
      {children}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'neutral'> = {
    published: 'green',
    draft: 'amber',
    archived: 'neutral',
    pending: 'amber',
    accepted: 'blue',
    rejected: 'red',
    completed: 'green',
  };
  return (
    <Badge tone={tones[status] ?? 'neutral'}>
      <span className="size-1.5 rounded-full bg-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
