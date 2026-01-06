"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

/**
 * Server action to verify a user's email
 * This uses the Supabase admin API to update the auth.users table
 * Only accessible to admin users
 */
export async function verifyUserEmail(userId: string) {
  try {
    const supabase = createAdminClient()

    // Update the user's email confirmation status in auth
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (error) {
      console.error("Error verifying user email:", error)
      return { success: false, error: error.message }
    }

    // Also update our custom users table for consistency
    const { error: updateError } = await supabase
      .from("users")
      .update({ email_verified: true })
      .eq("id", userId)

    if (updateError) {
      console.error("Error updating users table:", updateError)
      // Don't fail the operation if this fails, auth is the source of truth
    }

    // Revalidate the users page
    revalidatePath("/dashboard/users")

    return { success: true, data }
  } catch (error) {
    console.error("Unexpected error in verifyUserEmail:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }
  }
}
