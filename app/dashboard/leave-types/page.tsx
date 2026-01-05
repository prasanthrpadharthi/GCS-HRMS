import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LeaveTypeManagement } from "@/components/leave-type-management"

export default async function LeaveTypesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userData?.role !== "admin") {
    redirect("/dashboard")
  }

  // Get all leave types
  const { data: leaveTypes } = await supabase.from("leave_types").select("*").order("name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Leave Types Management</h1>
        <p className="text-amber-700 mt-2">Manage company leave types and their properties</p>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">Leave Types</CardTitle>
          <CardDescription className="text-amber-700">Configure available leave types for employees</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveTypeManagement leaveTypes={leaveTypes || []} />
        </CardContent>
      </Card>
    </div>
  )
}
