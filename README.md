# Team3D Tracker

A gamified daily-habit and fitness tracking web app for the Team3D community. Members log daily tasks, workouts, and lifestyle habits and compete on leaderboards in an RPG-style progression system with avatars, gold, weapons, achievements, and PvP item effects.

Built with Next.js 14 (App Router) + React + TypeScript on the front end and Supabase (Postgres, Auth, RLS, scheduled functions) on the back end.

## Features

### Core progression
- **Email/password auth** with password recovery flow (Supabase Auth + PKCE)
- **Daily tasks** — up to 10 per day, complete to earn EXP and level up your avatar
- **Daily reset at 5 PM EST** via a Supabase cron-triggered API route, with a live countdown in the header
- **Daily level (0–10)** drives a tiered avatar appearance; **lifetime EXP** persists across resets
- **Gold currency** earned through activity, spent in the shop

### Fitness & lifestyle modules
- **Lifts tracker** — log strength workouts with per-lift history, personal records, and a core-lifts leaderboard
- **10 T Commandments** — daily testosterone-habit checklist (sleep, sunlight, training, etc.) with streak tracking
- **Calendar** — historical view of every day's tasks, lifts, and weekly leaderboard snapshots; supports "copy from any day" to bring forward a previous task list
- **Notes** — per-day private notes

### Social & competitive
- **Daily, weekly, and lifetime leaderboards**
- **Friend system** — send / accept / reject requests, view friends' profiles and activity
- **Shop & inventory** — buy weapons, armour, potions, and cosmetics with gold
- **PvP item effects** — weapons reduce a target's lifetime EXP, armour blocks attacks, potions grant 24h immunity
- **Attack animations** and an **inbox** for notifications (attacks received, friend requests, achievements unlocked)
- **Achievements** with unlock notifications

### Admin & ops
- **Admin panel** for managing users, items, and resetting state
- **Daily reset cron endpoint** at `app/api/cron/daily-reset/route.ts`
- Mobile-responsive UI with a slide-out sidebar

## Tech stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Backend:** Supabase (Postgres + Row Level Security, Auth, Edge Functions / scheduled jobs)
- **Styling:** Inline CSS-in-JS with a dark / orange theme

## Getting started

### 1. Install
```bash
npm install
```

### 2. Configure Supabase
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CRON_SECRET=your_cron_secret   # used by app/api/cron/daily-reset
```

### 3. Database schema
Core tables (see SQL examples in `lib/` for the full set): `profiles`, `tasks`, `friend_requests`, `shop_items`, `user_inventory`, `lifts`, `lift_entries`, `core_lifts`, `testosterone_entries`, `achievements`, `notifications`, `notes`, `daily_history`. Enable RLS with per-user policies.

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000.

### 5. Schedule the daily reset
Point a Supabase scheduled function (or any cron) at `POST /api/cron/daily-reset` with the `CRON_SECRET` bearer token, set to fire at 5 PM EST.

## Project layout

```
app/
  page.tsx                       # Auth gate, layout, view router
  api/cron/daily-reset/route.ts  # Cron endpoint that resets daily state
  reset-password/page.tsx
components/                       # Tasks, Lifts, CoreLifts, Calendar, Testosterone,
                                  # Leaderboard, Friends, Shop, Inbox, Achievements,
                                  # Avatar, AttackAnimation, Admin, HowToPlay, Modal
lib/                              # Supabase client + per-feature data helpers
                                  # (auth, tasks, lifts, coreLifts, calendar,
                                  #  testosterone, achievements, notifications,
                                  #  shop, friends, admin, notes, modal)
```

## License

MIT
