# Requisiti e Funzionalità del Sistema

## Requisiti di Sistema

### Funzionali
1. **Gestione Campagne**
   - Creazione di campagne email con nome, oggetto e contenuto HTML
   - Stati campagna: bozza, programmata, in invio, completata, fallita
   - Programmazione con data/ora di inizio
   - Durata massima campagna configurabile

2. **Sistema di Invio Automatico**
   - **Batch sizing**: Numero di email per batch configurabile
   - **Intervalli**: Tempo tra batch configurabile (minuti)
   - **Limiti temporali**: Rispetto orari di invio e durata campagna
   - **Rotazione mittenti**: Distribuzione automatica tra mittenti disponibili

3. **Gestione Contatti e Gruppi**
   - Organizzazione contatti in gruppi
   - Importazione/esportazione contatti
   - Gestione stato attivo/inattivo

4. **Gestione Mittenti**
   - Configurazione domini email
   - Limiti giornalieri di invio per mittente
   - Sistema di warm-up per nuovi domini
   - Integrazione con Resend API

### Non Funzionali
1. **Performance**: Gestione di 10,000+ email per campagna
2. **Affidabilità**: Sistema di retry automatico per email fallite
3. **Sicurezza**: Autenticazione utente e isolamento dati
4. **Usabilità**: Interfaccia semplice per utenti non tecnici

## Funzionalità Dettagliate

### Sistema di Coda Email
- **Stato pending**: Email in attesa di invio
- **Stato processing**: Email in corso di invio
- **Stato sent**: Email inviata con successo
- **Stato failed**: Email fallita (con retry automatico)
- **Priorità**: Sistema di priorità per email urgenti

### Algoritmo di Invio
1. Quando una campagna viene avviata:
   - Calcola il primo batch basato su dimensione configurata
   - Invia immediatamente il primo batch
   - Programa i batch successivi secondo l'intervallo configurato
   - Continua fino a completamento o scadenza tempo limite

2. Distribuzione mittenti:
   - Rotazione round-robin tra mittenti attivi
   - Rispetto limiti giornalieri per mittente
   - Sospensione mittenti che raggiungono il limite

### Regole di Business
- Massimo 3 tentativi per email fallite
- Intervallo minimo tra batch: 1 minuto
- Massimo 1000 email per batch
- Orari di invio: configurabili per campagna
- Durata massima campagna: 30 giorni

### Casi Limite
- Gestione mittenti offline o sospesi
- Campagne con zero contatti validi
- Superamento limiti giornalieri durante invio
- Interruzione forzata campagne