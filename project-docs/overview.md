# Panoramica del Progetto - Sistema di Email Marketing

## Sfondo e Contesto
Questo progetto è un sistema completo di email marketing sviluppato per gestire campagne di invio email in modo automatizzato e scalabile. Il sistema è progettato per studenti delle scuole medie che necessitano di una soluzione semplice ma potente per la gestione di campagne email.

## Visione Principale
Creare una piattaforma di email marketing user-friendly che permetta agli utenti di:
- Gestire liste di contatti organizzate in gruppi
- Configurare mittenti con limiti giornalieri di invio
- Creare campagne email con contenuto HTML personalizzato
- Automatizzare l'invio delle email con sistema di code e batch
- Monitorare lo stato e le performance delle campagne

## Obiettivi Principali
1. **Semplicità d'uso**: Interfaccia intuitiva per utenti non tecnici
2. **Automazione completa**: Sistema di cron job per invio automatico
3. **Scalabilità**: Gestione di grandi volumi di email tramite sistema di code
4. **Controllo dei limiti**: Rispetto dei limiti giornalieri dei mittenti
5. **Monitoraggio**: Tracking completo di ogni email inviata

## Problemi Risolti
- **Invio manuale inefficiente**: Automazione completa dell'invio email
- **Gestione dei limiti**: Controllo automatico dei limiti giornalieri dei domini
- **Scalabilità**: Sistema di batch per gestire migliaia di email
- **Monitoraggio**: Visibilità completa dello stato delle campagne
- **Warm-up dei domini**: Gestione automatica del riscaldamento dei nuovi domini

## Architettura Generale
- **Frontend**: React TypeScript con Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Email Service**: Resend API
- **Cron Jobs**: Supabase Edge Functions con scheduling
- **State Management**: React Hooks + Supabase realtime