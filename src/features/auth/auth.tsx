import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api, setApiSession, setSessionRenewal, withSessionLock } from '@/lib/api';
import type { Resource, Token, User } from '@/types/api';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  sessionError: unknown;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  expiresAt: number | null;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<unknown>(null);
  const renewal = useRef<Promise<void> | null>(null);
  const pendingLogout = useRef<Promise<unknown>>(Promise.resolve());
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const generation = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const logout = useCallback(() => {
    pendingLogout.current = withSessionLock(() =>
      api('/auth/logout', { method: 'POST', anonymous: true }),
    ).catch(() => {
      toast.error(
        'Could not sign out on the server. Reconnect and sign out again to end the saved session.',
      );
    });
    generation.current += 1;
    tokenRef.current = null;
    userRef.current = null;
    setApiSession(null, () => undefined);
    void client.cancelQueries();
    client.clear();
    setUser(null);
    setExpiresAt(null);
    setSessionError(null);
  }, [client]);
  const expire = useCallback(() => {
    logout();
    toast.error('Your session expired. Sign in again to continue.');
  }, [logout]);
  const restoreSession = useCallback((): Promise<void> => {
    if (renewal.current) return renewal.current;
    const attempt = generation.current;
    const work = async () => {
      setSessionError(null);
      try {
        const result = await api<Resource<Token>>('/auth/refresh', {
          method: 'POST',
          anonymous: true,
        });
        const grantedAt = Date.now();
        const identity = await api<Resource<User>>('/auth/me', { token: result.data.access_token });
        if (attempt !== generation.current) return;
        const previous = userRef.current;
        const sameIdentity =
          previous?.id === identity.data.id && previous?.role === identity.data.role;
        if (previous && !sameIdentity) {
          await client.cancelQueries();
          if (attempt !== generation.current) return;
          client.clear();
        }
        tokenRef.current = result.data.access_token;
        userRef.current = identity.data;
        setApiSession(result.data.access_token, expire, sameIdentity);
        setExpiresAt(grantedAt + result.data.expires_in * 1000);
        setUser(identity.data);
      } catch (error) {
        if (attempt !== generation.current) return;
        if (error instanceof ApiError && error.status === 401) {
          generation.current += 1;
          tokenRef.current = null;
          userRef.current = null;
          setApiSession(null, () => undefined);
          void client.cancelQueries();
          client.clear();
          setUser(null);
          setExpiresAt(null);
        } else setSessionError(error);
        throw error;
      } finally {
        if (attempt === generation.current || !tokenRef.current) setInitializing(false);
      }
    };
    renewal.current = withSessionLock(work).finally(() => {
      renewal.current = null;
    });
    return renewal.current;
  }, [client, expire]);
  useEffect(() => {
    setSessionRenewal(restoreSession);
    let active = true;
    queueMicrotask(() => {
      if (active) void restoreSession().catch(() => undefined);
    });
    return () => {
      active = false;
      setSessionRenewal(null);
    };
  }, [restoreSession]);
  const login = useCallback(
    async (email: string, password: string) => {
      const attempt = ++generation.current;
      await pendingLogout.current;
      const result = await withSessionLock(() =>
        api<Resource<Token>>('/auth/login', {
          method: 'POST',
          body: { email, password },
          anonymous: true,
        }),
      );
      const grantedAt = Date.now();
      const identity = await api<Resource<User>>('/auth/me', { token: result.data.access_token });
      if (attempt !== generation.current) return;
      client.clear();
      tokenRef.current = result.data.access_token;
      userRef.current = identity.data;
      setApiSession(result.data.access_token, expire);
      setExpiresAt(grantedAt + result.data.expires_in * 1000);
      setUser(identity.data);
      setSessionError(null);
      setInitializing(false);
    },
    [client, expire],
  );
  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) return;
    const attempt = generation.current;
    const result = await api<Resource<User>>('/auth/me');
    if (attempt !== generation.current) return;
    const previous = userRef.current;
    if (previous && (previous.id !== result.data.id || previous.role !== result.data.role)) {
      await client.cancelQueries();
      if (attempt !== generation.current) return;
      client.clear();
    }
    userRef.current = result.data;
    setUser(result.data);
  }, [client]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        void restoreSession().catch(() => undefined);
      },
      Math.max(1000, expiresAt - Date.now() - 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, restoreSession]);
  useEffect(() => {
    const onFocus = () => {
      if (expiresAt && expiresAt <= Date.now()) void restoreSession().catch(() => undefined);
      else void refreshUser().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [expiresAt, restoreSession, refreshUser]);
  useEffect(
    () => () => {
      generation.current += 1;
      tokenRef.current = null;
      userRef.current = null;
      setApiSession(null, () => undefined);
    },
    [],
  );
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshUser,
        expiresAt,
        initializing,
        sessionError,
        restoreSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
