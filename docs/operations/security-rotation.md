# Rotation des secrets exposés — checklist

Suite à un partage de secrets via canal non-sécurisé (chat, etc.), il
faut révoquer puis régénérer les valeurs ci-dessous **dans l'ordre**
pour minimiser la fenêtre où un attaquant pourrait utiliser les
anciennes valeurs.

## 1. `WHATSAPP_VERIFY_TOKEN` — code-side ✅

Déjà fait par ce changement : nouvelle valeur aléatoire dans `.env`.

**Action côté Meta** :

1. Va sur Meta → WhatsApp → Configuration → section Webhook → Edit.
2. Champ **Verify token** → remplace par la nouvelle valeur (visible dans `.env`).
3. Click Vérifier et enregistrer — Meta refait le handshake avec le nouveau token.

⚠️ Pendant la fenêtre entre le redémarrage du dev server et la mise à
jour dans l'UI Meta, le handshake échoue. Garde l'ancien token sous la
main pour rollback rapide si besoin.

## 2. `WHATSAPP_APP_SECRET` — Meta UI

Le secret signe le HMAC des webhooks Meta. S'il fuit, un attaquant peut
forger des messages "venant de Meta" et déclencher des actions de notre
côté.

1. https://developers.facebook.com/apps/ → ton app DentalCare-Dev
2. **Paramètres → De base** (Settings → Basic).
3. **Clé secrète de l'app** → click **Afficher** → puis **Réinitialiser**.
4. Confirme par mot de passe Facebook.
5. Copie la nouvelle valeur, colle dans `.env` côté `WHATSAPP_APP_SECRET`.
6. Redémarre `pnpm dev`.

## 3. `WHATSAPP_TOKEN` — System User token (permanent)

Si l'ancien temporary token est apparu en clair, révoque-le :

1. https://business.facebook.com/ → Paramètres de l'entreprise.
2. **Utilisateurs système** → ton `dentalcare-bot`.
3. **Jetons** → **Modifier** sur l'ancien token → **Révoquer**.
4. Si tu veux aussi tourner le permanent (par hygiène) : génère un
   nouveau token (mêmes scopes `whatsapp_business_messaging` +
   `whatsapp_business_management`), colle-le dans `.env`, redémarre dev.

## 4. `CLOUDINARY_API_SECRET`

Si exposé, un attaquant peut signer des URL et accéder à toutes les
ressources du compte Cloudinary.

1. https://console.cloudinary.com/ → Settings → **Access Keys**.
2. **Generate new API Key** → choisis "Replace primary" → copie la
   nouvelle valeur.
3. Mets à jour `.env` (`CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`).
4. Redémarre dev — les uploads se feront avec les nouvelles clés.

## 5. `AUTH_SECRET`

Si exposé, un attaquant peut forger des sessions Auth.js valides.

1. Génère une nouvelle valeur : `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Remplace dans `.env`.
3. **Toutes les sessions actuelles seront invalidées** — les users en
   cours seront déconnectés et devront se reconnecter.

## 6. `DATABASE_URL` / `DIRECT_URL` — mot de passe Neon

Si exposé, un attaquant a un accès direct à la DB Postgres.

1. https://console.neon.tech/ → projet `dentalcare` → branch `main`.
2. **Settings → Reset password**.
3. Copie la nouvelle URL de connexion (avec le nouveau password).
4. Mets à jour `.env` (les 2 lignes `DATABASE_URL` + `DIRECT_URL`).
5. Redémarre dev — Prisma reconnecte avec le nouveau password.

⚠️ Si tu as déployé sur Vercel : mets à jour aussi les **Environment
Variables** Vercel (Settings → Environment Variables) sinon la prod
tombe à la prochaine connection.

## 7. `GEMINI_API_KEY`

1. https://aistudio.google.com/app/apikey
2. Sur la clé existante → **Delete**.
3. **Create API Key** → copie → mets dans `.env`.

## 8. `SEED_*_PASSWORD`

Les mots de passe des comptes admin/dentiste/réceptionniste seedés.

1. Choisis de nouveaux mots de passe forts.
2. Mets à jour `.env`.
3. **Si la DB est déjà seedée**, les anciens mots de passe RESTENT
   actifs en base — il faut soit re-seed (`pnpm db:seed --force` si on
   l'a, sinon recréer les users via l'UI), soit changer chaque mot de
   passe dans `/settings/users` une fois connecté.

## Ordre de rotation recommandé

1. ✅ `WHATSAPP_VERIFY_TOKEN` (code) — déjà fait
2. ⚠️ **`AUTH_SECRET` en dernier** — déconnecte tout le monde, attendre
   un moment calme.
3. `WHATSAPP_APP_SECRET` (Meta) — risque webhook spoof, prioritaire.
4. `CLOUDINARY_API_SECRET` — risque accès médias patients.
5. `GEMINI_API_KEY` — risque quota / facturation gonflée.
6. `WHATSAPP_TOKEN` (System User) — moins urgent vu que le token n'est
   pas en clair publiquement (System User tokens sont longs).
7. `DATABASE_URL` Neon — seulement si tu suspectes la fuite (sinon la
   rotation force une downtime courte).
8. `SEED_*_PASSWORD` — uniquement si les comptes seedés sont en prod.

## Audit post-rotation

Après chaque rotation, vérifie qu'aucun ancien client n'utilise encore
l'ancien secret :

- Webhooks Meta : surveille `/audit` pour des entrées `webhook.signature_invalid`
- Auth.js : surveille les redirects vers `/login` (sessions invalidées)
- DB : surveille les erreurs `password authentication failed` dans Sentry / Vercel logs
