import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, message } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared';
import type { Resource } from '@/types/api';

const UploadContext = createContext<(change: number) => void>(() => undefined);
export function ImageUploadProvider({
  children,
  onPendingChange,
}: {
  children: ReactNode;
  onPendingChange: (change: number) => void;
}) {
  return <UploadContext.Provider value={onPendingChange}>{children}</UploadContext.Provider>;
}

export function ImageUpload({
  id,
  disabled,
  onUploaded,
}: {
  id: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const changePending = useContext(UploadContext);
  return (
    <Field
      label="Upload image"
      htmlFor={id}
      error={error}
      hint="JPEG, PNG, GIF, or WebP, up to 2 MiB. Uploads immediately; save the article to keep it."
    >
      <Input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        disabled={disabled || pending}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || busy.current) return;
          setError('');
          if (
            !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type) ||
            file.size === 0 ||
            file.size > 2 * 1024 * 1024
          ) {
            setError('Choose a JPEG, PNG, GIF, or WebP image up to 2 MiB.');
            return;
          }
          busy.current = true;
          setPending(true);
          changePending(1);
          try {
            const result = await api<Resource<{ secure_url: string; public_id: string }>>(
              '/media/images',
              { method: 'POST', rawBody: file },
            );
            if (mounted.current) onUploaded(result.data.secure_url);
          } catch (failure) {
            setError(message(failure));
          } finally {
            busy.current = false;
            setPending(false);
            changePending(-1);
          }
        }}
      />
      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          Uploading image…
        </p>
      )}
    </Field>
  );
}
