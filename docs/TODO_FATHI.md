# MedicApp - Ma to-do list (Fathi)

Derniere mise a jour: 2026-06-27 (HDS enclenche ; socle teleconsultation + paiement local operationnel ; Stripe reste a creer)

Checklist personnelle pas-a-pas pour reprendre le travail sur la plateforme et preparer le module de paiement. Pour le detail technique de chaque phase, voir `ROADMAP.md` ; pour l'etat verifie, voir `ETAT_PROJET.md`.

## 1. Mettre la plateforme en route sur mon ordinateur — FAIT

L'environnement local tourne (Docker + frontend), sur donnees fictives. On reste en local : on ne touche pas a Azure tant que le durcissement HDS n'est pas lance.

- [x] prerequis installes (Git, Docker Desktop, Node.js, Python) ;
- [x] depot clone hors OneDrive (`C:\dev\medicapp`) et ouvert dans VS Code ;
- [x] backend lance avec Docker + migrations appliquees ;
- [x] frontend lance en local.
- [x] LiveKit local lance via Docker Compose (`ws://localhost:7880`) pour tester une vraie salle visio.

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
- [x] Azure (compte cabinet titulaire HDS + compte perso dev) ;
- [ ] **Stripe** : creer le compte (seul compte manquant), recuperer les cles API test et production ;
- [ ] **LiveKit Cloud UE** : a creer/configurer pour le pilote a donnees fictives, apres validation du test local ;
- [x] **Contrat HDS Microsoft** : reunion tenue 25/06, docs de conformite + certificat HDS recus 26/06 et archives dans `docs/`. Comptes Azure transmis a Microsoft.

## 3bis. Suivi HDS Microsoft (en cours)

- [x] accuse de reception des documents Microsoft (a Chedene) -- ou confirmer qu'il est fait ;
- [ ] **attendre le contact du partenaire Microsoft** pour le parametrage Azure HDS (mise en prod) ; preparer mes questions avant l'appel ;
- [ ] avec le partenaire : appliquer le durcissement reseau (Private Endpoints + coupure acces publics, deja scriptes dans `docs/compliance/INFRASTRUCTURE_HDS.md`) ;
- [ ] verifier que tout est bien deploye en **France Central** et que les services actives sont dans le perimetre certifie ;
- [ ] securiser au contrat cabinet : clause "cabinet titulaire Azure / Fathi prestataire dev-integration".

## 3ter. Maintenance et couts (a presenter au cabinet)

- [ ] presenter au cabinet les deux couts recurrents : **infra Azure ~400 EUR/mois (paye par le cabinet)** + **maintenance ~400 EUR HT/mois (formule Standard, facturee par moi)** ;
- [ ] formaliser le **contrat de maintenance distinct** (perimetre inclus/exclu, SLA, evolutions hors forfait au TJM) ;
- [ ] ajouter l'annexe maintenance au devis.

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

Le socle teleconsultation + paiement est maintenant integre et testable en local. Le paiement concerne la consultation prealable, pas l'acte.

Decisions actees (2026-06-20) :
- flux paiement : **payer pour reserver** (creneau confirme et acces visio delivre seulement apres paiement Stripe reussi) ;
- visio : **LiveKit**, salle integree dans l'espace patient ; phasage **Cloud UE (pilote, donnees fictives) -> self-host HDS (prod)**, meme SDK, pas de reecriture ;
- contrainte visio medicale : hebergeable HDS ou presta certifie HDS, donnees UE + DPA, embarquable, lien d'acces a usage unique, **sans enregistrement** (seul artefact conserve = compte rendu ecrit).

Tarifs (retour cabinet / Miriam, 2026-06-19) : consultation prealable = **50 EUR** (montant Stripe, remplace l'ancien 40 EUR) ; acte de circoncision desormais **tarife par tranche d'age** (grille a fournir par le cabinet). Tarifs non affiches sur la page d'accueil.

- [ ] recuperer aupres du cabinet la grille de tarifs par tranche d'age ;
- [x] cadrer la solution de teleconsultation: LiveKit integre dans l'application ;
- [x] implementer le socle local: paiement mock, RDV valide, session LiveKit, tokens patient/praticien ;
- [x] declencher le paiement de la consultation prealable dans le parcours ;
- [x] tester la generation de vrais tokens LiveKit locaux (`mock=false`) ;
- [ ] faire une recette visio complete a deux navigateurs/profils (Chrome patient + Edge praticien) ;
- [ ] integrer Stripe reel au backend (cles sandbox + webhook de confirmation signe) ;
- [ ] recuperer la facture Stripe, la stocker en HDS, exposer un lien de telechargement securise ;
- [ ] gerer le cas du patient qui paie puis refuse l'acte ;
- [ ] tester (paiement Stripe reussi, echoue, acces facture).

## 7. Documents metier reels

- [ ] remplacer le modele fictif d'ordonnance par le PDF reel du cabinet ;
- [ ] generer un compte rendu de consultation prealable a partir du modele fourni ;
- [ ] envoyer ce compte rendu aux parents par lien securise apres la consultation.

## Ordre conseille

1. **Tester la visio locale a deux profils** (section 6) -- patient Chrome + praticien Edge, camera/micro autorises ;
2. **Creer le compte Stripe** (section 3) -- recuperer les cles test pour remplacer le mock ;
3. **Brancher Stripe sandbox + webhook** (section 6) -- puis tester paiement reussi/echec ;
4. **Suivre le contact du partenaire Microsoft** (section 3bis) -- volet HDS enclenche, preparer mes questions ;
5. **Envoyer les corrections FAQ et les exemples PDF** (sections 2 et 7) -- debloque les contenus reels ;
6. **Envoyer la question comptable a Miriam** (section 4) -- valider facture Stripe/export mensuel ;
7. **Simplifier le parcours pilote** (section 5) -- Yousign et video explicative hors parcours actif.
