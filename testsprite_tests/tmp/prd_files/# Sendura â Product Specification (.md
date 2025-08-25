# Sendura – Product Specification (Auth & Role-Based Login)
**Versione:** 1.0  
**Data:** 2025-08-25

---

## 1) Overview
**Feature:** Pagina di autenticazione con selezione ruolo e redirect basato sul ruolo.  
**Obiettivo:** Permettere all’operatore di accedere usando **ID Operatore** e **Chiave d’Accesso**, con ruoli caricati dinamicamente da backend (Supabase). Dopo il login, reindirizzare alla dashboard corretta.

Componente di riferimento: `AuthPage` (React).

---

## 2) In Scope
- Form con campi:
  - **Ruolo** (select, popolata da RPC in base a `idOperatore`)
  - **ID Operatore** (text)
  - **Chiave d’Accesso** (password)
- Chiamata **RPC Supabase**: `get_roles_by_operator(_operator_id)`
- Login: `signInWithOperator(role, operatorId, accessKey)`
- Toast di successo/errore, stato di caricamento
- Redirect in base al ruolo
- Auto-redirect se sessione già attiva

**Out of scope:** registrazione, reset password, UI gestione ruoli.

---

## 3) Ruoli & Redirect
| Ruolo (case-insensitive) | Path di redirect |
|---|---|
| `reply_operator` | `/reply-operator` |
| `admin` | `/admin` |
| `project_manager` | `/pm-dashboard` |
| (sconosciuto/vuoto) | `/` |

---

## 4) Prerequisiti / Ambiente
- **Frontend:** React + Vite/Tailwind, `react-hot-toast`
- **Auth Hook:** `useAuth()` con `signInWithOperator`
- **Backend:** Supabase client configurato (`../lib/supabase`)
- **RPC:** `get_roles_by_operator(_operator_id text)` → array di oggetti con campo `role`
- **Sessione:** `localStorage.operator_session` (deve includere `role` per redirect su refresh)
- **Compatibilità:** ultime 2 versioni di Chrome/Firefox/Safari/Edge

---

## 5) Flussi Utente

### 5.1 Login (nuova sessione)
1. Utente apre `/auth`
2. Inserisce **ID Operatore**
3. App chiama RPC → popola **Ruolo**
4. Utente seleziona **Ruolo**
5. Inserisce **Chiave d’Accesso** e invia
6. App chiama `signInWithOperator`
7. **Successo:** toast “Accesso effettuato con successo!” → redirect per ruolo  
   **Errore:** toast con messaggio, nessun redirect

### 5.2 Auto-redirect se già loggato
- Se `user` è presente e `operator_session.role` esiste → redirect immediato alla route mappata

---

## 6) Validazioni (client-side minime)
- `idOperatore` **obbligatorio** per fetch ruoli e per login
- `chiaveAccesso` **obbligatoria** per login
- Se RPC restituisce ruoli e `ruolo` è vuoto → auto-seleziona il **primo ruolo** disponibile
- Niente password in chiaro nei log (mascherare con `***`)

---

## 7) Gestione Errori
- **RPC ruoli fallita:** svuota lista ruoli, log console, form utilizzabile
- **Auth fallita:** toast errore (messaggio backend se presente), nessun redirect
- **Ruolo non mappato:** dopo login valido → redirect a `/`

---

## 8) Account di Test
- **ID Operatore:** `OP-MAIO-ADMIN`  
- **Chiave d’Accesso:** `ciao`  
- **Ruolo atteso:** `admin` (se assegnato via RPC). In alternativa usare uno dei ruoli restituiti da `get_roles_by_operator`.

> I ruoli effettivi per l’operatore dipendono dai dati in Supabase (ambiente di test/staging).

---

## 9) Acceptance Criteria
1. Con `idOperatore` valorizzato, la select **Ruolo** si popola con i ruoli restituiti dall’RPC (senza duplicati).
2. Se `ruolo` non è selezionato e la lista non è vuota, viene selezionato automaticamente il primo ruolo.
3. Con credenziali valide: toast di successo e redirect alla route mappata entro un tempo ragionevole dopo la risposta.
4. Con credenziali errate: toast errore, nessun redirect.
5. All’apertura di `/auth` con sessione valida e `operator_session.role`: redirect immediato alla route del ruolo.
6. Nessuna password in chiaro nei log di console.

---

## 10) Test Cases

### TC-01 – Fetch ruoli valido
**Dati:** `idOperatore = OP-MAIO-ADMIN`  
**Passi:** apri `/auth` → inserisci ID → attendi popolamento select  
**Atteso:** la select mostra ≥1 ruolo; se `ruolo` era vuoto, auto-selezionato il primo

### TC-02 – Login successo (Admin)
**Dati:** `idOperatore = OP-MAIO-ADMIN`, `ruolo = admin` (se presente), `chiave = ciao`  
**Atteso:** toast successo + redirect a `/admin`

### TC-03 – Login fallito (password errata)
**Dati:** `idOperatore = OP-MAIO-ADMIN`, `ruolo valido`, `chiave = wrong`  
**Atteso:** toast errore, nessun redirect

### TC-04 – Nessun ruolo disponibile
**Dati:** `idOperatore` senza ruoli nell’RPC  
**Atteso:** select vuota; submit produce errore backend o blocco sensato

### TC-05 – Sessione già attiva
**Pre:** `operator_session = { "role": "admin" }`  
**Passi:** visita `/auth`  
**Atteso:** redirect immediato a `/admin`

### TC-06 – Ruolo non mappato
**Dati:** backend restituisce `auditor`  
**Atteso:** login ok → redirect a `/` (default)

---

## 11) Non-Functional
- UI responsiva ≥ 320px
- Indicatori di caricamento visibili
- Gestione errori di rete con messaggi chiari
- Performance: nessun blocco UI durante RPC/Auth

---

## 12) Domande Aperte
- Struttura e scadenza di `operator_session`
- Implementazione reale di “Hai dimenticato la password?”
