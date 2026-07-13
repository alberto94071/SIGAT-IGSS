"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const INTERVALO_MS = 7000;

export default function LoginClient({ fotos }: { fotos: string[] }) {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (fotos.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % fotos.length), INTERVALO_MS);
    return () => clearInterval(t);
  }, [fotos.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email, password, redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Credenciales incorrectas. Verifique su correo y contraseña.");
    } else {
      router.push("/launcher");
    }
  }

  return (
    <div className="relative min-h-screen bg-gray-200 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Fondo: la misma foto activa, difuminada, detrás de toda la pantalla */}
      {fotos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`bg-${src}`}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 w-full h-full object-cover blur-2xl scale-110 transition-opacity duration-[2000ms] ease-in-out ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {fotos.length > 0 && <div className="absolute inset-0 bg-black/25" />}

      {/* Tarjeta dividida: fotos a la izquierda, formulario blanco a la derecha */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[1.15fr_1fr] md:min-h-[560px]">

        {/* ── Panel de fotos ── */}
        <div className={`relative h-52 sm:h-64 md:h-auto overflow-hidden ${fotos.length === 0 ? "bg-gradient-to-br from-brand-600 to-brand-900" : "bg-brand-900"}`}>
          {fotos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden
              loading={i === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out ${i === idx ? "opacity-100 animate-login-kenburns" : "opacity-0"}`}
            />
          ))}
          {/* Velo para que la marca se lea sobre cualquier foto */}
          {fotos.length > 0 && (
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-900/30 to-black/20" />
          )}

          {/* Marca centrada sobre la foto */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur rounded-2xl mb-3 ring-2 ring-white/25">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg tracking-tight">CIP</h1>
            <p className="text-white/90 text-sm mt-1 drop-shadow">Control Interno Presupuestario</p>
            <p className="text-white/70 text-xs mt-0.5 drop-shadow">Instituto Guatemalteco de Seguridad Social</p>
          </div>

          {/* Indicador de fotos */}
          {fotos.length > 1 && (
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
              {fotos.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} aria-label={`Foto ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`} />
              ))}
            </div>
          )}
        </div>

        {/* ── Panel del formulario ── */}
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-brand-700">Bienvenido</h2>
            <p className="text-sm text-gray-500 mt-1">Inicia sesión con tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email" required
                className="input rounded-xl bg-gray-50 focus:bg-white"
                placeholder="usuario@igss.gob.gt"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password" required
                className="input rounded-xl bg-gray-50 focus:bg-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 rounded-xl">
              {loading ? "Verificando..." : "Ingresar al sistema"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Instituto Guatemalteco de Seguridad Social
          </p>
        </div>
      </div>
    </div>
  );
}
