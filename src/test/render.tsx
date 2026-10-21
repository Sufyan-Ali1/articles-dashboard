import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { createQueryClient } from '@/lib/query';
import { AuthProvider } from '@/features/auth/auth';
import { PreferencesProvider } from '@/features/settings/preferences';
export function renderRoutes(routes: RouteObject[], initial = '/') {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  const result = render(
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, client };
}
export function WithChildren({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
