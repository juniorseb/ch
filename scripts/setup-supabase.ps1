# =====================================================================
# Mamélodie — passage en mode réel (Supabase)
# =====================================================================
# À lancer UNE fois ton projet Supabase créé. Remplis les 8 valeurs ci-dessous,
# puis exécute :  powershell -ExecutionPolicy Bypass -File scripts/setup-supabase.ps1
#
# NB : ce script configure le BACKEND (secrets + fonctions + migration).
# Le FRONTEND se configure à part dans .env.local (voir DEPLOIEMENT.md).
# =====================================================================

# --- À REMPLIR --------------------------------------------------------
$ProjectRef   = "<TON_PROJECT_REF>"        # Dashboard -> Settings -> General -> Reference ID
$env:SUPABASE_ACCESS_TOKEN = "<TON_ACCESS_TOKEN>"  # https://supabase.com/dashboard/account/tokens
$env:SUPABASE_DB_PASSWORD  = "<TON_MOT_DE_PASSE_DB>" # mot de passe de la base (pour db push)

$GroqKey       = "<GROQ_API_KEY>"          # paroles (Groq / Llama)
$ResendKey     = "<RESEND_API_KEY>"        # email OTP
$ApipassKey    = "<APIPASS_API_KEY>"       # audio (Suno via ApiPass)
$GeniusKey     = "<GENIUSPAY_API_KEY>"     # paiement mobile money
$GeniusSecret  = "<GENIUSPAY_API_SECRET>"  # paiement mobile money
# ---------------------------------------------------------------------

Write-Host "1/4 — Liaison du projet Supabase..." -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef

Write-Host "2/4 — Application de la migration (schéma)..." -ForegroundColor Cyan
npx supabase db push

Write-Host "3/4 — Configuration des secrets des Edge Functions..." -ForegroundColor Cyan
npx supabase secrets set `
  GROQ_API_KEY=$GroqKey `
  RESEND_API_KEY=$ResendKey `
  APIPASS_API_KEY=$ApipassKey `
  GENIUSPAY_API_KEY=$GeniusKey `
  GENIUSPAY_API_SECRET=$GeniusSecret

Write-Host "4/4 — Déploiement des Edge Functions..." -ForegroundColor Cyan
npx supabase functions deploy `
  send-email-otp `
  verify-email-otp `
  complete-signup `
  preview-lyrics `
  create-song `
  create-payment `
  generate-lyrics `
  generate-audio `
  geniuspay-webhook `
  admin-api

Write-Host ""
Write-Host "Terminé. Pense à :" -ForegroundColor Green
Write-Host "  - créer .env.local (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)"
Write-Host "  - configurer l'URL du webhook GeniusPay :"
Write-Host "    https://$ProjectRef.supabase.co/functions/v1/geniuspay-webhook"
