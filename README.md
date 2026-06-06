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

- [ ] Integrar Supabase para auth + persistencia
- [ ] Sistema de puntuación real (con resultados oficiales)
- [ ] Grupos privados para competir con amigos
- [ ] Predicciones de eliminatoria
- [ ] Deploy a Vercel

## Licencia

Uso personal. Datos del torneo basados en información pública.
