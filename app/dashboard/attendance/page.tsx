import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceMarker } from "@/components/attendance-marker"
import { AttendanceCalendar } from "@/components/attendance-calendar"
import { AdminAttendanceTable } from "@/components/admin-attendance-table"

export default async function AttendancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  // Get today's attendance
  const today = new Date().toISOString().split("T")[0]
  const { data: todayAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .single()

  // Get company settings
  const { data: settings } = await supabase.from("company_settings").select("*").single()

  // Get current month attendance
  const currentDate = new Date()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  // For admin, get all users' attendance; for users, only their own
  let monthAttendanceQuery = supabase
    .from("attendance")
    .select("*, user:users!attendance_user_id_fkey(id, full_name, email)")
    .gte("date", firstDay.toISOString().split("T")[0])
    .lte("date", lastDay.toISOString().split("T")[0])
    .order("date", { ascending: false })

  if (userData?.role !== "admin") {
    monthAttendanceQuery = monthAttendanceQuery.eq("user_id", user.id)
  }

  const { data: monthAttendance } = await monthAttendanceQuery

  let monthLeavesQuery = supabase
    .from("leaves")
    .select("*")
    .gte("from_date", firstDay.toISOString().split("T")[0])
    .lte("to_date", lastDay.toISOString().split("T")[0])

  if (userData?.role !== "admin") {
    monthLeavesQuery = monthLeavesQuery.eq("user_id", user.id)
  }

  const { data: monthLeaves } = await monthLeavesQuery

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Attendance</h1>
        <p className="text-amber-700 mt-2">
          {userData?.role === "admin" ? "View all employees' attendance" : "Mark your attendance and view your history"}
        </p>
      </div>

      {userData?.role !== "admin" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-amber-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-amber-900">Today's Attendance</CardTitle>
              <CardDescription className="text-amber-700">
                Clock in from {settings?.mark_from_time || "09:00"} onwards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceMarker attendance={todayAttendance} settings={settings} userId={user.id} today={today} />
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-amber-900">Attendance Calendar</CardTitle>
              <CardDescription className="text-amber-700">View your monthly attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceCalendar attendance={monthAttendance || []} leaves={monthLeaves || []} userId={user.id} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-amber-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-amber-900">All Employees Attendance</CardTitle>
            <CardDescription className="text-amber-700">Day-wise attendance records for all users with month selection</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminAttendanceTable 
              initialAttendance={monthAttendance || []} 
              initialMonth={currentDate.getMonth() + 1}
              initialYear={currentDate.getFullYear()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
