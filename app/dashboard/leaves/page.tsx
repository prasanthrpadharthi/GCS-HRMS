import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LeaveManagementTable } from "@/components/leave-management-table"

export default async function LeavesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  // Get leaves based on role
  let leavesQuery = supabase.from("leaves").select("*, users(full_name, email)").order("date", { ascending: false })

  if (userData?.role !== "admin") {
    leavesQuery = leavesQuery.eq("user_id", user.id)
  }

  const { data: leaves } = await leavesQuery

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Leave Management</h1>
        <p className="text-amber-700 mt-2">
          {userData?.role === "admin" ? "View and manage all employee leaves" : "View your leave history"}
        </p>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">{userData?.role === "admin" ? "All Leaves" : "My Leaves"}</CardTitle>
          <CardDescription className="text-amber-700">
            {userData?.role === "admin" ? "Complete leave records for all employees" : "Your complete leave history"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveManagementTable leaves={leaves || []} isAdmin={userData?.role === "admin"} />
        </CardContent>
      </Card>
    </div>
  )
}
