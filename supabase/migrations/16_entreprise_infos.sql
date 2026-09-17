-- Fiche d'information entreprise : dénomination et devise existent déjà
-- (nom, devise), adresse/telephone aussi — il ne manque que le contact e-mail,
-- l'identification fiscale (NINEA/RCCM ou équivalent selon le pays) et le logo.
alter table public.entreprises
  add column if not exists email varchar(255),
  add column if not exists identification varchar(100),
  add column if not exists logo_url text;

-- Écriture via RPC dédiée plutôt qu'une policy RLS UPDATE sur entreprises :
-- une policy RLS ne peut restreindre QUE les lignes visibles, pas les colonnes
-- modifiables — un admin_entreprise ne doit jamais pouvoir toucher `palier`,
-- `abonnement_expire_le` ou `statut` (réservés à l'admin système, cf. RLS
-- existante qui n'expose aucune policy insert/update/delete sur cette table).
-- La liste de paramètres de cette fonction EST la liste blanche des champs
-- modifiables, même garantie que creer_vente/regler_dette déjà en place.
create or replace function public.update_entreprise_infos(
  p_nom varchar,
  p_adresse text,
  p_telephone varchar,
  p_email varchar,
  p_identification varchar,
  p_devise varchar
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin_entreprise' then
    raise exception 'Non autorisé';
  end if;

  if p_nom is null or length(trim(p_nom)) = 0 then
    raise exception 'Le nom est requis';
  end if;

  update public.entreprises
  set nom = trim(p_nom),
      adresse = nullif(trim(coalesce(p_adresse, '')), ''),
      telephone = nullif(trim(coalesce(p_telephone, '')), ''),
      email = nullif(trim(coalesce(p_email, '')), ''),
      identification = nullif(trim(coalesce(p_identification, '')), ''),
      devise = coalesce(p_devise, devise)
  where id = public.current_entreprise_id();
end;
$$;

-- Distincte de update_entreprise_infos : le logo se remplace seul (aperçu +
-- bouton "Changer" dans /parametres) sans repasser par tout le formulaire, une
-- fonction séparée évite d'avoir à ré-envoyer les autres champs sous peine de
-- les écraser à null.
create or replace function public.update_entreprise_logo(
  p_logo_url text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin_entreprise' then
    raise exception 'Non autorisé';
  end if;

  update public.entreprises
  set logo_url = p_logo_url
  where id = public.current_entreprise_id();
end;
$$;

-- Bucket public en lecture (le logo doit s'afficher sur des PDF et pages sans
-- session), écriture restreinte à son propre dossier <entreprise_id>/ pour
-- qu'une entreprise ne puisse jamais écraser le logo d'une autre.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_public_select" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_own_folder_insert" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );

create policy "logos_own_folder_update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );

create policy "logos_own_folder_delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );
