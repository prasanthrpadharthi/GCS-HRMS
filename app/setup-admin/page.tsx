"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function SetupAdminPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleCreateAdmin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: "admin@gcs.com",
        password: "admin",
        options: {
          data: {
            full_name: "Administrator",
            role: "admin",
            must_change_password: true,
          },
          emailRedirectTo: `${window.location.origin}/auth/change-password`,
        },
      })

      if (signUpError) throw signUpError

      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center mb-4">
            <Image src="/images/image.jpeg" alt="Company Logo" width={120} height={120} className="object-contain" />
          </div>
          <Card className="border-amber-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-amber-900">Setup Admin Account</CardTitle>
              <CardDescription className="text-amber-700">
                Create the default administrator account to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-900">
                    <p className="font-semibold mb-2">Admin account created successfully!</p>
                    <p className="text-sm">Email: admin@gcs.com</p>
                    <p className="text-sm">Password: admin</p>
                    <p className="text-sm mt-2">Redirecting to login...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-900 text-sm">
                    <p className="font-semibold mb-2">Default Admin Credentials:</p>
                    <p>Email: admin@gcs.com</p>
                    <p>Password: admin</p>
                    <p className="mt-2 text-xs">You will be required to change the password on first login</p>
                  </div>

                  {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

                  <Button
                    onClick={handleCreateAdmin}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  >
                    {isLoading ? "Creating Admin..." : "Create Admin Account"}
                  </Button>

                  <div className="text-center">
                    <Button
                      variant="link"
                      onClick={() => router.push("/auth/login")}
                      className="text-amber-700 hover:text-amber-800"
                    >
                      Already have an account? Login
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
