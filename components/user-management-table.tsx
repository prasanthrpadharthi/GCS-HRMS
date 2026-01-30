"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { updateUserByAdmin } from "@/app/actions/update-user"
import { verifyUserEmail } from "@/app/actions/verify-email"
import { resetUserPassword } from "@/app/actions/reset-password"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Edit, CheckCircle, Key } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAlert } from "@/components/ui/alert-custom"
import type { User } from "@/lib/types"

interface UserManagementTableProps {
  users: User[]
}

export function UserManagementTable({ users }: UserManagementTableProps) {
  const { showAlert, showConfirm } = useAlert()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterVerified, setFilterVerified] = useState<"all" | "verified" | "unverified">("all")
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "user" as "admin" | "user",
    employment_type: "full_time" as "full_time" | "part_time",
    work_pass_type: "singaporean" as "singaporean" | "pr" | "ep" | "wp",
    salary: "",
    password: "",
  })

  const resetForm = () => {
    setFormData({
      email: "",
      full_name: "",
      role: "user",
      employment_type: "full_time",
      work_pass_type: "singaporean",
      salary: "",
      password: "",
    })
    setError(null)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
            employment_type: formData.employment_type,
            work_pass_type: formData.work_pass_type,
            must_change_password: true,
          },
          emailRedirectTo: `${window.location.origin}/auth/change-password`,
        },
      })

      if (authError) throw authError

      // The trigger will automatically create the user profile
      // Auto-verify the user's email since we're not using email provider
      if (authData.user) {
        // Verify email immediately using server action
        const verifyResult = await verifyUserEmail(authData.user.id)

        if (!verifyResult.success) {
          console.warn("Failed to auto-verify email:", verifyResult.error)
          // Don't fail the user creation, just log the warning
        }

        // Update salary and other fields
        const updateData: any = {}
        if (formData.salary) {
          updateData.salary = Number.parseFloat(formData.salary)
        }
        if (formData.employment_type) {
          updateData.employment_type = formData.employment_type
        }
        if (formData.work_pass_type) {
          updateData.work_pass_type = formData.work_pass_type
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("users")
            .update(updateData)
            .eq("id", authData.user.id)

          if (updateError) throw updateError
        }
      }

      await showAlert("Success", "User created and email verified successfully!")
      setIsAddOpen(false)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const updateData: Partial<User> = {
        full_name: formData.full_name,
        role: formData.role,
        employment_type: formData.employment_type,
        work_pass_type: formData.work_pass_type,
      }

      if (formData.salary) {
        updateData.salary = Number.parseFloat(formData.salary)
      }

      // Use server action to perform admin update + auto-verify
      const result = await updateUserByAdmin(selectedUser.id, updateData)

      if (!result.success) {
        console.error("Admin update failed:", result.error)
        throw new Error(result.error || "Failed to update user")
      }

      await showAlert("Success", "User updated successfully!")
      setIsEditOpen(false)
      setSelectedUser(null)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await showConfirm("Delete User", "Are you sure you want to delete this user?")
    if (!confirmed) return

    try {
      const supabase = createClient()

      // Delete from auth will cascade to users table
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      router.refresh()
    } catch (error: unknown) {
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  const handleVerifyEmail = async (userId: string) => {
    const confirmed = await showConfirm(
      "Verify User Email",
      "Are you sure you want to manually verify this user's email? This will allow them to access the system."
    )
    if (!confirmed) return

    try {
      // Call server action to verify email using admin API
      const result = await verifyUserEmail(userId)

      if (!result.success) {
        throw new Error(result.error || "Failed to verify email")
      }

      await showAlert("Success", "User email has been verified successfully.")
      router.refresh()
    } catch (error: unknown) {
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  const handleResetPassword = async (userId: string, userName: string) => {
    const confirmed = await showConfirm(
      "Reset User Password",
      `Are you sure you want to reset ${userName}'s password to the default password "gcs@123"? The user will need to change their password on next login.`
    )
    if (!confirmed) return

    try {
      // Call server action to reset password using admin API
      const result = await resetUserPassword(userId)

      if (!result.success) {
        throw new Error(result.error || "Failed to reset password")
      }

      await showAlert("Success", result.message || "Password has been reset to default: gcs@123")
    } catch (error: unknown) {
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      employment_type: user.employment_type || "full_time",
      work_pass_type: user.work_pass_type || "singaporean",
      salary: user.salary?.toString() || "",
      password: "",
    })
    setIsEditOpen(true)
  }

  // Filter users based on verification status
  const filteredUsers = users.filter((user) => {
    if (filterVerified === "all") return true
    if (filterVerified === "verified") return user.email_verified
    if (filterVerified === "unverified") return !user.email_verified
    return true
  })

  // Count unverified users
  const unverifiedCount = users.filter((user) => !user.email_verified).length

  return (
    <div className="space-y-4">
      {/* Header with filter and add button */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Select value={filterVerified} onValueChange={(value: any) => setFilterVerified(value)}>
            <SelectTrigger className="w-[200px] border-amber-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="verified">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Verified
                </span>
              </SelectItem>
              <SelectItem value="unverified">
                <span className="flex items-center gap-2">
                  Unverified ({unverifiedCount})
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm()
                setIsAddOpen(true)
              }}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gradient-to-br from-amber-50 to-orange-50">
            <DialogHeader>
              <DialogTitle className="text-amber-900">Add New User</DialogTitle>
              <DialogDescription className="text-amber-700">
                Create a new employee account. You can manually verify their email after creation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-amber-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="border-amber-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-amber-900">
                  Temporary Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="border-amber-200"
                />
                <p className="text-xs text-amber-700">User will be required to change this on first login</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-amber-900">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="border-amber-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-amber-900">
                  Role
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "user" })}
                >
                  <SelectTrigger className="border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employment_type" className="text-amber-900">
                  Employment Type
                </Label>
                <Select
                  value={formData.employment_type}
                  onValueChange={(value) => setFormData({ ...formData, employment_type: value as "full_time" | "part_time" })}
                >
                  <SelectTrigger className="border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time (8.5 hrs/day)</SelectItem>
                    <SelectItem value="part_time">Part Time (4.25 hrs/day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_pass_type" className="text-amber-900">
                  Work Pass Type
                </Label>
                <Select
                  value={formData.work_pass_type}
                  onValueChange={(value) => setFormData({ ...formData, work_pass_type: value as "singaporean" | "pr" | "ep" | "wp" })}
                >
                  <SelectTrigger className="border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singaporean">Singaporean</SelectItem>
                    <SelectItem value="pr">PR (Permanent Resident)</SelectItem>
                    <SelectItem value="ep">EP (Employment Pass)</SelectItem>
                    <SelectItem value="wp">WP (Work Permit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary" className="text-amber-900">
                  Monthly Salary (SGD) (Optional)
                </Label>
                <Input
                  id="salary"
                  type="number"
                  step="0.01"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="border-amber-200"
                  placeholder="0.00"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="border-amber-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                >
                  {isLoading ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-gradient-to-br from-amber-50 to-orange-50">
          <DialogHeader>
            <DialogTitle className="text-amber-900">Edit User</DialogTitle>
            <DialogDescription className="text-amber-700">Update user information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-amber-900">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                disabled
                className="border-amber-200 bg-amber-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-full_name" className="text-amber-900">
                Full Name
              </Label>
              <Input
                id="edit-full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="border-amber-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-amber-900">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "user" })}
              >
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-employment_type" className="text-amber-900">
                Employment Type
              </Label>
              <Select
                value={formData.employment_type}
                onValueChange={(value) => setFormData({ ...formData, employment_type: value as "full_time" | "part_time" })}
              >
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time (8.5 hrs/day)</SelectItem>
                  <SelectItem value="part_time">Part Time (4.25 hrs/day)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-work_pass_type" className="text-amber-900">
                Work Pass Type
              </Label>
              <Select
                value={formData.work_pass_type}
                onValueChange={(value) => setFormData({ ...formData, work_pass_type: value as "singaporean" | "pr" | "ep" | "wp" })}
              >
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="singaporean">Singaporean</SelectItem>
                  <SelectItem value="pr">PR (Permanent Resident)</SelectItem>
                  <SelectItem value="ep">EP (Employment Pass)</SelectItem>
                  <SelectItem value="wp">WP (Work Permit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-salary" className="text-amber-900">
                Monthly Salary (SGD)
              </Label>
              <Input
                id="edit-salary"
                type="number"
                step="0.01"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="border-amber-200"
                placeholder="0.00"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setSelectedUser(null)
                  resetForm()
                }}
                className="border-amber-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
              >
                {isLoading ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-100">
              <TableHead className="text-amber-900">Name</TableHead>
              <TableHead className="text-amber-900">Email</TableHead>
              <TableHead className="text-amber-900">Role</TableHead>
              <TableHead className="text-amber-900">Employment</TableHead>
              <TableHead className="text-amber-900">Work Pass</TableHead>
              <TableHead className="text-amber-900">Salary (SGD)</TableHead>
              <TableHead className="text-amber-900">Email Status</TableHead>
              <TableHead className="text-amber-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-amber-700">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-amber-50">
                <TableCell className="font-medium text-amber-900">{user.full_name}</TableCell>
                <TableCell className="text-amber-700">{user.email}</TableCell>
                <TableCell className="text-amber-700 capitalize">{user.role}</TableCell>
                <TableCell className="text-amber-700 capitalize">
                  {user.employment_type === "full_time" ? "Full Time" : "Part Time"}
                </TableCell>
                <TableCell className="text-amber-700">
                  {user.work_pass_type === "singaporean" ? "Singaporean" :
                   user.work_pass_type === "pr" ? "PR" :
                   user.work_pass_type === "ep" ? "EP" :
                   user.work_pass_type === "wp" ? "WP" : "-"}
                </TableCell>
                <TableCell className="text-amber-700">{user.salary ? `$${user.salary.toFixed(2)}` : "-"}</TableCell>
                <TableCell>
                  {user.email_verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                      ✓ Verified
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerifyEmail(user.id)}
                      className="text-xs h-7 border-amber-300 hover:bg-amber-50 text-amber-700"
                    >
                      Verify Email
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResetPassword(user.id, user.full_name)}
                      className="hover:bg-blue-100 text-blue-600"
                      title="Reset Password"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      className="hover:bg-amber-100 text-amber-700"
                      title="Edit User"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUser(user.id)}
                      className="hover:bg-red-100 text-red-600"
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
