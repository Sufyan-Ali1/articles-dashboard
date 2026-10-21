import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/auth';
import { PreferencesProvider, usePreferences } from '@/features/settings/preferences';
import { createQueryClient } from '@/lib/query';
import { apiBase } from '@/lib/api';
import { router } from '@/app/router';
import { ErrorState } from '@/components/shared';
import './styles.css';

const queryClient = createQueryClient();
function Application() {
  const { preferences } = usePreferences();
  let configurationError: unknown;
  try {
    apiBase();
  } catch (error) {
    configurationError = error;
  }
  return (
    <>
      <Toaster position="top-right" richColors closeButton theme={preferences.theme} />
      {configurationError ? (
        <main className="mx-auto flex min-h-dvh max-w-xl items-center p-6">
          <ErrorState error={configurationError} />
        </main>
      ) : (
        <RouterProvider router={router} />
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AuthProvider>
          <Application />
        </AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  </StrictMode>,
);
