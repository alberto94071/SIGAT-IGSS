// auth.config.ts — configuración SIN imports de Node.js
// Este archivo es seguro para el Edge Runtime (middleware)
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },
  providers: [
    // En el middleware solo necesitamos declarar el provider,
    // la lógica authorize() vive en auth.ts (Node.js runtime)
    Credentials({
      name: "Credenciales",
      credentials: {
        email:    { label: "Correo",     type: "email"    },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize() {
        // authorize real está en auth.ts — aquí retornamos null
        // (el middleware solo valida JWT, no re-autentica)
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id!;
        token.rol      = (user as any).rol;
        token.permisos = (user as any).permisos;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id       = token.id as string;
        session.user.rol      = token.rol as string;
        session.user.permisos = token.permisos as string;
      }
      return session;
    },
  },
};
