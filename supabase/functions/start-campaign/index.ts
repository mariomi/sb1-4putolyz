import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

Deno.serve(async (req: Request) => {
  console.log(`🚀 Edge Function called with method: ${req.method}`);
  console.log(`📡 Request URL: ${req.url}`);
  
  // Abilita CORS per tutte le richieste
  if (req.method === 'OPTIONS') {
    console.log(`✅ Handling CORS preflight request`);
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Estrai il token dall'intestazione Authorization
    const authHeader = req.headers.get('Authorization');
    console.log(`🔑 Auth header: ${authHeader ? 'Present' : 'Missing'}`);
    
    let supabase: any;
    let user: any = null;
    
    // Controlla se è una chiamata con service role key (per avvio automatico)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      // Verifica se è un service role key confrontando con la variabile d'ambiente
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (token === serviceRoleKey) {
        console.log(`🔧 Service role authentication detected`);
        
        // Crea il client Supabase con il service role key
        supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        // Per le chiamate service role, non verifichiamo l'utente specifico
        // ma usiamo un utente di sistema
        user = { id: 'system', email: 'system@automatic' };
      } else {
        // Se non è un service role token, procedi con autenticazione normale
        console.log(`🔑 Regular JWT authentication detected`);
        
        // Crea il client Supabase con il token dell'utente
        supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
          }
        );

        // Verifica che l'utente sia autenticato
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          console.error('❌ Authentication error:', authError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Unauthorized - Invalid token' 
            }),
            { 
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        user = authUser;
        console.log(`✅ User authenticated: ${user.email}`);
      }
    } else {
      // Nessun header di autorizzazione
      console.log(`❌ No authorization header provided`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing authorization header' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Estrai l'ID della campagna dal corpo della richiesta
    const body = await req.json();
    console.log(`📦 Request body:`, body);
    const { campaignId, startImmediately } = body;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing campaignId in request body' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 1. Verifica che la campagna sia in stato 'draft' o 'scheduled' e appartenga all'utente
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .in('status', ['draft', 'scheduled'])
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found or not in draft/scheduled status: ${campaignError?.message}`);
    }

    console.log(`🎯 Starting campaign for ID: ${campaignId} (status: ${campaign.status})`);
    
    // Log se è un avvio automatico
    if (campaign.status === 'scheduled') {
      console.log(`🤖 AUTOMATIC START: Campaign "${campaign.name}" was scheduled for ${campaign.scheduled_at}`);
    }

    // Se non è una chiamata service role, verifica che la campagna appartenga all'utente
    if (!user.id.includes('system')) {
      const { data: userCampaign, error: userCampaignError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('profile_id', user.id)
        .single();

      if (userCampaignError || !userCampaign) {
        throw new Error(`Campaign not found or access denied: ${userCampaignError?.message}`);
      }
    }

    // 2. Recupera i mittenti associati
    const { data: sendersRes, error: sendersError } = await supabase
      .from('campaign_senders')
      .select('sender_id')
      .eq('campaign_id', campaignId);

    if (sendersError || !sendersRes?.length) {
      throw new Error('No senders associated with this campaign');
    }

    // 3. Recupera i mittenti attivi
    const senderIds = sendersRes.map(s => s.sender_id);
    const { data: senders, error: sendersDataError } = await supabase
      .from('senders')
      .select('*')
      .in('id', senderIds)
      .eq('is_active', true);

    if (sendersDataError || !senders?.length) {
      throw new Error('No active senders found');
    }

    // 4. Recupera i gruppi della campagna
    console.log(`🔍 Campaign selected_groups:`, campaign.selected_groups);
    let campaignGroups: any[] = [];
    
    try {
      if (campaign.selected_groups) {
        const groupsData = typeof campaign.selected_groups === 'string' 
          ? JSON.parse(campaign.selected_groups) 
          : campaign.selected_groups;
        
        console.log(`🔍 Parsed groups data:`, groupsData);
        
        if (groupsData && groupsData.groups && Array.isArray(groupsData.groups)) {
          campaignGroups = groupsData.groups.map((group: any) => ({
            group_id: group.groupId,
            percentage_start: group.percentageStart || 0,
            percentage_end: group.percentageEnd || 100
          }));
          console.log(`🔍 Mapped campaign groups:`, campaignGroups);
        }
      }
    } catch (parseError) {
      console.error('Error parsing selected_groups:', parseError);
    }
    
    // Fallback: prova a leggere dalla tabella campaign_groups se il JSON è vuoto
    if (!campaignGroups.length) {
      const { data: legacyGroups, error: groupsError } = await supabase
        .from('campaign_groups')
        .select('group_id, percentage_start, percentage_end')
        .eq('campaign_id', campaignId);
      
      if (!groupsError && legacyGroups?.length) {
        campaignGroups = legacyGroups;
      }
    }

    console.log(`🔍 Final campaign groups count: ${campaignGroups.length}`);
    
    if (!campaignGroups?.length) {
      throw new Error('No recipient groups selected');
    }

    // 5. Recupera tutti i contatti dai gruppi
    console.log(`🔍 Starting to fetch contacts from ${campaignGroups.length} groups...`);
    const allContacts: any[] = [];
    
    for (const group of campaignGroups) {
      // Determina se le percentuali sono abilitate
      const percentageEnabled = group.percentage_start !== null && group.percentage_end !== null;
      
      // Recupera i contact_id del gruppo
      console.log(`🔍 Fetching contacts for group ${group.group_id}...`);
      
      // Prova prima una query semplice per vedere se il gruppo esiste
      const { count: groupCount, error: countError } = await supabase
        .from('contact_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.group_id);
      
      if (countError) {
        console.error(`Error counting contact_groups for group ${group.group_id}:`, countError);
        continue;
      }
      
      console.log(`📧 Group ${group.group_id} has ${groupCount} contact_groups`);
      
      if (!groupCount || groupCount === 0) {
        console.warn(`No contact_groups found for group ${group.group_id}`);
        continue;
      }
      
      // Ora recupera i contact_id
      const { data: contactGroups, error: groupError } = await supabase
        .from('contact_groups')
        .select('contact_id')
        .eq('group_id', group.group_id)
        .order('contact_id');

      if (groupError) {
        console.error(`Error fetching contact_groups for group ${group.group_id}:`, groupError);
        continue;
      }

      if (!contactGroups?.length) {
        console.warn(`No contact_groups found for group ${group.group_id}`);
        continue;
      }

      console.log(`📧 Found ${contactGroups.length} contact_groups for group ${group.group_id}`);

      // Recupera tutti i contatti (attivi e non attivi) usando paginazione per grandi gruppi
      const contactIds = contactGroups.map(cg => cg.contact_id);
      console.log(`📧 Processing ${contactIds.length} contact IDs for group ${group.group_id}`);
      let allContactsInGroup: any[] = [];
      
      // Se ci sono molti contatti, usa paginazione (ridotto per evitare 414 errors)
      if (contactIds.length > 100) {
        console.log(`📧 Processing large group with ${contactIds.length} contacts, using pagination...`);
        
        for (let i = 0; i < contactIds.length; i += 100) {
          const batchIds = contactIds.slice(i, i + 100);
          console.log(`📧 Fetching batch ${i/100 + 1} with ${batchIds.length} IDs...`);
          
          const { data: batchContacts, error: batchError } = await supabase
            .from('contacts')
            .select('*')
            .in('id', batchIds);
          
          if (batchError) {
            console.error(`Error fetching contacts batch ${i/100 + 1}:`, batchError);
            continue;
          }
          
          if (batchContacts) {
            allContactsInGroup.push(...batchContacts);
            console.log(`📧 Batch ${i/100 + 1} added ${batchContacts.length} contacts`);
          }
        }
      } else {
        // Per gruppi piccoli, usa query normale
        console.log(`📧 Fetching ${contactIds.length} contacts with single query...`);
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds);

        if (contactsError) {
          console.warn(`Error fetching contacts for group ${group.group_id}:`, contactsError);
          continue;
        }
        
        if (contacts) {
          allContactsInGroup = contacts;
          console.log(`📧 Single query returned ${contacts.length} contacts`);
        }
      }

      console.log(`✅ Successfully retrieved ${allContactsInGroup.length} contacts for group ${group.group_id}`);
      
      if (!allContactsInGroup.length) {
        console.warn(`No contacts found in group ${group.group_id}`);
        continue;
      }

      let validContacts = allContactsInGroup;

      // Applica filtro percentuale se abilitato
      if (percentageEnabled) {
        const startIndex = Math.floor(((group.percentage_start ?? 0) / 100) * allContactsInGroup.length);
        const endIndex = Math.ceil(((group.percentage_end ?? 100) / 100) * allContactsInGroup.length);
        validContacts = allContactsInGroup.slice(startIndex, endIndex);
      }

      allContacts.push(...validContacts);
    }

    if (allContacts.length === 0) {
      throw new Error('No contacts found for the selected groups');
    }

    console.log(`📧 Trovati ${allContacts.length} contatti per l'invio`);

    // 6. Prepara le entry per la coda con intervalli di batch
    const queueEntries: any[] = [];
    const now = new Date();
    
    // Recupera le impostazioni di batch dalla campagna
    const emailsPerBatch = campaign.emails_per_batch || 10; // Default 10 email per batch
    const batchIntervalMinutes = campaign.batch_interval_minutes || 5; // Default 5 minuti tra batch
    
    console.log(`📦 Configurazione batch: ${emailsPerBatch} email per batch, ${batchIntervalMinutes} minuti di intervallo`);
    console.log(`🚀 Avvio immediato: ${startImmediately ? 'SÌ' : 'NO'}`);

    for (let i = 0; i < allContacts.length; i++) {
      const contact = allContacts[i];
      const sender = senders[i % senders.length]; // Cicla tra i mittenti
      
      // Calcola l'orario di invio basato sul batch
      const batchNumber = Math.floor(i / emailsPerBatch);
      
      let scheduledTime;
      if (startImmediately && batchNumber === 0) {
        // PRIMO BATCH: Avvio immediato quando richiesto
        scheduledTime = now;
        console.log(`📧 Batch ${batchNumber} (email ${i + 1}): INVIO IMMEDIATO`);
      } else {
        // BATCH SUCCESSIVI: Segui la schedulazione normale
        const delayMinutes = startImmediately ? batchNumber : batchNumber;
        scheduledTime = new Date(now.getTime() + (delayMinutes * batchIntervalMinutes * 60 * 1000));
        
        if (batchNumber === 1 && startImmediately) {
          console.log(`📧 Batch ${batchNumber} (email ${i + 1}): ${batchIntervalMinutes} minuti dopo l'avvio`);
        }
      }
      
      queueEntries.push({
        campaign_id: campaignId,
        contact_id: contact.id,
        sender_id: sender.id,
        status: 'pending',
        scheduled_for: scheduledTime.toISOString(),
        retry_count: 0,
      });
    }

    // 7. Pulisci la coda precedente
    await supabase.from('campaign_queues').delete().eq('campaign_id', campaignId);

    // 8. Inserisci le nuove entry nella coda
    const { error: insertError } = await supabase
      .from('campaign_queues')
      .insert(queueEntries);

    if (insertError) {
      throw new Error(`Error inserting queue entries: ${insertError.message}`);
    }

    // 9. Aggiorna lo status della campagna a 'sending'
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'sending',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) {
      throw new Error(`Error updating campaign status: ${updateError.message}`);
    }

    if (startImmediately) {
      console.log(`✅ Campagna ${campaignId} avviata con PRIMO BATCH IMMEDIATO`);
      console.log(`📧 ${queueEntries.length} email aggiunte alla coda:`);
      console.log(`   🚀 Primo batch (${Math.min(emailsPerBatch, queueEntries.length)} email): INVIO IMMEDIATO`);
      console.log(`   ⏰ Batch successivi: ogni ${batchIntervalMinutes} minuti`);
    } else {
      console.log(`✅ Campagna ${campaignId} preparata per l'invio programmato`);
      console.log(`📧 ${queueEntries.length} email aggiunte alla coda per processamento`);
    }

    // Rispondi immediatamente con successo
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: 'Campaign started successfully. Emails are being sent in background.',
        emailsQueued: queueEntries.length
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    // Gestisci gli errori e restituisci una risposta appropriata
    console.error('Error in campaign execution:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});