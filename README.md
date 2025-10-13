# Betclic Spin & Go Tracker (MVP)

Suivi des tournois Spin & Go Betclic: import `.txt`, parsing asynchrone, stats et dashboards.

## Prérequis
- Node.js ≥ 18

## Démarrage rapide (local, SQLite)
1. Installer les dépendances: `npm install`
2. Générer Prisma (SQLite dev) et migrer:
   - `npm run db:generate:dev`
   - `npm run db:migrate:dev`
3. Importer le fixture d’exemple en base: `npm run dev:parse`
4. Démarrer l’app: `npm run dev` puis ouvrir `http://localhost:3000/dashboard`

Note: Auth par e‑mail possible via `EMAIL_SERVER` + `EMAIL_FROM` + `NEXTAUTH_SECRET`. Sinon, utilisez `dev:parse` pour peupler la base.

## Variables d’environnement
Voir `.env.example` et renseigner si besoin:
- NextAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM`
- S3/R2: `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- QStash (optionnel): `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- Redis (optionnel): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Sentry (optionnel): `SENTRY_DSN`
- Prod DB: `DATABASE_URL` (Neon Postgres)

## Flux
1) `/api/upload-url` -> upload direct S3/R2 -> `/api/imports`
2) `/api/imports/:id/parse` (QStash ou fallback dev) -> persistance (Prisma)
3) KPIs `/api/stats` -> Dashboard (ROI, ITM, profit, histogramme multiplicateurs)

## Scripts
- Tests parser: `npm test`
- Parser fixture -> DB: `npm run dev:parse`
- Dev server: `npm run dev`

## Prod (Neon Postgres)
1. Créer Neon, récupérer `DATABASE_URL`
2. `npx prisma generate` puis `npx prisma migrate deploy`
3. Déployer (ex: Vercel) et configurer secrets (.env)

## Dossiers clés
- `src/app/api/*` — endpoints (upload, imports, stats, parse)
- `src/packages/parsers/betclic` — parser Betclic
- `src/server/parseImport.ts` — pipeline parsing/persistance
- `prisma/schema.dev.prisma` — schéma SQLite dev
- `prisma/schema.prisma` — schéma Postgres prod
