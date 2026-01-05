-- ========================================
-- Fix Leave Types Table RLS Policies
-- ========================================
-- This fixes the "An error occurred" when trying to edit leave type names

-- Drop existing leave_types policies
DROP POLICY IF EXISTS "Anyone can view active leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Users can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can insert leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can update leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can delete leave types" ON public.leave_types;

-- Recreate leave_types policies
-- Everyone can view leave types (needed for applying leaves)
CREATE POLICY "Users can view leave types" ON public.leave_types
  FOR SELECT USING (true);

-- Only admins can manage leave types
CREATE POLICY "Admins can insert leave types" ON public.leave_types
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update leave types" ON public.leave_types
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete leave types" ON public.leave_types
  FOR DELETE USING (public.is_admin());

-- Ensure RLS is enabled
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
