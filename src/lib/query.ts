import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 1 && error instanceof ApiError && [0, 500, 502, 503, 504].includes(error.status),
      },
      mutations: { retry: false },
    },
  });
}
