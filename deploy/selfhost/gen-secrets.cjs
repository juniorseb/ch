// Génère des secrets forts et cohérents pour la stack Supabase self-hosted,
// puis les écrit dans le .env passé en argument (défaut : /root/supabase/.env).
// Les clés ANON/SERVICE sont des JWT HS256 signés avec le JWT_SECRET généré,
// donc valides pour Kong/PostgREST/GoTrue. Une copie est sauvée (chmod 600).
//
// Usage : node deploy/selfhost/gen-secrets.cjs [/chemin/vers/.env]
const crypto = require('crypto')
const fs = require('fs')

const b64 = (b) =>
  Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (payload, secret) => {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64(JSON.stringify(payload))
  const sig = b64(crypto.createHmac('sha256', secret).update(head).digest())
  return head + '.' + sig
}
const rnd = (n) => crypto.randomBytes(n * 2).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, n)

const JWT_SECRET = rnd(48)
const iat = Math.floor(Date.now() / 1000)
const exp = iat + 3600 * 24 * 365 * 10 // 10 ans
const ANON_KEY = jwt({ role: 'anon', iss: 'supabase', iat, exp }, JWT_SECRET)
const SERVICE_ROLE_KEY = jwt({ role: 'service_role', iss: 'supabase', iat, exp }, JWT_SECRET)

const vals = {
  POSTGRES_PASSWORD: rnd(32),
  JWT_SECRET,
  ANON_KEY,
  SERVICE_ROLE_KEY,
  DASHBOARD_USERNAME: 'admin',
  DASHBOARD_PASSWORD: rnd(24),
  SECRET_KEY_BASE: rnd(64),
  VAULT_ENC_KEY: rnd(32),
  SITE_URL: 'https://mamelodie.net',
  API_EXTERNAL_URL: 'https://mamelodie.net',
  SUPABASE_PUBLIC_URL: 'https://mamelodie.net',
  ADDITIONAL_REDIRECT_URLS: 'https://mamelodie.net/**',
}

const envPath = process.argv[2] || '/root/supabase/.env'
let env = fs.readFileSync(envPath, 'utf8')
for (const [k, v] of Object.entries(vals)) {
  const re = new RegExp('^' + k + '=.*$', 'm')
  env = re.test(env) ? env.replace(re, k + '=' + v) : env + '\n' + k + '=' + v
}
fs.writeFileSync(envPath, env)

const backup = '/root/mamelodie-secrets.txt'
fs.writeFileSync(backup, Object.entries(vals).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
fs.chmodSync(backup, 0o600)

console.log(`✅ Secrets écrits dans ${envPath}  (copie sauvegardée : ${backup})\n`)
console.log('ANON_KEY=' + ANON_KEY)
console.log('SERVICE_ROLE_KEY=' + SERVICE_ROLE_KEY)
