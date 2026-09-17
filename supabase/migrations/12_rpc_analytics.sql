-- Fonctions d'agrégation pour le dashboard et les pages Comparatif/Rentabilité
-- (plan §6/phase 7). `language sql` sans `security definer` : ces fonctions
-- s'exécutent avec les droits de l'appelant, donc les policies RLS de
-- can_read_magasin s'appliquent normalement — un gérant n'agrège que son
-- magasin, un admin_entreprise peut agréger tous les magasins de son
-- entreprise (comparatif_magasins), jamais ceux d'une autre entreprise.

-- Évolution des ventes sur une période, avec les jours/semaines/mois sans
-- vente à zéro (generate_series en left join) pour ne pas laisser de trou
-- dans le graphique.
create or replace function public.ventes_par_periode(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_granularite text default 'jour' -- 'jour' | 'semaine' | 'mois'
) returns table (periode date, total numeric)
language sql stable as $$
  with bornes as (
    select
      (case p_granularite when 'mois' then '1 month' when 'semaine' then '1 week' else '1 day' end)::interval as pas,
      (case p_granularite when 'mois' then date_trunc('month', p_date_debut) when 'semaine' then date_trunc('week', p_date_debut) else p_date_debut::timestamptz end) as debut,
      (case p_granularite when 'mois' then date_trunc('month', p_date_fin) when 'semaine' then date_trunc('week', p_date_fin) else p_date_fin::timestamptz end) as fin
  ),
  series as (
    select generate_series(b.debut, b.fin, b.pas)::date as periode
    from bornes b
  ),
  ventes_aggregees as (
    select
      (case p_granularite
        when 'mois' then date_trunc('month', v.date_vente)
        when 'semaine' then date_trunc('week', v.date_vente)
        else date_trunc('day', v.date_vente)
      end)::date as periode,
      sum(v.montant_total) as total
    from public.ventes v
    where v.magasin_id = p_magasin_id
      and v.statut = 'validee'
      and v.date_vente >= p_date_debut
      and v.date_vente < (p_date_fin + interval '1 day')
    group by 1
  )
  select s.periode, coalesce(va.total, 0) as total
  from series s
  left join ventes_aggregees va on va.periode = s.periode
  order by s.periode
$$;

-- Rentabilité globale d'un magasin sur une période : marge_brute = ca - coût
-- (cout_unitaire snapshotté à la vente, cf. migration 04/10), resultat_net =
-- marge_brute - charges de la période.
create or replace function public.rentabilite_periode(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (ca numeric, cout numeric, marge_brute numeric, charges numeric, resultat_net numeric)
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
  )
  select agg.ca, agg.cout, (agg.ca - agg.cout) as marge_brute, cp.total as charges,
    (agg.ca - agg.cout - cp.total) as resultat_net
  from agg, charges_periode cp
$$;

-- Marge par article sur une période (paramétrable par magasin) — permet de
-- répondre à "quels articles rapportent le plus" plutôt qu'un seul chiffre global.
create or replace function public.rentabilite_par_article(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (article_id uuid, designation text, quantite numeric, ca numeric, cout numeric, marge numeric)
language sql stable as $$
  select
    a.id as article_id,
    a.designation,
    sum(lv.quantite) as quantite,
    sum(lv.quantite * lv.prix_unitaire) as ca,
    sum(lv.quantite * lv.cout_unitaire) as cout,
    sum(lv.quantite * (lv.prix_unitaire - lv.cout_unitaire)) as marge
  from public.lignes_vente lv
  join public.ventes v on v.id = lv.vente_id
  join public.articles a on a.id = lv.article_id
  where lv.magasin_id = p_magasin_id
    and v.statut = 'validee'
    and v.date_vente >= p_date_debut
    and v.date_vente < (p_date_fin + interval '1 day')
  group by a.id, a.designation
  order by marge desc
$$;

-- Comparatif entre magasins d'une même entreprise — réservé à l'usage
-- admin_entreprise côté app, mais la RLS (can_read_magasin) l'autoriserait
-- aussi pour un gérant qui n'obtiendrait que sa propre ligne.
create or replace function public.comparatif_magasins(
  p_entreprise_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (magasin_id uuid, magasin_nom text, ca numeric, marge_brute numeric)
language sql stable as $$
  select
    m.id as magasin_id,
    m.nom as magasin_nom,
    coalesce(sum(lv.quantite * lv.prix_unitaire), 0) as ca,
    coalesce(sum(lv.quantite * (lv.prix_unitaire - lv.cout_unitaire)), 0) as marge_brute
  from public.magasins m
  left join public.ventes v on v.magasin_id = m.id
    and v.statut = 'validee'
    and v.date_vente >= p_date_debut
    and v.date_vente < (p_date_fin + interval '1 day')
  left join public.lignes_vente lv on lv.vente_id = v.id
  where m.entreprise_id = p_entreprise_id
  group by m.id, m.nom
  order by m.nom
$$;
