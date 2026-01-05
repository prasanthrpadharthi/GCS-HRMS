import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserManagementTable } from "@/components/user-management-table"

export default async function UsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userData?.role !== "admin") {
    redirect("/dashboard")
  }

  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">User Management</h1>
        <p className="text-amber-700 mt-2">Manage employee accounts and permissions</p>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">All Users</CardTitle>
          <CardDescription className="text-amber-700">Add, edit, or remove user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementTable users={users || []} />
        </CardContent>
      </Card>
    </div>
  )
}
