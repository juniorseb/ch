# Checklist de sécurité — mise en production (Contabo)

Cocher AVANT d'ouvrir au public. Les points ⚠️ sont bloquants.

## 1. Secrets — tout régénérer ⚠️
Toutes les clés ci-dessous ont pu transiter en clair pendant le développement : **régénère-les** avant la prod, puis mets les nouvelles valeurs (via l'admin `app_secrets` ou le `.env` de la stack, jamais dans le code) :
- OpenRouter, Groq, ApiPass, Resend
- GeniusPay : `pk`/`sk`/`whsec` (sandbox **et** live)
- Google OAuth : **Client Secret** (`GOCSPX-…`) → régénérer dans Google Cloud

## 2. Secrets par défaut de Supabase self-hosted ⚠️
Dans `supabase/docker/.env`, remplacer TOUTES les valeurs par défaut :
- `POSTGRES_PASSWORD` (fort, aléatoire)
- `JWT_SECRET` (≥ 32 caractères aléatoires) → puis **régénérer** `ANON_KEY` et `SERVICE_ROLE_KEY` cohérents avec ce JWT_SECRET
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` (Studio)
- `VAULT_ENC_KEY`, `SECRET_KEY_BASE` si présents

## 3. Ne pas exposer les ports internes ⚠️
Dans `docker-compose.yml`, binder les ports sur **127.0.0.1** (pas `0.0.0.0`) :
- Kong `8000` → `127.0.0.1:8000`
- Studio `3000`, Postgres `5432`, analytics `4000` → `127.0.0.1:…`
Seul Caddy (443/80) est public. Accès Studio via **tunnel SSH** uniquement.
Vérifier : `sudo ss -tlnp` ne doit montrer QUE 22/80/443 en écoute publique.
Activer un pare-feu : `ufw allow 22,80,443/tcp && ufw enable`.

## 4. URLs de production
- App `.env.local` : `VITE_SUPABASE_URL=https://mamelodie.net`
- Stack `.env` : `API_EXTERNAL_URL=https://mamelodie.net`, `SITE_URL=https://mamelodie.net`,
  `FUNCTIONS_PUBLIC_URL=https://mamelodie.net/functions/v1`, `PUBLIC_SUPABASE_URL=https://mamelodie.net`
- `ADDITIONAL_REDIRECT_URLS=https://mamelodie.net/**`

## 5. Paiement / webhooks ⚠️
- GeniusPay → déclarer le webhook `https://mamelodie.net/functions/v1/geniuspay-webhook`
  et saisir le `whsec` (sandbox + live) dans l'admin.
  Le webhook **rejette désormais** tout appel non signé (fail-closed) : sans `whsec`, aucun paiement ne sera validé.
- Passer GeniusPay en **live** dans l'admin une fois testé en sandbox.
- Si callback ApiPass utilisé : définir `APIPASS_WEBHOOK_SECRET`.

## 6. Google OAuth
- Ajouter l'URI de redirection prod `https://mamelodie.net/auth/v1/callback` dans Google Cloud.
- Écran de consentement OAuth publié (sinon limité aux testeurs).

## 7. Email (Resend)
- Vérifier le domaine `mamelodie.net` dans Resend (SPF/DKIM) avant d'activer l'OTP.
- Tant que non vérifié : garder l'OTP **désactivé** (les inscriptions marchent sans email).

## 8. Admin
- Route obscurcie `/admin/portail-8x4k` + contrôle `profiles.is_admin` côté serveur (déjà en place).
- Vérifier que seul ton compte a `is_admin = true`.

## 9. Sauvegardes
- Cron de dump Postgres chiffré hors-serveur (voir `backup.sh`).

## 10. Divers
- Caddy fournit HTTPS auto + en-têtes de sécurité (HSTS, X-Frame-Options, nosniff) — déjà dans le `Caddyfile`.
- Ne jamais committer `supabase/docker/.env` ni `mamelodie/.env.local` (déjà gitignorés côté app).
