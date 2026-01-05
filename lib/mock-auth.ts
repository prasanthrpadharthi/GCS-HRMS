// Mock authentication for testing without database setup
// This allows login with admin/admin credentials

export interface MockUser {
  id: string
  email: string
  full_name: string
  role: "admin" | "user"
  salary?: number
  must_change_password: boolean
}

const MOCK_USERS: Record<string, { password: string; user: MockUser }> = {
  "admin@gcs.com": {
    password: "admin",
    user: {
      id: "mock-admin-id",
      email: "admin@gcs.com",
      full_name: "System Administrator",
      role: "admin",
      salary: 5000,
      must_change_password: false,
    },
  },
  "user@gcs.com": {
    password: "user123",
    user: {
      id: "mock-user-id",
      email: "user@gcs.com",
      full_name: "Test User",
      role: "user",
      salary: 3000,
      must_change_password: false,
    },
  },
}

export function enableMockAuth(): boolean {
  // Mock auth is enabled if Supabase env vars are not available
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function mockLogin(email: string, password: string): MockUser | null {
  const userRecord = MOCK_USERS[email]
  if (userRecord && userRecord.password === password) {
    // Store in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_user", JSON.stringify(userRecord.user))
    }
    return userRecord.user
  }
  return null
}

export function mockLogout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mock_user")
  }
}

export function getMockUser(): MockUser | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mock_user")
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return null
}

export function updateMockUserPassword(newPassword: string): boolean {
  const user = getMockUser()
  if (user && typeof window !== "undefined") {
    // In mock mode, just update the stored user
    localStorage.setItem("mock_user", JSON.stringify({ ...user, must_change_password: false }))
    return true
  }
  return false
}
