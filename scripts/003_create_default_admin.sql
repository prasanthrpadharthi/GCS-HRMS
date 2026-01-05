-- This script manually creates the default admin user
-- The admin needs to sign up through the auth.users table first
-- This is just a note that the admin should be created via the signup API with:
-- email: admin@company.com
-- password: admin
-- metadata: { role: 'admin', full_name: 'Administrator', must_change_password: true }

-- The trigger will automatically create the user profile in public.users table
