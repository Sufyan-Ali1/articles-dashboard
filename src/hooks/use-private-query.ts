import { useAuth } from '@/features/auth/auth';
export function useScope() {
  const { user } = useAuth();
  return [user?.id, user?.role] as const;
}
