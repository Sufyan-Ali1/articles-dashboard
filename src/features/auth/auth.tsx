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
import { api, setApiSession } from '@/lib/api';
import type { Resource, Token, User } from '@/types/api';

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  expiresAt: number | null;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const generation = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const logout = useCallback(() => {
    generation.current += 1;
    tokenRef.current = null;
    userRef.current = null;
    setApiSession(null, () => undefined);
    void client.cancelQueries();
    client.clear();
    setUser(null);
    setExpiresAt(null);
  }, [client]);
  const expire = useCallback(() => {
    logout();
    toast.error('Your session expired. Sign in again to continue.');
  }, [logout]);
  const login = useCallback(
    async (email: string, password: string) => {
      const attempt = ++generation.current;
      const result = await api<Resource<Token>>('/auth/login', {
        method: 'POST',
        body: { email, password },
        anonymous: true,
      });
      const grantedAt = Date.now();
      const identity = await api<Resource<User>>('/auth/me', { token: result.data.access_token });
      if (attempt !== generation.current) return;
      client.clear();
      tokenRef.current = result.data.access_token;
      userRef.current = identity.data;
      setApiSession(result.data.access_token, expire);
      setExpiresAt(grantedAt + result.data.expires_in * 1000);
      setUser(identity.data);
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
    const timer = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, expire]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => toast.warning('Your session expires in one minute. Save your work now.'),
      Math.max(0, expiresAt - Date.now() - 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  useEffect(() => {
    const onFocus = () => {
      if (expiresAt && expiresAt <= Date.now()) expire();
      else void refreshUser().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [expiresAt, expire, refreshUser]);
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
    <AuthContext.Provider value={{ user, login, logout, refreshUser, expiresAt }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
