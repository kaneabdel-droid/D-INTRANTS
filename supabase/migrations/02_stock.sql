-- Stock = grand livre (mouvements_stock, append-only, source de vérité) + cache
-- (stocks, quantité courante par magasin+article), synchronisés par trigger.
-- C'est ce mécanisme qui rend le stock "automatique" : toute écriture applicative
-- passe par un insert dans mouvements_stock, jamais par un update direct de stocks.

create table public.stocks (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  quantite numeric not null default 0,
  updated_at timestamptz default now(),
  unique (magasin_id, article_id)
);

create index idx_stocks_magasin on public.stocks(magasin_id);

create table public.mouvements_stock (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  type_mouvement varchar(30) not null check (type_mouvement in (
    'entree_achat', 'sortie_vente', 'ajustement_positif', 'ajustement_negatif',
    'transfert_entree', 'transfert_sortie'
  )),
  quantite numeric not null check (quantite > 0),
  reference_id uuid,
  reference_type varchar(30),
  motif text,
  utilisateur_id uuid references public.utilisateurs(id),
  created_at timestamptz default now()
);

create index idx_mouvements_stock_magasin on public.mouvements_stock(magasin_id);
create index idx_mouvements_stock_article on public.mouvements_stock(article_id);

create or replace function public.sync_stock_apres_mouvement()
returns trigger language plpgsql as $$
declare
  v_delta numeric;
  v_nouveau numeric;
begin
  v_delta := case when new.type_mouvement in ('entree_achat', 'ajustement_positif', 'transfert_entree')
    then new.quantite else -new.quantite end;

  insert into public.stocks (magasin_id, article_id, quantite, updated_at)
  values (new.magasin_id, new.article_id, v_delta, now())
  on conflict (magasin_id, article_id)
  do update set quantite = public.stocks.quantite + v_delta, updated_at = now()
  returning quantite into v_nouveau;

  if v_nouveau < 0 then
    raise exception 'Stock insuffisant (résultat négatif : %)', v_nouveau;
  end if;

  return new;
end;
$$;

create trigger trg_sync_stock
  after insert on public.mouvements_stock
  for each row execute procedure public.sync_stock_apres_mouvement();
