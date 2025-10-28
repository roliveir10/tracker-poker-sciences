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

### QStash

Pour déléguer la phase de parsing à Upstash QStash (et éviter les timeouts côté client):

1. Créez un projet QStash et récupérez:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
2. Renseignez un domaine public accessible par QStash dans `QSTASH_BASE_URL` (ex: `https://app.mondomaine.com`). En l’absence de valeur, l’app tentera `NEXTAUTH_URL`, puis `https://${VERCEL_URL}`.
3. Déployez, puis testez un import: la route `POST /api/imports` doit répondre `202 { status: "queued" }`. QStash appellera ensuite `POST /api/imports/:id/parse` et mettra à jour l’import en base.

Si les variables QStash ne sont pas présentes, l’application retombe en mode synchrone (utile en local), mais le client risque d’observer une erreur 524 sur les imports volumineux.

### Memberstack & Abonnements

Client (exposées):

- `NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY` — clé publique Memberstack DOM
- Plans actifs: Essentiel 20 € → `prc_basique-iud00utd`; Pro 30 € → `prc_pro-i2bk0ucx`
- `NEXT_PUBLIC_MS_PRICE_ID_50K` — priceId Stripe/Memberstack pour l’offre 50k/30j
- `NEXT_PUBLIC_MS_PRICE_ID_UNLIMITED` — priceId Stripe/Memberstack pour l’offre illimitée

Serveur:

- `MEMBERSTACK_API_KEY` — clé secrète API Memberstack (vérif serveur)
- Plans actifs: Essentiel 20 € → `prc_basique-iud00utd`; Pro 30 € → `prc_pro-i2bk0ucx`
- `MS_PRICE_ID_50K` — priceId 50k (côté serveur)
- `MS_PRICE_ID_UNLIMITED` — priceId illimité (côté serveur)
- `MS_FREE_MONTHLY_LIMIT` (optionnel, défaut 1000)
- `MS_LIMITED_MONTHLY_LIMIT` (optionnel, défaut 50000)

Notes:

- Fenêtre de quota: 30 derniers jours ancrés par membre.
  - Free: ancre = `user.createdAt`
  - Payant: ancre = début d’abonnement (Memberstack) ou fallback « maintenant » si indisponible
- API d’usage: `GET /api/billing/usage`
- Blocage d’import: `POST /api/imports` renvoie `403 { error: 'limit_reached' }` si quota atteint

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
- `prisma/schema.prisma` — schéma Postgres (Neon)
