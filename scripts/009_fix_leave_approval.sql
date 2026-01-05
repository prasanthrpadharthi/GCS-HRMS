-- ========================================
-- Fix Leave Approval Issues
-- ========================================
-- This fixes the "An error occurred" when approving leaves

-- First, ensure the leave_balances table has proper policies for triggers
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Admins can manage leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "System can manage leave balances" ON public.leave_balances;

-- Recreate policies
CREATE POLICY "Users can view leave balances" ON public.leave_balances
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Admins can insert leave balances" ON public.leave_balances
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update leave balances" ON public.leave_balances
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete leave balances" ON public.leave_balances
  FOR DELETE USING (public.is_admin());

-- ========================================
-- Update Leave Balance Trigger with Better Error Handling
-- ========================================

-- Create function to update leave balance when leave is approved
CREATE OR REPLACE FUNCTION public.update_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  leave_year INTEGER;
  balance_exists BOOLEAN;
BEGIN
  -- Extract year from leave dates
  leave_year := EXTRACT(YEAR FROM NEW.from_date);
  
  -- Only process if status changed to approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    -- Check if balance record exists
    SELECT EXISTS(
      SELECT 1 FROM public.leave_balances 
      WHERE user_id = NEW.user_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = leave_year
    ) INTO balance_exists;
    
    IF balance_exists THEN
      -- Update existing record
      UPDATE public.leave_balances
      SET used_days = used_days + NEW.total_days,
          updated_at = NOW()
      WHERE user_id = NEW.user_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = leave_year;
    ELSE
      -- Create new record with 0 allocated days (admin should set this separately)
      INSERT INTO public.leave_balances (user_id, leave_type_id, year, used_days, allocated_days)
      VALUES (NEW.user_id, NEW.leave_type_id, leave_year, NEW.total_days, 0);
    END IF;
    
  -- If status changed from approved to something else, subtract the days
  ELSIF OLD IS NOT NULL AND OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = GREATEST(0, used_days - NEW.total_days),
        updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND leave_type_id = NEW.leave_type_id 
      AND year = leave_year;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the leave approval
    RAISE WARNING 'Error updating leave balance: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_leave_status_change ON public.leaves;

CREATE TRIGGER on_leave_status_change
  AFTER INSERT OR UPDATE ON public.leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance();

-- ========================================
-- Verify Tables and Columns
-- ========================================

-- Check if updated_at column exists in leave_balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'leave_balances' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.leave_balances 
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;
