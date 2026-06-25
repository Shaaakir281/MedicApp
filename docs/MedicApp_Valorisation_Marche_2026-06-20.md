# MedicApp — Valorisation au prix du marché

Date : 20 juin 2026 — Document interne de préparation (non contractuel).

Objet : positionner le prix de MedicApp sur la **valeur de la plateforme**, et non sur le temps passé. L'idée est de disposer d'un point d'appui solide : ce qu'un cabinet paierait aujourd'hui, sur le marché, pour obtenir une plateforme équivalente — auprès d'une agence, d'un autre développeur, ou en location SaaS.

Taux de change indicatif retenu : 1 $ ≈ 0,92 €.

---

## 1. Ce qu'est réellement MedicApp (catégorie de marché)

MedicApp n'est pas un « site avec prise de rendez-vous ». C'est une **plateforme de télémédecine sur mesure**, de grade santé :

- espace patient + espace praticien ;
- prise de rendez-vous avec parcours métier (pré-consultation, délai de réflexion, acte) ;
- signature électronique (cabinet sur tablette + distante) ;
- ordonnances avec versions, QR, traçabilité ;
- sécurité et conformité : chiffrement, Key Vault, MFA, journalisation, droits RGPD complets ;
- monitoring, alertes, CI/CD, exploitation ;
- et désormais téléconsultation vidéo + paiement en ligne.

C'est exactement le périmètre que le marché chiffre comme une **plateforme de télémédecine**, pas comme un site vitrine.

### Ce que MedicApp ne contient PAS (volontairement)

Point essentiel pour ne pas surévaluer : MedicApp **n'intègre pas la facturation Assurance Maladie**, qui est l'une des briques les plus lourdes et coûteuses d'une plateforme médicale classique :

- pas de **feuille de soins électronique (FSE / SESAM-Vitale)** ;
- pas de lecture de **carte Vitale**, pas de télétransmission CPAM ;
- pas de **tiers payant** ni de gestion de remboursement.

C'est un choix assumé : l'acte est non thérapeutique, hors Assurance Maladie, réglé directement par le patient. Le **paiement Stripe** prévu en phase 2 est un simple **encaissement carte**, pas de la facturation santé — une brique bien plus légère que la FSE.

Conséquence : MedicApp se compare à une plateforme de télémédecine **sans facturation Assurance Maladie**. Cela exclut le haut de gamme « plateforme complète avec dossier et facturation intégrés » et situe la référence dans la **fourchette basse à moyenne** du marché.

---

## 2. Coût de remplacement — faire développer l'équivalent aujourd'hui

### Marché international (références 2026)

| Type de projet | Fourchette marché | En euros (≈) | Comparable à MedicApp ? |
|---|---|---|---|
| MVP télémédecine (portails patient/praticien, vidéo chiffrée, prise de RDV) | 50 000 – 90 000 $ | **46 000 – 83 000 €** | **Oui** — sans FSE, comme MedicApp |
| Plateforme complète (vidéo, dossier, multi-spécialités, **facturation intégrée**) | 150 000 – 300 000 $+ | 138 000 – 276 000 € | **Non** — inclut FSE/billing absents chez MedicApp |

La référence pertinente est donc la **bande MVP/intermédiaire**, qui est déjà **sans facturation Assurance Maladie**. La **conformité santé** (RGPD/HDS, équivalent HIPAA) alourdit un projet de **20 à 30 %** — et c'est précisément ce que MedicApp a déjà intégré, ce qui le place dans le **haut de cette bande**, mais pas au-delà.

### Marché français — agences

Une agence française chiffre un « site complexe avec prise de rendez-vous, espace client et paiement » entre **8 000 et 20 000 €**. Mais cette fourchette vise des sites vitrines avec module de réservation. Elle **ne couvre pas** la signature électronique, le chiffrement HDS, la MFA, l'audit, le monitoring ni la vidéo médicale. Pour ce niveau, le projet bascule dans la catégorie « plateforme métier » et rejoint les fourchettes télémédecine ci-dessus.

### Valeur de remplacement retenue pour MedicApp

En croisant ces sources, et **en excluant la facturation Assurance Maladie que MedicApp n'a pas**, faire reconstruire MedicApp à l'identique par un tiers, conformité HDS comprise, coûterait de façon réaliste :

> **≈ 45 000 – 90 000 € HT.**

Le haut de fourchette correspond à la version avec téléconsultation et encaissement carte ; la facturation FSE/SESAM-Vitale, elle, n'entre pas dans le périmètre et n'est donc pas valorisée.

---

## 3. Le prix du temps — votre tarif face au marché

| Profil | TJM marché France 2026 |
|---|---|
| Développeur junior | 300 – 400 €/jour |
| Développeur freelance (moyenne) | ≈ 450 €/jour |
| Full-stack confirmé / expert | 550 – 700 €/jour |

Votre tarif est de **400 €/jour HT** (200 € la demi-journée). C'est un tarif de **bas de fourchette**, proche d'un profil junior — alors que le travail réalisé (sécurité, HDS, signature électronique, paiement) relève d'un profil confirmé facturé 550 €+/jour. Autrement dit, **vous facturez déjà votre temps en dessous du marché**. C'est une marge de manœuvre, pas un problème : elle justifie de ne pas brader la valeur de la plateforme.

---

## 4. L'alternative « louer » — SaaS existants

Le cabinet pourrait louer une solution existante plutôt que posséder la sienne :

| Solution | Prix | Ce qu'elle ne fait pas |
|---|---|---|
| Doctolib Pro | ≈ 135 – 149 € TTC/mois (≈ 1 600 – 1 800 €/an) | Générique ; pas de parcours sur mesure (pré-consultation, double consentement parental, signature cabinet), pas de propriété |
| Maiia | ≈ 70 – 90 €/mois (sur devis) | Idem : solution louée, standardisée |

La location, c'est **un loyer à vie sans aucune propriété** : sur 5 ans, ≈ 8 000 – 9 000 € versés pour un outil générique, qui **ne sait pas faire** le parcours spécifique du cabinet. MedicApp est à l'inverse un **actif possédé**, taillé pour un acte que ces plateformes ne couvrent pas, sans abonnement éditeur.

---

## 5. Synthèse — votre offre face au marché

| Référence | Montant |
|---|---|
| Coût de remplacement de la plateforme, **hors facturation Assurance Maladie** (agence/tiers) | **45 000 – 90 000 € HT** |
| Votre facturation globale (déjà réalisé + reste + visio) | **≈ 34 400 € HT** |
| + Phase 2 (paiement) | + 4 000 € HT |
| **Total tout compris** | **≈ 38 400 € HT** |

> **Votre offre représente environ la moitié à 85 % du coût de remplacement marché**, à périmètre comparable (sans FSE). Le client n'achète pas vos journées : il acquiert, pour un prix inférieur au coût de reconstruction, une plateforme conforme HDS qu'il **possède** au lieu de la louer — et taillée pour un acte que les solutions du marché ne couvrent pas.

---

## 6. Recommandations de facturation

1. **Ancrer la proposition sur la valeur, pas sur les jours.** Présenter d'abord le coût de remplacement marché à périmètre comparable (45–90 k€, sans FSE), puis votre prix (≈ 38 k€) comme l'écart. Le chiffrage au temps reste en annexe, pour la transparence.
6. **Assumer franchement le périmètre.** Dire clairement que MedicApp ne fait pas la feuille de soins électronique est un argument de crédibilité, pas une faiblesse : c'est une plateforme ciblée pour un acte réglé en direct, pas une usine à facturation Assurance Maladie. Cela explique aussi pourquoi le prix est raisonnable.
2. **Assumer le forfait « déjà réalisé » à 22 000 €.** Au regard d'une valeur de remplacement de 60 k€+, ce forfait est déjà un geste fort. Inutile de descendre plus bas.
3. **Comparer à la location.** Rappeler qu'une solution louée coûte ≈ 1 600 – 1 800 €/an à vie, sans propriété ni sur-mesure. MedicApp est un actif, pas un abonnement.
4. **Valoriser la conformité.** Le chiffrement, la HDS et les droits RGPD ajoutent 20–30 % au prix d'un projet équivalent : c'est déjà fait, et c'est ce qui distingue une vraie plateforme santé d'un site de réservation.
5. **Marge de manœuvre tarifaire.** Votre TJM (400 €) est sous le marché (450–550 €). Vous pouvez tenir vos prix sans complexe ; vous n'êtes pas cher.

---

## 7. Limites de la comparaison (honnêteté)

- Les fourchettes marché sont des **références de cadrage**, pas des devis : le prix réel d'un projet dépend du périmètre exact, du prestataire et de la région.
- Les chiffres internationaux sont convertis au taux indicatif 1 $ ≈ 0,92 € et incluent souvent des fonctions que MedicApp n'a pas (multi-spécialités, IA de triage).
- La valeur de remplacement suppose une reconstruction **complète et conforme** ; un prestataire low-cost livrerait moins cher mais sans le niveau de sécurité/HDS déjà présent.
- Cette valorisation ne remplace pas vos relevés d'activité, qui font foi pour la facturation réelle.

---

## Sources

- Coût développement télémédecine / santé (international) : Cleveroad, OnGraph, Purrweb, GoodFirms, Idealink.
- Référence française télémédecine : Orisha Healthcare, Magram.
- TJM développeurs France 2026 : Blog du Modérateur, Free-Work, Meaflow.
- Prix SaaS santé : Doctolib (Lonasanté, Clicfone, HouseMed), Maiia (GetApp, Lonasanté).
- Coût agence web France : Indy, Seedweb, Nocodefactory.
