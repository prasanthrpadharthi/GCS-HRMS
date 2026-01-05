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
      -- Create new record
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_leave_status_change ON public.leaves;

-- Create trigger on leaves table
CREATE TRIGGER on_leave_status_change
  AFTER INSERT OR UPDATE ON public.leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance();

-- Also handle deletion
CREATE OR REPLACE FUNCTION public.handle_leave_deletion()
RETURNS TRIGGER AS $$
DECLARE
  leave_year INTEGER;
BEGIN
  -- Extract year from leave dates
  leave_year := EXTRACT(YEAR FROM OLD.from_date);
  
  -- Only process if the deleted leave was approved
  IF OLD.status = 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = GREATEST(0, used_days - OLD.total_days)
    WHERE user_id = OLD.user_id 
      AND leave_type_id = OLD.leave_type_id 
      AND year = leave_year;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_leave_delete ON public.leaves;

-- Create trigger for deletion
CREATE TRIGGER on_leave_delete
  AFTER DELETE ON public.leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_deletion();
