-- ========================================
-- Comprehensive RLS Policy Fix
-- ========================================
-- Run this script to fix all "An error occurred" issues with updates
-- This ensures all tables have proper RLS policies for admin operations

-- First, ensure is_admin() function exists with proper permissions
-- Use CASCADE to drop function and recreate all dependent policies
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users 
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ========================================
-- Fix Users Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can update profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Users can update profiles" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (public.is_admin());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Leave Types Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can insert leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can update leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can delete leave types" ON public.leave_types;

CREATE POLICY "Users can view leave types" ON public.leave_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert leave types" ON public.leave_types
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update leave types" ON public.leave_types
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete leave types" ON public.leave_types
  FOR DELETE USING (public.is_admin());

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Attendance Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;

CREATE POLICY "Users can view attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete attendance" ON public.attendance
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Leaves Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view leaves" ON public.leaves;
DROP POLICY IF EXISTS "Users can insert leaves" ON public.leaves;
DROP POLICY IF EXISTS "Users can update leaves" ON public.leaves;
DROP POLICY IF EXISTS "Admins can delete leaves" ON public.leaves;

CREATE POLICY "Users can view leaves" ON public.leaves
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert leaves" ON public.leaves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update leaves" ON public.leaves
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can delete leaves" ON public.leaves
  FOR DELETE USING (public.is_admin());

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Leave Balances Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can view leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can insert leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can update leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can delete leave balances" ON public.leave_balances;

CREATE POLICY "Users can view leave balances" ON public.leave_balances
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can insert leave balances" ON public.leave_balances
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update leave balances" ON public.leave_balances
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete leave balances" ON public.leave_balances
  FOR DELETE USING (public.is_admin());

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Company Settings Table RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;

CREATE POLICY "Anyone can view company settings" ON public.company_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update company settings" ON public.company_settings
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert company settings" ON public.company_settings
  FOR INSERT WITH CHECK (public.is_admin());

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Verify Policies
-- ========================================

-- Check that is_admin function exists
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'is_admin';

-- List all policies for verification
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
