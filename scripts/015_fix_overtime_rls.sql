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
