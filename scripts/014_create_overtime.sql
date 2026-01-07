-- Create overtime table for tracking user overtime on weekends and holidays

CREATE TABLE IF NOT EXISTS public.overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  overtime_date DATE NOT NULL,
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  hours_worked DECIMAL(5, 2),
  overtime_type VARCHAR(50) NOT NULL CHECK (overtime_type IN ('weekend', 'holiday')),
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_overtime_user_id ON public.overtime(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON public.overtime(overtime_date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON public.overtime(status);
CREATE INDEX IF NOT EXISTS idx_overtime_user_date ON public.overtime(user_id, overtime_date);

-- Create RLS policies for overtime table
ALTER TABLE public.overtime ENABLE ROW LEVEL SECURITY;

-- Users can view their own overtime records
CREATE POLICY "Users can view their own overtime" ON public.overtime
  FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can insert their own overtime records
CREATE POLICY "Users can create their own overtime" ON public.overtime
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Users can update their own pending overtime records
CREATE POLICY "Users can update their own pending overtime" ON public.overtime
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Users can delete their own pending overtime records
CREATE POLICY "Users can delete their own pending overtime" ON public.overtime
  FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update overtime status
CREATE POLICY "Admins can update overtime status" ON public.overtime
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Admins can view all overtime records
CREATE POLICY "Admins can view all overtime" ON public.overtime
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ));
