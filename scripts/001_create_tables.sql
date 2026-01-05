-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends auth.users with profile data)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  salary DECIMAL(10, 2),
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'half_day')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create leave_types table
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leave_balances table (employee leave allocation)
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days DECIMAL(4, 1) NOT NULL DEFAULT 0,
  used_days DECIMAL(4, 1) NOT NULL DEFAULT 0,
  remaining_days DECIMAL(4, 1) GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Create leaves table
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE SET NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  from_session TEXT NOT NULL DEFAULT 'full' CHECK (from_session IN ('full', 'morning', 'afternoon')),
  to_session TEXT NOT NULL DEFAULT 'full' CHECK (to_session IN ('full', 'morning', 'afternoon')),
  total_days DECIMAL(4, 1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_start_time TIME DEFAULT '09:30:00',
  work_end_time TIME DEFAULT '19:00:00',
  mark_from_time TIME DEFAULT '09:00:00',
  weekend_days TEXT[] DEFAULT ARRAY['Saturday', 'Sunday'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default company settings
INSERT INTO public.company_settings (id, work_start_time, work_end_time, mark_from_time, weekend_days)
VALUES (uuid_generate_v4(), '09:30:00', '19:00:00', '09:00:00', ARRAY['Saturday', 'Sunday'])
ON CONFLICT DO NOTHING;

-- Insert default leave types
INSERT INTO public.leave_types (id, name, description, is_paid, is_active) VALUES
  (uuid_generate_v4(), 'Sick Leave', 'Leave for medical reasons', true, true),
  (uuid_generate_v4(), 'Casual Leave', 'Leave for personal reasons', true, true),
  (uuid_generate_v4(), 'Earned Leave', 'Annual leave earned by employee', true, true),
  (uuid_generate_v4(), 'Unpaid Leave', 'Leave without pay', false, true),
  (uuid_generate_v4(), 'Maternity Leave', 'Leave for maternity', true, true),
  (uuid_generate_v4(), 'Paternity Leave', 'Leave for paternity', true, true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is admin (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (public.is_admin());

-- RLS Policies for attendance table
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all attendance" ON public.attendance
  FOR ALL USING (public.is_admin());

-- RLS Policies for leaves table
CREATE POLICY "Users can view own leaves" ON public.leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leaves" ON public.leaves
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can insert own leaves" ON public.leaves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaves" ON public.leaves
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all leaves" ON public.leaves
  FOR ALL USING (public.is_admin());

-- RLS Policies for leave_types table
CREATE POLICY "Everyone can view active leave types" ON public.leave_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage leave types" ON public.leave_types
  FOR ALL USING (public.is_admin());

-- RLS Policies for leave_balances table
CREATE POLICY "Users can view own leave balances" ON public.leave_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leave balances" ON public.leave_balances
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage leave balances" ON public.leave_balances
  FOR ALL USING (public.is_admin());

-- RLS Policies for company_settings
CREATE POLICY "Everyone can view settings" ON public.company_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update settings" ON public.company_settings
  FOR UPDATE USING (public.is_admin());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_leaves_user_dates ON public.leaves(user_id, from_date DESC, to_date DESC);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON public.leave_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON public.leaves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_types_updated_at BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
