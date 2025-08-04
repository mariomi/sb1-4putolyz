# Fix: Edge Function Contact Retrieval Issue

## Problem
The Edge Function `start-campaign/index.ts` was throwing the error:
```
No contacts found for the selected groups and percentages.
```

This error occurred even when percentage division was not enabled for groups.

## Root Cause
The issue had two parts:

### 1. Complex JOIN Query Issue
The contact retrieval logic was using a complex JOIN query that wasn't working correctly in the Supabase Edge Function environment:
```typescript
const { data: contactsInGroup, error: groupError } = await supabaseAdmin
  .from('contact_groups')
  .select(`
    contact_id,
    contacts!inner(id, is_active)
  `)
  .eq('group_id', group.group_id)
  .eq('contacts.is_active', true)
  .order('contact_id');
```

### 2. Wrong Data Source Issue
The Edge Function was reading `selected_groups` from the `campaigns` table, but the frontend was saving group data in the `campaign_groups` table.

## Solution

### 1. Fixed Contact Retrieval Logic
Replaced the complex JOIN query with two separate, simpler queries:

#### First Query: Get Contact IDs from Group
```typescript
const { data: contactGroups, error: groupError } = await supabaseAdmin
  .from('contact_groups')
  .select('contact_id')
  .eq('group_id', group.group_id)
  .order('contact_id');
```

#### Second Query: Filter Active Contacts
```typescript
const contactIds = contactGroups.map(cg => cg.contact_id);
const { data: activeContacts, error: contactsError } = await supabaseAdmin
  .from('contacts')
  .select('id')
  .in('id', contactIds)
  .eq('is_active', true);
```

### 2. Fixed Data Source
Changed the Edge Function to read group data from the correct table:

#### Before (Wrong)
```typescript
const selectedGroups: GroupSelection[] = campaign.selected_groups || [];
```

#### After (Correct)
```typescript
const { data: campaignGroups, error: groupsError } = await supabaseAdmin
  .from('campaign_groups')
  .select('group_id, percentage_start, percentage_end')
  .eq('campaign_id', campaignId);
```

### 3. Updated Percentage Logic
Modified the percentage detection logic to work with the database structure:

```typescript
const percentageEnabled = group.percentage_start !== null && group.percentage_end !== null;
```

## Benefits
1. **Reliability**: Simpler queries are less likely to fail in the Edge Function environment
2. **Data Consistency**: Reads from the correct database table
3. **Debugging**: Easier to identify which step fails
4. **Compatibility**: Works consistently with or without percentage filtering
5. **Performance**: More predictable query execution

## Code Changes
- **File**: `supabase/functions/start-campaign/index.ts`
- **Function**: `startCampaignExecution`
- **Lines**: 258-320 (approximately)

## Testing
The fix ensures that:
- Groups with active contacts are properly detected
- Percentage filtering works when enabled
- All contacts are used when percentage filtering is disabled
- Error messages are more specific about which step failed
- Data is read from the correct database table

## Compatibility
This fix maintains full compatibility with:
- Existing campaign data
- Percentage-based group selection
- Automatic batch calculation
- All other campaign features 