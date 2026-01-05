# Database RLS Policy Fix

## Issues Fixed

This script fixes the following issues in the HRMS application:

1. ❌ **Clock out error** - "An error occurred" when trying to clock out
2. ❌ **Salary update error** - Admins unable to update user salaries
3. ❌ **Leave history not visible** - Users cannot see their leave records
4. ❌ **Admin cannot see records** - Admin cannot view user data, attendance, or leaves

## Root Cause

The Row Level Security (RLS) policies had **conflicting rules** that prevented proper data access:
- Multiple separate policies for the same operation caused PostgreSQL to evaluate them incorrectly
- The `is_admin()` function had potential circular dependency issues
- UPDATE policies for attendance table were conflicting

## Solution

The fix consolidates RLS policies using **OR logic** in single policies instead of multiple conflicting policies.

## How to Apply the Fix

### Step 1: Run the Main Fix Script

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy the contents of `scripts/005_fix_rls_policies.sql`
4. Paste and **Run** the script

### Step 2: Verify the Fix (Optional)

1. In the same SQL Editor
2. Copy the contents of `scripts/006_verify_policies.sql`
3. Paste and **Run** the script
4. Check the output to confirm policies are correctly set up

### Step 3: Test the Application

After running the script, test the following:

- ✅ **Clock In/Out**: Try clocking in and out - should work without errors
- ✅ **Salary Update**: As admin, try updating a user's salary
- ✅ **View Users**: As admin, check if you can see all users in the Users page
- ✅ **Leave History**: As a regular user, check if you can see your leave applications
- ✅ **Admin Dashboard**: As admin, verify you can see all attendance and leave records

## What Changed

### Users Table
- Combined SELECT policies (users + admins) into one with OR logic
- Combined UPDATE policies (self-update + admin update) into one

### Attendance Table
- Removed conflicting UPDATE policies
- Consolidated all policies to use OR logic (user OR admin)

### Leaves Table
- Fixed SELECT policies so users can see their own leaves
- Admins can see all leaves
- Combined UPDATE logic (pending user updates OR admin updates)

### Leave Balances Table
- Users can view their own balances
- Admins can view all balances and manage them

### is_admin() Function
- Made more stable with `SECURITY DEFINER` and `STABLE` attributes
- Properly grants execution permissions to authenticated users

## Troubleshooting

If issues persist after running the script:

1. **Clear browser cache and reload** the application
2. **Log out and log back in** to refresh the session
3. **Check Supabase logs** in Dashboard → Logs for any RLS-related errors
4. **Verify the script ran successfully** - run the verification script (006_verify_policies.sql)

## Technical Details

The key change is moving from:
```sql
-- OLD: Multiple policies (causes conflicts)
CREATE POLICY "Users can update own attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all attendance" ON public.attendance
  FOR ALL USING (public.is_admin());
```

To:
```sql
-- NEW: Single policy with OR logic
CREATE POLICY "Users can update attendance" ON public.attendance
  FOR UPDATE USING (
    auth.uid() = user_id OR public.is_admin()
  );
```

This ensures that if either condition is true (user owns the record OR user is admin), the operation is allowed.
