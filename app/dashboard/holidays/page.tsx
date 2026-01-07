"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { HolidaysManagement } from "@/components/holidays-management"
import { redirect } from "next/navigation"
import { enableMockAuth, getMockUser } from "@/lib/mock-auth"

export default function HolidaysPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (enableMockAuth()) {
          const mockUser = getMockUser()
          setIsAdmin(mockUser?.role === "admin")
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

          setIsAdmin(data?.role === "admin")
        }
      } catch (error) {
        console.error("Error checking admin status:", error)
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
        <h1 className="text-3xl font-bold text-gray-900">Holidays Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage company holidays and view all holidays for the year
        </p>
      </div>

      <HolidaysManagement isAdmin={isAdmin} />
    </div>
  )
}
