# Activer « Continuer avec Google » (self-hosted)

La connexion Google est gérée par **GoTrue** (le serveur Auth de Supabase), qui lit
sa config OAuth dans ses **variables d'environnement au démarrage** — PAS dans la
base. On ne peut donc pas la piloter depuis l'admin (voir la note en bas).

## 1. Google Cloud Console

1. https://console.cloud.google.com → APIs & Services → **Identifiants**.
2. Créer un identifiant → **ID client OAuth** → type **Application Web**.
3. **URI de redirection autorisés** (ajouter les deux) :
   - Local : `http://localhost:8000/auth/v1/callback`
   - Prod  : `https://mamelodie.net/auth/v1/callback`
   > C'est `API_EXTERNAL_URL` + `/auth/v1/callback`. Google accepte `http://localhost` en dev.
4. Récupérer le **Client ID** (`...apps.googleusercontent.com`) et le **Secret** (`GOCSPX-...`).

## 2. `.env` de la stack Supabase (supabase/docker/.env)

```dotenv
# --- Google OAuth ---
GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=REMPLACER.apps.googleusercontent.com
GOOGLE_SECRET=GOCSPX-REMPLACER

# Origine du front + retours autorisés (le code redirige vers /creer/compte).
# LOCAL (adapter au port réel de ton front : Vite dev = 5173, preview = 4173) :
SITE_URL=http://localhost:5173
ADDITIONAL_REDIRECT_URLS=http://localhost:5173/**

# PROD (quand hébergé) :
# SITE_URL=https://mamelodie.net
# ADDITIONAL_REDIRECT_URLS=https://mamelodie.net/**
# API_EXTERNAL_URL=https://mamelodie.net
```

## 3. `docker-compose.yml` — décommenter dans le service `auth`

```yaml
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
```

## 4. Appliquer

```powershell
Set-Location <supabase\docker>
docker compose up -d auth   # recrée le conteneur avec les nouvelles variables
```
> `restart` ne suffit pas pour recharger le `.env` : utiliser `up -d`.

## 5. Vérifier

Front (client Supabase) doit pointer sur `http://localhost:8000` (VITE_SUPABASE_URL).
Clique « Continuer avec Google » → redirection Google → retour sur `/creer/compte`.

---

### Pourquoi pas dans l'admin ?

Les autres clés (OpenRouter, Groq, ApiPass, Resend, GeniusPay) sont lues par **nos
Edge Functions à chaque requête** → stockables dans `app_secrets` et modifiables à
chaud depuis l'admin. Google, lui, est consommé par **GoTrue** (conteneur Auth) qui
ne lit que ses variables d'env **au boot**. Le mettre en base ne servirait à rien
tant que GoTrue ne redémarre pas. → On le laisse en `.env` + `docker compose up -d auth`.
