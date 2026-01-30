export type UserRole = "admin" | "user"
export type EmploymentType = "full_time" | "part_time"
export type WorkPassType = "singaporean" | "pr" | "ep" | "wp"

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  employment_type?: EmploymentType
  work_pass_type?: WorkPassType
  salary?: number
  must_change_password: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  user_id: string
  date: string
  clock_in?: string
  clock_out?: string
  status: "present" | "absent" | "leave" | "half_day"
  created_at: string
  updated_at: string
  user?: User
}

export interface Leave {
  id: string
  user_id: string
  leave_type_id?: string
  from_date: string
  to_date: string
  from_session: "full" | "morning" | "afternoon"
  to_session: "full" | "morning" | "afternoon"
  total_days: number
  reason?: string
  status: "pending" | "approved" | "rejected"
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  leave_type?: LeaveType
  user?: User
}

export interface LeaveType {
  id: string
  name: string
  description?: string
  is_paid: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeaveBalance {
  id: string
  user_id: string
  leave_type_id: string
  year: number
  total_days: number
  used_days: number
  remaining_days: number
  created_at: string
  updated_at: string
  leave_type?: LeaveType
  user?: User
}

export interface CompanySettings {
  id: string
  work_start_time: string
  work_end_time: string
  mark_from_time: string
  weekend_days: string[]
  created_at: string
  updated_at: string
}

export interface Holiday {
  id: string
  holiday_name: string
  holiday_date: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Overtime {
  id: string
  user_id: string
  overtime_date: string
  time_from?: string
  time_to?: string
  hours_worked: number
  overtime_type: "weekend" | "holiday"
  description?: string
  status: "pending" | "approved" | "rejected"
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  user?: User
}
