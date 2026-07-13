import fs from "fs";
import path from "path";
import LoginClient from "./LoginClient";

// La lista de fotos del fondo se resuelve en build: cualquier imagen que esté
// en public/login-fondo/ entra al pase automáticamente (en orden alfabético).
// Si la carpeta está vacía, el login conserva su fondo de gradiente.
export const dynamic = "force-static";

export default function LoginPage() {
  let fotos: string[] = [];
  try {
    const dir = path.join(process.cwd(), "public", "login-fondo");
    fotos = fs.readdirSync(dir)
      .filter(f => /\.(jpe?g|jfif|png|webp|avif|gif)$/i.test(f))
      .sort()
      .map(f => `/login-fondo/${f}`);
  } catch {
    // Carpeta ausente: sin fotos.
  }

  return <LoginClient fotos={fotos} />;
}
