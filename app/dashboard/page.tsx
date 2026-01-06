import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarCheck, Users, FileText, Calendar } from "lucide-react"
import Link from "next/link"
import { ClockPromptModal } from "@/components/clock-prompt-modal"
import { DashboardAttendanceCalendar } from "@/components/dashboard-attendance-calendar"
import { formatDateToString } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  // Get today's date
  const today = formatDateToString(new Date())

  // Get today's attendance
  const { data: todayAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .single()

  // Get company settings
  const { data: settings } = await supabase.from("company_settings").select("*").single()

  // Get current month attendance count
  const currentDate = new Date()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  const { count: attendanceCount } = await supabase
    .from("attendance")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("date", formatDateToString(firstDay))
    .lte("date", formatDateToString(lastDay))
    .eq("status", "present")

  // Get attendance records with clock times to calculate total hours
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("clock_in, clock_out, date")
    .eq("user_id", user.id)
    .gte("date", formatDateToString(firstDay))
    .lte("date", formatDateToString(lastDay))
    .eq("status", "present")

  // Calculate total hours worked (excluding 1 hour lunch break per day)
  let totalHoursWorked = 0
  if (attendanceRecords) {
    attendanceRecords.forEach((record) => {
      if (record.clock_in && record.clock_out) {
        const clockIn = new Date(`${record.date}T${record.clock_in}`)
        const clockOut = new Date(`${record.date}T${record.clock_out}`)
        const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
        // Subtract 1 hour for lunch break
        const netHours = Math.max(0, hoursWorked - 1)
        totalHoursWorked += netHours
      }
    })
  }

  // Calculate effective days (total hours / 8.5 hours per day)
  const effectiveDays = totalHoursWorked > 0 ? (totalHoursWorked / 8.5).toFixed(2) : "0"

  // Get leaves data (all auto-approved)
  const { data: leavesData, count: leavesCount } = await supabase
    .from("leaves")
    .select("from_date, to_date, from_session, to_session", { count: "exact" })
    .eq("user_id", user.id)
    .gte("from_date", formatDateToString(firstDay))
    .lte("to_date", formatDateToString(lastDay))
    .eq("status", "approved")

  // Calculate total leave days excluding weekends
  let totalLeaveDays = 0
  const weekendDays = settings?.weekend_days || ["Saturday", "Sunday"]
  
  if (leavesData) {
    leavesData.forEach((leave) => {
      const fromDate = new Date(leave.from_date)
      const toDate = new Date(leave.to_date)
      let workingDaysInLeave = 0
      const currentDate = new Date(fromDate)
      
      while (currentDate <= toDate) {
        const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" })
        if (!weekendDays.includes(dayName)) {
          workingDaysInLeave++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      // Adjust for half days
      let adjustedLeaveDays = workingDaysInLeave
      if (leave.from_date === leave.to_date) {
        if (leave.from_session !== "full" || leave.to_session !== "full") {
          adjustedLeaveDays = 0.5
        }
      } else {
        if (leave.from_session === "afternoon") {
          adjustedLeaveDays -= 0.5
        }
        if (leave.to_session === "morning") {
          adjustedLeaveDays -= 0.5
        }
      }
      
      totalLeaveDays += adjustedLeaveDays
    })
  }

  // Get total users count (admin only)
  let totalUsers = null
  if (userData?.role === "admin") {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true }).neq("role", "admin")
    totalUsers = count
  }

  return (
    <div className="space-y-6">
      {/* Clock In/Out Prompt Modal */}
      <ClockPromptModal 
        attendance={todayAttendance} 
        settings={settings} 
        userId={user.id} 
        today={today} 
      />

      <div>
        <h1 className="text-3xl font-bold text-amber-900">Welcome, {userData?.full_name}!</h1>
        <p className="text-amber-700 mt-2">
          Here's your attendance overview for{" "}
          {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Days Present</CardTitle>
            <CalendarCheck className="h-4 w-4 text-amber-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{attendanceCount || 0}</div>
            <p className="text-xs text-amber-700 mt-1">
              {totalHoursWorked > 0 ? `${totalHoursWorked.toFixed(1)} hrs = ${effectiveDays} days` : 'This month'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Leaves Taken</CardTitle>
            <Calendar className="h-4 w-4 text-green-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{leavesCount || 0}</div>
            <p className="text-xs text-amber-700 mt-1">{totalLeaveDays > 0 ? `${totalLeaveDays} day${totalLeaveDays !== 1 ? 's' : ''} this month` : 'This month'}</p>
          </CardContent>
        </Card>

        {userData?.role === "admin" && (
          <Card className="border-amber-200 bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-amber-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-900">{totalUsers || 0}</div>
              <p className="text-xs text-amber-700 mt-1">Active users</p>
            </CardContent>
          </Card>
        )}

        <Link href="/dashboard/reports">
          <Card className="border-amber-200 bg-white/80 backdrop-blur hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900">View Reports</CardTitle>
              <FileText className="h-4 w-4 text-amber-700" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-amber-700">Click to view detailed reports</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Attendance Calendar View */}
      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">My Attendance Calendar</CardTitle>
          <CardDescription className="text-amber-700">
            Visual overview of your attendance, leaves, and working hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardAttendanceCalendar userId={user.id} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/dashboard/attendance">
          <Card className="border-amber-200 bg-white/80 backdrop-blur hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-amber-900">Mark Attendance</CardTitle>
              <CardDescription className="text-amber-700">Clock in for today's attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-700">Track your daily attendance and working hours</p>
            </CardContent>
          </Card>
        </Link>

        {userData?.role === "admin" && (
          <Link href="/dashboard/users">
            <Card className="border-amber-200 bg-white/80 backdrop-blur hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-amber-900">Manage Users</CardTitle>
                <CardDescription className="text-amber-700">Add and manage employee accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-700">Create new users and manage existing ones</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  )
}
