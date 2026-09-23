import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthTokens } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * NextAuth (Auth.js) en estrategia JWT.
 * No verifica credenciales por su cuenta: delega en el backend NestJS
 * (POST /auth/login), que es la autoridad del JWT. El access token y el
 * refresh token quedan dentro del token de NextAuth (cookie httpOnly);
 * el JS del navegador nunca los ve.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Necesario detrás de un proxy (Nginx Proxy Manager) en el VPS: sin esto
  // NextAuth rechaza la petición con UntrustedHost. AUTH_URL define el origen.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Subdominio de la empresa. No lo escribe nadie: lo pone la página de
        // acceso a partir de la cabecera que dejó el middleware, que a su vez
        // salió del Host real del navegador.
        orgSlug: { label: "Organización", type: "hidden" },
      },
      async authorize(credentials) {
        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
            // Va explícito porque esta llamada sale del servidor de Next: el
            // Host que vería la API sería el suyo, no el del navegador.
            ...(credentials?.orgSlug ? { orgSlug: credentials.orgSlug } : {}),
            platform: "WEB",
            deviceName: "Web",
          }),
        });
        if (!res.ok) return null;
        const tokens = (await res.json()) as AuthTokens;
        return {
          id: tokens.user.id,
          email: tokens.user.email,
          name: tokens.user.name ?? undefined,
          role: tokens.user.role,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpires: Date.now() + tokens.expiresIn * 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Primer login: copiar tokens del backend al JWT de NextAuth.
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpires = (user as any).accessTokenExpires;
        token.role = (user as any).role;
        return token;
      }
      // Token aún válido.
      if (Date.now() < (token.accessTokenExpires as number) - 30_000) {
        return token;
      }
      // Refrescar contra el backend (rotación de refresh token).
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        });
        if (!res.ok) {
          // 401/403: el refresh token ya no sirve (expirado o revocado) →
          // sesión muerta, forzamos re-login limpiando el token.
          if (res.status === 401 || res.status === 403) {
            return { ...token, error: "RefreshError" };
          }
          // 5xx u otro error transitorio del backend: NO matamos la sesión,
          // conservamos el token actual y reintentaremos en la próxima llamada.
          return token;
        }
        const refreshed = (await res.json()) as AuthTokens;
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpires = Date.now() + refreshed.expiresIn * 1000;
        delete (token as Record<string, unknown>).error;
        return token;
      } catch {
        // Error de red (API momentáneamente inalcanzable): mantenemos la sesión
        // y reintentamos luego, en vez de romperla y echar al usuario.
        return token;
      }
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
});
