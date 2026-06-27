# Mundial 2026 — Quiniela

Quiniela de predicciones para el Mundial 2026 (USA · Canadá · México). 48 equipos, 12 grupos, 104 partidos.

Hecho por [Julio Servan](https://instagram.com/julioservan).

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Instrument Serif** + **Geist** (Google Fonts)

## Features

- 🏠 Home con countdown al partido inaugural y ticker de equipos
- 📅 Calendario de partidos con vista de **Lista** y **Calendario** mensual
- 🏆 Página de los 12 grupos con tabla de posiciones
- 🥊 Bracket de eliminatoria (32 partidos a un encuentro)
- 🎯 Formulario de predicciones con guardado local
- 🏅 Ranking de usuarios
- 🌙 Dark mode con tipografía display italic

## Desarrollo

```bash
npm install
npm run dev
```

Por defecto arranca en [http://localhost:3000](http://localhost:3000). Para usar otro puerto:

```bash
PORT=3100 npm run dev
```

## Pipeline de datos automático (resultados + cuadro en vivo)

Los resultados, la clasificación y el cuadro de eliminatoria se actualizan
**solos** desde [API-Football](https://www.api-football.com) (API-SPORTS). La web
**nunca** llama a la API externa: un *poller* sincroniza los datos a Supabase y la
web lee de ahí.

### Cómo funciona

```
API-Football ──> /api/sync (cron, server) ──> Supabase ──> web (lee snapshot)
                     │                          ├─ mundial_results  (marcador final → quiniela + tabla)
                     │                          ├─ mundial_fixtures (snapshot en vivo + equipos de cada llave)
                     └─ cuida la cuota ─────────┴─ mundial_meta     (liga/temporada, cuota diaria, last_sync)
```

- **Capa de proveedor** (`lib/providers/`): toda la app habla con la interfaz
  `ResultsProvider` en *nuestros* tipos. Para cambiar de proveedor, edita un solo
  archivo (`lib/providers/index.ts`).
- **Liga/temporada** no se hardcodean: se resuelven vía `/leagues` y se cachean.
- **Cuota** (plan Free ~100 req/día): solo se llama a la API en ventanas de
  partido activo; se lleva la cuenta diaria y, si se agota, la web sirve el último
  dato con un aviso *"datos quizá con retraso"*.
- **Clasificación** con desempates FIFA completos (puntos → DG → GF →
  enfrentamiento directo → fair play → sorteo) y **ranking de los 8 mejores
  terceros** (`lib/fifa.ts`).
- **Cuadro** (`lib/bracket.ts`): los ganadores avanzan solos R32 → R16 → … →
  Final; las llaves sin definir muestran "Por definir".

### Puesta en marcha

1. **Consigue una key de API-Football**: regístrate en
   [dashboard.api-football.com](https://dashboard.api-football.com), copia tu
   *API Key* (plan Free disponible).
2. **Variables de entorno** (copia `.env.example` → `.env.local`). Las de servidor
   **nunca** se exponen al navegador:

   | Variable | Uso |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (navegador) |
   | `SUPABASE_SERVICE_ROLE_KEY` | El poller escribe resultados (solo servidor) |
   | `APIFOOTBALL_KEY` | Cabecera `x-apisports-key` (solo servidor) |
   | `CRON_SECRET` | Protege `/api/sync` |
   | `APIFOOTBALL_DAILY_CAP` (opc.) | Tope diario de peticiones (def. 95) |

3. **Base de datos**: ejecuta en el SQL Editor de Supabase, en orden:
   `supabase/schema.sql`, `supabase/winner-picks.sql`,
   `supabase/api-football.sql`, `supabase/match-detail.sql` y
   `supabase/knockout-scoring.sql` (este último para la puntuación enriquecida de
   eliminatorias: ganador 1 pt + resultado exacto 3 pts).
4. **Backfill inicial** (siembra los partidos para que la web no esté vacía):

   ```bash
   npm run backfill
   ```

5. **Cron**: `vercel.json` trae un cron **diario** (`0 12 * * *`) que llama a
   `/api/sync?mode=auto` (Vercel envía `Authorization: Bearer $CRON_SECRET`).
   Es compatible con el plan **Hobby**, pero solo refresca una vez al día.

   **Para actualización casi en vivo** (recomendado), añade un cron externo
   gratis (p. ej. [cron-job.org](https://cron-job.org)) cada 1-2 min apuntando a:

   ```
   https://TU-DOMINIO/api/sync?mode=auto&secret=TU_CRON_SECRET
   ```

   Modos: `auto` (completa periódica + en vivo durante partidos) · `live` (solo
   marcadores) · `full` (recarga todo).

> Nota: el plan **Hobby** de Vercel limita los crons a una vez al día. Para usar
> el cron de minutos directamente en Vercel necesitas el plan **Pro** (entonces
> cambia el `schedule` de `vercel.json` a `* * * * *`).

### Monitorización y fiabilidad

- **Panel admin** en `/admin/sync`: estado del robot (verde/ámbar/rojo), última
  sincronización, cuota usada (la nuestra y la que reporta el proveedor), liga
  detectada, equipos sin reconocer y últimos errores.
- **Endpoint `/api/health`**: el mismo estado en JSON, para vigilar o alertar.
- **Reintentos automáticos**: el adaptador reintenta ante errores temporales
  (red / 5xx / 429) con backoff antes de rendirse.
- **Forzar acciones**: `/api/sync?mode=full&secret=…` recarga todo;
  añade `&refresh=1` para re-detectar la liga.

## Estructura

```
worldcup/
├── app/                   # Rutas Next.js (App Router)
│   ├── matches/           # Calendario (vista lista + calendario)
│   ├── groups/            # 12 grupos
│   ├── eliminatoria/      # Bracket eliminatoria
│   ├── predictions/       # Formulario de quiniela
│   ├── leaderboard/       # Ranking
│   └── login/             # Stub auth (Supabase próximamente)
├── components/            # Componentes reutilizables
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Countdown.tsx
│   ├── MatchCard.tsx
│   ├── MatchesView.tsx    # Toggle lista/calendario
│   ├── MatchesList.tsx
│   ├── MatchesCalendar.tsx
│   ├── KnockoutBracket.tsx
│   ├── PredictionForm.tsx
│   └── TeamMarquee.tsx
├── lib/
│   ├── data/              # Mock data (teams, venues, matches)
│   └── utils/             # Helpers (format, calendar)
└── types/                 # TypeScript types
```

## Roadmap

- [x] Integrar Supabase para auth + persistencia
- [x] Sistema de puntuación real (con resultados oficiales)
- [x] Resultados, clasificación y cuadro automáticos (API-Football)
- [ ] Grupos privados para competir con amigos
- [ ] Predicciones de eliminatoria
- [ ] Deploy a Vercel

## Licencia

Uso personal. Datos del torneo basados en información pública.
