# 🌍 Veo Geo League

High-stakes GeoGuessr tracker for your colleague group. Ultra-dark Veo sports camera aesthetic.

## Features

- **Monthly Leaderboard** — ranked by average of top 15 daily scores ÷ 15
- **Daily MVP Badge** 🏅 — auto-tagged to the day's highest scorer
- **Red Card System** 🟥 — one per day per player, tracked and displayed
- **Post-Match Comments** — click any score to leave trash talk
- **League Chat** — real-time trash talk feed
- **Season Archive** — browse any previous month's results
- **Honor System** — no passwords, select your name and play

## Quick Start (Docker)

```bash
docker compose up --build
```

App runs at http://localhost:3000

## Local Development

```bash
npm install
mkdir -p data
npx prisma migrate dev --name init
npm run dev
```

## Tech Stack

- **Next.js 14** (App Router)
- **Prisma** + **SQLite** (mounted Docker volume)
- **Tailwind CSS** with Veo color system
- **Barlow Condensed** + **Space Mono** typography
- **lucide-react** icons

## Database Schema

| Table | Purpose |
|-------|---------|
| `Player` | Name + country flag emoji |
| `Score` | 3 rounds per day per player, auto-total |
| `RedCard` | One per giver per day, references score |
| `Comment` | Post-match comments on individual scores |
| `ChatMessage` | League chat feed |

## Scoring Logic

- Max **5,000 pts** per round, **15,000 pts** per day
- Monthly rank = sum of **top 15 daily totals** ÷ 15
- Leaderboard resets on the **1st of each month** (archive preserves history)

## Color System

| Name | Hex | Use |
|------|-----|-----|
| Veo Green | `#30FF51` | Winners, accents, positive |
| Veo Red | `#FF3030` | Red cards, penalties, alerts |
| Background | `#000000` | Base background |
| Surface | `#0b0e11` | Cards, panels |
