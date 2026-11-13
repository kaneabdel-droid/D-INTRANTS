"use client";

import { useState, useEffect } from "react";
import {
  Smartphone,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Copy,
  Printer,
  ShieldCheck,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
  Wheat,
} from "lucide-react";
import QRCode from "qrcode";
import {
  CompteMarchandDirect,
  TransactionDirecte,
  getComptesMarchandsDirects,
  enregistrerTransactionDirecte,
} from "@/lib/paiement-direct-storage";
import { formatMontant } from "@/lib/utils";

interface ModalEncaissementDirectProps {
  montant: number;
  clientNom?: string;
  commandeRef?: string;
  pointDeVente?: string;
  caissier?: string;
  onClose: () => void;
  onSuccess: (tx: TransactionDirecte) => void;
}

export function ModalEncaissementDirect({
  montant,
  clientNom = "Producteur / GIE",
  commandeRef = "Vente Intrants",
  pointDeVente = "Caisse Centrale Intrants",
  caissier = "Caissier en service",
  onClose,
  onSuccess,
}: ModalEncaissementDirectProps) {
  const [comptes, setComptes] = useState<CompteMarchandDirect[]>([]);
  const [methodeActive, setMethodeActive] = useState<
    "wave" | "orange_money" | "tpe_carte" | "especes"
  >("wave");

  // QR Codes générés en DataURL
  const [waveQrUrl, setWaveQrUrl] = useState<string>("");
  const [omQrUrl, setOmQrUrl] = useState<string>("");

  // Formulaires spécifiques
  const [waveRefTransaction, setWaveRefTransaction] = useState("");
  const [omRefTransaction, setOmRefTransaction] = useState("");
  const [tpeSelectionneId, setTpeSelectionneId] = useState("");
  const [tpeStanAutorisation, setTpeStanAutorisation] = useState("");
  const [tpeReseauCarte, setTpeReseauCarte] = useState("Visa");
  const [tpeDerniersChiffres, setTpeDerniersChiffres] = useState("");

  const [especesMontantRecu, setEspecesMontantRecu] = useState(montant);

  const [copieSucces, setCopieSucces] = useState<string | null>(null);
  const [transactionReussie, setTransactionReussie] = useState<TransactionDirecte | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const loadedComptes = getComptesMarchandsDirects();
    setComptes(loadedComptes);

    // Initialiser le TPE sélectionné
    const premierTpe = loadedComptes.find((c) => c.type === "tpe_banque" && c.actif);
    if (premierTpe) setTpeSelectionneId(premierTpe.id);

    // Générer QR code Wave dynamique avec le montant
    const compteWave = loadedComptes.find((c) => c.type === "wave" && c.actif);
    const waveNum = compteWave?.numeroOuCode || "+221774500000";
    const wavePayload = `https://pay.wave.com/m/${encodeURIComponent(
      waveNum.replace(/\s+/g, "")
    )}?amount=${montant}`;

    QRCode.toDataURL(wavePayload, { width: 220, margin: 1 })
      .then((url) => setWaveQrUrl(url))
      .catch((err) => console.warn("Erreur génération QR Wave:", err));

    // Générer QR code Orange Money
    const compteOm = loadedComptes.find((c) => c.type === "orange_money" && c.actif);
    const omCode = compteOm?.numeroOuCode || "781045";
    const omPayload = `OMPAY:${omCode}:${montant}`;

    QRCode.toDataURL(omPayload, { width: 220, margin: 1 })
      .then((url) => setOmQrUrl(url))
      .catch((err) => console.warn("Erreur génération QR OM:", err));
  }, [montant]);

  const compteWave = comptes.find((c) => c.type === "wave" && c.actif);
  const compteOm = comptes.find((c) => c.type === "orange_money" && c.actif);
  const tpeDisponibles = comptes.filter((c) => c.type === "tpe_banque" && c.actif);
  const compteTpeActuel = tpeDisponibles.find((t) => t.id === tpeSelectionneId) || tpeDisponibles[0];

  const economiesEstimees = Math.round(montant * 0.025); // 2.5% préservés

  const handleCopier = (texte: string, etiquette: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texte);
      setCopieSucces(`Copié : ${etiquette}`);
      setTimeout(() => setCopieSucces(null), 2500);
    }
  };

  const handleValiderPaiement = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    let referenceExterne = "";
    let methodeLibelle = "";
    let terminalNom = "";

    const dateNow = new Date().toISOString().slice(0, 10);
    const heureNow = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (methodeActive === "wave") {
      if (!waveRefTransaction.trim()) {
        setErreur("Veuillez renseigner l'ID de transaction Wave reçu par SMS sur le smartphone marchand.");
        return;
      }
      referenceExterne = waveRefTransaction.trim();
      methodeLibelle = `Wave Direct Marchand (${compteWave?.nom || "Caisse Intrants"})`;
      terminalNom = compteWave?.nom || "Smartphone Caisse Wave";
    } else if (methodeActive === "orange_money") {
      if (!omRefTransaction.trim()) {
        setErreur("Veuillez renseigner la référence de transaction Orange Money reçue par SMS.");
        return;
      }
      referenceExterne = omRefTransaction.trim();
      methodeLibelle = `Orange Money Direct (#144# - Code: ${compteOm?.numeroOuCode || "781045"})`;
      terminalNom = compteOm?.nom || "Compte Marchand OM";
    } else if (methodeActive === "tpe_carte") {
      if (!tpeStanAutorisation.trim()) {
        setErreur("Veuillez saisir le N° d'autorisation ou STAN imprimé sur le ticket du TPE bancaire.");
        return;
      }
      referenceExterne = `STAN-${tpeStanAutorisation.trim()}${
        tpeDerniersChiffres ? ` / Carte **** ${tpeDerniersChiffres.trim()}` : ""
      }`;
      methodeLibelle = `TPE Carte Bancaire (${compteTpeActuel?.banqueOuOperateur || "Banque"} - ${tpeReseauCarte})`;
      terminalNom = compteTpeActuel?.nom || "TPE Bancaire Intrants";
    } else if (methodeActive === "especes") {
      if (especesMontantRecu < montant) {
        setErreur(`Le montant reçu (${formatMontant(especesMontantRecu)}) est inférieur au montant dû (${formatMontant(montant)}).`);
        return;
      }
      referenceExterne = `ESP-${Date.now().toString().slice(-6)}`;
      methodeLibelle = `Espèces (Reçu: ${formatMontant(especesMontantRecu)}, Rendu: ${formatMontant(
        especesMontantRecu - montant
      )})`;
      terminalNom = "Tiroir-Caisse Intrants";
    }

    const nouvelleTransaction = enregistrerTransactionDirecte({
      date: dateNow,
      heure: heureNow,
      montant,
      devise: "XOF",
      methode: methodeActive,
      methodeLibelle,
      referenceExterne,
      terminalOuCompteNom: terminalNom,
      clientNom,
      commandeRef,
      pointDeVente,
      caissier,
      statut: "valide",
      notes: "Paiement direct 0% commission intermédiaire enregistré sur terminal magasin d'intrants.",
    });

    setTransactionReussie(nouvelleTransaction);
    onSuccess(nouvelleTransaction);
  };

  const imprimerRecu = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface border border-surface-border rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* BANDEAU ZÉRO COMMISSION */}
        <div className="bg-emerald-600 text-white px-5 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>Encaissement Direct sur Terminal Intrants (Zéro Frais d&apos;Agrégateur)</span>
          </div>
          <span className="bg-emerald-700/80 px-2 py-0.5 rounded-full text-[11px] font-bold">
            0% de commission
          </span>
        </div>

        {/* EN-TÊTE MODALE */}
        <div className="p-5 border-b border-surface-border flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-foreground">
                Règlement de {formatMontant(montant)}
              </h2>
            </div>
            <p className="text-xs text-foreground-muted mt-1">
              Réf : <span className="font-semibold text-foreground">{commandeRef}</span> • Client :{" "}
              <span className="font-semibold text-foreground">{clientNom}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ÉCRAN DE SUCCÈS / REÇU D'ENCAISSEMENT */}
        {transactionReussie ? (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-foreground">Encaissement Validé !</h3>
              <p className="text-xs text-foreground-muted mt-1">
                Le montant a été crédité directement sur le compte de la coopérative/du magasin sans intermédiaire.
              </p>
            </div>

            {/* FICHE RÉCAPITULATIVE / TICKET D'ENCAISSEMENT INTRANTS */}
            <div className="p-5 rounded-2xl bg-surface-raised border border-surface-border text-left space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-surface-border">
                <span className="text-foreground-muted">Numéro d&apos;opération :</span>
                <span className="font-mono font-bold text-foreground">{transactionReussie.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">Montant réglé :</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatMontant(transactionReussie.montant)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">Canal / Terminal :</span>
                <span className="font-medium text-foreground">{transactionReussie.methodeLibelle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">Réf. transaction opérateur / TPE :</span>
                <span className="font-mono font-bold text-foreground bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {transactionReussie.referenceExterne}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-surface-border">
                <span className="text-foreground-muted">Frais d&apos;agrégateur économisés (2.5%) :</span>
                <span className="font-bold text-emerald-600">
                  +{formatMontant(transactionReussie.fraisAggregateurEconomises)} épargnés
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={imprimerRecu}
                className="flex-1 py-3 px-4 rounded-xl border border-surface-border hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs text-foreground flex items-center justify-center gap-2 transition"
              >
                <Printer className="w-4 h-4" /> Imprimer le reçu d&apos;encaissement
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                Terminer & Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* SÉLECTEUR DE MÉTHODE DIRECTE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setMethodeActive("wave")}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  methodeActive === "wave"
                    ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shadow-xs"
                    : "border-surface-border text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Smartphone className="w-5 h-5 text-sky-500" />
                <span className="text-xs">Wave Direct</span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-1.5 py-0.2 rounded-full font-medium">
                  QR / 0%
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethodeActive("orange_money")}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  methodeActive === "orange_money"
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold shadow-xs"
                    : "border-surface-border text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Smartphone className="w-5 h-5 text-orange-500" />
                <span className="text-xs">Orange Money</span>
                <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950 px-1.5 py-0.2 rounded-full font-medium">
                  #144# / QR
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethodeActive("tpe_carte")}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  methodeActive === "tpe_carte"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs"
                    : "border-surface-border text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <span className="text-xs">TPE LBA / CNCAS</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full font-medium">
                  Carte / Sans Contact
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethodeActive("especes")}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  methodeActive === "especes"
                    ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs"
                    : "border-surface-border text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Banknote className="w-5 h-5 text-amber-500" />
                <span className="text-xs">Espèces</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.2 rounded-full font-medium">
                  Tiroir-Caisse
                </span>
              </button>
            </div>

            {erreur && (
              <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erreur}</span>
              </div>
            )}

            {/* FORMULAIRE ADAPTÉ À LA MÉTHODE CHOISIE */}
            <form onSubmit={handleValiderPaiement} className="space-y-4">
              {/* CAS 1 : WAVE DIRECT */}
              {methodeActive === "wave" && (
                <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {waveQrUrl ? (
                      <div className="p-2 bg-white rounded-2xl shadow-md border border-slate-200 shrink-0 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={waveQrUrl}
                          alt="QR Code Wave Intrants"
                          className="w-36 h-36 mx-auto rounded-lg"
                        />
                        <p className="text-[10px] font-bold text-slate-700 mt-1">Scanner avec Wave</p>
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs shrink-0">
                        Chargement QR...
                      </div>
                    )}

                    <div className="flex-1 space-y-2 text-xs text-foreground">
                      <div className="p-2.5 rounded-xl bg-surface border border-surface-border">
                        <span className="text-[11px] text-foreground-muted block">Numéro Marchand Direct Wave :</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                            {compteWave?.numeroOuCode || "+221 77 450 00 00"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopier(compteWave?.numeroOuCode || "+221774500000", "Numéro Wave")
                            }
                            className="text-foreground-muted hover:text-foreground p-1"
                            title="Copier le numéro"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-foreground-muted leading-relaxed">
                        Le client scanne ce QR code avec son application <strong>Wave</strong> ou envoie{" "}
                        <strong className="text-foreground">{formatMontant(montant)}</strong> au numéro marchand ci-dessus.
                      </p>

                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Frais d&apos;agrégateur préservés pour le magasin : +{formatMontant(economiesEstimees)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      ID Transaction Wave reçu par SMS sur le smartphone caisse *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: W-991204812 ou ID de transaction"
                      value={waveRefTransaction}
                      onChange={(e) => setWaveRefTransaction(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* CAS 2 : ORANGE MONEY DIRECT */}
              {methodeActive === "orange_money" && (
                <div className="p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {omQrUrl ? (
                      <div className="p-2 bg-white rounded-2xl shadow-md border border-slate-200 shrink-0 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={omQrUrl}
                          alt="QR Code Orange Money"
                          className="w-36 h-36 mx-auto rounded-lg"
                        />
                        <p className="text-[10px] font-bold text-orange-600 mt-1">Scanner Orange Money</p>
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs shrink-0">
                        Chargement QR...
                      </div>
                    )}

                    <div className="flex-1 space-y-2 text-xs text-foreground">
                      <div className="p-2.5 rounded-xl bg-surface border border-surface-border">
                        <span className="text-[11px] text-foreground-muted block">Code Marchand Orange Money Direct :</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-mono font-bold text-sm text-orange-600 dark:text-orange-400">
                            {compteOm?.numeroOuCode || "781045"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopier(compteOm?.numeroOuCode || "781045", "Code OM")}
                            className="text-foreground-muted hover:text-foreground p-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300 text-[11px] font-mono">
                        #144#391*{compteOm?.numeroOuCode || "781045"}*{montant}#
                      </div>

                      <p className="text-foreground-muted leading-relaxed">
                        Le producteur compose la syntaxe USSD ci-dessus sur son téléphone ou valide via Max It.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Référence transaction Orange Money (reçue par SMS) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: MP261113.0930.D11094"
                      value={omRefTransaction}
                      onChange={(e) => setOmRefTransaction(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* CAS 3 : TPE CARTE BANCAIRE DIRECT */}
              {methodeActive === "tpe_carte" && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Paiement sur Terminal Bancaire (LBA / CNCAS)
                      </h4>
                      <p className="text-[11px] text-foreground-muted">
                        Insérer ou approcher la carte bancaire sur le terminal du magasin et valider le montant.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Terminal TPE Utilisé
                      </label>
                      <select
                        value={tpeSelectionneId}
                        onChange={(e) => setTpeSelectionneId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs"
                      >
                        {tpeDisponibles.map((tpe) => (
                          <option key={tpe.id} value={tpe.id}>
                            {tpe.nom} ({tpe.banqueOuOperateur})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Réseau de Carte
                      </label>
                      <select
                        value={tpeReseauCarte}
                        onChange={(e) => setTpeReseauCarte(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="GIM-UEMOA">GIM-UEMOA</option>
                        <option value="Autre">Autre carte bancaire</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        N° Autorisation / STAN du ticket TPE *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 031948"
                        value={tpeStanAutorisation}
                        onChange={(e) => setTpeStanAutorisation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        4 derniers chiffres de la carte (optionnel)
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Ex: 5120"
                        value={tpeDerniersChiffres}
                        onChange={(e) => setTpeDerniersChiffres(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CAS 4 : ESPÈCES DIRECT */}
              {methodeActive === "especes" && (
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Montant à régler
                      </label>
                      <input
                        type="text"
                        disabled
                        value={formatMontant(montant)}
                        className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-surface-border text-foreground font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Montant reçu du producteur (FCFA)
                      </label>
                      <input
                        type="number"
                        min={montant}
                        step={500}
                        value={especesMontantRecu}
                        onChange={(e) => setEspecesMontantRecu(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-foreground font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface border border-surface-border flex items-center justify-between text-xs">
                    <span className="text-foreground-muted">Monnaie à rendre au producteur :</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm font-mono">
                      {formatMontant(Math.max(0, especesMontantRecu - montant))}
                    </span>
                  </div>
                </div>
              )}

              {copieSucces && (
                <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                  {copieSucces}
                </p>
              )}

              {/* BOUTON VALIDATION */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-surface-border text-xs font-semibold text-foreground-muted hover:text-foreground transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
                >
                  <span>Confirmer l&apos;encaissement</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

