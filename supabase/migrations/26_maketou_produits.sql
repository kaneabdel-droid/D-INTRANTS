CREATE TABLE IF NOT EXISTS public.maketou_produits (
    palier text NOT NULL,
    duree_mois integer NOT NULL,
    product_id text NOT NULL,
    PRIMARY KEY (palier, duree_mois)
);
ALTER TABLE public.maketou_produits ENABLE ROW LEVEL SECURITY;
