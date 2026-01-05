import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LeaveAllocationTable } from "@/components/leave-allocation-table"

export default async function LeaveAllocationPage() {
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

  const currentYear = new Date().getFullYear()

  // Get all users except admins
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("role", "user")
    .order("full_name")

  // Get all active leave types
  const { data: leaveTypes } = await supabase
    .from("leave_types")
    .select("*")
    .eq("is_active", true)
    .order("name")

  // Get all leave balances for current year
  const { data: leaveBalances } = await supabase
    .from("leave_balances")
    .select("*, leave_type:leave_types(*), user:users!leave_balances_user_id_fkey(id, full_name, email)")
    .eq("year", currentYear)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Leave Allocation</h1>
        <p className="text-amber-700 mt-2">Manage employee leave balances for {currentYear}</p>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">Employee Leave Balances</CardTitle>
          <CardDescription className="text-amber-700">
            Allocate and manage leave balances for employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveAllocationTable
            users={users || []}
            leaveTypes={leaveTypes || []}
            leaveBalances={leaveBalances || []}
            currentYear={currentYear}
          />
        </CardContent>
      </Card>
    </div>
  )
}
