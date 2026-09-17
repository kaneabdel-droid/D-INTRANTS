-- Ferme l'écart trouvé en audit : les policies RLS UPDATE/DELETE sur
-- journal_tresorerie/creances/dettes/mouvements_stock ne vérifient que le
-- tenant/rôle (can_write_magasin), pas si la ligne est liée à une
-- vente/achat/règlement — et aucune RPC (creer_vente, annuler_vente,
-- annuler_achat, regler_creance, regler_dette...) n'est security definer,
-- donc elles n'ont pas plus de droits qu'un appel direct du client Supabase.
-- Un gérant pouvait donc, en appelant directement le SDK (hors app), modifier
-- ou supprimer une ligne liée sans passer par annuler_vente/annuler_achat/
-- regler_creance/regler_dette, désynchronisant silencieusement stock/
-- trésorerie/créances/dettes de la vente/achat/règlement qui les a produites.
--
-- Ces triggers verrouillent ces tables au niveau base. Les RPC légitimes qui
-- doivent transgresser (regler_creance, regler_dette, annuler_vente,
-- annuler_achat) posent un drapeau de session avant leur UPDATE/DELETE, via
-- set_config(..., is_local => true) : limité à la transaction en cours, donc
-- automatiquement réinitialisé à la fin de l'appel RPC (chaque appel RPC
-- s'exécute comme sa propre transaction côté PostgREST/Supabase) — aucune
-- fuite possible vers une requête ultérieure sur la même connexion poolée.

-- Second correctif de l'audit, sans rapport avec les triggers ci-dessus :
-- annuler_vente/annuler_achat suppriment une ligne de journal_tresorerie par
-- (reference_id, reference_type) sans index dédié — balayage complet de la
-- table (tous magasins/entreprises confondus) à chaque annulation. Négligeable
-- au volume actuel, mais se dégrade avec la table ; index partiel peu coûteux
-- à maintenir puisqu'il ne couvre que les lignes réellement liées.
create index if not exists idx_journal_tresorerie_reference
  on public.journal_tresorerie(reference_id, reference_type)
  where reference_id is not null;

create or replace function public.verifier_pas_modif_directe_tresorerie()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_lignes_liees', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if old.reference_type is not null then
      raise exception 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — modifiez-la depuis son origine.';
    end if;
    return new;
  end if;

  -- DELETE : seules les écritures manuelles (reference_type null) ou liées à
  -- une charge (reference_type = 'charge', gérée directement par
  -- charges/actions.ts qui fait son propre delete+réinsertion) sont
  -- supprimables hors RPC. Vente/achat/créance/dette ne le sont jamais
  -- directement : uniquement via annuler_vente/annuler_achat.
  if old.reference_type is not null and old.reference_type <> 'charge' then
    raise exception 'Cette écriture est liée à une vente, un achat ou un règlement — supprimez-la depuis son origine.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_proteger_journal_tresorerie on public.journal_tresorerie;
create trigger trg_proteger_journal_tresorerie
  before update or delete on public.journal_tresorerie
  for each row execute procedure public.verifier_pas_modif_directe_tresorerie();

create or replace function public.verifier_pas_modif_directe_creance_dette()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_lignes_liees', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Cette opération doit passer par le règlement ou l''annulation de la vente/achat d''origine.';
end;
$$;

drop trigger if exists trg_proteger_creances on public.creances;
create trigger trg_proteger_creances
  before update or delete on public.creances
  for each row execute procedure public.verifier_pas_modif_directe_creance_dette();

drop trigger if exists trg_proteger_dettes on public.dettes;
create trigger trg_proteger_dettes
  before update or delete on public.dettes
  for each row execute procedure public.verifier_pas_modif_directe_creance_dette();

-- mouvements_stock : grand livre append-only, aucun code applicatif ni aucune
-- RPC ne modifie/supprime une ligne existante — toute correction passe par un
-- nouveau mouvement compensatoire (cf. annuler_vente/annuler_achat, migration
-- 18). Verrou inconditionnel, sans drapeau de contournement puisqu'aucun
-- chemin légitime n'en a besoin.
create or replace function public.interdire_modif_mouvements_stock()
returns trigger language plpgsql as $$
begin
  raise exception 'Un mouvement de stock ne peut être ni modifié ni supprimé — utilisez un mouvement compensatoire.';
end;
$$;

drop trigger if exists trg_interdire_modif_mouvements_stock on public.mouvements_stock;
create trigger trg_interdire_modif_mouvements_stock
  before update or delete on public.mouvements_stock
  for each row execute procedure public.interdire_modif_mouvements_stock();

-- Les quatre RPC qui transgressent légitimement : identiques à leur dernière
-- version (migrations 11 et 18), avec l'ajout du set_config juste avant leur
-- premier UPDATE/DELETE sur une table protégée ci-dessus.

create or replace function public.regler_creance(
  p_creance_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.creances where id = p_creance_id
  for update;

  if v_magasin_id is null then
    raise exception 'Créance introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  update public.creances
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_creance_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'entree', p_montant, 'reglement_creance', p_creance_id, 'creance', 'Règlement créance', v_utilisateur_id);
end;
$$;

create or replace function public.regler_dette(
  p_dette_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.dettes where id = p_dette_id
  for update;

  if v_magasin_id is null then
    raise exception 'Dette introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  update public.dettes
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_dette_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'sortie', p_montant, 'reglement_dette', p_dette_id, 'dette', 'Règlement dette', v_utilisateur_id);
end;
$$;

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

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_creance_id is not null then
    delete from public.creances where id = v_creance_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_vente_id and reference_type = 'vente';

  update public.ventes set statut = 'annulee' where id = p_vente_id;
end;
$$;

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

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_dette_id is not null then
    delete from public.dettes where id = v_dette_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_achat_id and reference_type = 'achat';

  update public.achats set statut = 'annulee' where id = p_achat_id;
end;
$$;
