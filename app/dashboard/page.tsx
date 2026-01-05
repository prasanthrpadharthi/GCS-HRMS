import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarCheck, Users, FileText, Calendar } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  // Get current month attendance count
  const currentDate = new Date()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  const { count: attendanceCount } = await supabase
    .from("attendance")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("date", firstDay.toISOString().split("T")[0])
    .lte("date", lastDay.toISOString().split("T")[0])
    .eq("status", "present")

  const { count: leaveCount } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("date", firstDay.toISOString().split("T")[0])
    .lte("date", lastDay.toISOString().split("T")[0])

  // Get total users count (admin only)
  let totalUsers = null
  if (userData?.role === "admin") {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true })
    totalUsers = count
  }

  return (
    <div className="space-y-6">
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
            <p className="text-xs text-amber-700 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Leaves Taken</CardTitle>
            <Calendar className="h-4 w-4 text-amber-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{leaveCount || 0}</div>
            <p className="text-xs text-amber-700 mt-1">This month</p>
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
