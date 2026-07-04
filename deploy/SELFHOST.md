# Mamélodie — Supabase self-hosted (Docker), local puis VPS

On fait tourner **toute la stack Supabase en Docker** (Postgres, Auth, PostgREST,
Realtime, Storage, Kong/API gateway, Studio, Edge Functions). Même setup en local
et sur le VPS Contabo → aucune dépendance cloud.

> Local d'abord (répétition), puis on rejoue exactement les mêmes étapes sur le VPS.

---

## 0. Prérequis
- **Docker Desktop** (local) / **Docker + Docker Compose** (VPS).
- **Git**.
- RAM : la stack tourne bien dès ~2 Go ; ton VPS 8 Go est large.

## 1. Récupérer la stack Supabase
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

## 2. Configurer `.env`
- **En local** : le `.env.example` contient déjà des **clés de démo fonctionnelles**
  (ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET). Tu peux démarrer tel quel pour tester.
- **Pour la prod (VPS)** : régénère impérativement
  `POSTGRES_PASSWORD`, `JWT_SECRET`, puis **ANON_KEY** et **SERVICE_ROLE_KEY**
  (signées avec ton JWT_SECRET — générateur : https://supabase.com/docs/guides/self-hosting#api-keys),
  `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`, et configure le **SMTP**
  (`SMTP_*`) pour les emails d'auth/OTP.
- Renseigne aussi :
  - `SITE_URL` = URL du frontend (local: `http://localhost:5173`, prod: `https://mamelodie.net`)
  - `API_EXTERNAL_URL` = URL publique de l'API (local: `http://localhost:8000`, prod: `https://api.mamelodie.net`)

## 3. Démarrer
```bash
docker compose up -d
docker compose ps           # tout doit être "healthy"
```
- **Studio** : http://localhost:8000 (login = DASHBOARD_USERNAME/PASSWORD)
- **API / Kong** : http://localhost:8000

## 4. Créer le schéma
Studio → **SQL Editor** → colle le contenu de `supabase/schema.sql` (du projet
Mamélodie) → Run. (Ça crée tables, vue crédits, RLS, profils, admin.)

## 5. Brancher les Edge Functions (outillé)
Deux helpers fournis dans `deploy/selfhost/` :

1. **Secrets** — copie l'override dans la stack et renseigne les valeurs dans son `.env` :
   ```bash
   cp deploy/selfhost/docker-compose.override.yml <chemin>/supabase/docker/
   # puis dans supabase/docker/.env :  GROQ_API_KEY=... RESEND_API_KEY=... etc.
   ```
2. **Fonctions** — copie nos fonctions (+ `_shared`) à côté du routeur `main` :
   ```bash
   SUPABASE_DOCKER=<chemin>/supabase/docker ./deploy/selfhost/sync-functions.sh
   cd <chemin>/supabase/docker && docker compose up -d && docker compose restart functions
   ```
Les fonctions sont appelables à `http://localhost:8000/functions/v1/<nom>`.
(Ré-exécute `sync-functions.sh` + `restart functions` à chaque modif d'une fonction.)

## 6. Brancher le frontend Mamélodie
Dans le projet Mamélodie, `.env.local` :
```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<ANON_KEY du .env de la stack>
```
Puis `npm run dev`. L'app tourne maintenant sur **ta** stack Supabase locale.

## 7. Tester le bout-en-bout
Inscription → (OTP si SMTP configuré) → création → paroles (Groq) → paiement
(GeniusPay) → audio (Suno) → bibliothèque. Panel : `/admin/portail-8x4k`.

---

## 8. Passage sur le VPS Contabo
Mêmes étapes 1→5, plus :
- **Domaine** : `mamelodie.net` (frontend) + `api.mamelodie.net` (Supabase/Kong).
- **Reverse proxy + HTTPS auto** : `deploy/selfhost/Caddyfile` (sert le front `dist/`
  ET proxy `api.mamelodie.net` → Kong:8000). `sudo cp deploy/selfhost/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`.
- `.env` de la stack : `SITE_URL=https://mamelodie.net`,
  `API_EXTERNAL_URL=https://api.mamelodie.net`, clés **régénérées**.
- `.env.production` du frontend : `VITE_SUPABASE_URL=https://api.mamelodie.net`.
- **Webhook GeniusPay** → `https://api.mamelodie.net/functions/v1/geniuspay-webhook`.
- **Frontend** : `npm run build` → servir `dist/` (voir `deploy/nginx-mamelodie.conf`).

## 9. Exploitation (ta responsabilité en self-hosted)
- **Backups** : script fourni `deploy/selfhost/backup.sh` (pg_dumpall + rotation).
  En cron : `0 3 * * * /var/www/mamelodie/deploy/selfhost/backup.sh`. **Copie les dumps hors VPS.**
- **Sécurité** : firewall (n'expose que 80/443), secrets forts, MAJ des images Docker.
- **Monitoring** : `docker compose ps`, logs, espace disque (NVMe 150 Go = ok).
- **Emails** : un vrai SMTP (sinon pas d'OTP/reset). 
