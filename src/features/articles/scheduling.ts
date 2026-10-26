// datetime-local values represent the user's browser timezone, never UTC.
export function localDateTime(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
export function scheduleTimestamp(value: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Choose a publication date and time.');
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || localDateTime(date.toISOString()) !== value)
    throw new Error('This local time does not exist. Choose another date or time.');
  if (date.getTime() <= now) throw new Error('Choose a publication time in the future.');
  return date.toISOString();
}
export function scheduledDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date);
}
