import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorState, Field, Spinner } from '@/components/shared';
import { localDateTime, scheduledDate, scheduleTimestamp } from './scheduling';
export function ScheduleDialog({
  open,
  close,
  initialDate,
  reschedule,
  pending,
  error,
  onSchedule,
}: {
  open: boolean;
  close: () => void;
  initialDate?: string | null;
  reschedule: boolean;
  pending: boolean;
  error: unknown;
  onSchedule: (timestamp: string) => Promise<boolean>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) close();
      }}
      title={reschedule ? 'Reschedule publication' : 'Schedule publication'}
      description="Your edits will be saved first. The article stays private until the server publishes it at the scheduled time."
    >
      {open && (
        <ScheduleForm
          key={initialDate || 'new'}
          initialDate={initialDate}
          reschedule={reschedule}
          pending={pending}
          error={error}
          close={close}
          onSchedule={onSchedule}
        />
      )}
    </Dialog>
  );
}
function ScheduleForm({
  initialDate,
  reschedule,
  pending,
  error,
  close,
  onSchedule,
}: Omit<Parameters<typeof ScheduleDialog>[0], 'open'>) {
  const [value, setValue] = useState(initialDate ? localDateTime(initialDate) : '');
  const [validation, setValidation] = useState('');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let preview: string | null = null;
  try {
    preview = scheduleTimestamp(value);
  } catch {
    /* Show field errors on submit. */
  }
  return (
    <form
      className="space-y-4"
      noValidate
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        let timestamp: string;
        try {
          timestamp = scheduleTimestamp(value);
          setValidation('');
        } catch (failure) {
          setValidation(failure instanceof Error ? failure.message : 'Choose a future time.');
          return;
        }
        if (await onSchedule(timestamp)) close();
      }}
    >
      <Field
        label="Publication date and time"
        htmlFor="publication-time"
        error={validation}
        hint={`Your timezone: ${zone}. The selected time is converted to UTC for the server.`}
      >
        <Input
          id="publication-time"
          type="datetime-local"
          step={60}
          min={localDateTime(new Date(Date.now()).toISOString())}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setValidation('');
          }}
          aria-invalid={!!validation}
          aria-describedby={validation ? 'publication-time-error' : undefined}
          readOnly={pending}
          autoFocus
        />
      </Field>
      {preview && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p>
            Publish: <strong>{scheduledDate(preview)}</strong>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">UTC: {preview}</p>
        </div>
      )}
      {error != null && <ErrorState compact error={error} />}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={pending} onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {reschedule ? 'Save & reschedule' : 'Save & schedule'}
        </Button>
      </div>
    </form>
  );
}
