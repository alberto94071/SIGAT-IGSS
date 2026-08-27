import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

// Bloqueo temporal tras varios intentos fallidos seguidos — sin esto, un
// atacante puede probar contraseñas contra un email conocido sin límite
// (fuerza bruta). Se guarda en la fila del usuario (no en memoria del
// proceso) para que el bloqueo sea real en un despliegue serverless, donde
// cada request puede caer en una instancia distinta.
export const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

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

        // El mismo campo de login sirve para correo (la mayoría de roles) o
        // IBM/número de empleado (rol "colaborador", que no tiene correo
        // institucional — ver CLAUDE.md).
        const identificador = credentials.email as string;
        const [user] = await db
          .select()
          .from(usuarios)
          .where(or(eq(usuarios.email, identificador), eq(usuarios.ibm, identificador)))
          .limit(1);

        if (!user || !user.activo) return null;

        if (user.bloqueado_hasta && new Date(user.bloqueado_hasta).getTime() > Date.now()) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) {
          const intentos = user.intentos_fallidos + 1;
          await db.update(usuarios).set(
            intentos >= MAX_INTENTOS_FALLIDOS
              ? { intentos_fallidos: 0, bloqueado_hasta: new Date(Date.now() + BLOQUEO_MS).toISOString() }
              : { intentos_fallidos: intentos }
          ).where(eq(usuarios.id, user.id));
          return null;
        }

        // Update last_login y limpiar cualquier racha de intentos fallidos previa
        await db
          .update(usuarios)
          .set({ last_login: new Date().toISOString(), intentos_fallidos: 0, bloqueado_hasta: null })
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
