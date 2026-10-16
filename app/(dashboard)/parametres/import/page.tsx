import React from 'react'
import type { Metadata } from 'next'
import { AssistantImport, type TypeImportOption } from '@/components/import/AssistantImport'
import { importerDonneesIntrants } from './actions'

export const metadata: Metadata = {
  title: 'Importer des données existantes — D-INTRANTS',
}

const OPTIONS_INTRANTS: TypeImportOption[] = [
  {
    id: 'articles',
    titre: 'Intrants & Stocks initiaux',
    description: 'Semences, engrais, produits phytosanitaires, outillage, prix et quantités en stock',
    icone: 'article',
    nomFichierModele: 'modele_import_intrants_stocks.csv',
    modeleCSV: `designation;reference;categorie;unite;prix_vente;quantite;seuil_alerte
Engrais NPK 15-15-15 sac 50kg;NPK-151515-50KG;Engrais minéraux;sac;19500;120;15
Urée 46% sac 50kg;UREE-46-50KG;Engrais azotés;sac;21000;100;10
Semence Maïs Hybride F1 sac 10kg;SEM-MAIS-F1-10KG;Semences certifiées;sac;12500;80;10
Semence Arachide 73-33 sac 50kg;SEM-ARACH-50KG;Semences certifiées;sac;24000;60;5
Insecticide Lambda-Cyhalothrine 1L;INS-LAMBDA-1L;Produits phytosanitaires;litre;7500;90;12
Pulvérisateur à dos 16L;PULV-16L;Matériel & Outillage;unite;18000;30;5`
  },
  {
    id: 'fournisseurs',
    titre: 'Fabricants & Fournisseurs',
    description: 'Industries chimiques, semenciers, distributeurs d’équipements agricoles',
    icone: 'fournisseur',
    nomFichierModele: 'modele_import_fournisseurs_intrants.csv',
    modeleCSV: `nom;telephone;adresse
INDUSTRIES CHIMIQUES DU SÉNÉGAL (ICS);+221 33 849 00 00;Dakar, Sénégal
TROPICASEM SÉNÉGAL;+221 33 832 20 20;Zone Franche, Dakar
SEDAB SÉNÉGAL;+221 33 864 12 12;Route de Rufisque, Dakar`
  },
  {
    id: 'clients',
    titre: 'Coopératives & Exploitants',
    description: 'GIE agricoles, producteurs, coopératives maraîchères et céréalières',
    icone: 'client',
    nomFichierModele: 'modele_import_clients_agricoles.csv',
    modeleCSV: `nom;telephone;adresse
GIE Des Producteurs de Riz de Ross Béthio;+221 77 111 22 33;Ross Béthio, Saint-Louis
Coopérative Maraîchère des Niayes;+221 78 222 33 44;Notto Gouye Diama, Thiès
Amadou Diallo (Grand Exploitant);+221 76 333 44 55;Kolda Commune`
  }
]

export default function PageImportIntrants() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AssistantImport
        nomApplication="D-INTRANTS"
        titreModule="Assistant d'Importation de Données Existantes"
        optionsTypes={OPTIONS_INTRANTS}
        onImporter={importerDonneesIntrants}
      />
    </div>
  )
}
