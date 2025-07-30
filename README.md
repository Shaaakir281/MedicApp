# Medicapp – Ordonnances pré-intervention

> **MVP (Phase 1)** : prise de RDV en ligne, questionnaire court, génération
> automatique d’une ordonnance PDF pré-remplie, **validation manuelle du
> praticien**, envoi sécurisé par e-mail.

## ⚡ Périmètre MVP

- Formulaire RDV + vérification identité (code SMS / e-mail)
- Questionnaire médical simplifié (allergies, traitements)
- Génération PDF standard selon l’intervention
- Tableau praticien : révision, modification, signature simple
- Envoi PDF via lien expirable + code SMS
- **2FA praticien** (TOTP recommandé)  
- Hébergement : **OVHcloud Santé – HDS**

### Hors périmètre MVP → Phase 2
PSC/INS · signature qualifiée · MSSanté · DMP/FHIR

## 🚀 Démarrer la démo (Sprint 0)

```bash
git clone https://github.com/Shaaakir281/MedicApp
cd MedicApp
npm install            # frontend (vite + tailwind) – à venir Sprint 0
pip install -r requirements.txt   # backend FastAPI – Sprint 1