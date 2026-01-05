# Complete Setup Guide for HRMS Application

## Issues Fixed in This Update

1. ✅ **Manual Attendance Update** - Can now override existing attendance records
2. ✅ **Leave Management Visibility** - Users can see their leave records with proper RLS
3. ✅ **Used Leave Count** - Automatically updates when leaves are approved/rejected
4. ✅ **Employee Filter in Reports** - Now correctly filters by selected employee
5. ✅ **Loading States** - Added smooth loading animations throughout the app

## Required SQL Scripts to Run

Run these scripts in your **Supabase SQL Editor** in this order:

### 1. Fix RLS Policies (REQUIRED)
📄 **File:** `scripts/005_fix_rls_policies.sql`

This fixes all permission issues for:
- User management
- Attendance (clock in/out)
- Leaves (viewing, approval)
- Leave balances

### 2. Leave Balance Auto-Update (REQUIRED)
📄 **File:** `scripts/007_leave_balance_trigger.sql`

This automatically updates the `used_days` count when:
- A leave is approved ➡️ Adds days to used_days
- A leave is rejected/reset ➡️ Subtracts days from used_days
- A leave is deleted ➡️ Subtracts days from used_days

## Step-by-Step Setup

### Step 1: Run RLS Fix
```sql
-- Copy entire content of scripts/005_fix_rls_policies.sql
-- Paste in Supabase SQL Editor
-- Click "Run"
```

### Step 2: Run Leave Balance Trigger
```sql
-- Copy entire content of scripts/007_leave_balance_trigger.sql
-- Paste in Supabase SQL Editor
-- Click "Run"
```

### Step 3: Verify Setup
Run this verification query:
```sql
-- Check if triggers exist
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname IN ('on_leave_status_change', 'on_leave_delete');

-- Should return 2 rows
```

## Features Now Working

### For Users:
✅ Clock in/out with automatic prompts
✅ View leave history with leave types and status
✅ See accurate leave balance (approved vs pending)
✅ Override/update attendance records
✅ Apply for leaves with proper validation
✅ Smooth loading indicators for all operations

### For Admins:
✅ View all employee attendance with month selector
✅ Delete any attendance record
✅ Approve/reject leave requests
✅ Reset approved/rejected leaves back to pending
✅ Filter attendance reports by employee
✅ Add/edit/delete leave types
✅ Automatic salary calculations
✅ Export attendance reports to CSV

## Testing Checklist

After running the SQL scripts:

### Test Leave Management:
1. ⬜ Apply for a leave as user
2. ⬜ See it in "Leaves Pending" on dashboard
3. ⬜ Admin approves the leave
4. ⬜ Check "Leaves Approved" count increases
5. ⬜ Verify `used_days` is updated in leave balance

### Test Attendance:
1. ⬜ Clock in as user
2. ⬜ Clock out as user
3. ⬜ Try manual attendance for same date (should update, not error)
4. ⬜ Admin views all attendance with month selector
5. ⬜ Admin deletes an attendance record

### Test Reports:
1. ⬜ Admin selects specific employee in reports
2. ⬜ Verify correct data shows for that employee
3. ⬜ Export to CSV works
4. ⬜ Salary calculations are accurate

## Troubleshooting

### If leaves still show 0 used days:
1. Approve a leave
2. Check if trigger fired: `SELECT * FROM leave_balances WHERE user_id = 'YOUR_USER_ID';`
3. If no record, manually create allocation first in Leave Allocation tab

### If "An error occurred" persists:
1. Check browser console for detailed error
2. Verify RLS policies ran: `SELECT * FROM pg_policies WHERE tablename = 'attendance';`
3. Clear browser cache and reload

### If loading states don't show:
1. Check for TypeScript errors in terminal
2. Rebuild: `npm run build`
3. Restart dev server: `npm run dev`

## New UI Improvements

- 🔄 **Loading Spinners** - Beautiful animated spinners with messages
- ⚡ **Fast Transitions** - Smooth animations throughout
- 📊 **Real-time Updates** - Instant feedback on all actions
- 🎯 **Clear Messages** - Users always know what's happening
- ✨ **Modern Design** - Polished amber-themed interface

## Support

If issues persist:
1. Check Supabase logs in Dashboard → Logs
2. Verify all SQL scripts ran without errors
3. Ensure you're using the latest code version
4. Try logging out and back in to refresh session
