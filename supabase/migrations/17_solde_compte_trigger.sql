-- Interdit qu'un compte de trésorerie qui n'est pas de type "banque" (caisse,
-- mobile_money) passe en solde négatif — un point d'application unique en
-- BEFORE INSERT couvre tous les chemins d'écriture existants (addEcritureTresorerie,
-- addCharge, et les RPC creer_achat/regler_dette qui insèrent directement en
-- SQL) sans avoir à dupliquer le contrôle dans chacun, même principe que le
-- trigger sync_stock_apres_mouvement (02_stock.sql) qui bloque déjà un stock
-- négatif. Un compte "banque" peut légitimement aller à découvert — aucune
-- limite n'est imposée dans ce cas.
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
    where compte_tresorerie_id = new.compte_tresorerie_id;

    if new.type_mouvement = 'sortie' and (v_solde - new.montant) < 0 then
      raise exception 'Solde insuffisant sur ce compte (solde actuel : %, montant demandé : %)', v_solde, new.montant;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_verifier_solde_compte
  before insert on public.journal_tresorerie
  for each row execute procedure public.verifier_solde_compte();
