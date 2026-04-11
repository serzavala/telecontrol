# TeleControl — Control de Producción de Cuadrillas

App web para control de producción de cuadrillas de telecomunicaciones.  
Esquemas: producción semanal (IZZI-Monstel 2026) y renta quincenal (Casos de Negocio CN).

---

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **PDF**: jsPDF + jsPDF-AutoTable
- **Gráficas**: Chart.js
- **Deploy**: Vercel

---

## Configuración paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/telecontrol.git
cd telecontrol
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. En el menú izquierdo ve a **SQL Editor**
4. Copia y pega el contenido de `supabase-schema.sql` y ejecútalo
5. Ve a **Settings → API** y copia:
   - `Project URL`
   - `anon public key`

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus datos de Supabase:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

---

## Despliegue en Vercel

### Opción A — Desde GitHub (recomendado)

1. Sube el proyecto a GitHub
2. Ve a [vercel.com](https://vercel.com) y conecta tu cuenta de GitHub
3. Importa el repositorio `telecontrol`
4. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clic en **Deploy**

Tu app estará en `https://telecontrol-xxxx.vercel.app`

### Opción B — CLI de Vercel

```bash
npm install -g vercel
vercel
```

---

## Cargar conceptos iniciales IZZI-Monstel 2026

Una vez que hayas creado tu cuenta en la app, ve a **Conceptos** y agrega:

| # | Concepto | Unidad | Precio |
|---|---|---|---|
| 1 | Drop unifibra cinchado | Metro lineal acero | $6.50 |
| 2 | Instalación de NAP | Pza | $200.00 |
| 3 | Prueba potencia NAP | Pza | $200.00 |
| 5 | Tendido fibra 24H | Metro lineal acero | $6.00 |
| 6 | Tendido fibra 48H | Metro lineal acero | $7.00 |
| 7 | Tendido fibra 96H | Metro lineal acero | $8.00 |
| 8 | Tendido fibra 144H | Metro lineal acero | $9.00 |
| 9 | Tendido fibra 288H (Feder) | Metro lineal acero | $10.00 |
| 10 | Hilado fibra cualquier hilos | Metro lineal acero | $3.00 |
| 11 | Fusión | Por hilo | $110.00 |

---

## Estructura del proyecto

```
telecontrol/
├── src/
│   ├── components/
│   │   ├── Layout.jsx        # Sidebar + navegación
│   │   └── Modal.jsx         # Modal reutilizable
│   ├── hooks/
│   │   ├── useAuth.jsx       # Contexto de autenticación
│   │   └── useDB.js          # Todas las operaciones con Supabase
│   ├── lib/
│   │   ├── supabase.js       # Cliente de Supabase
│   │   ├── pdf.js            # Generación de PDFs
│   │   └── fechas.js         # Helpers de semanas y fechas CN
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Graficas.jsx
│   │   ├── Produccion.jsx
│   │   ├── CasosNegocio.jsx
│   │   ├── Catalogos.jsx     # Cuadrillas, Proyectos, Conceptos
│   │   ├── CorteSemanal.jsx
│   │   ├── CorteCN.jsx
│   │   ├── Historial.jsx
│   │   └── Usuarios.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase-schema.sql       # Esquema de base de datos
├── .env.example
└── README.md
```

---

## Flujo de cortes

| Esquema | Frecuencia | Día de corte | Día de cobro |
|---|---|---|---|
| Producción semanal | Cada semana | Viernes | Siguiente lunes |
| Casos de Negocio CN | Quincenal | Día 14 y penúltimo del mes | Día 15 y último del mes |

---

Desarrollado con Claude · Anthropic 2026
