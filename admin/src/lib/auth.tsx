import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, authedApi, refreshAccessToken, setAccessToken, unwrap } from "@/api/client";
import type { User } from "@/api/types";

/** Marca el navegador del administrador para excluirlo de las métricas (docs/04-metrics.md). */
export const ADMIN_FLAG_KEY = "devnull_admin";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function markAdminBrowser(): void {
  try {
    window.localStorage.setItem(ADMIN_FLAG_KEY, "1");
  } catch {
    // Almacenamiento no disponible (modo privado): no es crítico.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });
  const queryClient = useQueryClient();

  const loadUser = useCallback(async () => {
    const user = await unwrap(authedApi.GET("/api/v1/auth/me"));
    setState({ status: "authenticated", user });
  }, []);

  // Restaura la sesión con la cookie de refresh al cargar el panel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) {
        setState({ status: "anonymous", user: null });
        return;
      }
      try {
        await loadUser();
      } catch {
        if (!cancelled) setState({ status: "anonymous", user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await unwrap(api.POST("/api/v1/auth/login", { body: { email, password } }));
      setAccessToken(tokens.access_token);
      markAdminBrowser();
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.POST("/api/v1/auth/logout");
    } finally {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: "anonymous", user: null });
    }
  }, [queryClient]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
