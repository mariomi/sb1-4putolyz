# Automatic Batch Calculation Feature

## Overview
The campaign creation form has been updated to automatically calculate email batch parameters instead of requiring manual input from users. This simplifies the user experience and ensures consistent, optimal scheduling.

## Changes Made

### Frontend Changes (`src/pages/CampaignsPage.tsx`)

#### 1. Removed Manual Fields
- **Removed**: "Email per Batch" and "Intervallo (min)" input fields from the form
- **Reason**: These parameters are now calculated automatically based on campaign duration and total emails

#### 2. Updated Form Data Structure
```typescript
// Before
const initialFormData = {
  // ... other fields
  emails_per_batch: 50,
  batch_interval_minutes: 15,
  // ... other fields
}

// After
const initialFormData = {
  // ... other fields
  // emails_per_batch and batch_interval_minutes removed
  // ... other fields
}
```

#### 3. Enhanced Calculation Logic
The `calculateScheduleSummary()` function now uses automatic calculation:

```typescript
// Automatic calculation logic
const dailySendCount = Math.max(1, Math.min(10, Math.ceil(emailPerDay / 10))); // Min 1, max 10 batch al giorno
const batchSize = Math.max(1, Math.floor(emailPerDay / dailySendCount));
const intervalBetweenSends = Math.floor((24 * 60) / dailySendCount); // Minuti totali divisi per numero di batch
```

#### 4. Updated Form Submission
- **Removed**: `emails_per_batch` and `batch_interval_minutes` from campaign data payload
- **Added**: Automatic calculation validation before submission
- **Enhanced**: Error handling for invalid calculation scenarios

#### 5. Improved Summary Display
The scheduling summary now shows:
- **Visual cards** for key metrics (days, total emails, emails/day, batches/day)
- **Detailed breakdown** of batch size and intervals
- **Remaining emails** distribution information
- **Real-time updates** when form fields change

### Backend Changes (`supabase/functions/start-campaign/index.ts`)

#### 1. Automatic Daily Send Count Calculation
```typescript
// Before
const dailySendCount = campaign.emails_per_batch || 10;

// After
const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
const emailsPerDay = Math.floor(activeContacts.length / totalDays);
const dailySendCount = Math.max(1, Math.min(10, Math.ceil(emailsPerDay / 10)));
```

#### 2. Enhanced Logging
Added detailed logging for automatic calculations:
```typescript
console.log(`📊 Automatic calculation: ${emailsPerDay} emails/day, ${dailySendCount} batches/day`);
```

## Benefits

### 1. Simplified User Experience
- **Fewer fields** to fill out during campaign creation
- **Reduced complexity** for new users
- **Faster campaign setup** process

### 2. Consistent Scheduling
- **Optimal distribution** of emails across campaign duration
- **Automatic balancing** of batch sizes and intervals
- **Prevents user errors** in manual parameter setting

### 3. Dynamic Updates
- **Real-time calculation** updates as users change dates or groups
- **Immediate feedback** on scheduling impact
- **Visual confirmation** of email distribution

### 4. Backward Compatibility
- **Existing campaigns** continue to work normally
- **Database fields** remain for historical data
- **No breaking changes** to existing functionality

## Technical Implementation

### Calculation Algorithm
1. **Total Days**: `(end_date - start_date) + 1`
2. **Emails per Day**: `Math.floor(total_emails / total_days)`
3. **Daily Batches**: `Math.max(1, Math.min(10, Math.ceil(emails_per_day / 10)))`
4. **Batch Size**: `Math.max(1, Math.floor(emails_per_day / daily_batches))`
5. **Interval**: `Math.floor((24 * 60) / daily_batches)` minutes

### Constraints
- **Minimum batches**: 1 per day
- **Maximum batches**: 10 per day
- **Minimum batch size**: 1 email
- **Maximum interval**: 24 hours (1440 minutes)

## User Interface Changes

### Before
```
[Email per Batch: 50] [Intervallo (min): 15]
```

### After
```
📊 Riepilogo Pianificazione
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Giorni      │ Email       │ Email/giorno│ Batch/giorno│
│ totali      │ totali      │             │             │
│ 30          │ 3000        │ 100         │ 10          │
└─────────────┴─────────────┴─────────────┴─────────────┘
Email per batch: 10 email
Intervallo tra batch: 2h 24m
```

## Migration Notes

### Database
- **No migration required** - existing fields remain for historical data
- **New campaigns** will not populate `emails_per_batch` and `batch_interval_minutes`
- **Backend calculation** uses campaign duration and contact count

### Frontend
- **Form validation** updated to check calculation validity
- **Error handling** enhanced for edge cases
- **Type safety** maintained with optional fields

## Future Enhancements

### Potential Improvements
1. **Advanced algorithms** for optimal email distribution
2. **User preferences** for batch timing preferences
3. **A/B testing** of different scheduling strategies
4. **Analytics** on delivery success rates by batch timing

### Configuration Options
1. **Custom batch limits** per sender/domain
2. **Time zone** considerations for global campaigns
3. **Peak hour** avoidance settings
4. **Weekend** vs weekday scheduling

## Testing

### Test Cases
1. **Short campaigns** (1-3 days) with many emails
2. **Long campaigns** (30+ days) with few emails
3. **Edge cases** with very small or large contact lists
4. **Date changes** to verify dynamic updates
5. **Group selection** changes to verify recalculation

### Validation
- ✅ **Calculation accuracy** verified against manual math
- ✅ **UI responsiveness** confirmed for real-time updates
- ✅ **Backend compatibility** tested with existing campaigns
- ✅ **Error handling** verified for invalid scenarios 