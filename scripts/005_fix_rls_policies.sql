-- Drop existing is_admin function
DROP FUNCTION IF EXISTS public.is_admin();

-- Recreate is_admin function with proper security context
-- This function bypasses RLS by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Query the users table directly, bypassing RLS
  SELECT role INTO user_role
  FROM public.users 
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop all existing RLS policies for users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Recreate RLS policies with proper logic
-- SELECT policy: Users can see their own profile OR if they're admin, they can see all
CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- INSERT policy: Only admins can create new users
CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

-- UPDATE policy: Users can update their own profile OR admins can update any user
CREATE POLICY "Users can update profiles" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  );

-- DELETE policy: Only admins can delete users
CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (public.is_admin());

-- Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Fix Attendance Table RLS Policies
-- ========================================

-- Drop existing attendance policies
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;

-- Recreate attendance policies with proper logic
CREATE POLICY "Users can view attendance" ON public.attendance
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Users can insert attendance" ON public.attendance
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Users can update attendance" ON public.attendance
  FOR UPDATE USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Admins can delete attendance" ON public.attendance
  FOR DELETE USING (public.is_admin());

-- ========================================
-- Fix Leaves Table RLS Policies
-- ========================================

-- Drop existing leaves policies
DROP POLICY IF EXISTS "Users can view own leaves" ON public.leaves;
DROP POLICY IF EXISTS "Admins can view all leaves" ON public.leaves;
DROP POLICY IF EXISTS "Users can insert own leaves" ON public.leaves;
DROP POLICY IF EXISTS "Users can update own leaves" ON public.leaves;
DROP POLICY IF EXISTS "Admins can manage all leaves" ON public.leaves;

-- Recreate leaves policies with proper logic
CREATE POLICY "Users can view leaves" ON public.leaves
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Users can insert leaves" ON public.leaves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update leaves" ON public.leaves
  FOR UPDATE USING (
    (auth.uid() = user_id AND status = 'pending') OR public.is_admin()
  );

CREATE POLICY "Admins can delete leaves" ON public.leaves
  FOR DELETE USING (public.is_admin());

-- ========================================
-- Fix Leave Balances RLS Policies
-- ========================================

-- Drop existing leave_balances policies
DROP POLICY IF EXISTS "Users can view own leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can view all leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can manage leave balances" ON public.leave_balances;

-- Recreate leave_balances policies
CREATE POLICY "Users can view leave balances" ON public.leave_balances
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Admins can manage leave balances" ON public.leave_balances
  FOR ALL USING (public.is_admin());

-- ========================================
-- Fix Leave Types Table RLS Policies
-- ========================================

-- Drop existing leave_types policies
DROP POLICY IF EXISTS "Anyone can view active leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.leave_types;

-- Recreate leave_types policies
CREATE POLICY "Users can view leave types" ON public.leave_types
  FOR SELECT USING (true); -- Everyone can view leave types

CREATE POLICY "Admins can insert leave types" ON public.leave_types
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update leave types" ON public.leave_types
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete leave types" ON public.leave_types
  FOR DELETE USING (public.is_admin());
