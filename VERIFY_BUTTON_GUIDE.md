# Email Verification Feature - Visual Guide

## Where is the Verify Button?

The **"Verify Email"** button appears **row-wise** in the User Management table, next to each unverified user.

### User Management Screen Layout

```
Dashboard → Manage Users
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Filter: [All Users ▼]                                    [+ Add User]           │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Name        │ Email              │ Role  │ Salary    │ Email Status  │ Actions │
├──────────────┼────────────────────┼───────┼───────────┼───────────────┼─────────┤
│  John Doe    │ john@example.com   │ User  │ $3000.00  │ ✓ Verified    │ ✎ 🗑    │
├──────────────┼────────────────────┼───────┼───────────┼───────────────┼─────────┤
│  Jane Smith  │ jane@example.com   │ User  │ $3500.00  │ [Verify Email]│ ✎ 🗑    │  ← Click here!
├──────────────┼────────────────────┼───────┼───────────┼───────────────┼─────────┤
│  Bob Wilson  │ bob@example.com    │ Admin │ $5000.00  │ [Verify Email]│ ✎ 🗑    │  ← Click here!
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Button States

**For Verified Users:**
```
┌──────────────────┐
│  ✓ Verified      │  ← Green badge (no button)
└──────────────────┘
```

**For Unverified Users:**
```
┌──────────────────┐
│  Verify Email    │  ← Clickable button
└──────────────────┘
```

### Filter Options

Use the dropdown at the top to filter users:

```
┌─────────────────────────┐
│ Filter: All Users    ▼  │
├─────────────────────────┤
│ • All Users             │
│ • ✓ Verified            │
│ • Unverified (2)        │ ← Shows count of unverified users
└─────────────────────────┘
```

## How to Use the Verify Button

### Step 1: Navigate to User Management
1. Login as admin
2. Go to **Dashboard**
3. Click on **Manage Users** in the sidebar or dashboard card

### Step 2: Find Unverified Users
**Option A:** Scroll through the table
- Look for users with **"Verify Email"** button in the "Email Status" column

**Option B:** Use the filter (Recommended)
- Click the filter dropdown
- Select **"Unverified"**
- Only unverified users will be shown

### Step 3: Verify a User
1. Click the **"Verify Email"** button next to the user
2. A confirmation dialog appears:
   ```
   ┌─────────────────────────────────────────┐
   │  Verify User Email                      │
   ├─────────────────────────────────────────┤
   │  Are you sure you want to manually      │
   │  verify this user's email? This will    │
   │  allow them to access the system.       │
   │                                         │
   │           [Cancel]  [Confirm]           │
   └─────────────────────────────────────────┘
   ```
3. Click **"Confirm"**
4. Success message appears
5. The button changes to **"✓ Verified"** green badge
6. User can now log in and access the system

## Auto-Verification for New Users

✅ **NEW FEATURE:** All new users are now **automatically verified** when created!

When you create a new user:
1. Click **"+ Add User"**
2. Fill in the details
3. Click **"Add User"**
4. ✨ User is automatically verified!
5. No need to manually click verify button

### Success Message
After creating a user, you'll see:
```
┌─────────────────────────────────────────┐
│  Success                                │
├─────────────────────────────────────────┤
│  User created and email verified        │
│  successfully!                          │
│                                         │
│                    [OK]                 │
└─────────────────────────────────────────┘
```

## Common Questions

### Q: Why don't I see the verify button?
**A:** The button only appears for **unverified** users. If you see "✓ Verified" (green badge), the user is already verified.

### Q: Can I bulk verify multiple users?
**A:** Currently, you need to verify users one by one. You can filter by "Unverified" to see all users that need verification.

### Q: What happens if I verify someone by mistake?
**A:** There's no "unverify" button. Once verified, the user remains verified. This is intentional for security.

### Q: Do new users need verification?
**A:** No! Starting now, all new users are **automatically verified** when you create them. You only need to manually verify existing unverified users.

### Q: Will users get an email notification?
**A:** No, since we're not using an email provider. You should inform users through another channel (phone, in-person, etc.) that their account is ready.

## Troubleshooting

### Button doesn't work when clicked
- Check browser console for errors (F12)
- Ensure you're logged in as admin
- Verify the service role key is set in `.env.local`
- Restart your development server

### Changes not reflecting
- Refresh the page (F5)
- Clear browser cache
- Check if the SQL migration scripts were run

### "Email Status" column not visible
- The SQL migration scripts haven't been run
- Follow the guide in `HOW_TO_RUN_SCRIPTS.md`
