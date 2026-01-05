"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Plus, Trash2, Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import type { User } from "@/lib/types"

interface UserManagementTableProps {
  users: User[]
}

export function UserManagementTable({ users }: UserManagementTableProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "user" as "admin" | "user",
    salary: "",
    password: "",
  })

  const resetForm = () => {
    setFormData({
      email: "",
      full_name: "",
      role: "user",
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
            must_change_password: true,
          },
          emailRedirectTo: `${window.location.origin}/auth/change-password`,
        },
      })

      if (authError) throw authError

      // The trigger will automatically create the user profile
      // But we need to update salary if provided
      if (authData.user && formData.salary) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ salary: Number.parseFloat(formData.salary) })
          .eq("id", authData.user.id)

        if (updateError) throw updateError
      }

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
      }

      if (formData.salary) {
        updateData.salary = Number.parseFloat(formData.salary)
      }

      const { error: updateError } = await supabase.from("users").update(updateData).eq("id", selectedUser.id)

      if (updateError) throw updateError

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
    if (!confirm("Are you sure you want to delete this user?")) return

    try {
      const supabase = createClient()

      // Delete from auth will cascade to users table
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      router.refresh()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      salary: user.salary?.toString() || "",
      password: "",
    })
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
                Create a new employee account. They will receive an email to verify their account.
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
              <TableHead className="text-amber-900">Salary (SGD)</TableHead>
              <TableHead className="text-amber-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-amber-50">
                <TableCell className="font-medium text-amber-900">{user.full_name}</TableCell>
                <TableCell className="text-amber-700">{user.email}</TableCell>
                <TableCell className="text-amber-700 capitalize">{user.role}</TableCell>
                <TableCell className="text-amber-700">{user.salary ? `$${user.salary.toFixed(2)}` : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      className="hover:bg-amber-100 text-amber-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUser(user.id)}
                      className="hover:bg-red-100 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
