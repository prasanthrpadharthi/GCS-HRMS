-- Add employment_type and work_pass_type columns to users table
-- This migration adds new fields to track employee employment type and work pass type

-- Add employment_type column (enum-like with check constraint)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time'));

-- Add work_pass_type column (enum-like with check constraint)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS work_pass_type TEXT CHECK (work_pass_type IN ('singaporean', 'pr', 'ep', 'wp'));

-- Set default values for existing users
UPDATE users
SET employment_type = 'full_time'
WHERE employment_type IS NULL;

UPDATE users
SET work_pass_type = 'singaporean'
WHERE work_pass_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.employment_type IS 'Employment type: full_time (8.5 hrs/day) or part_time (4.25 hrs/day)';
COMMENT ON COLUMN users.work_pass_type IS 'Work pass type: singaporean, pr (Permanent Resident), ep (Employment Pass), wp (Work Permit)';
