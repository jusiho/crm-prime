import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthTokens } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * NextAuth (Auth.js) en estrategia JWT.
 * No verifica credenciales por su cuenta: delega en el backend NestJS
 * (POST /auth/login), que es la autoridad del JWT. El access token y el
 * refresh token quedan dentro del token de NextAuth (cookie httpOnly) y
 * NO se exponen en la sesión (que el navegador puede leer en
 * /api/auth/session). El servidor los lee con `lib/session-token.ts`.
 *
 * La renovación del access token vive en `middleware.ts`, no aquí.
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
      },
      async authorize(credentials) {
        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
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
      }
      // Sin refresco aquí: `auth()` descarta la cookie que devolvería, así que
      // el refresh token rotado se perdería. Lo hace el middleware.
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
});
