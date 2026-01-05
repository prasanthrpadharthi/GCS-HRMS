export type UserRole = "admin" | "user"

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  salary?: number
  must_change_password: boolean
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
}

export interface Leave {
  id: string
  user_id: string
  date: string
  leave_type: "paid" | "unpaid"
  day_type: "full" | "half"
  reason?: string
  created_at: string
  updated_at: string
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
