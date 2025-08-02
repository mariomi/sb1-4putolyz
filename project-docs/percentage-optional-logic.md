# Logica di Gestione Gruppi con Percentuali Opzionali

## Panoramica

La logica di gestione gruppi email è stata completamente rivista per rendere **opzionale** la suddivisione percentuale. Ora l'interfaccia è più semplice e intuitiva, con il comportamento di default che utilizza l'intero gruppo.

## 🔧 Modifiche Frontend

### Interfaccia Aggiornata

```typescript
interface GroupSelection {
  group_id: string;
  percentage_enabled?: boolean; // Opzionale: se true, usa percentuali
  percentage_start?: number;    // Opzionale: percentuale iniziale
  percentage_end?: number;      // Opzionale: percentuale finale
}
```

### Comportamento di Default

- **Percentuali disabilitate di default**: Quando si seleziona un gruppo, viene utilizzato automaticamente il 100% dei contatti
- **Toggle per abilitare**: Un switch permette di attivare facoltativamente la suddivisione percentuale
- **Campi condizionali**: I campi percentuale appaiono solo quando il toggle è attivo

### Validazione Client-Side

```typescript
// Validazione percentuali solo se abilitate
const invalidGroups = formData.selected_groups.some(
  (group) => {
    if (!group.percentage_enabled) return false; // Se non abilitato, non validare
    const start = group.percentage_start ?? 0;
    const end = group.percentage_end ?? 100;
    return start < 0 || end > 100 || start >= end;
  }
);
```

### Interfaccia Utente

1. **Selezione gruppo**: Checkbox per selezionare il gruppo
2. **Toggle percentuali**: Switch per abilitare/disabilitare la suddivisione
3. **Campi percentuale**: Appaiono solo se il toggle è attivo
4. **Messaggio informativo**: Mostra quanti contatti verranno utilizzati

## 🔧 Modifiche Backend

### Logica di Recupero Contatti

```typescript
// Se le percentuali non sono abilitate, usa tutti i contatti
if (!group.percentage_enabled) {
  console.log(`✅ Using all ${totalContactsInGroup} contacts (no percentage filter)`);
  validContacts = contactsInGroup;
} else {
  // Altrimenti applica il filtro percentuale
  const startIndex = Math.floor(((group.percentage_start ?? 0) / 100) * totalContactsInGroup);
  const endIndex = Math.ceil(((group.percentage_end ?? 100) / 100) * totalContactsInGroup);
  
  validContacts = contactsInGroup.slice(startIndex, endIndex);
}
```

### Ordine Stabile

I contatti vengono ordinati per `contact_id` per garantire un ordine stabile quando si applicano le percentuali:

```typescript
.from('contact_groups')
.select('contact_id')
.eq('group_id', group.group_id)
.order('contact_id'); // Ordine stabile per percentuali
```

### Logging Dettagliato

Il backend fornisce logging dettagliato per il debug:

```
📋 Processing group abc123 with percentage_enabled: false
  ✅ Using all 1000 contacts (no percentage filter)
  📧 Added 1000 contacts from group abc123

📋 Processing group def456 with percentage_enabled: true
  📊 Applying percentage filter: 0% - 50%
  📊 Contacts range: 0 to 500 (500 contacts)
  📧 Added 500 contacts from group def456
```

## 🎯 Comportamenti

### Comportamento di Default (Percentuali Disabilitate)

1. **Selezione gruppo**: L'utente seleziona un gruppo
2. **Toggle disabilitato**: Le percentuali sono disabilitate di default
3. **Messaggio informativo**: "📧 Verranno utilizzati tutti i contatti del gruppo (X contatti)"
4. **Backend**: Utilizza tutti i contatti attivi del gruppo
5. **Payload**: Invia solo `group_id` senza percentuali

### Comportamento con Percentuali Abilitate

1. **Toggle abilitato**: L'utente attiva il toggle delle percentuali
2. **Campi visibili**: Appaiono i campi "Inizio (%)" e "Fine (%)"
3. **Validazione**: Controlla che i valori siano validi (0-100, iniziale < finale)
4. **Backend**: Applica il filtro percentuale sui contatti
5. **Payload**: Invia `group_id`, `percentage_start`, `percentage_end`

## 📊 Esempi Pratici

### Esempio 1: Gruppo Completo
```json
{
  "group_id": "abc123",
  "percentage_enabled": false
}
```
**Risultato**: Utilizza tutti i 1000 contatti del gruppo

### Esempio 2: Prima Metà
```json
{
  "group_id": "def456",
  "percentage_enabled": true,
  "percentage_start": 0,
  "percentage_end": 50
}
```
**Risultato**: Utilizza i primi 500 contatti (0-50%)

### Esempio 3: Ultimo Terzo
```json
{
  "group_id": "ghi789",
  "percentage_enabled": true,
  "percentage_start": 67,
  "percentage_end": 100
}
```
**Risultato**: Utilizza gli ultimi 330 contatti (67-100%)

## ✅ Vantaggi

1. **Interfaccia più semplice**: Comportamento di default intuitivo
2. **Compatibilità**: Funziona con gruppi esistenti senza modifiche
3. **Flessibilità**: Permette suddivisioni precise quando necessario
4. **Validazione robusta**: Controlli client e server-side
5. **Logging dettagliato**: Facile debug e monitoraggio
6. **Ordine stabile**: Risultati consistenti tra esecuzioni

## 🔄 Compatibilità

- **Database**: Nessuna modifica necessaria allo schema
- **API**: Compatibile con payload esistenti
- **Frontend**: Interfaccia aggiornata ma retrocompatibile
- **Backend**: Gestisce entrambi i casi (con e senza percentuali)

## 🚀 Implementazione

### Frontend
- ✅ Interfaccia `GroupSelection` aggiornata
- ✅ Toggle per abilitare/disabilitare percentuali
- ✅ Validazione client-side
- ✅ UI condizionale per i campi percentuale
- ✅ Messaggi informativi

### Backend
- ✅ Logica di recupero contatti aggiornata
- ✅ Gestione percentuali opzionali
- ✅ Ordine stabile per risultati consistenti
- ✅ Logging dettagliato per debug
- ✅ Compatibilità con payload esistenti

La nuova logica offre un'esperienza utente più semplice e intuitiva, mantenendo la flessibilità per casi d'uso avanzati. 