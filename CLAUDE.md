# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GCS HRMS (Human Resource Management System) - An employee attendance and leave management system built with Next.js 16, Supabase, and TypeScript. The application supports both admin and user roles with features for clock in/out, leave management, attendance tracking, overtime recording, and PDF report generation.

## Development Commands

```bash
# Install dependencies
npm install

# Development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16.0.10 with App Router (Turbopack enabled)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with SSR support
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS 4.x
- **PDF Generation**: jsPDF with autoTable
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation

### Directory Structure

```
app/
├── auth/              # Authentication pages (login, forgot-password, reset-password)
├── dashboard/         # Protected dashboard pages
│   ├── attendance/    # Clock in/out and attendance viewing
│   ├── leaves/        # Leave application and management
│   ├── leave-types/   # Admin: Configure leave types
│   ├── leave-allocation/ # Admin: Allocate leave balances
│   ├── users/         # Admin: User management
│   ├── holidays/      # Admin: Holiday management
│   ├── overtime/      # Overtime recording
│   ├── overtime-reports/ # Admin: Overtime reports and approvals
│   └── reports/       # Attendance reports with PDF export
├── actions/           # Server actions (email verification, user updates)
├── api/               # API routes (push notifications, subscriptions)
└── layout.tsx         # Root layout with providers

components/
├── ui/                # shadcn/ui base components (button, card, dialog, etc.)
├── admin-attendance-table.tsx        # Admin attendance management
├── all-users-attendance-table.tsx    # PDF export component (must be Client Component)
├── attendance-marker.tsx             # Clock in/out functionality
├── attendance-calendar.tsx           # Monthly attendance calendar view
├── dashboard-attendance-calendar.tsx # Admin dashboard calendar
├── leave-apply-dialog.tsx            # Leave application form
├── user-management-table.tsx         # User CRUD operations
└── nav-bar.tsx                       # Navigation bar with auth state

lib/
├── supabase/
│   ├── client.ts    # Browser Supabase client
│   ├── server.ts    # Server-side Supabase client (uses Next.js cookies)
│   ├── admin.ts     # Admin client with service role key
│   └── proxy.ts     # Session management middleware
├── types.ts         # TypeScript interfaces for all domain models
├── utils.ts         # Utility functions (date formatting, etc.)
└── mock-auth.ts     # Mock authentication flag for development

scripts/              # SQL migration scripts for Supabase setup
```

### Key Architectural Patterns

#### Authentication Flow
- Authentication is handled through `lib/supabase/proxy.ts` which acts as middleware
- Protected routes redirect unauthenticated users to `/auth/login`
- Server components use `createClient()` from `lib/supabase/server.ts` which uses Next.js cookies
- Client components use `createClient()` from `lib/supabase/client.ts` for browser operations
- The proxy middleware runs on all routes (excluding static assets) via `proxy.ts` in the root

#### Server vs Client Components
- Pages in `app/dashboard/` are **Server Components** by default (async function components)
- Components using browser-only APIs (PDF generation, local storage) need `"use client"` directive
- When using `next/dynamic` in Server Components, do NOT use `{ ssr: false }` (not supported in Next.js 16)

#### Database Models
Core tables (defined in `lib/types.ts`):
- `users` - Employee records with roles (admin/user)
- `attendance` - Daily attendance records (clock_in, clock_out, status)
- `leaves` - Leave requests with approval workflow
- `leave_types` - Configurable leave categories (paid/unpaid)
- `leave_balances` - Annual leave allocation per user per type
- `company_settings` - Work hours, weekend configuration
- `holidays` - Company holiday calendar
- `overtime` - Overtime records for weekend/holiday work

#### Row Level Security (RLS)
All tables use Supabase RLS policies defined in `scripts/*.sql` files:
- Users can only see their own records
- Admins can see and modify all records
- Policies are authenticated using `auth.uid()` from Supabase Auth

#### Role-Based Access
- **Admin**: Full access to all features, can approve/reject leaves, manage users, configure settings
- **User**: Can mark attendance, apply for leaves, view own records

### Important Implementation Notes

#### PDF Export Component
`components/all-users-attendance-table.tsx` is a Client Component that uses jsPDF for browser-only PDF generation. When dynamically importing this component in Server Components, do NOT use `{ ssr: false }`.

#### Date Handling
- Use `formatDateToString()` from `lib/utils.ts` for consistent date formatting
- Dates are stored as `YYYY-MM-DD` strings in the database
- Attendance date ranges use inclusive comparisons (`gte` and `lte`)

#### Leave Balance Calculation
Leave balances are automatically updated via database triggers (`scripts/007_leave_balance_trigger.sql`):
- When leave is approved → `used_days` increases
- When leave is rejected/deleted → `used_days` decreases
- Always check `used_days` is correctly updated after leave operations

#### Attendance Status
Status values: `present`, `absent`, `leave`, `half_day`
- Present: Clock in and clock out recorded
- Absent: No attendance marked (LOP - Loss of Pay)
- Leave: Approved leave request exists
- Half_day: Partial attendance

#### Overtime Types
- `weekend`: Work on configured weekend days
- `holiday`: Work on company holidays

### Supabase Setup

Required environment variables (see `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run SQL scripts in order from `scripts/` directory:
1. `001_create_tables.sql` - Core tables
2. `002_create_user_trigger.sql` - User sync trigger
3. `005_fix_rls_policies.sql` - RLS policies
4. `007_leave_balance_trigger.sql` - Leave balance auto-update
5. `011_add_email_verified.sql` - Email verification field
6. `013_create_holidays.sql` - Holiday table
7. `014_create_overtime.sql` - Overtime table

### UI Component Library

The app uses shadcn/ui components from `components/ui/`:
- `alert-custom.tsx` - Custom alert/toast notifications
- `button.tsx`, `card.tsx`, `dialog.tsx` - Base UI primitives
- `loading.tsx` - Loading spinner component
- Import from `@/components/ui/*` for consistency

### Development Tips

1. **Mock Auth Mode**: Set `enableMockAuth()` in `lib/mock-auth.ts` returns true to bypass Supabase auth
2. **Service Role Key**: Only use `lib/supabase/admin.ts` for server-side admin operations
3. **RLS Issues**: If users see "An error occurred", check RLS policies in Supabase SQL Editor
4. **Leave Balance Issues**: Verify triggers exist: `SELECT * FROM pg_trigger WHERE tgname IN ('on_leave_status_change', 'on_leave_delete')`
5. **Build Errors**: Watch for `ssr: false` usage in Server Components - remove or wrap in Client Component
