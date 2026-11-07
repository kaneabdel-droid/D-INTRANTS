-- 32_update_plan_comptable_caisse_mobile_cheque.sql
-- Correction du plan comptable de référence :
-- 571 : Caisse principale (espèces)
-- 551 : Monnaie électronique (Mobile Money : Wave, Orange Money)
-- 531 : Chèques, bons et effets à encaisser

update public.plan_comptable
set libelle = 'Chèques, bons et effets à encaisser', type = 'tresorerie'
where compte = '531';

update public.plan_comptable
set libelle = 'Caisse principale (espèces)', type = 'tresorerie'
where compte = '571';

insert into public.plan_comptable (entreprise_id, compte, libelle, classe, type)
values (null, '551', 'Monnaie électronique (Mobile Money : Wave, Orange Money)', 5, 'tresorerie')
on conflict do nothing;

insert into public.plan_comptable (entreprise_id, compte, libelle, classe, type)
values (null, '571', 'Caisse principale (espèces)', 5, 'tresorerie')
on conflict do nothing;
