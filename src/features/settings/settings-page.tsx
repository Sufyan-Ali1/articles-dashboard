import { Monitor, Moon, Sun, Rows3 } from 'lucide-react';
import { usePreferences } from './preferences';
import { cn } from '@/lib/utils';
import { Card, Notice, PageHeader } from '@/components/shared';
export default function SettingsPage() {
  const { preferences, update } = usePreferences();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Make this workspace feel a little more like yours."
        eyebrow="Your preferences"
      />
      <div className="max-w-3xl space-y-6">
        <Card className="p-6">
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how the dashboard looks on this device.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3" role="group" aria-label="Appearance">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((option) => (
              <button
                key={option.value}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-lg border p-5 text-sm transition-colors hover:bg-muted',
                  preferences.theme === option.value &&
                    'border-primary bg-primary/5 text-primary ring-1 ring-primary',
                )}
                aria-pressed={preferences.theme === option.value}
                onClick={() => update({ theme: option.value as 'light' | 'dark' | 'system' })}
              >
                <option.icon className="size-5" />
                {option.label}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Rows3 className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">Table density</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the amount of space between rows.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Table density">
            {[
              { value: 'comfortable', label: 'Comfortable', text: 'A little room to breathe.' },
              { value: 'compact', label: 'Compact', text: 'More information at a glance.' },
            ].map((option) => (
              <button
                key={option.value}
                aria-pressed={preferences.density === option.value}
                onClick={() => update({ density: option.value as 'comfortable' | 'compact' })}
                className={cn(
                  'rounded-lg border p-4 text-left hover:bg-muted',
                  preferences.density === option.value &&
                    'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{option.text}</span>
              </button>
            ))}
          </div>
        </Card>
        <Notice>
          Preferences are saved only in this browser. They do not change backend configuration or
          your public blog.
        </Notice>
      </div>
    </>
  );
}
