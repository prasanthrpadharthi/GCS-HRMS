import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LeaveManagementTable } from "@/components/leave-management-table"
import { Badge } from "@/components/ui/badge"
import { LeaveApplyDialog } from "@/components/leave-apply-dialog"

export default async function LeavesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  const currentYear = new Date().getFullYear()

  // Get leaves based on role
  let leavesQuery = supabase
    .from("leaves")
    .select("*, leave_type:leave_types(*), user:users(id, full_name, email)")
    .order("from_date", { ascending: false })

  if (userData?.role !== "admin") {
    leavesQuery = leavesQuery.eq("user_id", user.id)
  }

  const { data: leaves, error: leavesError } = await leavesQuery

  // Log error for debugging (remove in production)
  if (leavesError) {
    console.error("Error fetching leaves:", leavesError)
  }

  // Get leave balances for current user
  let leaveBalances = null
  if (userData?.role !== "admin") {
    const { data } = await supabase
      .from("leave_balances")
      .select("*, leave_type:leave_types(*)")
      .eq("user_id", user.id)
      .eq("year", currentYear)

    leaveBalances = data
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">Leave Management</h1>
          <p className="text-amber-700 mt-2">
            {userData?.role === "admin" ? "View and manage all employee leaves" : "View your leave history and balances"}
          </p>
        </div>
        {userData?.role !== "admin" && (
          <div className="w-64">
            <LeaveApplyDialog userId={user.id} />
          </div>
        )}
      </div>

      {userData?.role !== "admin" && leaveBalances && leaveBalances.length > 0 && (
        <Card className="border-amber-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-amber-900">Your Leave Balances ({currentYear})</CardTitle>
            <CardDescription className="text-amber-700">Available leave days by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {leaveBalances.map((balance: any) => (
                <div key={balance.id} className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-amber-900">{balance.leave_type?.name}</h3>
                    <Badge variant={balance.leave_type?.is_paid ? "default" : "secondary"} className="text-xs">
                      {balance.leave_type?.is_paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Total:</span>
                      <span className="font-semibold text-amber-900">{balance.total_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Used:</span>
                      <span className="font-semibold text-orange-600">{balance.used_days} days</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1">
                      <span className="text-amber-700">Remaining:</span>
                      <span className={`font-bold ${
                        balance.remaining_days <= 0 ? "text-red-600" :
                        balance.remaining_days < 3 ? "text-orange-600" :
                        "text-green-600"
                      }`}>
                        {balance.remaining_days} days
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">{userData?.role === "admin" ? "All Leave Requests" : "My Leave Requests"}</CardTitle>
          <CardDescription className="text-amber-700">
            {userData?.role === "admin" ? "Review and approve/reject leave requests" : "Your leave application history"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveManagementTable leaves={leaves || []} isAdmin={userData?.role === "admin"} currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  )
}
