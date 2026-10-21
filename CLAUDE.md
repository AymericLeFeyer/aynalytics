# aynalytics — CLAUDE.md

> Analytics self-hosted : SDK de tracking (screens + events a proprietes libres) -> collector public -> dashboard interne (VPN).
> **Dernière mise à jour : 2026-10-21** (v0.1 : creation du projet)

## Stack

| Couche | Choix                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------- |
| Front  | React 18 + Vite 8 + TypeScript strict + **Ant Design 5** + `@ant-design/plots` 2                  |
| Data   | `@tanstack/react-query` v5, `fetch` centralise (`httpClient`), `dayjs`, `react-router-dom` 6      |
| Back   | **Fastify 5** + TypeScript, `zod` 4, `@fastify/rate-limit`, `@fastify/static`                     |
| DB     | **SQLite** (`better-sqlite3` 12, WAL) — fichier `${DATA_DIR}/aynalytics.db` partage               |
| SDK    | TS sans dependance, build `tsup` : ESM/CJS + IIFE minifiee (~6 Ko) servie sur `/sdk.js`           |
| Tests  | `vitest` 4 (racine), `happy-dom` pour le SDK, `fastify.inject` pour les API                       |
| Deploy | 1 `Dockerfile` multi-target -> 2 images (`collector`, `dashboard`), `docker-compose.yml`, CI GHCR |

Monorepo **npm workspaces** (pas de pnpm). Commandes : `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format`.
Dev : `npm run dev:collector` (8080), `npm run dev:api` (8081, exige `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD`), `npm run dev:web` (5180, proxy `/api` -> 8081). `DATA_DIR` par defaut `../../data` (= `./data` a la racine).

## Structure

```
packages/core/src/          # @aynalytics/core : SOURCES TS (exports -> src/index.ts), bundle dans les apps par tsup
  domain/sites/             # Site, SiteRepository, originPolicy (normalize/isOriginAllowed), keys (pk/sk/hash)
  domain/events/            # TrackedEvent, EventRepository + SaltRepository, payloadSchema (zod + LIMITS), enrichment, buildEvent
  domain/analytics/         # Stats (filtre, DIMENSIONS whitelist, INTERVAL_MS), AnalyticsRepository
  infrastructure/sqlite/    # database.ts (open + migrations), Sqlite{Site,Event,Salt,Analytics}Repository
packages/sdk/src/           # client.ts (AynalyticsClient), index.ts (singleton init/track/...), browser.ts (IIFE), server.ts
apps/collector/src/         # serveur PUBLIC d'ingestion
  application/sites/SiteRegistry.ts            # cache memoire des sites actifs (TTL 10 s)
  application/ingest/usecases/{AuthorizeCollect,IngestEvents}.ts
  application/maintenance/usecases/PurgeExpiredData.ts
  presentation/{plugins/security.ts, routes/collect.ts, routes/sdk.ts}
  app.ts (buildCollector, testable) / server.ts (bootstrap + purge horaire)
apps/dashboard-api/src/     # API INTERNE + sert le build du front
  application/sites/usecases/{ListSites,CreateSite,UpdateSite,RotateSiteSecret,DeleteSite,siteValidation}.ts
  application/analytics/usecases/{GetOverview,GetTimeseries,GetTopValues,GetPropertyKeys,GetPropertyBreakdown,ListEvents}.ts
  presentation/{plugins/security.ts, routes/sites.ts, routes/analytics.ts, routes/web.ts}
apps/dashboard-web/src/     # SPA DDD
  domain/{sites,analytics}/{entities,repositories}
  infrastructure/http/httpClient.ts, infrastructure/{sites,analytics}/repositories/Http*Repository.ts, infrastructure/config/appConfigApi.ts
  application/{sites,analytics,config}/usecases/*  # hooks react-query
  presentation/{components,pages,hooks}
  composition.ts            # composition root (seul endroit qui instancie les Http*Repository)
```

## Domaines (core)

### sites

- **Site** `{ id (uuid), name, publicKey ('ay_pk_'+16), secretHash (sha256 hex), allowedOrigins: string[], active, createdAt }`. `PublicSite` = sans `secretHash` (`toPublicSite`).
- **SiteRepository** (sync) : `list()`, `findById(id)`, `findByPublicKey(pk)`, `insert(site)`, `update(id, patch: SitePatch) -> Site|undefined`, `delete(id) -> boolean`.
- `normalizeOriginPattern(input) -> string|null` : `scheme://host[:port]` ou `scheme://*.domaine`, http/https, sans chemin/query/credentials, port par defaut retire.
- `isOriginAllowed(origin, patterns)` : egalite stricte d'origine, ou wildcard = sous-domaines uniquement (l'apex n'est PAS couvert par `*.x.fr`).
- `generatePublicKey()`, `generateSecretKey()` ('ay_sk_'+43), `hashSecret(s)`, `verifySecret(s, hash)` (timingSafeEqual).

### events

- **TrackedEvent** : `siteId, type ('screen'|'event'), name, properties (JSON libre), ts, receivedAt, visitorHash, sessionId, anonymousId, userId, url, path, referrer, referrerHost, source, utm{source,medium,campaign,term,content}, browser, os, device, language, screenWidth`.
- **EventRepository** : `insertMany(events)`, `purgeBefore(ts) -> n`, `deleteBySite(siteId) -> n`. **SaltRepository** : `getOrCreate(day 'YYYY-MM-DD')`, `purgeOlderThan(day)`.
- `collectPayloadSchema` = `{ siteKey, events: IncomingEvent[1..50] }`. `LIMITS` : nom <= 100, <= 50 cles, cle <= 64, string <= 1000, tableau <= 50, profondeur <= 3, proprietes <= 8 Ko serialisees.
- `buildTrackedEvent(input, ctx)` : URL nettoyee (`sanitizeUrl` : garde seulement `utm_*`), UTM explicites (session SDK) > UTM de l'URL, `source` = utm_source > domaine referent externe (sans `www.`) > `direct` ; `server` pour un envoi backend sans UTM/referent. `clampTimestamp` : ts client accepte si dans [-24 h (7 j serveur), +5 min], sinon `receivedAt`.
- `visitorHash` = sha256(sel du jour | site | IP | UA) tronque a 32 hex. Aucune IP ni UA brut stocke.

### analytics

- **StatsFilter** `{ siteId?, from, to, type?, name?, source?, path? }` (ms, `to` exclusif).
- **AnalyticsRepository** : `overview(f)`, `timeseries(f, 'hour'|'day', tzOffsetMinutes)` (trous remplis a 0), `top(f, dimension, limit)`, `propertyKeys(f)`, `propertyBreakdown(f, key, limit) -> { rows, numeric: {count,sum,avg,min,max}|null }`, `listEvents(f, { limit, before?, propKey?, propValue? })`.
- `DIMENSIONS` : `name, path, source, referrer (->referrer_host), utm_source, utm_medium, utm_campaign, browser, os, device, language`.

## Use cases (signatures `execute`)

Collector :

- `AuthorizeCollect.execute({ siteKey, origin, authorization }) -> { ok: true, site, serverSide } | { ok: false, reason: 'unknown_site'|'invalid_secret'|'origin_not_allowed' }`
- `IngestEvents.execute({ site, events, ip, userAgent, serverSide }) -> number` (0 si bot)
- `PurgeExpiredData.execute() -> { purgedEvents }` (sels > 1 jour + retention `RETENTION_DAYS`)

Dashboard :

- `ListSites.execute() -> PublicSite[]` · `CreateSite.execute({ name, allowedOrigins }) -> { site, secretKey }` · `UpdateSite.execute(id, { name?, allowedOrigins?, active? }) -> PublicSite` · `RotateSiteSecret.execute(id) -> { secretKey }` · `DeleteSite.execute(id) -> { deletedEvents }`
- `GetOverview.execute(f) -> { current, previous }` (periode precedente de meme duree) · `GetTimeseries.execute(f, interval, tz)` (max 1000 buckets) · `GetTopValues.execute(f, dim, limit)` · `GetPropertyKeys.execute(f)` · `GetPropertyBreakdown.execute(f, key, limit)` · `ListEvents.execute(f, q) -> { items, nextCursor }`

## Endpoints

Collector (public, `https://analytics.<domaine>`) :

| Methode | Route         | Role                                                                                                                              |
| ------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/v1/collect` | `{ siteKey, events[] }` en `text/plain` (SDK) ou `application/json`. 202 `{accepted}` / 400 `invalid_payload` / 403 `unknown_site | origin_not_allowed | invalid_secret` / 429. Rate limit par IP. |
| OPTIONS | `/v1/collect` | preflight, 204 seulement si l'origine appartient a un site actif                                                                  |
| GET     | `/sdk.js`     | SDK IIFE (`cache 1h`, `CORP cross-origin`)                                                                                        |
| GET     | `/health`     | `{status:'ok'}`                                                                                                                   |

Dashboard (interne, tout sous basic auth sauf `/api/health`, mutations exigent `x-aynalytics-csrf: 1`) :

| Methode | Route                                                      | Role                                                                                    |
| ------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET     | `/api/health`                                              | non protege                                                                             |
| GET     | `/api/config`                                              | `{ collectorUrl }` (env `COLLECTOR_PUBLIC_URL`)                                         |
| GET     | `/api/sites`                                               | liste (sans hash)                                                                       |
| POST    | `/api/sites`                                               | `{ name, allowedOrigins[] }` -> 201 `{ site, secretKey }` (cle affichee une seule fois) |
| PATCH   | `/api/sites/:id`                                           | `{ name?, allowedOrigins?, active? }`                                                   |
| POST    | `/api/sites/:id/rotate-secret`                             | `{ secretKey }`                                                                         |
| DELETE  | `/api/sites/:id`                                           | supprime site + evenements -> `{ deletedEvents }`                                       |
| GET     | `/api/stats/overview?from&to&siteId&type&name&source&path` | `{ current, previous }`                                                                 |
| GET     | `/api/stats/timeseries?...&interval=hour                   | day&tz=<minutes>`                                                                       | points |
| GET     | `/api/stats/top?...&dimension=<DIMENSIONS>&limit<=100`     | `[{value,count,visitors}]`                                                              |
| GET     | `/api/stats/properties?...` (avec `name`)                  | `[{key,count}]`                                                                         |
| GET     | `/api/stats/breakdown?...&key&limit<=200`                  | `{ rows, numeric }`                                                                     |
| GET     | `/api/events?...&limit<=200&before&propKey&propValue`      | `{ items, nextCursor }`                                                                 |
| GET     | `/*`                                                       | SPA (fallback `index.html`)                                                             |

Contraintes de requete stats : `to > from`, plage <= 2 ans.

## Front

Routes : `/` (OverviewPage : KPIs + variation, courbe, top ecrans/events cliquables, acquisition, techno), `/events?type&name&key&value` (EventsPage : explorateur, proprietes dynamiques, flux brut pagine), `/sites` (SitesPage : CRUD, cle secrete, snippets).

Hooks (application) :

| Hook                                                                                                                   | Fichier                                               |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `useSites`, `useCreateSite`, `useUpdateSite`, `useRotateSiteSecret`, `useDeleteSite`                                   | `application/sites/usecases/siteUseCases.ts`          |
| `useOverview`, `useTimeseries`, `useTopValues`, `usePropertyKeys`, `usePropertyBreakdown`, `useEventStream` (infinite) | `application/analytics/usecases/analyticsUseCases.ts` |
| `useAppConfig`                                                                                                         | `application/config/usecases/useAppConfig.ts`         |
| `useFilters` (contexte site + periode, persiste en localStorage)                                                       | `presentation/hooks/useFilters.tsx`                   |

## SDK

- `init({ siteKey, endpoint, autoScreens=true, autoClicks=true, persistence='session'|'local'|'memory', respectDoNotTrack=false, debug })`, `track(name, props)`, `screen(name?, props)`, `identify(userId|null)`, `reset()`, `flush()`.
- Balise : `<script defer src="<collector>/sdk.js" data-site-key="ay_pk_..." [data-auto-screens="false"] [data-persistence="local"] [data-respect-dnt="true"]>` ; endpoint = origine du script. Stub `window.aynalytics.q` rejoue.
- Clics sans JS : `data-ay-event="purchase_click"` + `data-ay-prop-<cle>="valeur"` (nombres/booleens convertis, `href` ajoute pour les liens) -> envoi immediat via `sendBeacon`.
- File : flush apres 1 s ou 20 evenements, `sendBeacon` sur `pagehide`/`visibilitychange`. Session 30 min d'inactivite, stocke referent externe + UTM d'arrivee.
- Serveur : `createServerClient({ endpoint, siteKey, secretKey })` depuis `@aynalytics/sdk/server` (Bearer).

## Securite (resume)

- Collector : site actif + (Origin dans `allowedOrigins` **ou** Bearer cle secrete). Pas d'Origin et pas de secret = 403. CORS reflete uniquement les origines connues. Body <= 64 Ko, zod strict sur tailles, parseur JSON securise (rejette `__proto__`), rate limit IP, filtre bots, headers durcis.
- Dashboard : bind sur l'IP VPN (`DASHBOARD_BIND` obligatoire dans compose) + basic auth timing-safe + anti-CSRF (header custom + `Sec-Fetch-Site`) + CSP stricte (sauf `style-src 'unsafe-inline'` pour antd) + rate limit.
- Conteneurs : non-root (uid 1000), `read_only`, `cap_drop: ALL`, `no-new-privileges`.

## Patterns

- `@aynalytics/core` est consomme **en sources TS** (devDependency des apps) : `tsx` en dev, `tsup` le bundle en prod (`noExternal`). Ses deps runtime (`better-sqlite3`, `zod`) doivent etre declarees dans les `dependencies` de chaque app.
- Repositories SQLite **synchrones** ; toutes les valeurs passent en parametres nommes ; les colonnes dynamiques viennent uniquement de `DIMENSIONS`.
- Migrations : tableau `MIGRATIONS` indexe par `PRAGMA user_version`, executees en transaction `IMMEDIATE` (les 2 conteneurs peuvent demarrer en meme temps). **Ne jamais modifier une migration existante**, en ajouter une.
- Le front calcule la periode au moment du choix (pas a chaque rendu) pour des `queryKey` stables ; le bouton Actualiser recalcule + `invalidateQueries()`.
- Tests d'API via `buildCollector` / `buildDashboard` + `app.inject` sur base `:memory:`.

## Points d'attention

- **Cache des sites dans le collector (10 s)** : un site cree/desactive/une cle regeneree n'est effectif qu'apres ce delai.
- **SQLite partage entre 2 conteneurs** : le dossier `data` doit etre sur un FS local (pas NFS/SMB : verrous WAL) et appartenir a l'uid 1000 (`chown 1000:1000 data`).
- **TRUST_PROXY** : ne jamais mettre `true` si le port du collector est joignable directement (X-Forwarded-For spoofable -> contournement du rate limit). Utiliser la liste CIDR du reverse proxy (`loopback,172.16.0.0/12` par defaut).
- La cle publique est visible dans le HTML : la protection navigateur repose sur l'Origin, qui ne protege que contre les navigateurs, pas contre un script qui forge l'en-tete. Le rate limit + les bornes de payload limitent l'abus ; les donnees critiques (paiements) doivent passer par le SDK serveur avec cle secrete.
- `visitorHash` change chaque jour (sel tournant) : les "visiteurs" sont uniques **par jour** ; sur une periode longue, c'est une somme approx. Pour du recurrent, `persistence: 'local'` (anonymousId) — peut necessiter un consentement.
- Vite 8 est impose par vitest 4 (hoisting) : garder la meme majeure de Vite dans `dashboard-web`, sinon conflit de types du plugin React.
- `typescript-eslint`/`eslint` 9 : ne pas monter eslint 10 tant que les plugins ne suivent pas.
