# Procédure de Gestion des Violations de Données Personnelles

## MedicApp - Conformité RGPD Article 33 & 34

**Version :** 1.0
**Date de création :** [DATE À REMPLIR]
**Dernière mise à jour :** [DATE À REMPLIR]
**Statut :** En vigueur
**Classification :** Confidentiel - Usage interne

---

## Table des Matières

1. [Objet et Champ d'Application](#1-objet-et-champ-dapplication)
2. [Définitions](#2-définitions)
3. [Cadre Réglementaire](#3-cadre-réglementaire)
4. [Détection et Identification](#4-détection-et-identification)
5. [Évaluation de la Violation](#5-évaluation-de-la-violation)
6. [Notification à la CNIL](#6-notification-à-la-cnil)
7. [Communication aux Personnes Concernées](#7-communication-aux-personnes-concernées)
8. [Documentation et Registre](#8-documentation-et-registre)
9. [Actions Correctives](#9-actions-correctives)
10. [Responsabilités](#10-responsabilités)
11. [Annexes](#11-annexes)

---

## 1. Objet et Champ d'Application

### 1.1 Objet

Cette procédure définit les étapes à suivre en cas de **violation de données personnelles** au sein de la plateforme MedicApp, conformément aux articles 33 et 34 du RGPD.

### 1.2 Champ d'application

Cette procédure s'applique à :

- **Toutes les données personnelles** traitées par MedicApp
- **Les données de santé** des patients (données sensibles)
- **Les données des parents/tuteurs légaux**
- **Les données techniques** (logs, IP, etc.)

### 1.3 Personnes concernées

| Rôle | Responsabilités |
|------|-----------------|
| **Responsable de traitement** | Décision finale, notification CNIL |
| **DPO / Référent données** | Coordination, évaluation, documentation |
| **Contact technique** | Détection, investigation, remédiation |
| **Sous-traitants** | Signalement immédiat (Azure, Yousign, Twilio) |

---

## 2. Définitions

### 2.1 Violation de données personnelles (RGPD art. 4.12)

> Une **violation de données personnelles** est une violation de la sécurité entraînant, de manière accidentelle ou illicite, la destruction, la perte, l'altération, la divulgation non autorisée de données personnelles transmises, conservées ou traitées d'une autre manière, ou l'accès non autorisé à de telles données.

### 2.2 Types de violations

| Type | Description | Exemples |
|------|-------------|----------|
| **Confidentialité** | Divulgation ou accès non autorisé | Piratage, email envoyé au mauvais destinataire, accès par employé non habilité |
| **Intégrité** | Altération non autorisée des données | Modification malveillante, corruption de fichiers |
| **Disponibilité** | Perte d'accès ou destruction | Ransomware, suppression accidentelle, perte de clé de chiffrement |

### 2.3 Données concernées par MedicApp

| Catégorie | Sensibilité | Exemples |
|-----------|-------------|----------|
| **Données de santé** | Très élevée | Questionnaire médical, allergies, antécédents |
| **Données d'identification enfant** | Élevée | Nom, prénom, date de naissance |
| **Données parents** | Élevée | Nom, email, téléphone |
| **Documents signés** | Élevée | Consentements, autorisations parentales |
| **Données techniques** | Modérée | Logs, IP, horodatages |

---

## 3. Cadre Réglementaire

### 3.1 Textes applicables

| Texte | Articles | Obligation |
|-------|----------|------------|
| **RGPD** | Article 33 | Notification CNIL sous 72h |
| **RGPD** | Article 34 | Communication aux personnes si risque élevé |
| **RGPD** | Article 5.1.f | Principe d'intégrité et confidentialité |
| **Code de la Santé Publique** | L. 1111-8 | Protection données de santé |
| **Référentiel HDS** | - | Traçabilité et signalement incidents |

### 3.2 Délais légaux

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHRONOLOGIE OBLIGATOIRE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  T+0          T+72h                    T+30j                    │
│   │             │                        │                       │
│   ▼             ▼                        ▼                       │
│ Découverte   Notification          Notification                 │
│ violation    CNIL                  complémentaire               │
│              (obligatoire)         (si info manquante)          │
│                                                                  │
│              Si risque élevé :                                   │
│              Communication aux personnes concernées              │
│              "dans les meilleurs délais"                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Sanctions en cas de non-respect

| Infraction | Sanction maximale |
|------------|------------------|
| Non-notification CNIL | 10 M€ ou 2% CA mondial |
| Non-communication personnes | 10 M€ ou 2% CA mondial |
| Absence de documentation | 10 M€ ou 2% CA mondial |
| Mesures de sécurité insuffisantes | 20 M€ ou 4% CA mondial |

---

## 4. Détection et Identification

### 4.1 Sources de détection

| Source | Exemples | Action immédiate |
|--------|----------|------------------|
| **Alertes automatiques** | Azure Defender, Application Insights | Vérifier et qualifier |
| **Signalement utilisateur** | Parent signale accès suspect | Enregistrer et investiguer |
| **Signalement sous-traitant** | Azure, Yousign notifie incident | Évaluer impact MedicApp |
| **Découverte interne** | Audit révèle anomalie | Documenter et escalader |
| **Source externe** | CNIL, chercheur sécurité | Vérifier et confirmer |

### 4.2 Indicateurs de compromission (IoC)

| Indicateur | Gravité | Action |
|------------|---------|--------|
| Connexions depuis IP inhabituelles | Moyenne | Vérifier logs, bloquer si suspect |
| Tentatives de connexion échouées massives | Moyenne | Activer rate-limiting, alerter |
| Accès aux données hors heures normales | Faible à Moyenne | Vérifier légitimité |
| Téléchargement massif de données | Élevée | Bloquer immédiatement, investiguer |
| Modification de droits d'accès non autorisée | Élevée | Révoquer, investiguer |
| Présence de fichiers inhabituels | Élevée | Isoler système, analyser |
| Chiffrement de fichiers (ransomware) | Critique | Activer PRA immédiatement |

### 4.3 Procédure de qualification initiale

```
┌─────────────────────────────────────────────────────────────────┐
│                 ARBRE DE DÉCISION - QUALIFICATION               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Événement détecté                                               │
│        │                                                         │
│        ▼                                                         │
│  ┌─────────────────────┐                                        │
│  │ Des données         │──NON──▶ Pas une violation              │
│  │ personnelles sont   │         (incident de sécurité)          │
│  │ concernées ?        │                                         │
│  └──────────┬──────────┘                                        │
│             │ OUI                                                │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ Y a-t-il eu accès,  │                                        │
│  │ perte, altération   │──NON──▶ Pas une violation              │
│  │ ou destruction ?    │                                         │
│  └──────────┬──────────┘                                        │
│             │ OUI                                                │
│             ▼                                                    │
│      VIOLATION CONFIRMÉE                                         │
│      Passer à l'évaluation (Section 5)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Évaluation de la Violation

### 5.1 Critères d'évaluation

#### Critère 1 : Nature des données

| Type de données | Score |
|-----------------|-------|
| Données techniques (logs, IP) | 1 |
| Données d'identification (nom, email) | 2 |
| Données de contact (téléphone, adresse) | 2 |
| Données bancaires | 3 |
| **Données de santé** | **4** |
| Données génétiques ou biométriques | 4 |

#### Critère 2 : Volume de données

| Volume | Score |
|--------|-------|
| < 10 personnes | 1 |
| 10-100 personnes | 2 |
| 100-1000 personnes | 3 |
| > 1000 personnes | 4 |

#### Critère 3 : Facilité d'identification

| Facilité | Score |
|----------|-------|
| Données pseudonymisées + chiffrement | 1 |
| Données pseudonymisées uniquement | 2 |
| Données en clair mais partielles | 3 |
| Données en clair complètes | 4 |

#### Critère 4 : Conséquences potentielles

| Conséquence | Score |
|-------------|-------|
| Désagrément mineur | 1 |
| Atteinte à la réputation | 2 |
| Préjudice financier | 3 |
| **Atteinte à la santé / sécurité** | **4** |

### 5.2 Matrice de gravité

```
Score total = C1 + C2 + C3 + C4

┌───────────────┬────────────────────────────────────────────────┐
│ Score total   │ Niveau de risque                               │
├───────────────┼────────────────────────────────────────────────┤
│ 4-6           │ FAIBLE - Documentation interne uniquement      │
│ 7-10          │ MODÉRÉ - Notification CNIL obligatoire         │
│ 11-13         │ ÉLEVÉ - Notification CNIL + communication      │
│               │         aux personnes concernées               │
│ 14-16         │ CRITIQUE - Notification immédiate + mesures    │
│               │            d'urgence                           │
└───────────────┴────────────────────────────────────────────────┘
```

### 5.3 Cas particulier : Données de santé

**ATTENTION** : Pour MedicApp, toute violation impliquant des **données de santé** doit être considérée comme **risque ÉLEVÉ minimum**, quelle que soit la taille.

| Situation | Classification automatique |
|-----------|---------------------------|
| Accès non autorisé dossier patient | ÉLEVÉ (notification CNIL + personnes) |
| Fuite document signé (consentement) | ÉLEVÉ (notification CNIL + personnes) |
| Perte clé de chiffrement | CRITIQUE |
| Ransomware sur base de données | CRITIQUE |

### 5.4 Formulaire d'évaluation rapide

```markdown
# ÉVALUATION VIOLATION - FORMULAIRE RAPIDE

Date/Heure découverte : __/__/____ __:__
Évaluateur : ________________

## Nature de l'incident
□ Accès non autorisé
□ Divulgation accidentelle
□ Perte de données
□ Altération de données
□ Destruction de données
□ Autre : ________________

## Données concernées
□ Données de santé (questionnaire, allergies, antécédents)
□ Identification enfant (nom, prénom, date naissance)
□ Données parents (nom, email, téléphone)
□ Documents signés (consentements, autorisations)
□ Données techniques (logs, IP)

## Évaluation des critères
- C1 (Nature données) : __ /4
- C2 (Volume) : __ /4
- C3 (Identification) : __ /4
- C4 (Conséquences) : __ /4
- TOTAL : __ /16

## Niveau de risque
□ FAIBLE (4-6) → Documentation interne
□ MODÉRÉ (7-10) → Notification CNIL
□ ÉLEVÉ (11-13) → Notification CNIL + personnes
□ CRITIQUE (14-16) → Notification immédiate + urgence

## Données de santé impliquées ?
□ OUI → Niveau ÉLEVÉ minimum automatique
□ NON

Signature évaluateur : ________________
```

---

## 6. Notification à la CNIL

### 6.1 Quand notifier ?

| Niveau de risque | Notification CNIL | Délai |
|------------------|-------------------|-------|
| FAIBLE | Non obligatoire | - |
| MODÉRÉ | **Obligatoire** | 72h |
| ÉLEVÉ | **Obligatoire** | 72h |
| CRITIQUE | **Obligatoire** | Immédiat (< 24h recommandé) |

**IMPORTANT** : En cas de doute, notifier. La CNIL préfère une notification "par précaution" à une non-notification.

### 6.2 Contenu de la notification (art. 33.3)

La notification à la CNIL doit contenir :

| Information | Description | Statut |
|-------------|-------------|--------|
| **Nature de la violation** | Type (confidentialité, intégrité, disponibilité) | Obligatoire |
| **Catégories de personnes** | Patients, parents, praticiens | Obligatoire |
| **Nombre approximatif de personnes** | Estimation | Obligatoire |
| **Catégories de données** | Santé, identification, contact | Obligatoire |
| **Volume approximatif** | Nombre d'enregistrements | Obligatoire |
| **Coordonnées DPO** | Nom, email, téléphone | Obligatoire |
| **Conséquences probables** | Impacts sur les personnes | Obligatoire |
| **Mesures prises** | Actions correctives | Obligatoire |

### 6.3 Procédure de notification

#### Étape 1 : Préparer la notification

```markdown
# PRÉPARATION NOTIFICATION CNIL

## Informations à rassembler
- [ ] Date et heure de découverte
- [ ] Date et heure estimée de la violation
- [ ] Description technique de l'incident
- [ ] Liste des données concernées
- [ ] Estimation du nombre de personnes
- [ ] Mesures déjà prises
- [ ] Mesures envisagées
- [ ] Coordonnées DPO
```

#### Étape 2 : Soumettre via le téléservice CNIL

**URL** : [https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles](https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles)

**Étapes** :
1. Créer un compte sur le téléservice (si pas existant)
2. Sélectionner "Nouvelle notification"
3. Remplir le formulaire avec les informations préparées
4. Conserver le numéro de dossier attribué

#### Étape 3 : Notification complémentaire (si nécessaire)

Si toutes les informations ne sont pas disponibles dans les 72h :

1. Notifier avec les informations disponibles
2. Cocher "Notification initiale"
3. Compléter dans les 30 jours avec une "Notification complémentaire"

### 6.4 Modèle de notification

```
NOTIFICATION DE VIOLATION DE DONNÉES PERSONNELLES
(Article 33 du RGPD)

1. IDENTIFICATION DU RESPONSABLE DE TRAITEMENT
Nom : Dr. [NOM]
Adresse : [ADRESSE CABINET]
SIRET : [SIRET]

2. COORDONNÉES DPO
Nom : Dr. [NOM]
Email : [EMAIL DPO]
Téléphone : [TÉLÉPHONE]

3. DESCRIPTION DE LA VIOLATION
Date de découverte : [DATE]
Date estimée de l'incident : [DATE]
Nature : [Confidentialité / Intégrité / Disponibilité]
Description : [DESCRIPTION TECHNIQUE]

4. DONNÉES ET PERSONNES CONCERNÉES
Catégories de personnes : [Patients mineurs, Parents/tuteurs]
Nombre approximatif : [NOMBRE]
Catégories de données : [Données de santé, Identification, Contact]
Volume approximatif : [NOMBRE D'ENREGISTREMENTS]

5. CONSÉQUENCES PROBABLES
[Description des risques pour les personnes concernées]

6. MESURES PRISES
[Liste des actions correctives immédiates]

7. MESURES ENVISAGÉES
[Liste des actions préventives futures]

8. COMMUNICATION AUX PERSONNES
[Effectuée / Envisagée / Non nécessaire + justification]

Fait à [VILLE], le [DATE]
Signature : [SIGNATURE]
```

---

## 7. Communication aux Personnes Concernées

### 7.1 Quand communiquer ?

La communication aux personnes est **obligatoire** si la violation est **susceptible d'engendrer un risque élevé** pour leurs droits et libertés.

| Critère | Communication obligatoire |
|---------|--------------------------|
| Données de santé exposées | OUI |
| Usurpation d'identité possible | OUI |
| Préjudice financier possible | OUI |
| Discrimination possible | OUI |
| Atteinte à la réputation | Selon gravité |

### 7.2 Exceptions à la communication

La communication n'est **pas obligatoire** si :

| Exception | Condition |
|-----------|-----------|
| **Chiffrement** | Les données étaient chiffrées avec une clé non compromise |
| **Mesures correctives** | Les mesures prises éliminent le risque élevé |
| **Effort disproportionné** | Communication publique alternative (site web, médias) |

### 7.3 Contenu de la communication (art. 34.2)

| Information | Obligatoire |
|-------------|-------------|
| Nature de la violation | OUI |
| Coordonnées DPO | OUI |
| Conséquences probables | OUI |
| Mesures prises | OUI |
| Recommandations aux personnes | OUI (conseillé) |

### 7.4 Modèles de communication

#### Email aux parents/tuteurs

```
Objet : [IMPORTANT] Information sur la sécurité de vos données - MedicApp

Madame, Monsieur,

Nous vous informons qu'un incident de sécurité a affecté la plateforme
MedicApp le [DATE].

NATURE DE L'INCIDENT
[Description claire et accessible de ce qui s'est passé]

DONNÉES CONCERNÉES
[Liste des types de données potentiellement affectées]

CONSÉQUENCES POSSIBLES
[Explication des risques potentiels en langage simple]

MESURES PRISES
Dès la découverte de cet incident, nous avons :
- [Action 1]
- [Action 2]
- [Action 3]

CE QUE VOUS POUVEZ FAIRE
Nous vous recommandons de :
- [Recommandation 1 : ex. changer mot de passe]
- [Recommandation 2 : ex. surveiller communications suspectes]
- [Recommandation 3]

CONTACT
Pour toute question, vous pouvez contacter notre délégué à la protection
des données :
- Email : [EMAIL DPO]
- Téléphone : [TÉLÉPHONE]

Nous vous présentons nos excuses pour cette situation et restons à votre
disposition pour tout renseignement complémentaire.

Dr. [NOM]
Responsable de traitement - MedicApp
```

#### SMS d'alerte (court)

```
[MedicApp] IMPORTANT : Incident sécurité détecté.
Vos données peuvent être concernées.
Consultez vos emails pour plus d'informations.
Contact : [TÉLÉPHONE]
```

### 7.5 Canal de communication

| Urgence | Canal principal | Canal secondaire |
|---------|-----------------|------------------|
| Critique | Téléphone + SMS | Email |
| Élevée | Email | SMS |
| Modérée | Email | Courrier postal |

---

## 8. Documentation et Registre

### 8.1 Registre des violations (art. 33.5)

Le responsable de traitement **doit documenter** toute violation, qu'elle soit notifiée ou non.

#### Structure du registre

```markdown
# REGISTRE DES VIOLATIONS DE DONNÉES PERSONNELLES
MedicApp - Dr. [NOM]

## Violation #[NUMÉRO]

### Identification
- ID : VIO-[ANNÉE]-[NUMÉRO]
- Date découverte : [DATE]
- Date violation : [DATE] (estimée)
- Découvert par : [QUI]
- Source détection : [COMMENT]

### Description
- Nature : [Confidentialité / Intégrité / Disponibilité]
- Description technique : [DÉTAILS]
- Cause : [IDENTIFIÉE / EN INVESTIGATION]

### Données concernées
- Catégories : [LISTE]
- Volume : [NOMBRE]
- Personnes concernées : [CATÉGORIES + NOMBRE]

### Évaluation
- Score de gravité : [X/16]
- Niveau de risque : [FAIBLE / MODÉRÉ / ÉLEVÉ / CRITIQUE]
- Données de santé : [OUI / NON]

### Notification CNIL
- Notifiée : [OUI / NON]
- Date notification : [DATE]
- Numéro dossier CNIL : [NUMÉRO]
- Notification complémentaire : [OUI / NON]

### Communication personnes
- Effectuée : [OUI / NON]
- Date : [DATE]
- Canal : [EMAIL / SMS / TÉLÉPHONE]
- Nombre de personnes informées : [NOMBRE]

### Mesures correctives
- [ ] [Mesure 1] - Date : [DATE]
- [ ] [Mesure 2] - Date : [DATE]
- [ ] [Mesure 3] - Date : [DATE]

### Documents associés
- Formulaire évaluation : [LIEN]
- Copie notification CNIL : [LIEN]
- Copie communication : [LIEN]
- Rapport investigation : [LIEN]

### Clôture
- Date clôture : [DATE]
- Clôturé par : [QUI]
- Retour d'expérience : [RÉSUMÉ]
```

### 8.2 Conservation des documents

| Document | Durée conservation | Justification |
|----------|-------------------|---------------|
| Registre des violations | 5 ans minimum | Preuve de conformité |
| Notifications CNIL | 5 ans | Preuve de notification |
| Communications aux personnes | 5 ans | Preuve de communication |
| Rapports d'investigation | 5 ans | Analyse forensique |
| Logs système (incident) | 5 ans | Preuves techniques |

### 8.3 Emplacement du registre

Le registre des violations est conservé :

- **Format numérique** : [CHEMIN / URL]
- **Format papier** (backup) : [EMPLACEMENT PHYSIQUE]
- **Accès** : Restreint au DPO et responsable de traitement

### 8.4 Exports RGPD encadres

- Les exports de donnees critiques sont verrouilles par variable d'environnement
  (`EXPORT_CRITICAL_DATA_ALLOWED=true`) et exigent un motif (`--reason`).
- Chaque export est journalise dans un fichier `export_audit.jsonl` (horodatage,
  responsable, justification, volume) afin d'assurer la tracabilite.
- En cas d'incident, verifier ce journal dans la phase d'investigation.

---

## 9. Actions Correctives

### 9.1 Actions immédiates (< 4h)

| Action | Responsable | Délai |
|--------|-------------|-------|
| Isoler la source de compromission | Contact technique | Immédiat |
| Révoquer accès compromis | Contact technique | < 1h |
| Préserver les preuves (logs, captures) | Contact technique | < 2h |
| Évaluer la gravité | DPO | < 4h |
| Décider notification | Responsable de traitement | < 4h |

### 9.2 Actions à court terme (< 72h)

| Action | Responsable | Délai |
|--------|-------------|-------|
| Notifier CNIL si applicable | DPO | < 72h |
| Communiquer aux personnes si risque élevé | DPO | < 72h |
| Investigation approfondie | Contact technique | < 72h |
| Corriger la vulnérabilité | Contact technique | < 72h |

### 9.3 Actions à moyen terme (< 30j)

| Action | Responsable | Délai |
|--------|-------------|-------|
| Notification complémentaire CNIL | DPO | < 30j |
| Rapport d'investigation complet | Contact technique | < 15j |
| Mesures préventives additionnelles | Contact technique | < 30j |
| Mise à jour politique sécurité | DPO | < 30j |

### 9.4 Retour d'expérience (post-incident)

Après chaque violation, organiser une réunion de retour d'expérience :

```markdown
# RETOUR D'EXPÉRIENCE - VIOLATION VIO-[NUMÉRO]

Date réunion : [DATE]
Participants : [LISTE]

## Ce qui a bien fonctionné
- [POINT 1]
- [POINT 2]

## Ce qui peut être amélioré
- [POINT 1]
- [POINT 2]

## Actions d'amélioration
| Action | Responsable | Échéance | Priorité |
|--------|-------------|----------|----------|
| [ACTION 1] | [QUI] | [DATE] | [HAUTE/MOYENNE/BASSE] |
| [ACTION 2] | [QUI] | [DATE] | [HAUTE/MOYENNE/BASSE] |

## Mise à jour procédures
□ Procédure violation données mise à jour
□ PRA/PCA mis à jour
□ Formation équipe planifiée
```

---

## 10. Responsabilités

### 10.1 Matrice RACI

| Activité | Responsable | Accountable | Consulté | Informé |
|----------|-------------|-------------|----------|---------|
| Détection incident | Technique | DPO | - | Resp. traitement |
| Évaluation gravité | DPO | Resp. traitement | Technique | - |
| Décision notification | Resp. traitement | - | DPO | Technique |
| Notification CNIL | DPO | Resp. traitement | Technique | - |
| Communication personnes | DPO | Resp. traitement | - | Technique |
| Remédiation technique | Technique | DPO | - | Resp. traitement |
| Documentation | DPO | Resp. traitement | Technique | - |

### 10.2 Contacts

| Rôle | Nom | Email | Téléphone |
|------|-----|-------|-----------|
| **Responsable de traitement** | Dr. [NOM] | [EMAIL] | [TÉL] |
| **DPO / Référent données** | [NOM] | [EMAIL] | [TÉL] |
| **Contact technique** | [NOM] | [EMAIL] | [TÉL] |

### 10.3 Escalade

```
Niveau 1 : Incident détecté
    │
    ▼ (notification immédiate)
Contact technique
    │
    ▼ (< 1h : qualification)
DPO / Référent données
    │
    ▼ (< 4h : décision)
Responsable de traitement
    │
    ▼ (< 72h si violation confirmée)
CNIL + Personnes concernées
```

---

## 11. Annexes

### Annexe A : Checklist de réponse à incident

```markdown
# CHECKLIST RÉPONSE À VIOLATION DE DONNÉES

Date : __/__/____ Heure : __:__
Responsable checklist : ________________

## PHASE 1 : DÉTECTION & CONTAINMENT (< 1h)
- [ ] Incident signalé et enregistré
- [ ] Source de compromission identifiée
- [ ] Accès compromis révoqués
- [ ] Système isolé si nécessaire
- [ ] Preuves préservées (logs, captures)

## PHASE 2 : ÉVALUATION (< 4h)
- [ ] Formulaire d'évaluation rempli
- [ ] Score de gravité calculé
- [ ] Niveau de risque déterminé
- [ ] Données de santé vérifiées
- [ ] Nombre de personnes estimé

## PHASE 3 : NOTIFICATION (< 72h)
- [ ] Décision notification CNIL prise
- [ ] Notification CNIL soumise (si applicable)
- [ ] Numéro dossier CNIL noté
- [ ] Décision communication personnes prise
- [ ] Communication envoyée (si applicable)

## PHASE 4 : REMÉDIATION (< 7j)
- [ ] Vulnérabilité corrigée
- [ ] Tests de sécurité effectués
- [ ] Accès restaurés (si révoqués)
- [ ] Surveillance renforcée mise en place

## PHASE 5 : DOCUMENTATION (< 30j)
- [ ] Registre des violations mis à jour
- [ ] Rapport d'investigation rédigé
- [ ] Notification complémentaire CNIL (si nécessaire)
- [ ] Retour d'expérience organisé
- [ ] Procédures mises à jour

Signature : ________________
Date clôture : __/__/____
```

### Annexe B : Contacts d'urgence CNIL

| Service | Contact |
|---------|---------|
| **Téléservice notification** | [notifications.cnil.fr](https://notifications.cnil.fr) |
| **Standard CNIL** | 01 53 73 22 22 |
| **Adresse** | CNIL - 3 Place de Fontenoy - TSA 80715 - 75334 PARIS CEDEX 07 |

### Annexe C : Obligations des sous-traitants

Conformément à l'article 33.2 du RGPD, les sous-traitants (Azure, Yousign, Twilio) doivent notifier toute violation **sans délai** au responsable de traitement.

| Sous-traitant | Contact incident | SLA notification |
|---------------|------------------|------------------|
| Microsoft Azure | Portal Azure + Support | < 24h (contrat DPA) |
| Yousign | support@yousign.com | < 24h (contrat DPA) |
| Twilio | security@twilio.com | < 24h (contrat DPA) |

### Annexe D : Modèle registre (format tableau)

| ID | Date découverte | Nature | Données | Volume | Risque | CNIL notifiée | Personnes informées | Statut |
|----|----------------|--------|---------|--------|--------|---------------|---------------------|--------|
| VIO-2024-001 | [DATE] | [TYPE] | [CAT] | [N] | [NIVEAU] | [O/N] | [O/N] | [OUVERT/CLOS] |

### Annexe E : Indicateurs de suivi

| Indicateur | Cible | Fréquence mesure |
|------------|-------|------------------|
| Délai moyen de détection | < 24h | Mensuel |
| Délai moyen de notification CNIL | < 48h | Par incident |
| Taux de violations notifiées | 100% (si obligatoire) | Annuel |
| Nombre de violations | Tendance à la baisse | Annuel |
| Taux de récurrence (même cause) | 0% | Annuel |

---

## Historique des Versions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [DATE] | [NOM] | Version initiale |

---

**Document approuvé par :**

| Nom | Fonction | Date | Signature |
|-----|----------|------|-----------|
| Dr. [NOM] | Responsable de traitement | [DATE] | __________ |

---

*Ce document est confidentiel et destiné à un usage interne uniquement.*
*MedicApp - Plateforme de Gestion de Procédures Médicales*
*Conformité RGPD - Articles 33 & 34*
