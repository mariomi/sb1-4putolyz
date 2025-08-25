# sb1-4putolyz

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/mariomi/sb1-4putolyz)

# Guida al Workflow GitHub

## 1. Obiettivi del workflow
- Mantenere il branch `main` sempre stabile e pronto per la produzione.  
- Ridurre i conflitti e facilitare le review.  
- Standardizzare naming, flusso PR e strategie di merge.  

---

## 2. Struttura dei branch
- **main** → codice stabile, rilasciato in produzione  
- **develop** → integrazione delle feature prima del rilascio  
- **feature/<nome-feature>** → ogni nuova funzionalità  
- **fix/<nome-bug>** → correzioni puntuali  

---

## 3. Regole generali
- Nessun commit diretto su `main` (attivare **Branch Protection**).  
- Ogni attività passa da **Pull Request (PR)** con almeno 1–2 review.  
- Commit piccoli e descrittivi; preferire **Squash & Merge** per storia pulita.  
- Tenere aggiornato spesso il proprio branch con `develop` per minimizzare conflitti.  

---

## 4. Flusso operativo quotidiano (per ogni sviluppatore)

### 1) Clonare il repository (prima volta)
```bash
git clone <url-repo>
cd <nome-repo>
```

### 2) Creare/aggiornare il branch `develop`
```bash
# Solo la prima volta
git checkout -b develop
git push origin develop

# Dalle volte successive
git checkout develop
git pull origin develop
```

### 3) Creare il proprio branch feature
```bash
git checkout develop
git pull origin develop
git checkout -b feature/<nome-feature>
```

### 4) Lavorare e fare commit/push frequenti
```bash
git add *
git commit -m "Descrizione chiara della modifica"
git push origin feature/<nome-feature>
```

### 5) Aprire una Pull Request (PR) su GitHub
- Base = `develop`  
- Compare = `feature/<nome-feature>`  

### 6) Richiedere review e applicare eventuali fix
- Aggiornare la PR finché non viene approvata.  

---

## 5. Pull Request e Code Review
- **Titolo e descrizione:** contesto, cosa cambia, come testare.  
- Collegare **Issue/Milestone** se presenti.  
- Verificare che i **check CI** (lint, test) siano verdi prima del merge.  
- Usare **Squash & Merge** per un commit pulito su `develop`.  

---

## 6. Strategie di merge consigliate

### Squash & Merge (consigliato)
```bash
git checkout develop
git pull origin develop
git merge --squash feature/nome-feature
git commit -m "Aggiunge funzionalità login"
git push origin develop
```

### Merge commit
```bash
git checkout develop
git pull origin develop
git merge feature/nome-feature   # crea un merge commit
git push origin develop
```

### Rebase (avanzato, usare con cautela)
```bash
git checkout feature/nome-feature
git fetch origin
git rebase origin/develop

# Risolvere conflitti, poi:
git add .
git rebase --continue

# Unire su develop
git checkout develop
git pull origin develop
git merge --ff-only feature/nome-feature
git push origin develop
```

---

## 7. Risoluzione dei conflitti
```bash
git checkout develop
git pull origin develop
git merge feature/<nome-feature>

# Risolvere i conflitti nei file
git add *
git commit
git push origin develop
```
👉 Suggerimento: risolvi i conflitti **in locale**, non dall’editor web.  

---

## 8. Esempio pratico (4 utenti)
- **Alice** → `feature/login`  
- **Bob** → `feature/dashboard`  
- **Carla** → `feature/api`  
- **Diego** → `feature/payments`  

```bash
git checkout develop
git pull origin develop

# Alice
git checkout -b feature/login

# Bob
git checkout -b feature/dashboard

# Carla
git checkout -b feature/api

# Diego
git checkout -b feature/payments
```

Ognuno lavora sul proprio branch, pushando e aprendo PR verso `develop`.  
Dopo approvazione → **Squash & Merge** su `develop`.  

---

## 9. Procedura di release: push su `main`

### ✅ Metodo consigliato (via Pull Request)
1. Assicurarsi che `develop` sia verde (test passati).  
2. Aprire PR: `base = main`, `compare = develop`  
   - Titolo: “Release vX.Y.Z”  
3. Approvare PR e fare **Squash & Merge** (o Merge commit).  
4. Creare un tag di release (opzionale ma consigliato):  
   ```bash
   git fetch --tags
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

### 🛠️ Alternativa (solo maintainer via CLI)
```bash
git checkout main
git pull origin main
git merge develop
git push origin main

# Opzionale: tag della release
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

---

## 10. Comandi principali (cheat sheet)
```bash
git status
git fetch
git pull origin <branch>
git checkout <branch>
git checkout -b <nuovo-branch>
git add .
git commit -m "messaggio"
git push origin <branch>
git merge <branch>
git rebase    # avanzato
git tag -a vX.Y.Z -m "nota"
git push origin vX.Y.Z
```

---

## 11. Template Pull Request
```markdown
## Descrizione
- Contesto e obiettivo:
- Cosa cambia:
- Come testare:

## Checklist
- [ ] Lint e test passano
- [ ] Documentazione aggiornata (se necessario)
- [ ] Issue collegata: #<id>
```

---

## 12. Convenzioni di naming
- `feature/nome-breve-descrittivo`  
  (es. `feature/login-social`)  
- `fix/nome-breve-descrittivo`  
  (es. `fix/validation-email`)  

Commit message:  
- Imperativo, breve + dettaglio.  
- Esempio: `Aggiunge validazione email per form registrazione`.  

---

## 13. Checklist pre-merge
- Branch aggiornato con `develop` (o `main` in trunk-based).  
- Test locali passati, CI verde.  
- Nessun **TODO** o log di debug residuo.  
- PR descritta e reviewer assegnati.  

---

## 14. Impostare Branch Protection (consigliato)
- GitHub → **Settings → Branches → Branch protection rules**  
- Regole per `main` (e `develop`):  
  - Richiedere PR  
  - 1–2 approvazioni  
  - Test CI verdi  
- Bloccare push diretti su `main`  
- Se usi Squash & Merge → valutare **Require linear history**  

---
