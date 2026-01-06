"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

type UpdateData = Record<string, any>

export async function updateUserByAdmin(userId: string, updateData: UpdateData) {
  try {
    const supabase = createAdminClient()

    // Ensure admin marks the user as email verified when updating
    const payload = { ...updateData, email_verified: true }

    const { error } = await supabase.from("users").update(payload).eq("id", userId)

    if (error) {
      console.error("Admin user update error:", error)
      return { success: false, error: error.message }
    }

    // Also update auth.users confirmation for consistency
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (authError) {
      console.error("Failed to update auth user confirmation:", authError)
      // Do not fail if this doesn't work; users table is primary for app logic
    }

    revalidatePath("/dashboard/users")

    return { success: true }
  } catch (err) {
    console.error("Unexpected error in updateUserByAdmin:", err)
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
