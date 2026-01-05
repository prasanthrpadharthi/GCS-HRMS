import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">Leave Types Management</h1>
          <p className="text-amber-700 mt-2">Manage company leave types</p>
        </div>
      </div>

      <Card className="border-amber-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-amber-900">Leave Types</CardTitle>
          <CardDescription className="text-amber-700">Configure available leave types for employees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leaveTypes && leaveTypes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {leaveTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-4 rounded-lg border-2 ${
                      type.is_active
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-amber-900">{type.name}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          type.is_active
                            ? "bg-green-600 text-white"
                            : "bg-gray-400 text-white"
                        }`}
                      >
                        {type.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {type.description && (
                      <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                    )}
                    <div className="flex gap-2 items-center text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          type.is_paid
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {type.is_paid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-amber-700">
                <p>No leave types configured yet.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Leave types are pre-configured. You can manage them through the Supabase
          dashboard SQL editor. To add, update, or deactivate leave types, run SQL queries on the{" "}
          <code className="bg-amber-100 px-1 rounded">leave_types</code> table.
        </p>
      </div>
    </div>
  )
}
