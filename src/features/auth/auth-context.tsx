import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api, setAccessToken, setRefreshHandler } from '@/lib/api';
import { closeAllSockets } from '@/lib/socket';
import { storage, StorageKeys } from '@/lib/storage';
import type { AuthUser, Session } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  token: string | null;
  signIn: (identifier: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  const persist = useCallback(async (session: Session) => {
    setAccessToken(session.accessToken);
    setToken(session.accessToken);
    refreshTokenRef.current = session.refreshToken;
    setUser(session.user);
    await Promise.all([
      storage.set(StorageKeys.accessToken, session.accessToken),
      storage.set(StorageKeys.refreshToken, session.refreshToken),
      storage.set(StorageKeys.user, JSON.stringify(session.user)),
    ]);
  }, []);

  const clear = useCallback(async () => {
    setAccessToken(null);
    setToken(null);
    refreshTokenRef.current = null;
    setUser(null);
    closeAllSockets();
    await Promise.all([
      storage.del(StorageKeys.accessToken),
      storage.del(StorageKeys.refreshToken),
      storage.del(StorageKeys.user),
    ]);
  }, []);

  // Renovación de token ante 401 (registrada en el cliente API)
  const doRefresh = useCallback(async (): Promise<string | null> => {
    const rt = refreshTokenRef.current;
    if (!rt) return null;
    try {
      const session = await api.post<Session>('/auth/refresh', { refreshToken: rt });
      await persist(session);
      return session.accessToken;
    } catch {
      await clear();
      setStatus('unauthenticated');
      return null;
    }
  }, [persist, clear]);

  useEffect(() => {
    setRefreshHandler(doRefresh);
    return () => setRefreshHandler(null);
  }, [doRefresh]);

  // Bootstrap de sesión desde el almacenamiento seguro
  useEffect(() => {
    (async () => {
      const [at, rt, u] = await Promise.all([
        storage.get(StorageKeys.accessToken),
        storage.get(StorageKeys.refreshToken),
        storage.get(StorageKeys.user),
      ]);
      if (at && rt && u) {
        setAccessToken(at);
        setToken(at);
        refreshTokenRef.current = rt;
        setUser(JSON.parse(u));
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    })();
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const session = await api.post<Session>('/auth/login', {
        identifier,
        password,
      });
      await persist(session);
      setStatus('authenticated');
      return session.user;
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignora errores de red al cerrar sesión
    }
    await clear();
    setStatus('unauthenticated');
  }, [clear]);

  return (
    <AuthContext.Provider value={{ status, user, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
