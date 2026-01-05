"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { mockLogout, getMockUser, enableMockAuth } from "@/lib/mock-auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, User, LogOut, Key, Users, CalendarCheck, FileText, Home, Calendar } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface NavBarProps {
  user: {
    email: string
    role: "admin" | "user"
    full_name: string
  }
}

export function NavBar({ user: initialUser }: NavBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState(initialUser)

  useEffect(() => {
    if (enableMockAuth()) {
      const mockUser = getMockUser()
      if (mockUser) {
        setUser({
          email: mockUser.email,
          full_name: mockUser.full_name,
          role: mockUser.role,
        })
      } else {
        // No mock user found, redirect to login
        router.push("/auth/login")
      }
    }
  }, [router])

  const handleLogout = async () => {
    if (enableMockAuth()) {
      mockLogout()
      router.push("/auth/login")
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/auth/login")
    }
  }

  const handleResetPassword = () => {
    router.push("/dashboard/reset-password")
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/dashboard/leaves", label: "Leaves", icon: Calendar },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
    ...(user.role === "admin" ? [{ href: "/dashboard/users", label: "Users", icon: Users }] : []),
  ]

  return (
    <nav className="bg-gradient-to-r from-amber-700 to-orange-700 text-white shadow-md sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/images/image.jpeg" alt="Company Logo" width={40} height={40} className="object-contain" />
            <span className="text-xl font-semibold hidden sm:block">GCS Attendance</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                    pathname === item.href ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* Desktop User Menu */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-white/10 text-white">
                    <User className="h-5 w-5" />
                    <span className="text-sm">{user.full_name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-semibold">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-1">Role: {user.role}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {!enableMockAuth() && (
                    <DropdownMenuItem onClick={handleResetPassword}>
                      <Key className="mr-2 h-4 w-4" />
                      Reset Password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 bg-gradient-to-br from-amber-50 to-orange-50">
                  <div className="flex flex-col gap-6 mt-8">
                    <div className="border-b border-amber-200 pb-4">
                      <p className="font-semibold text-amber-900">{user.full_name}</p>
                      <p className="text-xs text-amber-700">{user.email}</p>
                      <p className="text-xs text-amber-700 capitalize mt-1">Role: {user.role}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {navItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                              pathname === item.href
                                ? "bg-amber-200 text-amber-900 font-semibold"
                                : "text-amber-800 hover:bg-amber-100"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>

                    <div className="border-t border-amber-200 pt-4 flex flex-col gap-2">
                      {!enableMockAuth() && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsOpen(false)
                            handleResetPassword()
                          }}
                          className="justify-start text-amber-800 hover:bg-amber-100"
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsOpen(false)
                          handleLogout()
                        }}
                        className="justify-start text-amber-800 hover:bg-amber-100"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
