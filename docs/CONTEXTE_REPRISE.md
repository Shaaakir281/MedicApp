# Prompt de reprise — projet MedicApp

> Copier tout le contenu sous cette ligne dans une nouvelle conversation. Sélectionner aussi le dossier MedicApp pour que l'assistant puisse lire les documents directement.

---

Contexte projet : MedicApp, plateforme de **téléconsultation** pour **circoncision rituelle** (acte non thérapeutique). Backend FastAPI, frontend React, hébergement Azure (France Central). Repo : `github.com/Shaaakir281/MedicApp`. Projet en **pause technique** : base PostgreSQL et Azure Container Registry supprimés pour réduire les coûts ; frontend et monitoring conservés. Données fictives uniquement.

Je suis Fathi, le prestataire qui développe la plateforme pour le cabinet d'un médecin. Miriam est l'amie qui gère l'administratif côté cabinet (je la tutoie, ton synthétique). Tu me guides une étape à la fois, en réponses courtes.

## Documents de suivi (dans `docs/`)
- `ETAT_PROJET.md` — état vérifié, ce qui est fait / à revalider / à faire + tableau des comptes tiers.
- `ROADMAP.md` — phases R0→R6 + phase **RP** (module paiement Stripe).
- `TODO_FATHI.md` — ma checklist perso (lancer en local via Docker, comptes, dev paiement).
- `PERIMETRE_DEVIS.md` — périmètre préparatoire au devis.
- `REPRISE_PROJET.md` — procédure de reconstruction Azure.
- `CHECKLIST_OUVERTURE_COMPTES.html` — 35 étapes d'ouverture des comptes (domaine → email → Azure → Twilio → Mailjet → passation).
- `PASSATION_ACCES_PLATEFORME.docx` — registre des accès + annexe à remplir le jour de la remise.
- `PROMPT_GUIDE_COMPTES.md` — guide d'ouverture des comptes (à utiliser pour chaque création de compte).

## Décisions verrouillées

**Comptes & propriété**
- Tous les comptes que le cabinet possédera (domaine, Azure, Twilio, Mailjet) ouverts avec une identité neutre `admin@<domaine>`, facturation au nom du cabinet dès l'ouverture.
- J'avance les frais avec ma CB ; passation ultérieure (RDV 1h avec Miriam) pour basculer les CB + remettre la feuille de passation.
- Mots de passe : générés via Chrome, notés sur carnet papier (pas de mdp en clair sur OneDrive), 2FA partout. Le supprimer du compte Google le jour de la passation.
- **OVH** : compte dédié au projet (pas mon compte perso) ; alias `fathimetalsi+cabinet@gmail.com` le temps de l'achat, puis remplacé par `admin@<domaine>`. Le titulaire du domaine (nom + adresse du praticien) se déclare à l'achat, indépendamment du compte.
- **GitHub** : pas de 2e compte. Éventuellement une organisation GitHub gratuite (transférable). Le lien GitHub→Azure passe par OIDC côté Azure, pas par l'identité GitHub.

**Développement**
- Cloner le repo **hors de OneDrive** (ex. `C:\dev\medicapp`) — git sous OneDrive se corrompt. OneDrive = docs seulement.
- Dev en local via **Docker** (gratuit, visio comprise), push sur GitHub privé.
- Industrialisation (GitHub Actions → build image → ACR client → App Service, auth OIDC) au moment de la reconstruction Azure. Données fictives jusqu'à la fin du durcissement HDS.

**Paiement (nouveau — phase RP)**
- Paiement en ligne pour la **consultation préalable uniquement** ; l'acte reste réglé en direct le jour J.
- Pas de feuille de soins ni de remboursement (acte rituel non thérapeutique, hors Assurance Maladie).
- **Stripe** encaisse ET émet la facture automatiquement (numérotation incluse). On n'intègre PAS le logiciel comptable au serveur.
- Facture = donnée de santé → pas d'email : dépôt sur stockage **HDS** + lien sécurisé dans l'espace patient (comme les ordonnances). Le comptable récupère l'**export mensuel Stripe**.
- Question en attente côté cabinet : quel logiciel comptable, peut-il gérer les factures, OK pour le fonctionnement Stripe.

**Téléconsultation vidéo (point découvert)**
- Le module vidéo **n'existe pas** : seulement un *mode* de RDV « visio / présentiel » (étiquette sur le rendez-vous), aucune salle d'appel intégrée (pas de Twilio Video / Jitsi / Whereby / WebRTC).
- À décider : vidéo **intégrée** (native, espace patient, contrainte HDS) vs **outil externe** (lien collé par le praticien). À chiffrer comme phase à part entière.

## État des comptes (au 2026-06-18)
- Faits : Mailjet, Twilio, OVH, nom de domaine, Azure.
- En attente : contrat **HDS Microsoft** (1ère demande de contact envoyée).
- À ouvrir : **Stripe** (seul compte manquant).

## Devis
- En recalcul avec la visio. Ordre de grandeur évoqué : devis v3 ~34 j / ~13 600 € HT. Lot HDS 4,5 j incompressible. Documents de devis dans le dossier outputs d'une autre session.
- Coût annuel en production (HT) communiqué à Miriam : ~2 300–2 500 €/an (HDS + visio + domaine/emails + SMS ~0,05–0,08 €/unité, Mailjet gratuit au démarrage).

## Points de vigilance
- Initier les clauses HDS Microsoft dès la semaine 1 (délai administratif le plus incertain).
- Consentement du parent 2 absent le jour de l'acte : à trancher avec l'avocate avant tout retrait de Yousign.
- Vérifier si des patients réels ont déjà des données sur la plateforme (change la priorité du durcissement HDS).

## Prochaine étape demandée
Revoir et actualiser ensemble la to-do list (`TODO_FATHI.md`) en intégrant : achat domaine en cours, vidéo à arbitrer, Stripe à ouvrir, relance HDS.
