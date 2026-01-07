"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminOvertimeReports } from "@/components/admin-overtime-reports"
import { redirect } from "next/navigation"
import { enableMockAuth, getMockUser } from "@/lib/mock-auth"

export default function AdminOvertimeReportsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (enableMockAuth()) {
          const mockUser = getMockUser()
          if (mockUser?.role !== "admin") {
            redirect("/dashboard/overtime")
          }
          setIsAdmin(true)
        } else {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            redirect("/auth/login")
          }

          const { data } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single()

          if (data?.role !== "admin") {
            redirect("/dashboard/overtime")
          }

          setIsAdmin(true)
        }
      } catch (error) {
        console.error("Error checking admin status:", error)
        redirect("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Overtime Reports</h1>
        <p className="text-muted-foreground mt-2">
          View and manage employee overtime records with month-wise breakdown
        </p>
      </div>

      <AdminOvertimeReports />
    </div>
  )
}
