-- Encaissement automatique par monnaie électronique (virement ou scan QR).
--
-- Chaque compte de trésorerie de type mobile_money peut recevoir sa propre clé de
-- webhook : quand le fournisseur (ou un relais intermédiaire — app SMS→webhook,
-- Pabbly/Make/Zapier — pour les opérateurs sans webhook marchand natif, ce qui est
-- le cas fréquent hors Wave) notifie D-INTRANTS d'un paiement reçu, l'écriture est
-- insérée directement dans journal_tresorerie, sans saisie manuelle du gérant.
--
-- reference_externe porte l'identifiant de transaction du fournisseur (texte libre,
-- distinct de reference_id qui est un uuid réservé aux liens internes vente/achat/
-- créance/dette) : il sert uniquement à empêcher qu'un webhook rejoué (retry réseau
-- côté fournisseur) ne double l'écriture.

alter table public.comptes_tresorerie
  add column fournisseur_electronique varchar(20) check (fournisseur_electronique in ('wave', 'orange_money', 'generique')),
  add column identifiant_marchand text,
  add column cle_webhook text;

alter table public.journal_tresorerie
  add column reference_externe text;

-- Un même fournisseur ne renverra jamais deux fois la même référence de
-- transaction pour un compte donné : l'index sert de verrou anti-doublon au
-- niveau base, indépendant de la logique applicative du webhook.
create unique index idx_journal_tresorerie_dedup_webhook
  on public.journal_tresorerie(compte_tresorerie_id, reference_externe)
  where reference_externe is not null;

comment on column public.comptes_tresorerie.cle_webhook is
  'Secret partagé comparé en temps constant à la clé reçue par /api/webhooks/mobile-money/[compteId] — jamais exposé hors espace gérant/trésorier de l''entreprise propriétaire.';
