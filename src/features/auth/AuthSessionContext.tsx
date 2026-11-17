import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSessionState } from './authTypes';
import { subscribeToAuthSession, type AuthSessionSubscription } from './authSession';

type AuthSessionContextValue = {
  session: AuthSessionState;
  refreshSession: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSessionState>({ status: 'loading' });
  const subscription = useRef<AuthSessionSubscription | null>(null);

  useEffect(() => {
    const authSession = subscribeToAuthSession(setSession);
    subscription.current = authSession;
    return () => {
      authSession.unsubscribe();
      if (subscription.current === authSession) {
        subscription.current = null;
      }
    };
  }, []);

  const refreshSession = useCallback(async () => {
    await subscription.current?.refresh();
  }, []);

  return (
    <AuthSessionContext.Provider value={{ session, refreshSession }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionState | null {
  return useContext(AuthSessionContext)?.session ?? null;
}

export function useRefreshAuthSession(): (() => Promise<void>) | null {
  return useContext(AuthSessionContext)?.refreshSession ?? null;
}
