import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthTokens } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * Con subdominios por empresa, `AUTH_URL` NO puede estar fijado.
 *
 * Auth.js lo usa como origen único para construir las redirecciones y las
 * cookies de sesión. Con `AUTH_URL=https://trimmo.lat`, entrar en
 * `acme.trimmo.lat` creaba la cookie en el subdominio y después redirigía al
 * dominio raíz — donde esa cookie no existe. El usuario veía la portada sin
 * sesión y parecía que el alta "no había redirigido".
 *
 * Sin `AUTH_URL`, `trustHost: true` hace que el origen salga de la cabecera
 * `Host` de cada petición (o `X-Forwarded-Host`), y el protocolo de
 * `X-Forwarded-Proto` con HTTPS por defecto. Cada subdominio es así su propio
 * origen de autenticación, que es lo que un SaaS por subdominios necesita.
 *
 * Se descarta aquí, en vez de confiar en que nadie lo ponga en el `.env`,
 * porque este fallo ya pasó una vez y no dio ningún error: solo un
 * comportamiento raro difícil de atribuir.
 */
if (process.env.SAAS_BASE_DOMAIN && process.env.AUTH_URL) {
  console.warn(
    `[auth] AUTH_URL="${process.env.AUTH_URL}" se ignora: con SAAS_BASE_DOMAIN el origen sale del Host de cada petición.`,
  );
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
}

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
  // NextAuth rechaza la petición con UntrustedHost. Y con subdominios por
  // empresa es además lo que decide el origen: ver el bloque de AUTH_URL arriba.
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
        // Pase de un solo uso que devuelve el alta de empresa. Si viene, no
        // hay contraseña: la identidad ya la comprobó el alta hace un momento.
        handoff: { label: "Pase", type: "hidden" },
      },
      async authorize(credentials) {
        const handoff =
          typeof credentials?.handoff === "string" ? credentials.handoff : "";

        const res = await fetch(
          `${API_URL}/api/v1/auth/${handoff ? "handoff" : "login"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              handoff
                ? { token: handoff, platform: "WEB", deviceName: "Web" }
                : {
                    email: credentials?.email,
                    password: credentials?.password,
                    // Va explícito porque esta llamada sale del servidor de
                    // Next: el Host que vería la API sería el suyo, no el
                    // del navegador.
                    ...(credentials?.orgSlug
                      ? { orgSlug: credentials.orgSlug }
                      : {}),
                    platform: "WEB",
                    deviceName: "Web",
                  },
            ),
          },
        );
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
