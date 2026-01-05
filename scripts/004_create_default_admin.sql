-- Create default admin user
-- Note: This requires the Supabase service role key to execute
-- You can also create the admin through the signup API with the following metadata:

-- To create the default admin, use the signup API with:
-- POST to https://your-supabase-url/auth/v1/signup
-- {
--   "email": "admin@gcs.com",
--   "password": "admin",
--   "data": {
--     "full_name": "Administrator",
--     "role": "admin",
--     "must_change_password": true
--   }
-- }

-- Or use Supabase client:
-- supabase.auth.signUp({
--   email: 'admin@gcs.com',
--   password: 'admin',
--   options: {
--     data: {
--       full_name: 'Administrator',
--       role: 'admin',
--       must_change_password: true
--     }
--   }
-- })

-- The trigger will automatically create the user profile in the public.users table
