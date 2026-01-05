import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NavBar } from "@/components/nav-bar"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { enableMockAuth } from "@/lib/mock-auth"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userData: { email: string; full_name: string; role: "admin" | "user" } | null = null

  if (enableMockAuth()) {
    // Mock authentication mode - check localStorage on client
    // Since this is server-side, we'll need to handle it differently
    // For now, we'll allow access and let the NavBar component handle mock user display
    userData = {
      email: "Loading...",
      full_name: "Loading...",
      role: "user",
    }
  } else {
    const supabase = await createClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      redirect("/auth/login")
    }

    const { data: dbUserData } = await supabase
      .from("users")
      .select("email, full_name, role")
      .eq("id", user.id)
      .single()

    if (!dbUserData) {
      redirect("/auth/login")
    }

    userData = dbUserData
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <NavBar user={userData} />
      <main className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
      <PWAInstallPrompt />
    </div>
  )
}
