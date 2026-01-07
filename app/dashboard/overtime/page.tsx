"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { UserOvertimeRecording } from "@/components/user-overtime-recording"
import { AdminOvertimeReports } from "@/components/admin-overtime-reports"
import { redirect } from "next/navigation"
import { enableMockAuth, getMockUser } from "@/lib/mock-auth"

export default function OvertimePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        if (enableMockAuth()) {
          const mockUser = getMockUser()
          if (mockUser?.id) {
            setUserId(mockUser.id)
            setIsAdmin(mockUser.role === "admin")
          } else {
            redirect("/auth/login")
          }
        } else {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            redirect("/auth/login")
          }

          setUserId(user.id)

          const { data } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single()

          setIsAdmin(data?.role === "admin")
        }
      } catch (error) {
        console.error("Error checking user:", error)
        redirect("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  if (loading || !userId) {
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
        <h1 className="text-3xl font-bold text-gray-900">
          {isAdmin ? "Overtime Reports" : "Overtime Management"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isAdmin
            ? "View and manage employee overtime records with month-wise breakdown"
            : "Record and manage your overtime hours for weekends and holidays"}
        </p>
      </div>

      {isAdmin ? <AdminOvertimeReports /> : <UserOvertimeRecording userId={userId} />}
    </div>
  )
}
