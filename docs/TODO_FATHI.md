# MedicApp - Ma to-do list (Fathi)

Derniere mise a jour: 2026-06-18 (revue post-reprise)

Checklist personnelle pas-a-pas pour reprendre le travail sur la plateforme et preparer le module de paiement. Pour le detail technique de chaque phase, voir `ROADMAP.md` ; pour l'etat verifie, voir `ETAT_PROJET.md`.

## 1. Mettre la plateforme en route sur mon ordinateur

But: pouvoir developper et tester en local, sans toucher a Azure (Docker monte sa propre base PostgreSQL locale).

- [ ] installer les prerequis: **Git**, **Docker Desktop**, **Node.js**, **Python** ;
- [ ] cloner le depot : `git clone https://github.com/Shaaakir281/MedicApp.git` ;
- [ ] ouvrir le dossier dans VS Code ;
- [ ] backend : `cd backend`, puis `Copy-Item .env.example .env` ;
- [ ] lancer le backend avec Docker : `docker compose up --build` ;
- [ ] appliquer les migrations : `docker compose exec backend alembic upgrade head` ;
- [ ] verifier l'API : ouvrir `http://localhost:8000/docs` ;
- [ ] (optionnel) injecter des donnees fictives : `seed_practitioner_demo.py` ;
- [ ] frontend : `cd frontend`, `npm install`, `npm run dev` ;
- [ ] verifier le frontend : ouvrir `http://localhost:5173`.

## 2. Commencer a travailler sur les modifications

- [ ] creer une branche de travail : `git checkout -b paiement-stripe` ;
- [ ] rejouer une fois le parcours patient en local pour bien le re-decouvrir ;
- [ ] noter au fil de l'eau les bugs/regressions rencontres ;
- [ ] commiter regulierement et pousser sur GitHub.

## 3. Comptes et services tiers

- [x] Mailjet (email) ;
- [x] Twilio (SMS) ;
- [x] OVH ;
- [x] nom de domaine (achat effectue, en cours de propagation/configuration) ;
- [x] Azure ;
- [ ] **Stripe** : creer le compte (seul compte manquant), recuperer les cles API test et production ;
- [ ] **Contrat HDS Microsoft** : relancer si pas de reponse sous une semaine -- c'est le delai administratif le plus incertain, initier maintenant.

## 4. Cote cabinet (a confirmer avec Miriam / le comptable)

- [ ] envoyer a Miriam la question : quel logiciel comptable, peut-il gerer les factures de consultations ;
- [ ] valider que **Stripe emet la facture** et que le comptable travaille sur l'**export mensuel** Stripe ;
- [ ] confirmer l'absence de remboursement / feuille de soins (acte rituel non therapeutique).

## 5. Module video : arbitrage (decision avant devis final)

Le module video n'est pas integre : le champ "visio/presentiel" est une etiquette sur le RDV, sans salle d'appel.
Deux options a trancher avec le praticien :

- **Option A - Lien externe** : le praticien colle un lien (Whereby, Zoom, etc.) dans le RDV ou par SMS. Zero dev, zero contrainte HDS supplementaire, solution immediate.
- **Option B - Video integree native** : salle d'appel dans l'espace patient (WebRTC / Jitsi / Whereby embed). Complexite HDS a evaluer, a chiffrer comme phase independante.

- [ ] presenter les deux options au praticien et obtenir sa decision ;
- [ ] si Option B retenue : chiffrer la phase video et l'ajouter au devis.

## 6. Module de paiement (developpement)

A faire une fois le compte Stripe cree. Detail complet dans `ROADMAP.md` section RP.

- [ ] integrer Stripe au backend (paiement + webhook de confirmation) ;
- [ ] declencher le paiement de la consultation prealable dans le parcours ;
- [ ] recuperer la facture Stripe, la stocker en HDS, exposer un lien de telechargement securise ;
- [ ] gerer le cas du patient qui paie puis refuse l'acte ;
- [ ] tester (paiement reussi, echoue, acces facture).

## Ordre conseille

1. **Relancer le contrat HDS Microsoft** (section 3) -- a faire des maintenant, le delai admin est impredictible ;
2. **Creer le compte Stripe** (section 3) -- rapide, debloque la phase RP ;
3. **Arbitrage video** (section 5) -- presenter les options au praticien avant de finaliser le devis ;
4. **Envoyer la question comptable a Miriam** (section 4) -- en parallele des etapes 2-3 ;
5. **Mettre en route en local** (section 1) -- prerequis au developpement ;
6. **Attaquer le developpement du paiement** (section 6) -- une fois Stripe ouvert et env local OK.
