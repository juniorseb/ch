# Mamélodie

Crée une chanson. Offre une émotion.

Plateforme self-service de chansons personnalisées par IA — l'utilisateur
crée un compte, choisit une occasion, raconte son histoire, relit et ajuste
les paroles générées, paye en mobile money, et reçoit deux versions de sa
chanson en quelques minutes.

## Parcours

```
Accueil visiteur
  -> Inscription (email + mot de passe, obligatoire)
  -> Vérification email (code à 4 chiffres)
  -> Occasion et pack
  -> Formulaire (destinataire, ton, style, histoire)
  -> Paiement mobile money (Orange/MTN/Moov/Wave, contact uniquement)
  -> Paroles générées, modifiables avant validation
  -> Génération de la musique (deux versions)
  -> Chanson prête (écouter, télécharger, partager)
```

L'identité repose sur l'email (Supabase Auth), pas sur le téléphone — un
email fonctionne pour la diaspora et les numéros internationaux, alors que
l'OTP par SMS était limité à la Côte d'Ivoire. Le numéro de téléphone reste
collecté, mais uniquement comme contact pour le paiement mobile money.

## Stack

- **Frontend** : React + TypeScript + Vite + Tailwind CSS v4, React Router
- **Identité** : Supabase Auth (email + mot de passe), confirmation par code à 4 chiffres envoyé via [Resend](https://resend.com)
- **Backend** : Supabase (Postgres, RLS, Realtime, Edge Functions)
- **Musique** : Suno via [ApiPass](https://apipass.dev) (Suno n'a pas d'API officielle ; génère toujours deux versions par appel)
- **Paroles** : Groq (Llama 3.3), structurées avec des balises de section ([Intro], [Couplet 1], [Refrain]...)
- **Paiement** : [GeniusPay](https://pay.genius.ci) — mobile money Orange/MTN/Moov/Wave, ~1% de commission

## Démarrer en local

```bash
npm install
npm run dev
```

L'app tourne entièrement en **mode démo** sans aucune clé API : inscription
et connexion simulées, paroles et musique pré-remplies, codes de
vérification affichés dans la console du navigateur. Tu peux donc cliquer
sur tout le parcours dès maintenant.

## Brancher les vraies intégrations

1. Crée un projet sur [supabase.com](https://supabase.com), copie `.env.example` en `.env.local` et remplis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Settings -> API).
2. Dans **Authentication -> Providers -> Email**, désactive "Confirm email" côté Supabase natif (la confirmation se fait via notre propre code à 4 chiffres, pas le lien natif de Supabase).
3. Exécute `supabase/schema.sql` dans le SQL Editor du dashboard.
4. Installe la [Supabase CLI](https://supabase.com/docs/guides/cli), puis déploie les Edge Functions :
   ```bash
   supabase login
   supabase link --project-ref <ton-projet>
   supabase functions deploy create-payment geniuspay-webhook generate-lyrics generate-audio send-email-otp verify-email-otp
   ```
5. Configure les secrets (Dashboard -> Edge Functions -> Secrets, ou `supabase secrets set`) :
   - `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`
   - `APIPASS_API_KEY`
   - `GROQ_API_KEY` (optionnel — sans clé, les paroles utilisent un gabarit de secours)
   - `RESEND_API_KEY` (pour l'envoi du code de vérification par email)
6. Dans le dashboard GeniusPay, configure le webhook vers `https://<ton-projet>.supabase.co/functions/v1/geniuspay-webhook`.

## Architecture serveur (Edge Functions)

```
supabase/
  schema.sql                tables, RLS (auth.uid() = user_id), vue payment_credits
  functions/
    send-email-otp/         envoie le code à 4 chiffres après l'inscription (Resend)
    verify-email-otp/       vérifie le code, confirme l'email côté Supabase Auth
    create-payment/         crée payments + song_generations pour l'utilisateur authentifié, démarre le checkout GeniusPay
    geniuspay-webhook/      confirme le paiement, déclenche generate-lyrics
    generate-lyrics/        paroles structurées (Groq), s'arrête à lyrics_ready, diffuse en Realtime
    generate-audio/         envoie les paroles (éventuellement modifiées) à Suno, capture les deux versions
```

`song_generations` et `payments` sont protégées par RLS (`auth.uid() =
user_id`), donc lisibles directement par le frontend avec la clé anon une
fois l'utilisateur connecté — pas besoin de passer par une Edge Function
pour l'historique. Les écritures (création, changement de statut) passent
uniquement par les Edge Functions avec la clé `service_role`. Le suivi en
direct (paroles puis musique) n'a pas besoin de lire la base : il écoute un
canal Realtime "broadcast" nommé `song:<id>`.

## Ce qui reste à faire

1. Vérifier la forme exacte de la réponse ApiPass pour un résultat à deux clips et ajuster `extractAudioUrls` dans `generate-audio` en conséquence (actuellement une supposition raisonnable, pas testée avec une vraie clé)
2. Ajouter un cron Supabase qui appelle `cleanup_expired_otps()` régulièrement
3. Décider du parcours en cas d'échec de paiement (relance, remboursement) — pour l'instant `geniuspay-webhook` marque juste la ligne `failed`
4. "Mot de passe oublié" sur l'écran de connexion (pas encore implémenté)
5. Achat d'un pack supplémentaire depuis le Profil (bouton présent, action à brancher)

## Structure

```
src/
  components/   Button, BottomNav, OtpInput, RequireAuth, Waveform (élément signature), Shell
  lib/
    api/        auth.ts, geniuspay.ts — appellent Supabase Auth et les Edge Functions
    types.ts    types partagés (Occasion, Pack, SongDraft, SongGeneration)
    SongDraftContext.tsx   état du parcours de création en cours
    useSongHistory.ts      historique réel via RLS, ou données de démo
  pages/        un fichier par écran du parcours
supabase/
  schema.sql    tables + RLS
  functions/    les six Edge Functions (voir plus haut)
```
