-- RPC pour les règlements de créances/dettes : même logique d'atomicité que
-- creer_vente/creer_achat (migration 10) — la mise à jour du solde et
-- l'écriture de trésorerie doivent réussir ou échouer ensemble, jamais l'une
-- sans l'autre (sinon un solde soldé sans encaissement, ou l'inverse).
-- `for update` verrouille la ligne créance/dette le temps de la transaction
-- pour éviter un double règlement concurrent qui ferait passer le solde en
-- négatif (deux caissiers réglant la même créance au même instant).

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

  update public.dettes
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_dette_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'sortie', p_montant, 'reglement_dette', p_dette_id, 'dette', 'Règlement dette', v_utilisateur_id);
end;
$$;
