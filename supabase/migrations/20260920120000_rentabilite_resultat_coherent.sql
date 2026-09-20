-- Le résultat net de la page Rentabilité ne retranchait que la table `charges`, alors que
-- l'excédent brut d'exploitation du tableau de bord ajoute aussi les « autres produits » et
-- retranche les « autres charges » saisis en trésorerie (catégories explicites, hors règlements).
-- Pour un même magasin et une même période, les deux chiffres divergeaient.
--
-- rentabilite_periode reprend donc exactement les composantes du compte d'exploitation :
--   marge_brute  = CA - coût des marchandises vendues (cout_unitaire figé à la vente)
--   charges      = charges enregistrées + écritures de trésorerie « autres_charges »
--   resultat_net = marge_brute + autres_produits - charges
-- La signature change (nouvelle colonne autres_produits) : `create or replace` ne suffit pas.
drop function if exists public.rentabilite_periode(uuid, date, date);

create function public.rentabilite_periode(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (ca numeric, cout numeric, marge_brute numeric, autres_produits numeric, charges numeric, resultat_net numeric)
language sql stable as $$
  with ventes_periode as (
    select lv.quantite, lv.prix_unitaire, lv.cout_unitaire
    from public.lignes_vente lv
    join public.ventes v on v.id = lv.vente_id
    where lv.magasin_id = p_magasin_id
      and v.statut = 'validee'
      and v.date_vente >= p_date_debut
      and v.date_vente < (p_date_fin + interval '1 day')
  ),
  agg as (
    select
      coalesce(sum(quantite * prix_unitaire), 0) as ca,
      coalesce(sum(quantite * cout_unitaire), 0) as cout
    from ventes_periode
  ),
  charges_periode as (
    select coalesce(sum(montant), 0) as total
    from public.charges
    where magasin_id = p_magasin_id
      and date_charge >= p_date_debut
      and date_charge <= p_date_fin
  ),
  ecritures_periode as (
    select
      coalesce(sum(montant) filter (where categorie = 'autres_produits'), 0) as produits,
      coalesce(sum(montant) filter (where categorie = 'autres_charges'), 0) as charges
    from public.journal_tresorerie
    where magasin_id = p_magasin_id
      and reference_type is null
      and categorie in ('autres_produits', 'autres_charges')
      and date_mouvement >= p_date_debut
      and date_mouvement < (p_date_fin + interval '1 day')
  )
  select
    agg.ca,
    agg.cout,
    (agg.ca - agg.cout) as marge_brute,
    ep.produits as autres_produits,
    (cp.total + ep.charges) as charges,
    (agg.ca - agg.cout + ep.produits - cp.total - ep.charges) as resultat_net
  from agg, charges_periode cp, ecritures_periode ep
$$;

-- Le comparatif affiche désormais l'excédent brut d'exploitation de chaque magasin.
-- Il est obtenu en appelant rentabilite_periode (migration précédente) pour chaque magasin :
-- une seule définition de la marge et du résultat pour le comparatif, la page Rentabilité et
-- les cartes du tableau de bord, donc des chiffres forcément concordants.
-- Les magasins sans vente restent listés (rentabilite_periode renvoie toujours une ligne, à zéro).
-- La signature change (nouvelle colonne) : `create or replace` ne suffit pas.
drop function if exists public.comparatif_magasins(uuid, date, date);

create function public.comparatif_magasins(
  p_entreprise_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (magasin_id uuid, magasin_nom text, ca numeric, marge_brute numeric, excedent_brut numeric)
language sql stable as $$
  select
    m.id as magasin_id,
    m.nom as magasin_nom,
    r.ca,
    r.marge_brute,
    r.resultat_net as excedent_brut
  from public.magasins m
  cross join lateral public.rentabilite_periode(m.id, p_date_debut, p_date_fin) r
  where m.entreprise_id = p_entreprise_id
  order by m.nom
$$;
