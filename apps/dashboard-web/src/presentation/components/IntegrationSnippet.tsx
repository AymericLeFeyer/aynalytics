import { Alert, Tabs, Typography } from 'antd';
import { useAppConfig } from '../../application/config/usecases/useAppConfig';
import type { Site } from '../../domain/sites/entities/Site';

function Code({ code }: { code: string }) {
  return (
    <Typography.Paragraph copyable={{ text: code }} style={{ marginBottom: 0 }}>
      <pre style={{ margin: 0, overflowX: 'auto', fontSize: 12 }}>{code}</pre>
    </Typography.Paragraph>
  );
}

export function IntegrationSnippet({ site, secretKey }: { site: Site; secretKey?: string }) {
  const { data: config } = useAppConfig();
  const endpoint = config?.collectorUrl ?? 'https://analytics.mondomaine.fr';

  const scriptTag = `<script defer src="${endpoint}/sdk.js" data-site-key="${site.publicKey}"></script>

<!-- Clic tracké sans JavaScript (envoi immédiat, même si le lien quitte la page) -->
<a href="https://boutique.exemple/produit"
   data-ay-event="purchase_click"
   data-ay-prop-product="Clavier"
   data-ay-prop-price="89.9">Acheter</a>

<script>
  // Événement libre depuis votre code
  window.aynalytics?.track('newsletter_signup', { plan: 'pro' });
</script>`;

  const moduleCode = `import aynalytics from '@aynalytics/sdk';

aynalytics.init({
  siteKey: '${site.publicKey}',
  endpoint: '${endpoint}',
  // autoScreens: true (défaut) -> un screen par changement de route
});

aynalytics.track('purchase_click', { product: 'Clavier', price: 89.9, partner: 'amazon' });
aynalytics.screen('Checkout', { step: 2 });
aynalytics.identify('user-42'); // optionnel`;

  const serverCode = `import { createServerClient } from '@aynalytics/sdk/server';

const analytics = createServerClient({
  endpoint: '${endpoint}',
  siteKey: '${site.publicKey}',
  secretKey: process.env.AYNALYTICS_SECRET_KEY!, // ${secretKey ? secretKey : 'ay_sk_... (cle secrete du site)'}
});

await analytics.track('order_paid', { amount: 129, currency: 'EUR' }, { userId: 'user-42' });`;

  return (
    <>
      {!config?.collectorUrl && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="COLLECTOR_PUBLIC_URL n'est pas défini : remplace l'URL d'exemple par celle de ton collector."
        />
      )}
      {site.allowedOrigins.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Aucune origine autorisée : seuls les envois serveur (clé secrète) seront acceptés."
        />
      )}
      <Tabs
        items={[
          { key: 'script', label: 'Balise <script>', children: <Code code={scriptTag} /> },
          { key: 'module', label: 'Module (React, Vite…)', children: <Code code={moduleCode} /> },
          { key: 'server', label: 'Serveur (clé secrète)', children: <Code code={serverCode} /> },
        ]}
      />
    </>
  );
}
