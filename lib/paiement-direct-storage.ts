/**
 * Module d'Encaissement Direct sur Appareils & Comptes du Magasin d'Intrants (Zéro Agrégateur)
 * D-INTRANTS — Économie de 100% des frais de commission d'agrégateur (2% à 3.5% préservés)
 */

export interface CompteMarchandDirect {
  id: string;
  type: 'wave' | 'orange_money' | 'free_money' | 'tpe_banque';
  nom: string;
  numeroOuCode: string;
  banqueOuOperateur: string;
  pointDeVente: string;
  actif: boolean;
  qrCodeData?: string;
  instructions?: string;
}

export interface TransactionDirecte {
  id: string;
  date: string;
  heure: string;
  montant: number;
  devise: string;
  methode: 'wave' | 'orange_money' | 'free_money' | 'tpe_carte' | 'especes';
  methodeLibelle: string;
  referenceExterne: string; // ID transaction Wave, ID Orange Money, N° Autorisation STAN TPE
  terminalOuCompteNom: string;
  clientNom: string;
  commandeRef: string; // Bon de livraison / Facture intrants / GIE
  pointDeVente: string;
  caissier: string;
  statut: 'valide' | 'annule';
  fraisAggregateurEconomises: number; // 2.5% du montant préservés
  notes?: string;
}

const STORAGE_KEY_COMPTES = 'dintrants_comptes_marchands_directs';
const STORAGE_KEY_TRANSACTIONS = 'dintrants_transactions_directes';

export const COMPTES_MARCHANDS_DEFAUT: CompteMarchandDirect[] = [
  {
    id: 'cpt-wave-intrants',
    type: 'wave',
    nom: 'Wave Marchand Caisse Intrants & Semences',
    numeroOuCode: '+221 77 450 00 00',
    banqueOuOperateur: 'Wave Business Sénégal',
    pointDeVente: 'Caisse Centrale Intrants',
    actif: true,
    qrCodeData: 'https://pay.wave.com/m/M_sn_intrants_agricoles',
    instructions: 'Scanner le QR Wave ou envoyer au numéro marchand direct du comptoir d’intrants',
  },
  {
    id: 'cpt-om-intrants',
    type: 'orange_money',
    nom: 'Orange Money Marchand Intrants',
    numeroOuCode: '781045',
    banqueOuOperateur: 'Orange Money Sénégal',
    pointDeVente: 'Caisse Centrale Intrants',
    actif: true,
    instructions: 'Composer #144#391*781045*Montant# ou scanner le QR code officiel du magasin',
  },
  {
    id: 'cpt-tpe-cncas',
    type: 'tpe_banque',
    nom: 'TPE Bancaire CNCAS / La Banque Agricole #01',
    numeroOuCode: 'TPE-LBA-INTRANTS-01',
    banqueOuOperateur: 'La Banque Agricole (LBA / CNCAS) - Visa/Mastercard/GIM',
    pointDeVente: 'Comptoir Principal Intrants',
    actif: true,
    instructions: 'Insérer la carte bancaire sur le terminal LBA pour règlements producteurs et coopératives',
  },
  {
    id: 'cpt-tpe-entrepot',
    type: 'tpe_banque',
    nom: 'TPE Mobile Dépôt Engrais & Gros Volumes',
    numeroOuCode: 'TPE-CBAO-DEPOT-02',
    banqueOuOperateur: 'CBAO Attijariwafa Bank',
    pointDeVente: 'Entrepôt & Hangar Principal',
    actif: true,
    instructions: 'Terminal mobile autonome pour enlèvement sacs d’engrais urée / NPK et semences certifiées',
  },
  {
    id: 'cpt-free-intrants',
    type: 'free_money',
    nom: 'Free Money Marchand',
    numeroOuCode: '54210',
    banqueOuOperateur: 'Free Money Sénégal',
    pointDeVente: 'Caisse Centrale Intrants',
    actif: false,
    instructions: 'Code Marchand Free Money direct',
  },
];

export const TRANSACTIONS_DIRECTES_DEFAUT: TransactionDirecte[] = [
  {
    id: 'TX-INT-2026-001',
    date: '2026-11-13',
    heure: '08:45',
    montant: 450000,
    devise: 'XOF',
    methode: 'wave',
    methodeLibelle: 'Wave Direct Marchand (0% agrégateur)',
    referenceExterne: 'W-991204812',
    terminalOuCompteNom: 'Wave Marchand Caisse Intrants & Semences',
    clientNom: 'GIE Bokk Jom (Vallée du Fleuve)',
    commandeRef: 'VNT-INT-0041 (Engrais NPK 15-15-15 & Urée)',
    pointDeVente: 'Caisse Centrale Intrants',
    caissier: 'Ousmane Sow',
    statut: 'valide',
    fraisAggregateurEconomises: 11250, // 450 000 * 2.5%
    notes: 'Paiement direct Wave vérifié sur smartphone marchand caisse',
  },
  {
    id: 'TX-INT-2026-002',
    date: '2026-11-13',
    heure: '09:30',
    montant: 95000,
    devise: 'XOF',
    methode: 'orange_money',
    methodeLibelle: 'Orange Money Direct (Code 781045)',
    referenceExterne: 'MP261113.0930.D11094',
    terminalOuCompteNom: 'Orange Money Marchand Intrants',
    clientNom: 'Producteur Maraîcher Modou Dieng',
    commandeRef: 'VNT-INT-0042 (Semences Oignon & Tomate)',
    pointDeVente: 'Caisse Centrale Intrants',
    caissier: 'Aminata Ndiaye',
    statut: 'valide',
    fraisAggregateurEconomises: 2375,
    notes: 'Code marchand composé au comptoir, validation par SMS',
  },
  {
    id: 'TX-INT-2026-003',
    date: '2026-11-13',
    heure: '10:20',
    montant: 2100000,
    devise: 'XOF',
    methode: 'tpe_carte',
    methodeLibelle: 'TPE Carte Bancaire LBA / CNCAS (STAN: 031948)',
    referenceExterne: 'STAN-031948 / AUTH-941029',
    terminalOuCompteNom: 'TPE Bancaire CNCAS / La Banque Agricole #01',
    clientNom: 'Coopérative Agricole du Saloum',
    commandeRef: 'VNT-INT-0043 (Pack complet campagne arachidière)',
    pointDeVente: 'Caisse Centrale Intrants',
    caissier: 'Ousmane Sow',
    statut: 'valide',
    fraisAggregateurEconomises: 52500, // 2 100 000 * 2.5%
    notes: 'Carte bancaire GIM/Visa sur TPE La Banque Agricole. Zéro commission intermédiaire.',
  },
  {
    id: 'TX-INT-2026-004',
    date: '2026-11-13',
    heure: '11:10',
    montant: 60000,
    devise: 'XOF',
    methode: 'especes',
    methodeLibelle: 'Espèces / Caisse Directe',
    referenceExterne: 'ESP-1110-INT',
    terminalOuCompteNom: 'Tiroir-Caisse Intrants',
    clientNom: 'Producteur Local',
    commandeRef: 'VNT-INT-0044 (Produits phytosanitaires bio)',
    pointDeVente: 'Caisse Centrale Intrants',
    caissier: 'Aminata Ndiaye',
    statut: 'valide',
    fraisAggregateurEconomises: 0,
    notes: 'Paiement espèces direct au comptoir.',
  },
];

export function getComptesMarchandsDirects(): CompteMarchandDirect[] {
  if (typeof window === 'undefined') return COMPTES_MARCHANDS_DEFAUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(COMPTES_MARCHANDS_DEFAUT));
      return COMPTES_MARCHANDS_DEFAUT;
    }
    return JSON.parse(raw);
  } catch {
    return COMPTES_MARCHANDS_DEFAUT;
  }
}

export function saveCompteMarchandDirect(compte: CompteMarchandDirect): void {
  if (typeof window === 'undefined') return;
  const existants = getComptesMarchandsDirects();
  const index = existants.findIndex((c) => c.id === compte.id);
  let maj: CompteMarchandDirect[];
  if (index >= 0) {
    maj = [...existants];
    maj[index] = compte;
  } else {
    maj = [compte, ...existants];
  }
  localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(maj));
}

export function supprimerCompteMarchandDirect(id: string): void {
  if (typeof window === 'undefined') return;
  const existants = getComptesMarchandsDirects();
  const maj = existants.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(maj));
}

export function getTransactionsDirectes(): TransactionDirecte[] {
  if (typeof window === 'undefined') return TRANSACTIONS_DIRECTES_DEFAUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(TRANSACTIONS_DIRECTES_DEFAUT));
      return TRANSACTIONS_DIRECTES_DEFAUT;
    }
    return JSON.parse(raw);
  } catch {
    return TRANSACTIONS_DIRECTES_DEFAUT;
  }
}

export function enregistrerTransactionDirecte(tx: Omit<TransactionDirecte, 'id' | 'fraisAggregateurEconomises'>): TransactionDirecte {
  const fraisAggregateurEconomises = tx.methode === 'especes' ? 0 : Math.round(tx.montant * 0.025);
  const nouvelle: TransactionDirecte = {
    ...tx,
    id: `TX-INT-${Date.now().toString().slice(-6)}`,
    fraisAggregateurEconomises,
  };

  if (typeof window !== 'undefined') {
    const existantes = getTransactionsDirectes();
    const maj = [nouvelle, ...existantes];
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(maj));
  }
  return nouvelle;
}

export function getTotalEconomiesAggregateurs(): { totalEncaisseDirect: number; totalEconomise: number; nombreTransactions: number } {
  const txs = getTransactionsDirectes();
  const valides = txs.filter((t) => t.statut === 'valide');
  const totalEncaisseDirect = valides.reduce((sum, t) => sum + t.montant, 0);
  const totalEconomise = valides.reduce((sum, t) => sum + t.fraisAggregateurEconomises, 0);
  return {
    totalEncaisseDirect,
    totalEconomise,
    nombreTransactions: valides.length,
  };
}

