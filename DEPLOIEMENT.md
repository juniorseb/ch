# Déploiement Mamélodie — passage du mode démo au mode réel

Aujourd'hui l'app tourne en **mode démo** (paroles/audio/paiement simulés, aucune
clé requise). Voici la checklist pour passer en **réel**.

## 0. Prérequis
- Un projet **Supabase** créé (https://supabase.com).
- La **Supabase CLI** (utilisée via `npx supabase`, déjà dispo dans le projet).
- Les clés des prestataires : **OpenRouter** (paroles, principal — gpt-4o-mini)
  + **Groq** (paroles, secours), **Resend** (email OTP), **ApiPass** (audio),
  **GeniusPay** (paiement mobile money).

## 1. Frontend — `.env.local`
Crée un fichier `.env.local` à la racine (copie de `.env.example`) :

```
VITE_SUPABASE_URL=https://<ton-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (Dashboard -> Settings -> API -> anon public)
```

> Tant que ces 2 variables sont vides, l'app reste en mode démo.
> Ne mets **jamais** les clés Groq/Resend/ApiPass/GeniusPay ici (côté navigateur) :
> ce sont des **secrets d'Edge Functions** (étape 3).

## 2. Base de données — migration
Deux options :
- **CLI** : `npx supabase db push` (applique `supabase/migrations/`).
- **Dashboard** : SQL Editor → coller le contenu de
  `supabase/migrations/20260701000000_credits_and_flow.sql` → Run.
  (Base neuve : tu peux à la place exécuter `supabase/schema.sql`.)

## 3. Secrets des Edge Functions
Dashboard → Edge Functions → Secrets, **ou** CLI :

```
npx supabase secrets set OPENROUTER_API_KEY=... GROQ_API_KEY=... RESEND_API_KEY=... APIPASS_API_KEY=... GENIUSPAY_API_KEY=... GENIUSPAY_API_SECRET=...
```

## 4. Déploiement des Edge Functions
```
npx supabase functions deploy send-email-otp verify-email-otp complete-signup \
  preview-lyrics create-song create-payment generate-lyrics generate-audio \
  check-song-status apipass-webhook geniuspay-webhook admin-api
```

> Callback musique (recommandé) : renseigne le secret
> `npx supabase functions deploy apipass-webhook --no-verify-jwt` (public) et
> les secrets `FUNCTIONS_PUBLIC_URL=https://<ref>.supabase.co/functions/v1` +
> `APIPASS_WEBHOOK_SECRET=<aléatoire>`. generate-audio passe alors
> automatiquement l'URL de callback à ApiPass ; le polling reste le filet de
> secours si le callback est manqué.

## 5. GeniusPay (clés + webhook)
- **Clés API** : saisis-les depuis l'**admin → Paiement → Clés GeniusPay**
  (sandbox `pk_sandbox_/sk_sandbox_` et live `pk_live_/sk_live_`). Elles sont
  stockées de façon sécurisée (table `app_secrets`, jamais lisible côté client).
  Le mode sandbox/live se choisit avec le toggle de l'admin (même endpoint,
  seules les clés changent).
- **Webhook** : dans GeniusPay, crée un webhook vers :
  ```
  https://<domaine>/functions/v1/geniuspay-webhook
  ```
  avec les événements `payment.success`, `payment.failed`. Copie le secret
  `whsec_...` renvoyé et colle-le dans l'admin (Secret webhook sandbox/live) —
  la signature HMAC est alors vérifiée à chaque appel.

## 6. Administrateur
Le schéma marque `ngoransebastjunior@gmail.com` comme admin. Pour un autre
compte : `update profiles set is_admin = true where email = '...';`

## Raccourci
Le script `scripts/setup-supabase.ps1` enchaîne les étapes 2→4 (remplis les
valeurs en haut du fichier d'abord).

## ⚠️ Sécurité — à traiter avant d'encaisser
- **Régénère** les clés Groq/Resend déjà partagées en clair (chat).
- **Signe/valide le webhook GeniusPay** (aujourd'hui il fait confiance à tout POST
  — un secret/signature est à ajouter dans `geniuspay-webhook`).

## Déploiement sur VPS (frontend statique)

L'app est un **site statique** (build Vite) ; Supabase reste en cloud. Le VPS
ne fait que servir les fichiers. **Les `VITE_*` sont compilées au build** → les
définir AVANT `npm run build`.

Sur le VPS (Ubuntu, Node 20+ installé) :

```bash
git clone <repo> /var/www/mamelodie && cd /var/www/mamelodie
# 1) variables (build-time)
cat > .env.production <<EOF
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
EOF
# 2) build
npm ci
npm run build            # -> dossier dist/
# 3) nginx
sudo cp deploy/nginx-mamelodie.conf /etc/nginx/sites-available/mamelodie
sudo ln -s /etc/nginx/sites-available/mamelodie /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

- DNS : un enregistrement **A** `mamelodie.net` → IP du VPS.
- HTTPS : `sudo certbot --nginx -d mamelodie.net -d www.mamelodie.net`.
- **Rebuild** (`npm run build`) à chaque changement de code ou de `.env.production`.
- Le fallback SPA (routes `/app`, `/creer/...`) est géré par la conf nginx fournie.

## Vérifs post-déploiement
- Inscription → email OTP reçu (Resend) → connexion.
- Création → paroles générées (Groq) → paiement (redirection GeniusPay) → audio (Suno).
- Panel `/admin` : stats, chansons, utilisateurs, réglage OTP.
