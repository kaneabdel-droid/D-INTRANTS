-- RPC plpgsql pour les écritures multi-tables atomiques (plan §7 phase 5) :
-- une vente touche ventes + lignes_vente + mouvements_stock (+ creances +
-- journal_tresorerie selon le mode de paiement) — un enchaînement de .insert()
-- séquentiels côté client laisserait des écritures partielles en cas d'échec
-- à mi-chemin (ex: stock insuffisant détecté après la ligne 3 sur 5). Le corps
-- d'une fonction plpgsql s'exécute dans une seule transaction implicite : toute
-- exception (dont celle levée par le trigger sync_stock_apres_mouvement en cas
-- de stock insuffisant) annule l'ensemble.
--
-- security invoker (par défaut) : la fonction s'exécute avec les droits de
-- l'appelant, donc les policies RLS s'appliquent normalement à chaque insert
-- (can_write_magasin) — la vérification explicite en tête de fonction est une
-- défense en profondeur qui produit un message d'erreur clair avant d'aller
-- plus loin, plutôt que de laisser échouer sur la première policy venue.

create or replace function public.creer_vente(
  p_magasin_id uuid,
  p_client_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb -- [{ "article_id": uuid, "quantite": numeric, "prix_unitaire": numeric }, ...]
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
    -- Coût moyen pondéré : moyenne des prix d'achat historiques de cet article
    -- dans ce magasin (aucun champ "coût" dédié sur `articles` dans ce schéma,
    -- cf. plan §2 — la marge se calcule à partir de cet historique d'achats).
    select coalesce(avg(la.prix_unitaire_achat), 0) into v_cout_unitaire
    from public.lignes_achat la
    where la.article_id = (v_ligne->>'article_id')::uuid
      and la.magasin_id = p_magasin_id;

    insert into public.lignes_vente (vente_id, magasin_id, article_id, quantite, prix_unitaire, cout_unitaire)
    values (
      v_vente_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire')::numeric, v_cout_unitaire
    );

    -- Lève une exception (et annule toute la transaction) si le stock devient négatif.
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'sortie_vente', (v_ligne->>'quantite')::numeric, v_vente_id, 'vente', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.creances (magasin_id, client_id, vente_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_client_id, v_vente_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    -- Encaisse sur le premier compte "caisse" du magasin par défaut (choix du
    -- compte précis laissé à une évolution ultérieure du formulaire de vente).
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

-- Symétrique de creer_vente, côté achats fournisseur.
create or replace function public.creer_achat(
  p_magasin_id uuid,
  p_fournisseur_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb -- [{ "article_id": uuid, "quantite": numeric, "prix_unitaire_achat": numeric }, ...]
) returns uuid
language plpgsql as $$
declare
  v_achat_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Un achat doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire_achat')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.achats (magasin_id, fournisseur_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_fournisseur_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_achat_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    insert into public.lignes_achat (achat_id, magasin_id, article_id, quantite, prix_unitaire_achat)
    values (
      v_achat_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire_achat')::numeric
    );

    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'entree_achat', (v_ligne->>'quantite')::numeric, v_achat_id, 'achat', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.dettes (magasin_id, fournisseur_id, achat_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_fournisseur_id, v_achat_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'sortie', p_montant_paye, 'achat', v_achat_id, 'achat', 'Paiement achat', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_achat_id;
end;
$$;
