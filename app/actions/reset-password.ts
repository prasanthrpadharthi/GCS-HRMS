"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function resetUserPassword(userId: string) {
  try {
    const supabase = createAdminClient()
    const defaultPassword = "gcs@123"

    // Update user's password using admin API
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: defaultPassword,
      user_metadata: {
        must_change_password: true,
      },
    })

    if (error) {
      console.error("Password reset error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, message: "Password has been reset to default password." }
  } catch (err) {
    console.error("Unexpected error in resetUserPassword:", err)
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
