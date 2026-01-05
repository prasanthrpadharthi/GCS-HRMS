"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { mockLogin, enableMockAuth } from "@/lib/mock-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (enableMockAuth()) {
        console.log("[v0] Using mock authentication mode")
        const mockUser = mockLogin(email, password)
        if (mockUser) {
          if (mockUser.must_change_password) {
            router.push("/auth/change-password")
          } else {
            router.push("/dashboard")
          }
        } else {
          throw new Error("Invalid email or password")
        }
        return
      }

      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Check if user must change password
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("must_change_password")
        .eq("id", data.user.id)
        .single()

      if (userError) throw userError

      if (userData?.must_change_password) {
        router.push("/auth/change-password")
      } else {
        router.push("/dashboard")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center mb-4">
            <Image src="/images/image.jpeg" alt="Company Logo" width={120} height={120} className="object-contain" />
          </div>
          {enableMockAuth() && (
            <div className="bg-amber-100 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm">
              <p className="font-semibold mb-1">Demo Mode Active</p>
              <p className="text-xs">Login with: admin@gcs.com / admin</p>
            </div>
          )}
          <Card className="border-amber-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-amber-900">Login</CardTitle>
              <CardDescription className="text-amber-700">
                Enter your credentials to access the attendance system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-amber-900">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@company.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-amber-200 focus:border-amber-400"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-amber-900">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-amber-200 focus:border-amber-400"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner />
                        Logging in...
                      </span>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </div>
                {!enableMockAuth() && (
                  <div className="mt-4 text-center text-sm text-amber-700">
                    Forgot your password?{" "}
                    <Link
                      href="/auth/forgot-password"
                      className="underline underline-offset-4 text-amber-800 font-medium"
                    >
                      Reset Password
                    </Link>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
