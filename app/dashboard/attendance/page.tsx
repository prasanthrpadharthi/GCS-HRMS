import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceMarker } from "@/components/attendance-marker"
import { AttendanceCalendar } from "@/components/attendance-calendar"

export default async function AttendancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

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

  const { data: monthAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", firstDay.toISOString().split("T")[0])
    .lte("date", lastDay.toISOString().split("T")[0])
    .order("date", { ascending: false })

  const { data: monthLeaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", firstDay.toISOString().split("T")[0])
    .lte("date", lastDay.toISOString().split("T")[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Attendance</h1>
        <p className="text-amber-700 mt-2">Mark your attendance and view your history</p>
      </div>

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
            <AttendanceCalendar attendance={monthAttendance || []} leaves={monthLeaves || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
