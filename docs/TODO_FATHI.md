# MedicApp - Ma to-do list (Fathi)

Derniere mise a jour: 2026-06-20 (env local lance ; infra Azure differee au HDS ; Stripe reste a creer)

Checklist personnelle pas-a-pas pour reprendre le travail sur la plateforme et preparer le module de paiement. Pour le detail technique de chaque phase, voir `ROADMAP.md` ; pour l'etat verifie, voir `ETAT_PROJET.md`.

## 1. Mettre la plateforme en route sur mon ordinateur — FAIT

L'environnement local tourne (Docker + frontend), sur donnees fictives. On reste en local : on ne touche pas a Azure tant que le durcissement HDS n'est pas lance.

- [x] prerequis installes (Git, Docker Desktop, Node.js, Python) ;
- [x] depot clone hors OneDrive (`C:\dev\medicapp`) et ouvert dans VS Code ;
- [x] backend lance avec Docker + migrations appliquees ;
- [x] frontend lance en local.

## 2. Commencer a travailler sur les modifications

- [ ] creer une branche de travail : `git checkout -b simplification-pilote` ;
- [ ] rejouer une fois le parcours patient en local pour bien le re-decouvrir ;
- [ ] noter au fil de l'eau les bugs/regressions rencontres ;
- [ ] envoyer la liste de corrections FAQ a appliquer ;
- [ ] fournir les exemples PDF reels d'ordonnance ;
- [ ] fournir l'exemple de compte rendu de consultation prealable ;
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

## 5. Simplification du parcours avant pilote

- [ ] ameliorer la page d'accueil pour presenter davantage le docteur et le cabinet ;
- [ ] retirer Yousign du parcours actif pour le pilote ;
- [ ] conserver la signature sur place/tablette comme mecanisme principal ;
- [ ] masquer la video explicative dans l'interface publique et le parcours patient ;
- [ ] simplifier l'espace praticien pour un seul docteur ;
- [ ] creer le dashboard administrateur de gestion des creneaux ;
- [ ] definir les types de creneaux: consultation prealable d'information, acte, indisponibilite, autre ;
- [ ] definir les durees de creneaux par jour/plage horaire ;
- [ ] prevoir l'ouverture ou l'envoi des signatures cabinet depuis le dashboard si utile.

## 6. Teleconsultation et paiement

Le module de teleconsultation n'est pas encore integre : le champ "visio/presentiel" est une etiquette sur le RDV, sans salle d'appel.
Le paiement concerne la consultation prealable, pas l'acte.

Decisions actees (2026-06-20) :
- flux paiement : **payer pour reserver** (creneau confirme et acces visio delivre seulement apres paiement Stripe reussi) ;
- visio : **LiveKit**, salle integree dans l'espace patient ; phasage **Cloud UE (pilote, donnees fictives) -> self-host HDS (prod)**, meme SDK, pas de reecriture ;
- contrainte visio medicale : hebergeable HDS ou presta certifie HDS, donnees UE + DPA, embarquable, lien d'acces a usage unique, **sans enregistrement** (seul artefact conserve = compte rendu ecrit).

Tarifs (retour cabinet / Miriam, 2026-06-19) : consultation prealable = **50 EUR** (montant Stripe, remplace l'ancien 40 EUR) ; acte de circoncision desormais **tarife par tranche d'age** (grille a fournir par le cabinet). Tarifs non affiches sur la page d'accueil.

- [ ] recuperer aupres du cabinet la grille de tarifs par tranche d'age ;
- [ ] cadrer la solution de teleconsultation: lien externe rapide ou salle integree ;
- [ ] si salle integree retenue : chiffrer la complexite HDS et technique ;
- [ ] integrer Stripe au backend (paiement + webhook de confirmation) ;
- [ ] declencher le paiement de la consultation prealable dans le parcours ;
- [ ] recuperer la facture Stripe, la stocker en HDS, exposer un lien de telechargement securise ;
- [ ] gerer le cas du patient qui paie puis refuse l'acte ;
- [ ] tester (paiement reussi, echoue, acces facture).

## 7. Documents metier reels

- [ ] remplacer le modele fictif d'ordonnance par le PDF reel du cabinet ;
- [ ] generer un compte rendu de consultation prealable a partir du modele fourni ;
- [ ] envoyer ce compte rendu aux parents par lien securise apres la consultation.

## Ordre conseille

1. **Relancer le contrat HDS Microsoft** (section 3) -- a faire des maintenant, le delai admin est impredictible ;
2. **Creer le compte Stripe** (section 3) -- rapide, debloque la phase RP ;
3. **Envoyer les corrections FAQ et les exemples PDF** (sections 2 et 7) -- debloque les contenus reels ;
4. **Envoyer la question comptable a Miriam** (section 4) -- en parallele des etapes 2-3 ;
5. **Mettre en route en local** (section 1) -- prerequis au developpement ;
6. **Simplifier le parcours pilote** (section 5) -- Yousign et video explicative hors parcours actif ;
7. **Cadrer teleconsultation + paiement** (section 6) -- une fois Stripe ouvert et env local OK.
