-- Create holidays table for managing company holidays

CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Create index on holiday_date for better query performance
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);

-- Create RLS policies for holidays table
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view holidays
CREATE POLICY "Holidays are viewable by all authenticated users" ON public.holidays
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow only admins to insert holidays
CREATE POLICY "Only admins can create holidays" ON public.holidays
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow only admins to update holidays
CREATE POLICY "Only admins can update holidays" ON public.holidays
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow only admins to delete holidays
CREATE POLICY "Only admins can delete holidays" ON public.holidays
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert Singapore Public Holidays 2026
INSERT INTO public.holidays (holiday_name, holiday_date, description) VALUES
  ('New Year Day', '2026-01-01', 'New Year Day'),
  ('Chinese New Year', '2026-02-17', 'Chinese New Year (Day 1)'),
  ('Chinese New Year', '2026-02-18', 'Chinese New Year (Day 2)'),
  ('Good Friday', '2026-04-03', 'Good Friday'),
  ('Hari Raya Puasa', '2026-05-07', 'Hari Raya Puasa'),
  ('Vesak Day', '2026-05-24', 'Vesak Day'),
  ('Hari Raya Haji', '2026-06-17', 'Hari Raya Haji'),
  ('National Day', '2026-08-09', 'National Day'),
  ('Deepavali', '2026-11-08', 'Deepavali'),
  ('Christmas Day', '2026-12-25', 'Christmas Day')
ON CONFLICT (holiday_date) DO NOTHING;
