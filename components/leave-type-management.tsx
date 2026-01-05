"use client"

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
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAlert } from "@/components/ui/alert-custom"
import type { LeaveType } from "@/lib/types"

interface LeaveTypeManagementProps {
  leaveTypes: LeaveType[]
}

export function LeaveTypeManagement({ leaveTypes }: LeaveTypeManagementProps) {
  const { showAlert, showConfirm } = useAlert()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<LeaveType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_paid: true,
    is_active: true,
  })

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_paid: true,
      is_active: true,
    })
    setError(null)
  }

  const handleAddLeaveType = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: insertError } = await supabase.from("leave_types").insert({
        name: formData.name,
        description: formData.description,
        is_paid: formData.is_paid,
        is_active: formData.is_active,
      })

      if (insertError) throw insertError

      setIsAddOpen(false)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditLeaveType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType) return

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      console.log("Attempting to update leave type:", selectedType.id)
      console.log("Update data:", {
        name: formData.name,
        description: formData.description,
        is_paid: formData.is_paid,
        is_active: formData.is_active,
      })

      const { data, error: updateError } = await supabase
        .from("leave_types")
        .update({
          name: formData.name,
          description: formData.description,
          is_paid: formData.is_paid,
          is_active: formData.is_active,
        })
        .eq("id", selectedType.id)
        .select()

      console.log("Update response data:", data)
      console.log("Update response error:", updateError)

      if (updateError) {
        console.error("Leave type update error:", updateError)
        console.error("Error details:", JSON.stringify(updateError, null, 2))
        console.error("Error code:", updateError.code)
        console.error("Error message:", updateError.message)
        console.error("Error hint:", updateError.hint)
        console.error("Error details:", updateError.details)
        throw new Error(updateError.message || "Failed to update leave type")
      }

      setIsEditOpen(false)
      setSelectedType(null)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      console.error("Caught error type:", typeof error)
      console.error("Error updating leave type:", error)
      if (error instanceof Error) {
        console.error("Error name:", error.name)
        console.error("Error stack:", error.stack)
      }
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteLeaveType = async (typeId: string) => {
    const confirmed = await showConfirm("Delete Leave Type", "Are you sure you want to delete this leave type?")
    if (!confirmed) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("leave_types").delete().eq("id", typeId)

      if (error) throw error

      router.refresh()
    } catch (error: unknown) {
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  const openEditDialog = (type: LeaveType) => {
    setSelectedType(type)
    setFormData({
      name: type.name,
      description: type.description || "",
      is_paid: type.is_paid,
      is_active: type.is_active,
    })
    setIsEditOpen(true)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Leave Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-amber-900">Add New Leave Type</DialogTitle>
              <DialogDescription className="text-amber-700">Create a new leave type for employees</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLeaveType} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-amber-900">
                  Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="border-amber-300"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-amber-900">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="border-amber-300"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_paid"
                    checked={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                    className="rounded border-amber-300"
                  />
                  <Label htmlFor="is_paid" className="text-amber-900">
                    Paid Leave
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-amber-300"
                  />
                  <Label htmlFor="is_active" className="text-amber-900">
                    Active
                  </Label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false)
                    resetForm()
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  {isLoading ? "Adding..." : "Add Leave Type"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-900">Edit Leave Type</DialogTitle>
            <DialogDescription className="text-amber-700">Update leave type details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditLeaveType} className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-amber-900">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="border-amber-300"
              />
            </div>

            <div>
              <Label htmlFor="edit-description" className="text-amber-900">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-amber-300"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_paid"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  className="rounded border-amber-300"
                />
                <Label htmlFor="edit-is_paid" className="text-amber-900">
                  Paid Leave
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-amber-300"
                />
                <Label htmlFor="edit-is_active" className="text-amber-900">
                  Active
                </Label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setSelectedType(null)
                  resetForm()
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 bg-amber-600 hover:bg-amber-700">
                {isLoading ? "Updating..." : "Update Leave Type"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-100">
              <TableHead className="text-amber-900">Name</TableHead>
              <TableHead className="text-amber-900">Description</TableHead>
              <TableHead className="text-amber-900">Type</TableHead>
              <TableHead className="text-amber-900">Status</TableHead>
              <TableHead className="text-amber-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.map((type) => (
              <TableRow key={type.id} className="hover:bg-amber-50">
                <TableCell className="font-medium text-amber-900">{type.name}</TableCell>
                <TableCell className="text-amber-700">{type.description || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={type.is_paid ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-orange-100 text-orange-800 border-orange-300"}
                  >
                    {type.is_paid ? "Paid" : "Unpaid"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={type.is_active ? "bg-green-100 text-green-800 border-green-300" : "bg-gray-100 text-gray-800 border-gray-300"}
                  >
                    {type.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-700"
                      onClick={() => openEditDialog(type)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteLeaveType(type.id)}
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
