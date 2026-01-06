# How to Run SQL Migration Scripts

## Step-by-Step Guide

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project: `ytrsvckkdshmlhlghxrj`

2. **Navigate to SQL Editor**
   - Click on the **SQL Editor** icon in the left sidebar
   - Or go to: Database → SQL Editor

3. **Run Script 1: Add email_verified column**
   - Click **"+ New query"** button
   - Copy the entire content from `scripts/011_add_email_verified.sql`
   - Paste it into the editor
   - Click **"Run"** button (or press Ctrl+Enter)
   - You should see: "Success. No rows returned"

4. **Run Script 2: Update user trigger**
   - Click **"+ New query"** button again
   - Copy the entire content from `scripts/012_update_user_trigger_email_verified.sql`
   - Paste it into the editor
   - Click **"Run"** button
   - You should see: "Success. No rows returned"

5. **Verify Installation**
   - Run this query to check the column was added:
   ```sql
   SELECT id, email, full_name, email_verified 
   FROM users 
   LIMIT 5;
   ```
   - You should see the `email_verified` column with values

### Option 2: Command Line (Advanced)

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref ytrsvckkdshmlhlghxrj

# Run migrations
supabase db push scripts/011_add_email_verified.sql
supabase db push scripts/012_update_user_trigger_email_verified.sql
```

## What Each Script Does

### Script 011: Add email_verified column
- Adds `email_verified` column to users table
- Sets existing users as verified (backward compatibility)
- This is your custom tracking field

### Script 012: Update user trigger
- Updates the trigger that creates user profiles
- New users will be created with `email_verified = false`
- Syncs with the auth system

## Troubleshooting

### "relation already exists" error
- The column/table already exists
- Safe to ignore if you've run it before
- Scripts use `IF NOT EXISTS` to prevent errors

### Permission denied
- Make sure you're logged in as the project owner
- Check your Supabase dashboard permissions

### Timeout error
- The query is taking too long
- Try running on a less busy time
- Check your internet connection

## After Running Scripts

1. **Restart your Next.js dev server**
   ```bash
   # Stop the server (Ctrl+C)
   # Start again
   npm run dev
   ```

2. **Test the feature**
   - Go to Dashboard → Manage Users
   - You should see "Email Status" column
   - Try filtering by "Unverified"
   - Test the verify button

3. **Check if it works**
   - Create a new test user
   - They should appear as "Unverified"
   - Click "Verify Email" button
   - They should change to "✓ Verified"

## Quick Start (TL;DR)

1. Open: https://supabase.com/dashboard/project/ytrsvckkdshmlhlghxrj/sql/new
2. Copy-paste content from `scripts/011_add_email_verified.sql` → Run
3. Copy-paste content from `scripts/012_update_user_trigger_email_verified.sql` → Run
4. Done! Restart your dev server.
