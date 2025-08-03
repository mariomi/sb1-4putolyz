# Fix: Edge Function Contact Retrieval Issue

## Problem
The Edge Function `start-campaign/index.ts` was throwing the error:
```
No contacts found for the selected groups and percentages.
```

This error occurred even when percentage division was not enabled for groups.

## Root Cause
The issue was in the contact retrieval logic using a complex JOIN query:
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

The `contacts!inner(id, is_active)` syntax was not working correctly in the Supabase Edge Function environment, causing the query to fail or return no results.

## Solution
Replaced the complex JOIN query with two separate, simpler queries:

### 1. First Query: Get Contact IDs from Group
```typescript
const { data: contactGroups, error: groupError } = await supabaseAdmin
  .from('contact_groups')
  .select('contact_id')
  .eq('group_id', group.group_id)
  .order('contact_id');
```

### 2. Second Query: Filter Active Contacts
```typescript
const contactIds = contactGroups.map(cg => cg.contact_id);
const { data: activeContacts, error: contactsError } = await supabaseAdmin
  .from('contacts')
  .select('id')
  .in('id', contactIds)
  .eq('is_active', true);
```

## Benefits
1. **Reliability**: Simpler queries are less likely to fail in the Edge Function environment
2. **Debugging**: Easier to identify which step fails (group contacts vs active contacts)
3. **Compatibility**: Works consistently with or without percentage filtering
4. **Performance**: More predictable query execution

## Code Changes
- **File**: `supabase/functions/start-campaign/index.ts`
- **Function**: `startCampaignExecution`
- **Lines**: 260-310 (approximately)

## Testing
The fix ensures that:
- Groups with active contacts are properly detected
- Percentage filtering works when enabled
- All contacts are used when percentage filtering is disabled
- Error messages are more specific about which step failed

## Compatibility
This fix maintains full compatibility with:
- Existing campaign data
- Percentage-based group selection
- Automatic batch calculation
- All other campaign features 