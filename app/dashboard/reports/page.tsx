import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceReportTable } from "@/components/attendance-report-table"

export default async function ReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  // Get current month for initial report
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // Get all users (admin only)
  let users = []
  if (userData?.role === "admin") {
    const { data: allUsers } = await supabase.from("users").select("*").order("full_name")
    users = allUsers || []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Attendance Reports</h1>
        <p className="text-amber-700 mt-2">
          {userData?.role === "admin"
            ? "View detailed attendance reports and export data"
            : "View your attendance report and calculate salary"}
        </p>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">Monthly Attendance Report</CardTitle>
          <CardDescription className="text-amber-700">
            Select a month to view detailed attendance and salary calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceReportTable
            currentUserId={user.id}
            currentUserData={userData}
            isAdmin={userData?.role === "admin"}
            allUsers={users}
            defaultYear={year}
            defaultMonth={month}
          />
        </CardContent>
      </Card>
    </div>
  )
}
