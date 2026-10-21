# Aynalytics

Analytics self-hosted, respectueux de la vie privée :

- **SDK** à intégrer sur tes sites : écrans (`screen`) et événements (`track`) avec des propriétés libres.
- **Collector** : serveur public qui reçoit les données, et uniquement depuis les sites autorisés.
- **Dashboard** : interface interne (protégée par Pangolin), avec vue d'ensemble, explorateur de propriétés et gestion des sites.

Les deux images Docker partagent un dossier `data/` qui contient une base SQLite. Elles sont publiées par
[Pangolin](https://github.com/fosrl/pangolin) : aucun port n'est ouvert sur l'hôte.

```
 sites autorisés ──HTTPS──▶ Pangolin (ressource publique) ──▶ aynalytics-collector:8080 ─┐
                                                                                         ├─▶ ./data/aynalytics.db
 toi ──HTTPS──▶ Pangolin (ressource protégée SSO) ──▶ aynalytics-dashboard:8081 ─────────┘
```

## Déploiement sur le VPS

```bash
git clone <repo> aynalytics && cd aynalytics
cp .env.example .env            # BASIC_AUTH_PASSWORD, COLLECTOR_PUBLIC_URL, PROXY_NETWORK
docker compose pull && docker compose up -d
```

`PROXY_NETWORK` est le réseau Docker de Pangolin (`docker network ls`, `pangolin` par défaut). Dans Pangolin, sur le site **local** :

| Ressource | Sous-domaine              | Cible                              | Authentification                                     |
| --------- | ------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Collector | `analytics.mondomaine.fr` | `http://aynalytics-collector:8080` | **désactivée** (les sites doivent pouvoir l'appeler) |
| Dashboard | `stats.mondomaine.fr`     | `http://aynalytics-dashboard:8081` | **activée** (SSO / utilisateurs autorisés)           |

`TRUST_PROXY` doit couvrir le sous-réseau du réseau Pangolin (`docker network inspect pangolin`). Les valeurs par défaut couvrent `172.16.0.0/12` et `10.0.0.0/8`.

## Intégration

1. Dans le dashboard, ouvre **Sites**, clique sur **Nouveau site** et ajoute les origines autorisées (`https://monsite.fr`, `https://*.monsite.fr`).
2. Ajoute le script sur le site :

```html
<script defer src="https://analytics.mondomaine.fr/sdk.js" data-site-key="ay_pk_..."></script>

<!-- Clic sur un lien d'achat : aucun JS à écrire -->
<a
  href="https://amzn.to/xxx"
  data-ay-event="purchase_click"
  data-ay-prop-product="Clavier"
  data-ay-prop-price="89.9"
  >Acheter</a
>

<script>
  window.aynalytics?.track('newsletter_signup', { plan: 'pro' });
</script>
```

Ou en module (React, Vite…) :

```ts
import aynalytics from '@aynalytics/sdk';

aynalytics.init({ siteKey: 'ay_pk_...', endpoint: 'https://analytics.mondomaine.fr' });
aynalytics.track('purchase_click', { product: 'Clavier', price: 89.9, partner: 'amazon' });
aynalytics.screen('Checkout', { step: 2 });
```

Ou côté serveur, avec la clé secrète (à ne jamais mettre dans du code front) :

```ts
import { createServerClient } from '@aynalytics/sdk/server';

const analytics = createServerClient({
  endpoint,
  siteKey: 'ay_pk_...',
  secretKey: process.env.AYNALYTICS_SECRET_KEY!,
});
await analytics.track('order_paid', { amount: 129 }, { userId: 'user-42' });
```

La source de chaque événement (`utm_source`, sinon le domaine référent, sinon `direct`) est déduite automatiquement et conservée pendant toute la session.

## Développement

```bash
npm install
npm test            # vitest (core, SDK, collector, API)
npm run dev:collector
BASIC_AUTH_USER=admin BASIC_AUTH_PASSWORD=motdepasse-local npm run dev:api
npm run dev:web     # http://localhost:5180
```

Voir `CLAUDE.md` pour l'architecture détaillée, les endpoints et les points d'attention.
