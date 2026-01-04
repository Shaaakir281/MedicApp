# Tests E2E MedicApp (demo)

## Parcours patient

- [ ] Inscription: email + mot de passe, verification email OK
- [ ] Connexion: autocomplete OK (login vs inscription)
- [ ] Dossier: remplir champs requis, enregistrer, pas de blocage
- [ ] Verification email parent 2: envoi OK, message clair si blocage
- [ ] Rendez-vous: preconsultation possible sans verification telephone
- [ ] Regle 14 jours: tentative acte < 14j -> modale visible
- [ ] Regle 14 jours: acte >= 14j -> creation OK
- [ ] Onglet documents: banner demo visible, checklists parent 1/2 ok
- [ ] Signature a distance: lien OK, pas de SMS en cabinet
- [ ] PDF final: telechargement OK, audit Yousign inclus

## Parcours praticien

- [ ] Drawer patient: noms parents visibles et editables
- [ ] Documents: section repliee par defaut, compteur "signes / total" OK
- [ ] Preview "Voir": pas de duplication de fichiers (cache)
- [ ] Activation cabinet: parent1/parent2 activables depuis praticien
- [ ] Session tablette: code + lien affiches, signature possible
- [ ] Double signature: PDF final genere automatiquement
- [ ] PDF final: meme document cote patient et praticien
