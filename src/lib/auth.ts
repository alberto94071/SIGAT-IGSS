import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email:    { label: "Correo",     type: "email"    },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, credentials.email as string))
          .limit(1);

        if (!user || !user.activo) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        // Update last_login
        await db
          .update(usuarios)
          .set({ last_login: new Date().toISOString() })
          .where(eq(usuarios.id, user.id));

        return {
          id:       String(user.id),
          name:     user.nombre,
          email:    user.email,
          rol:      user.rol,
          permisos: user.permisos,
        };
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
});
