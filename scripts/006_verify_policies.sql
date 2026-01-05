-- Verification Script - Run this AFTER running 005_fix_rls_policies.sql
-- This will show you all the active RLS policies

-- Show all policies on users table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Show all policies on attendance table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance'
ORDER BY policyname;

-- Show all policies on leaves table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'leaves'
ORDER BY policyname;

-- Show all policies on leave_balances table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'leave_balances'
ORDER BY policyname;

-- Verify the is_admin function exists
SELECT proname, proowner::regrole, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'is_admin';
