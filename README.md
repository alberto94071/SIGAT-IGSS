# IGSS — Sistema de Fondo Rotativo Interno

**Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos — Tejutla, San Marcos**

Stack: Next.js 15 · Neon PostgreSQL · NextAuth v5 · Drizzle ORM · Tailwind CSS · Vercel

---

## Estructura del proyecto

```
src/
├── app/
│   ├── login/                   ← Página de login
│   ├── dashboard/
│   │   ├── layout.tsx           ← Sidebar + TopBar (protegido)
│   │   ├── page.tsx             ← Dashboard con stats
│   │   ├── usuarios/            ← CRUD usuarios + permisos (superadmin)
│   │   ├── configuracion/       ← Configuración del sistema
│   │   ├── catalogos/           ← Catálogo de insumos (habilitar/deshabilitar)
│   │   ├── servicios/           ← Registro de servicios
│   │   ├── pagos/               ← Tabla maestra de pagos
│   │   ├── banco/               ← Libro de movimientos bancarios
│   │   ├── caja-chica/          ← Gastos de caja chica
│   │   ├── liquidacion/         ← Liquidación + conciliación del fondo
│   │   ├── reportes/            ← Libro de banco, conciliación, programación
│   │   └── documentos/          ← SIAF, DAB-60, Vale, Baucher, Acta, Carta
│   └── api/auth/[...nextauth]/  ← NextAuth handlers
├── components/
│   ├── Sidebar.tsx              ← Navegación lateral
│   └── TopBar.tsx               ← Barra superior
└── lib/
    ├── schema.ts                ← Esquema Drizzle (todas las tablas)
    ├── db.ts                    ← Conexión Neon
    ├── auth.ts                  ← NextAuth config
    └── permisos.ts              ← Roles, permisos y nav items
```

---

## Roles del sistema

| Rol           | Descripción                                              |
|---------------|----------------------------------------------------------|
| `superadmin`  | Acceso total. Gestiona usuarios, permisos y configuración |
| `admin`       | Todos los módulos excepto usuarios y configuración        |
| `operador`    | Servicios, pagos, banco, caja chica, reportes, documentos |
| `consulta`    | Solo reportes (lectura)                                   |

Los permisos pueden personalizarse por usuario desde el panel de usuarios.

---

## Setup — Paso a paso

### 1. Clonar y dependencias

```bash
git clone https://github.com/TU_USUARIO/igss-fondo-rotativo.git
cd igss-fondo-rotativo
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
AUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Crear la base de datos (Neon)

1. Ve a [console.neon.tech](https://console.neon.tech)
2. Crea un nuevo proyecto: `igss-fondo-rotativo`
3. Copia la connection string a `DATABASE_URL`

### 4. Inicializar la BD (tablas + superadmin)

```bash
npx tsx scripts/seed.ts
```

Esto crea todas las tablas y el primer superadmin:
- **Email:** `admin@igss.gob.gt`
- **Password:** `Admin@IGSS2026!`

⚠️ **Cambia la contraseña inmediatamente** desde el panel de usuarios.

### 5. Desarrollo local

```bash
npm run dev
# → http://localhost:3000
```

---

## Deploy en Vercel

```bash
# Instala Vercel CLI
npm i -g vercel

# Deploy
vercel

# Variables de entorno en Vercel dashboard:
# DATABASE_URL, AUTH_SECRET
# NEXTAUTH_URL se setea automáticamente
```

---

## Credencial inicial del Super Admin

```
URL:      /login
Email:    admin@igss.gob.gt
Password: Admin@IGSS2026!
```

**Primeros pasos después del deploy:**
1. Cambiar la contraseña del superadmin
2. Crear los demás usuarios desde `/dashboard/usuarios`
3. Asignar roles y personalizar permisos
4. Verificar la configuración en `/dashboard/configuracion`

---

## Módulos implementados (Sprint 1)

- [x] Autenticación con NextAuth v5
- [x] Roles: superadmin, admin, operador, consulta
- [x] Permisos granulares por módulo (toggle por usuario)
- [x] Panel de usuarios: crear, editar, reset contraseña, habilitar/deshabilitar
- [x] Catálogo de insumos: CRUD + habilitar/deshabilitar temporalmente
- [x] Configuración del sistema (datos institucionales)
- [x] Dashboard con métricas del fondo
- [x] Log de auditoría automático

## Próximos sprints

- [ ] Sprint 2: Servicios, Pagos, Banco, Caja Chica
- [ ] Sprint 3: Liquidación, Conciliación, Reportes
- [ ] Sprint 4: Generación de documentos (SIAF, DAB-60, Vale, Baucher)
