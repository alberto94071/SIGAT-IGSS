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
    <div className={`relative min-h-screen flex items-center justify-center p-4 overflow-hidden ${fotos.length === 0 ? "bg-gradient-to-br from-brand-700 to-brand-900" : "bg-brand-900"}`}>
      {/* ── Fondo: pase de fotos con fundido y zoom lento ── */}
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
      {/* Velo para que el formulario siga legible sobre cualquier foto */}
      {fotos.length > 0 && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-black/50 to-black/70" />
      )}

      <div className="relative w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow">CIP</h1>
          <p className="text-brand-200 text-sm mt-1 drop-shadow">Control Interno Presupuestario</p>
          <p className="text-brand-300 text-xs mt-0.5 drop-shadow">Instituto Guatemalteco de Seguridad Social</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email" required
                className="input"
                placeholder="usuario@igss.gob.gt"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password" required
                className="input"
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

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? "Verificando..." : "Ingresar al sistema"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Instituto Guatemalteco de Seguridad Social
          </p>
        </div>

        {/* Indicador de fotos */}
        {fotos.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-5">
            {fotos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Foto ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
