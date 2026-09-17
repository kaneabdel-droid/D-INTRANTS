-- Annulation de vente/achat, avec répercussion correcte sur le stock, les
-- créances/dettes et la trésorerie — la version précédente d'annulerVente
-- (app/(dashboard)/ventes/actions.ts) se contentait de changer `statut` sans
-- rien réconcilier, ce qui aurait laissé le stock, les créances/dettes et la
-- trésorerie faussés en permanence. Ce fichier corrige aussi un vrai bug
-- connexe : le coût moyen pondéré (cout_unitaire) utilisé par creer_vente
-- incluait les lignes d'achats déjà annulés.

-- 1) Le trigger de solde plancher (migration 17) ne couvrait que les INSERT ;
-- l'étendre à UPDATE pour qu'aucune modification directe d'une écriture ne
-- puisse contourner la règle "un compte non-banque ne passe jamais au négatif".
-- Le code applicatif privilégie delete+réinsertion plutôt qu'un UPDATE direct
-- (cf. updateEcritureTresorerie), mais le trigger reste la garantie ultime.
create or replace function public.verifier_solde_compte()
returns trigger language plpgsql as $$
declare
  v_type_compte varchar(20);
  v_solde numeric;
begin
  select type_compte, solde_initial into v_type_compte, v_solde
  from public.comptes_tresorerie
  where id = new.compte_tresorerie_id;

  if v_type_compte is distinct from 'banque' then
    select v_solde + coalesce(sum(case when type_mouvement = 'entree' then montant else -montant end), 0)
    into v_solde
    from public.journal_tresorerie
    where compte_tresorerie_id = new.compte_tresorerie_id
      and id is distinct from new.id;

    if new.type_mouvement = 'sortie' and (v_solde - new.montant) < 0 then
      raise exception 'Solde insuffisant sur ce compte (solde actuel : %, montant demandé : %)', v_solde, new.montant;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_verifier_solde_compte on public.journal_tresorerie;
create trigger trg_verifier_solde_compte
  before insert or update on public.journal_tresorerie
  for each row execute procedure public.verifier_solde_compte();

-- 2) Corrige creer_vente : le coût moyen pondéré doit ignorer les lignes
-- d'achats annulés, sinon le coût d'un achat annulé continue de peser sur la
-- marge des ventes futures alors que ces unités n'ont jamais été réellement
-- acquises. Reste identique par ailleurs à la version de la migration 10.
create or replace function public.creer_vente(
  p_magasin_id uuid,
  p_client_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_cout_unitaire numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une vente doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.ventes (magasin_id, client_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_client_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_vente_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    select coalesce(avg(la.prix_unitaire_achat), 0) into v_cout_unitaire
    from public.lignes_achat la
    join public.achats a on a.id = la.achat_id
    where la.article_id = (v_ligne->>'article_id')::uuid
      and la.magasin_id = p_magasin_id
      and a.statut = 'validee';

    insert into public.lignes_vente (vente_id, magasin_id, article_id, quantite, prix_unitaire, cout_unitaire)
    values (
      v_vente_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire')::numeric, v_cout_unitaire
    );

    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'sortie_vente', (v_ligne->>'quantite')::numeric, v_vente_id, 'vente', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.creances (magasin_id, client_id, vente_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_client_id, v_vente_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'entree', p_montant_paye, 'vente', v_vente_id, 'vente', 'Encaissement vente', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_vente_id;
end;
$$;

-- 3) annuler_vente : restaure le stock (mouvement compensatoire — jamais de
-- suppression physique de mouvements_stock, pour que le trigger
-- sync_stock_apres_mouvement recalcule stocks.quantite et que l'historique
-- reste complet), retire la créance liée et l'écriture de trésorerie liée,
-- puis marque la vente annulée. Bloque si la créance a déjà été réglée (même
-- partiellement) : annuler effacerait un règlement bien réel du client.
create or replace function public.annuler_vente(p_vente_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_creance_id uuid;
  v_creance_initial numeric;
  v_creance_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.ventes where id = p_vente_id;

  if v_magasin_id is null then
    raise exception 'Vente introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cette vente est déjà annulée';
  end if;

  select id, montant_initial, montant_restant into v_creance_id, v_creance_initial, v_creance_restant
  from public.creances where vente_id = p_vente_id;

  if v_creance_id is not null and v_creance_restant <> v_creance_initial then
    raise exception 'Cette créance a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_vente where vente_id = p_vente_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_positif', v_ligne.quantite, p_vente_id, 'annulation_vente', v_utilisateur_id);
  end loop;

  if v_creance_id is not null then
    delete from public.creances where id = v_creance_id;
  end if;

  -- Retrait direct de l'écriture (pas de contre-écriture) : le solde de
  -- trésorerie est toujours recalculé à la volée par somme des lignes,
  -- contrairement au stock il n'y a ici aucun trigger dont on dépend pour
  -- maintenir un solde en cache — retirer l'écriture erronée est plus simple
  -- et plus sûr qu'une contre-écriture qui doublerait l'historique sans
  -- bénéfice de recalcul.
  delete from public.journal_tresorerie where reference_id = p_vente_id and reference_type = 'vente';

  update public.ventes set statut = 'annulee' where id = p_vente_id;
end;
$$;

-- 4) annuler_achat : symétrique. Si une partie du stock entré par cet achat a
-- déjà été revendue, le trigger sync_stock_apres_mouvement lève "Stock
-- insuffisant" sur le mouvement compensatoire et bloque l'annulation — c'est
-- le comportement voulu, on ne peut pas reprendre un stock déjà sorti.
create or replace function public.annuler_achat(p_achat_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_dette_id uuid;
  v_dette_initial numeric;
  v_dette_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.achats where id = p_achat_id;

  if v_magasin_id is null then
    raise exception 'Achat introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cet achat est déjà annulé';
  end if;

  select id, montant_initial, montant_restant into v_dette_id, v_dette_initial, v_dette_restant
  from public.dettes where achat_id = p_achat_id;

  if v_dette_id is not null and v_dette_restant <> v_dette_initial then
    raise exception 'Cette dette a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_achat where achat_id = p_achat_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_negatif', v_ligne.quantite, p_achat_id, 'annulation_achat', v_utilisateur_id);
  end loop;

  if v_dette_id is not null then
    delete from public.dettes where id = v_dette_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_achat_id and reference_type = 'achat';

  update public.achats set statut = 'annulee' where id = p_achat_id;
end;
$$;
