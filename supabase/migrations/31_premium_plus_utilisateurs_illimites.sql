-- Migration 31 : Formule Premium Plus avec 5 magasins et utilisateurs illimités

-- 1. Ajout de la colonne optionnelle utilisateurs_max dans paliers_abonnement
-- (NULL signifie utilisateurs illimités)
alter table public.paliers_abonnement
  add column if not exists utilisateurs_max integer;

-- 2. Mise à jour explicite du palier Premium Plus : 5 magasins et utilisateurs illimités (NULL)
update public.paliers_abonnement
set magasins_max = 5,
    utilisateurs_max = null,
    prix_mensuel_fcfa = 15000
where code = 'premium_plus';

