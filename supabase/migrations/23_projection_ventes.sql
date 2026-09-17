-- 23_projection_ventes.sql
create or replace function public.projection_ventes(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_granularite text -- 'jour', 'semaine', 'mois'
) returns table (periode timestamp, montant_estime numeric)
language sql stable as $$
  -- V1 : Moyenne mobile simple sur les 3 dernières périodes équivalentes
  -- Pour une vraie projection, il faudrait l'implémenter côté client/API
  -- avec une librairie de régression, ou étendre le SQL
  -- Ici, on retourne simplement un squelette pour l'UI
  with historique as (
    select periode, montant_total
    from public.ventes_par_periode(p_magasin_id, p_date_debut, p_date_fin, p_granularite)
  ),
  stats as (
    select avg(montant_total) as moyenne_recent from historique
  )
  select 
    -- 3 périodes de projection
    generate_series(
      (p_date_fin + interval '1 day')::timestamp,
      (p_date_fin + interval '3 day')::timestamp, -- simplifié
      '1 day'::interval
    ) as periode,
    (select moyenne_recent from stats) as montant_estime;
$$;
