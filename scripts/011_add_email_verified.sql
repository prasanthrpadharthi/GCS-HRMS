-- Add email_verified column to users table
-- This allows admins to manually verify user emails when not using email provider

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Set existing users as verified (for backward compatibility)
-- You can comment this out if you want all existing users to go through verification
UPDATE public.users 
SET email_verified = true 
WHERE email_verified IS NULL OR email_verified = false;

-- Add comment to explain the column
COMMENT ON COLUMN public.users.email_verified IS 'Manual email verification status. Admins can verify users without email provider.';
