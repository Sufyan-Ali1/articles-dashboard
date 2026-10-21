import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { setUnsavedChanges } from '@/lib/unsaved';
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    setUnsavedChanges(dirty);
    return () => setUnsavedChanges(false);
  }, [dirty]);
  const allow = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allow.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty && !allow.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
  useEffect(() => {
    allow.current = false;
  }, [dirty]);
  return {
    allowNavigation: () => {
      allow.current = true;
    },
    warning: (
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Leave without saving?"
        description="Your unsaved changes will be lost. Save your article before leaving this page."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Discard changes
          </Button>
        </div>
      </Dialog>
    ),
  };
}
