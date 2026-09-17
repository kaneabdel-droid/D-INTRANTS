-- 22_palmares_clients.sql
create or replace function public.palmares_clients(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_limite int default 20
) returns table (client_id uuid, client_nom text, nb_ventes bigint, montant_total numeric, derniere_visite timestamptz)
language sql stable as $$
  select c.id, c.nom, count(v.id), coalesce(sum(v.montant_total), 0), max(v.date_vente)
  from public.clients c
  join public.ventes v on v.client_id = c.id
  where v.magasin_id = p_magasin_id
    and v.statut = 'validee'
    and v.date_vente >= p_date_debut
    and v.date_vente < (p_date_fin + interval '1 day')
  group by c.id, c.nom
  order by montant_total desc
  limit p_limite
$$;
