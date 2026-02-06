# Procedure de sauvegarde et restauration

Derniere mise a jour : 2026-02-06

## Objectif
Assurer la disponibilite des donnees MedicApp (PostgreSQL + Blob Storage) et
tester regulierement la capacite de restauration.

## 1) Azure PostgreSQL (Flexible Server)

### 1.1 Sauvegarde automatique (Azure)
- Azure gere des backups automatiques du serveur PostgreSQL.
- Verifier la retention configuree dans Azure (ex: 7, 14, 35 jours selon plan).
- Conserver une retention suffisante pour couvrir les erreurs humaines.

### 1.2 Verification mensuelle (recommandee)
1. Azure Portal -> PostgreSQL Flexible Server -> Backups.
2. Verifier qu'au moins 1 sauvegarde recente est visible.
3. Noter la date/heure du dernier backup.

### 1.3 Procedure de restauration (manuelle)
1. Azure Portal -> PostgreSQL Flexible Server -> Restore.
2. Choisir la date/heure de restauration.
3. Creer un nouveau serveur (ex: medicapp-db-restore-YYYYMMDD).
4. Verifier la connexion et l'integrite des tables.

> Important: ne pas ecraser le serveur de production. Toujours restaurer vers un nouveau serveur.

## 2) Azure Blob Storage

### 2.1 Protection recommandee
- Activer "Soft delete" pour les blobs.
- Activer "Versioning" si disponible.
- Conserver une retention de 30 a 90 jours.

### 2.2 Verification mensuelle
1. Azure Portal -> Storage Account -> Containers.
2. Verifier qu'un fichier recent est present.
3. Verifier qu'un fichier supprime apparait dans "Deleted blobs" si Soft delete actif.

## 3) Test de verification (dry-run)

Script disponible : `backend/scripts/test_restore.py`

Exemple (dry-run) :
```
python -m scripts.test_restore --dry-run
```

Avec Azure CLI (liste des backups) :
```
python -m scripts.test_restore --dry-run \
  --azure-server medicappdbprod \
  --azure-resource-group medicapp-rg
```

Ce script:
- verifie la connectivite DB
- lit la version Alembic
- compte les donnees essentielles
- teste la presence d'un document signe (si disponible)
- tente de lister les backups Azure si le CLI est configure

## 4) Checklist mensuelle
- [ ] Backup PostgreSQL recent visible
- [ ] Retention conforme aux exigences
- [ ] Blob Storage: soft delete actif
- [ ] Dry-run OK (script test_restore)
- [ ] Note des resultats dans un journal interne

## Contacts
Voir `docs/CONTACTS_SUPPORT.md` (a creer dans S10).
