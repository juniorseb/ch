-- ---------------------------------------------------------------------
-- RESET des données de TEST avant lancement. ⚠️ IRRÉVERSIBLE.
--
-- Vide : chansons, paiements, funnel (analytics_events), métriques API
--        (api_calls), avis, codes OTP, enregistrements de fichiers audio,
--        et TOUS les comptes SAUF l'administrateur.
-- Conserve : réglages (app_settings), clés (app_secrets), grille de tarifs,
--            et le compte admin.
--
-- Adapter l'email admin ci-dessous si besoin.
-- ---------------------------------------------------------------------
begin;

-- Statistiques (tables purement analytiques)
truncate analytics_events;
truncate api_calls;
truncate email_otps;

-- Contenu généré / paiements / avis
delete from feedback;
delete from storage.objects where bucket_id = 'songs';
delete from song_generations;
delete from payments;

-- Comptes de test : tout sauf l'admin (profil puis utilisateur auth = cascade
-- sur identities/sessions). L'admin conserve son compte (crédits remis à 0
-- puisque les paiements sont supprimés -> il peut se re-créditer depuis l'admin).
delete from profiles where email is distinct from 'ngoransebastjunior@gmail.com';
delete from auth.users where email is distinct from 'ngoransebastjunior@gmail.com';

commit;
