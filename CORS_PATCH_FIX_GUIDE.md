# How to Fix the CORS/PATCH Error for Overtime Approval

## Problem Summary
When admins try to approve/reject overtime records, they get this error:
```
Access to fetch at 'https://ytrsvckkdshmlhlghxrj.supabase.co/rest/v1/overtime?...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response
```

**This is NOT a true CORS error** - it's a Supabase RLS (Row Level Security) policy issue. The RLS policies are preventing admins from updating overtime records.

## Root Cause
The existing RLS policies in `scripts/014_create_overtime.sql` use complex `EXISTS` subqueries that may not properly authenticate admin users for UPDATE (PATCH) operations:

```sql
-- PROBLEMATIC POLICY:
CREATE POLICY "Admins can update overtime status" ON public.overtime
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ))
```

This structure sometimes fails for UPDATE operations, blocking the PATCH request at the RLS level.

## Solution

### Step 1: Execute the SQL Migration in Supabase

1. **Go to your Supabase project dashboard**
   - URL: https://supabase.com/dashboard/projects
   - Select your project (GCS-HRMS)

2. **Navigate to SQL Editor**
   - Left sidebar → SQL Editor
   - Click "New Query"

3. **Copy and paste the following SQL migration**
   - Source file: `scripts/015_fix_overtime_rls.sql`
   - Content:
   ```sql
   -- Fix overtime RLS policy for admin updates
   -- This script fixes the CORS/PATCH issue by ensuring admins can properly update overtime records

   -- Drop existing problematic policies
   DROP POLICY IF EXISTS "Admins can update overtime status" ON public.overtime;
   DROP POLICY IF EXISTS "Admins can view all overtime" ON public.overtime;

   -- Recreate with simpler, more reliable logic
   -- Admins can view all overtime records
   CREATE POLICY "Admins can view all overtime records" ON public.overtime
     FOR SELECT
     USING (
       (auth.uid() = user_id) OR 
       (SELECT role = 'admin' FROM public.users WHERE id = auth.uid())
     );

   -- Admins can update overtime (approve, reject)
   CREATE POLICY "Admins can update overtime records" ON public.overtime
     FOR UPDATE
     USING (SELECT role = 'admin' FROM public.users WHERE id = auth.uid())
     WITH CHECK (SELECT role = 'admin' FROM public.users WHERE id = auth.uid());

   -- Admins can delete overtime records
   CREATE POLICY "Admins can delete overtime records" ON public.overtime
     FOR DELETE
     USING (SELECT role = 'admin' FROM public.users WHERE id = auth.uid());
   ```

4. **Click "Run" or press Ctrl+Enter**
   - Wait for successful execution
   - You should see: "No rows returned" (this is expected for DROP/CREATE statements)
   - No error messages should appear

### Step 2: Verify the Code Changes

The approval functions have already been updated to include:

**File:** `components/admin-overtime-reports.tsx`

✅ **Already Fixed Features:**
1. **handleApproveOvertime()** - Now includes:
   - `const { data: { user } } = await supabase.auth.getUser()` - Gets authenticated user
   - `if (!user) throw new Error("User not authenticated")` - Ensures admin is logged in
   - `approved_by: user.id` - Includes admin user ID in update payload
   - Error handling with console logging

2. **handleRejectOvertime()** - Same improvements as approve function

3. **Dynamic working days calculation** - Replaced hardcoded "22" with actual month working days
   ```typescript
   // Count actual working days (Monday-Friday) in the month
   for (let day = 1; day <= daysInMonth; day++) {
     const dayOfWeek = new Date(year, month - 1, day).getDay()
     if (dayOfWeek !== 0 && dayOfWeek !== 6) {
       workingDaysInMonth++
     }
   }
   ```

### Step 3: Test the Fix

1. **Login as Admin**
   - Navigate to Dashboard → Overtime (or admin overtime management)
   - Ensure you're using an admin account

2. **Test Overtime Approval**
   - Find a pending overtime record
   - Click "Approve" button
   - Expected: Record status changes to "approved" ✅
   - Unexpected: CORS error ❌ (if this happens, RLS fix didn't apply)

3. **Check Browser Console**
   - Open DevTools: F12
   - Go to Console tab
   - No errors should appear during approval
   - You should see: "Overtime records fetched successfully" or similar success message

4. **Verify in Report**
   - Go to Attendance Report
   - Check that approved overtime appears in "Overtime Pay (1.5x)" column
   - Total salary should include overtime compensation

### Step 4: If Error Still Occurs

**Check 1: Verify Admin Role**
- Go to Supabase Dashboard → Authentication → Users
- Click on your user
- Look for `raw_user_meta_data` or go to Database Editor → users table
- Ensure `role = 'admin'` for your user account

**Check 2: Verify Migration Applied**
- In Supabase SQL Editor, run:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'overtime';
  ```
- You should see policies named:
  - "Admins can view all overtime records"
  - "Admins can update overtime records"
  - "Admins can delete overtime records"
  - (OLD policies like "Admins can update overtime status" should NOT appear)

**Check 3: Test RLS Policy Directly**
- In SQL Editor, run:
  ```sql
  -- This should return 'admin' if your user is properly authenticated
  SELECT role FROM public.users WHERE id = auth.uid();
  ```

## What Changed

### Before (Problematic):
```sql
CREATE POLICY "Admins can update overtime status" ON public.overtime
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ))
```

### After (Fixed):
```sql
CREATE POLICY "Admins can update overtime records" ON public.overtime
  FOR UPDATE
  USING (SELECT role = 'admin' FROM public.users WHERE id = auth.uid())
  WITH CHECK (SELECT role = 'admin' FROM public.users WHERE id = auth.uid())
```

**Key Improvements:**
1. **Simpler logic** - Direct SELECT with = comparison instead of EXISTS with nested AND
2. **More reliable** - Single subquery instead of complex EXISTS pattern
3. **Consistent WITH CHECK** - Both USING and WITH CHECK use same authentication logic
4. **Better performance** - Single row lookup instead of existence check

## Summary

| Item | Status | Details |
|------|--------|---------|
| Code Changes | ✅ Done | Functions updated with user authentication and approved_by field |
| SQL Migration | 📋 Ready | scripts/015_fix_overtime_rls.sql created |
| Your Action | ⚠️ REQUIRED | Execute SQL migration in Supabase SQL Editor |
| Testing | ⏳ Pending | After migration: test overtime approval button |

## Support

If the issue persists after executing the SQL migration:
1. Check admin user role in users table
2. Verify RLS policies were applied (use pg_policies query)
3. Check browser console for error details
4. Clear browser cache and restart development server
