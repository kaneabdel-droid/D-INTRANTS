"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Smartphone,
  CreditCard,
  Banknote,
  ShieldCheck,
  Sparkles,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  SlidersHorizontal,
  PlusCircle,
  FileText,
  Building,
  RefreshCw,
  Coins,
  ArrowUpRight,
  TrendingUp,
  X,
  Eye,
  Wheat,
  Sprout,
} from "lucide-react";
import {
  TransactionDirecte,
  getTransactionsDirectes,
  getTotalEconomiesAggregateurs,
  CompteMarchandDirect,
  getComptesMarchandsDirects,
  saveCompteMarchandDirect,
} from "@/lib/paiement-direct-storage";
import { ModalEncaissementDirect } from "@/components/ModalEncaissementDirect";
import { formatMontant } from "@/lib/utils";

export default function EncaissementsDirectsPage() {
  const [transactions, setTransactions] = useState<TransactionDirecte[]>([]);
  const [comptes, setComptes] = useState<CompteMarchandDirect[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreMethode, setFiltreMethode] = useState("toutes");
  const [modalEncaissementOuvert, setModalEncaissementOuvert] = useState(false);
  const [transactionAffichee, setTransactionAffichee] = useState<TransactionDirecte | null>(null);
  const [montantSaisi, setMontantSaisi] = useState<number>(50000);
  const [nomClientSaisi, setNomClientSaisi] = useState("Producteur / GIE");
  const [refVenteSaisie, setRefVenteSaisie] = useState("Vente Intrants Directe");

  // Onglet : 'transactions' ou 'comptes'
  const [ongletActif, setOngletActif] = useState<"transactions" | "comptes">("transactions");
  const [modalNouveauCompte, setModalNouveauCompte] = useState(false);

  useEffect(() => {
    setTransactions(getTransactionsDirectes());
    setComptes(getComptesMarchandsDirects());
  }, []);

  const stats = getTotalEconomiesAggregateurs();

  const totalWave = transactions
    .filter((t) => t.methode === "wave" && t.statut === "valide")
    .reduce((acc, t) => acc + t.montant, 0);

  const totalOm = transactions
    .filter((t) => t.methode === "orange_money" && t.statut === "valide")
    .reduce((acc, t) => acc + t.montant, 0);

  const totalTpe = transactions
    .filter((t) => t.methode === "tpe_carte" && t.statut === "valide")
    .reduce((acc, t) => acc + t.montant, 0);

  const totalCash = transactions
    .filter((t) => t.methode === "especes" && t.statut === "valide")
    .reduce((acc, t) => acc + t.montant, 0);

  const transactionsFiltrees = transactions.filter((t) => {
    const matchMethode = filtreMethode === "toutes" || t.methode === filtreMethode;
    const q = recherche.toLowerCase();
    const matchRecherche =
      !q ||
      t.clientNom.toLowerCase().includes(q) ||
      t.commandeRef.toLowerCase().includes(q) ||
      t.referenceExterne.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q);
    return matchMethode && matchRecherche;
  });

  const handlePaiementReussi = (nouvelleTx: TransactionDirecte) => {
    setTransactions(getTransactionsDirectes());
    setModalEncaissementOuvert(false);
  };

  const handleAjouterCompte = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nouveau: CompteMarchandDirect = {
      id: `cpt-${Date.now()}`,
      type: fd.get("type") as any,
      nom: fd.get("nom") as string,
      numeroOuCode: fd.get("numeroOuCode") as string,
      banqueOuOperateur: fd.get("banqueOuOperateur") as string,
      pointDeVente: (fd.get("pointDeVente") as string) || "Caisse Centrale Intrants",
      actif: true,
      instructions: fd.get("instructions") as string,
    };
    saveCompteMarchandDirect(nouveau);
    setComptes(getComptesMarchandsDirects());
    setModalNouveauCompte(false);
  };

  return (
    <div className="space-y-6">
      {/* ── EN-TÊTE DE PAGE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Encaissements Directs sur Appareils Intrants
              </h1>
              <p className="text-xs text-foreground-muted">
                Zéro agrégateur intermédiaire • 0% de commission prélevée • 100% crédité sur les comptes et TPE du magasin d&apos;intrants
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalEncaissementOuvert(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition"
          >
            <Smartphone className="w-4 h-4" />
            <span>Nouvel Encaissement Direct</span>
          </button>
        </div>
      </div>

      {/* ── BANNIÈRE ÉCONOMIES AGREGATEURS ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-600/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-200">
              Économies de Trésorerie Définitivement Acquises
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">
              +{formatMontant(stats.totalEconomise)}
            </h2>
            <p className="text-xs text-emerald-100">
              Frais d&apos;agrégateurs (2.5%) totalement économisés sur les {stats.nombreTransactions} encaissements directs d&apos;intrants agricoles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 self-stretch md:self-auto justify-between md:justify-start">
          <div>
            <p className="text-[10px] text-emerald-200 font-semibold uppercase">Total Encaissé Direct</p>
            <p className="text-lg font-black">{formatMontant(stats.totalEncaisseDirect)}</p>
          </div>
          <Coins className="w-6 h-6 text-emerald-200" />
        </div>
      </div>

      {/* ── GRILLE DES 4 MODALITÉS DIRECTES ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-muted">Wave Marchand</span>
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Smartphone className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-heading text-foreground mt-2">
            {formatMontant(totalWave)}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            +{formatMontant(Math.round(totalWave * 0.025))} économisés
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-muted">Orange Money Direct</span>
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              <Smartphone className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-heading text-foreground mt-2">
            {formatMontant(totalOm)}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            +{formatMontant(Math.round(totalOm * 0.025))} économisés
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-muted">TPE Banque Agricole</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-heading text-foreground mt-2">
            {formatMontant(totalTpe)}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            +{formatMontant(Math.round(totalTpe * 0.025))} économisés
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-muted">Espèces Caisse</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Banknote className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-heading text-foreground mt-2">
            {formatMontant(totalCash)}
          </p>
          <span className="text-[10px] text-foreground-muted font-medium">Direct au tiroir</span>
        </div>
      </div>

      {/* ── ONGLETS & ACTIONS ── */}
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setOngletActif("transactions")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              ongletActif === "transactions"
                ? "bg-foreground text-background shadow-xs"
                : "text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            Historique des Encaissements Directs ({transactions.length})
          </button>
          <button
            onClick={() => setOngletActif("comptes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              ongletActif === "comptes"
                ? "bg-foreground text-background shadow-xs"
                : "text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            Terminaux & Comptes Marchands Intrants ({comptes.length})
          </button>
        </div>

        {ongletActif === "comptes" && (
          <button
            onClick={() => setModalNouveauCompte(true)}
            className="px-3 py-1.5 rounded-xl border border-surface-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold text-foreground flex items-center gap-1.5 transition"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ajouter un Terminal</span>
          </button>
        )}
      </div>

      {/* ── ONGLET 1 : HISTORIQUE DES TRANSACTIONS DIRECTES ── */}
      {ongletActif === "transactions" && (
        <div className="space-y-4">
          {/* BARRE DE RECHERCHE ET FILTRES */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Rechercher par producteur, coopérative, bon d'intrants, réf Wave/OM/STAN..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-foreground-muted" />
              <select
                value={filtreMethode}
                onChange={(e) => setFiltreMethode(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs"
              >
                <option value="toutes">Toutes les méthodes</option>
                <option value="wave">Wave Direct</option>
                <option value="orange_money">Orange Money Direct</option>
                <option value="tpe_carte">TPE LBA / CNCAS</option>
                <option value="especes">Espèces Caisse</option>
              </select>
            </div>
          </div>

          {/* TABLE DES TRANSACTIONS */}
          <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-raised border-b border-surface-border text-foreground-muted font-semibold">
                  <tr>
                    <th className="p-3">Réf / Date</th>
                    <th className="p-3">Producteur & Commande</th>
                    <th className="p-3">Canal & Terminal</th>
                    <th className="p-3">Réf. Externe (Opérateur/STAN)</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3 text-right">Économie (0%)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-foreground">
                  {transactionsFiltrees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-foreground-muted">
                        Aucun encaissement direct trouvé pour ces critères.
                      </td>
                    </tr>
                  ) : (
                    transactionsFiltrees.map((t) => (
                      <tr key={t.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                        <td className="p-3">
                          <span className="font-mono font-bold text-foreground block">{t.id}</span>
                          <span className="text-[11px] text-foreground-muted">
                            {t.date} à {t.heure}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold block">{t.clientNom}</span>
                          <span className="text-[11px] text-foreground-muted">{t.commandeRef}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-medium block">{t.methodeLibelle}</span>
                          <span className="text-[10px] text-foreground-muted">{t.terminalOuCompteNom}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono bg-surface-raised px-2 py-0.5 rounded border border-surface-border text-[11px]">
                            {t.referenceExterne}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold font-mono text-foreground text-sm">
                          {formatMontant(t.montant)}
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                            +{formatMontant(t.fraisAggregateurEconomises)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setTransactionAffichee(t)}
                            className="p-1.5 rounded-lg border border-surface-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground-muted hover:text-foreground"
                            title="Voir le reçu"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ONGLET 2 : CONFIGURATION DES COMPTES MARCHANDS ── */}
      {ongletActif === "comptes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comptes.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-surface border border-surface-border flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {c.type === "wave" || c.type === "orange_money" ? (
                      <Smartphone className="w-5 h-5" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{c.nom}</h3>
                    <p className="text-xs text-foreground-muted">{c.banqueOuOperateur}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    c.actif
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {c.actif ? "Actif au comptoir" : "Inactif"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-raised border border-surface-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Identifiant / Code Marchand :</span>
                  <span className="font-mono font-bold text-foreground">{c.numeroOuCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Poste / Affectation :</span>
                  <span className="text-foreground">{c.pointDeVente}</span>
                </div>
              </div>

              {c.instructions && (
                <p className="text-[11px] text-foreground-muted italic leading-relaxed">
                  « {c.instructions} »
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODALE D'ENCAISSEMENT DIRECT RAPIDE ── */}
      {modalEncaissementOuvert && (
        <ModalEncaissementDirect
          montant={montantSaisi}
          clientNom={nomClientSaisi}
          commandeRef={refVenteSaisie}
          onClose={() => setModalEncaissementOuvert(false)}
          onSuccess={handlePaiementReussi}
        />
      )}

      {/* ── MODALE VISUALISATION REÇU D'ENCAISSEMENT ── */}
      {transactionAffichee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-surface-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <h3 className="text-base font-bold text-foreground">Reçu d&apos;Encaissement Magasin d&apos;Intrants</h3>
              <button onClick={() => setTransactionAffichee(null)}>
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-foreground-muted">N° Transaction :</span>
                <span className="font-mono font-bold">{transactionAffichee.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Date & Heure :</span>
                <span>{transactionAffichee.date} {transactionAffichee.heure}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Producteur / GIE :</span>
                <span className="font-bold">{transactionAffichee.clientNom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Bon d&apos;intrants :</span>
                <span>{transactionAffichee.commandeRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Moyen utilisé :</span>
                <span>{transactionAffichee.methodeLibelle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Référence opérateur :</span>
                <span className="font-mono font-bold bg-surface-raised px-1.5 py-0.5 rounded">
                  {transactionAffichee.referenceExterne}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-surface-border text-sm font-bold">
                <span>Montant Réglé :</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatMontant(transactionAffichee.montant)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-surface-border text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Imprimer
              </button>
              <button
                onClick={() => setTransactionAffichee(null)}
                className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE AJOUT COMPTE MARCHAND ── */}
      {modalNouveauCompte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-surface-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <h3 className="text-base font-bold text-foreground">Ajouter un Terminal Marchand</h3>
              <button onClick={() => setModalNouveauCompte(false)}>
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            <form onSubmit={handleAjouterCompte} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground-muted mb-1">Type de Terminal</label>
                <select name="type" className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground">
                  <option value="wave">Wave Business</option>
                  <option value="orange_money">Orange Money Pro</option>
                  <option value="tpe_banque">TPE Bancaire Physique (LBA / CNCAS / CBAO)</option>
                  <option value="free_money">Free Money Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-foreground-muted mb-1">Libellé du Terminal</label>
                <input name="nom" required placeholder="Ex: TPE Caisse Entrepôt #02" className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground" />
              </div>
              <div>
                <label className="block text-foreground-muted mb-1">Numéro Téléphone Marchand ou Identifiant TPE</label>
                <input name="numeroOuCode" required placeholder="Ex: +221 77 450 00 00 ou TPE-LBA-02" className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground font-mono" />
              </div>
              <div>
                <label className="block text-foreground-muted mb-1">Banque ou Opérateur Partenaire</label>
                <input name="banqueOuOperateur" required placeholder="Ex: La Banque Agricole (LBA)" className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground" />
              </div>
              <div>
                <label className="block text-foreground-muted mb-1">Emplacement / Point de Vente</label>
                <input name="pointDeVente" defaultValue="Caisse Centrale Intrants" className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground" />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNouveauCompte(false)}
                  className="flex-1 py-2 rounded-xl border border-surface-border text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

