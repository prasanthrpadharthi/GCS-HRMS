"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useAlert } from "@/components/ui/alert-custom"
import type { User, LeaveType, LeaveBalance } from "@/lib/types"

interface LeaveAllocationTableProps {
  users: User[]
  leaveTypes: LeaveType[]
  leaveBalances: LeaveBalance[]
  currentYear: number
}

export function LeaveAllocationTable({
  users,
  leaveTypes,
  leaveBalances,
  currentYear,
}: LeaveAllocationTableProps) {
  const { showAlert, showConfirm } = useAlert()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    user_id: "",
    leave_type_id: "",
    total_days: "",
  })

  const resetForm = () => {
    setFormData({
      user_id: "",
      leave_type_id: "",
      total_days: "",
    })
    setEditingBalance(null)
    setError(null)
  }

  const handleOpenDialog = (balance?: LeaveBalance) => {
    if (balance) {
      setEditingBalance(balance)
      setFormData({
        user_id: balance.user_id,
        leave_type_id: balance.leave_type_id,
        total_days: balance.total_days.toString(),
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      if (editingBalance) {
        // Update existing balance
        const { error: updateError } = await supabase
          .from("leave_balances")
          .update({
            total_days: parseFloat(formData.total_days),
          })
          .eq("id", editingBalance.id)

        if (updateError) throw updateError
      } else {
        // Create new balance
        const { error: insertError } = await supabase.from("leave_balances").insert({
          user_id: formData.user_id,
          leave_type_id: formData.leave_type_id,
          year: currentYear,
          total_days: parseFloat(formData.total_days),
          used_days: 0,
        })

        if (insertError) throw insertError
      }

      setIsDialogOpen(false)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (balanceId: string) => {
    const confirmed = await showConfirm("Delete Allocation", "Are you sure you want to delete this leave allocation?")
    if (!confirmed) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("leave_balances").delete().eq("id", balanceId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error("Error deleting balance:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Group balances by user
  const balancesByUser = leaveBalances.reduce((acc, balance) => {
    if (!acc[balance.user_id]) {
      acc[balance.user_id] = []
    }
    acc[balance.user_id].push(balance)
    return acc
  }, {} as Record<string, LeaveBalance[]>)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-amber-700">
          Showing leave balances for {Object.keys(balancesByUser).length} employees
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Allocate Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBalance ? "Update Leave Balance" : "Allocate Leave"}</DialogTitle>
              <DialogDescription>
                {editingBalance
                  ? "Update the leave balance for the employee"
                  : `Assign leave balance to an employee for ${currentYear}`}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user_id">Employee *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  disabled={!!editingBalance}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leave_type_id">Leave Type *</Label>
                <Select
                  value={formData.leave_type_id}
                  onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
                  disabled={!!editingBalance}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_days">Total Days *</Label>
                <Input
                  id="total_days"
                  type="number"
                  step="0.5"
                  min="0"
                  max="365"
                  required
                  value={formData.total_days}
                  onChange={(e) => setFormData({ ...formData, total_days: e.target.value })}
                  placeholder="e.g., 12 or 10.5"
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Saving..." : editingBalance ? "Update Balance" : "Allocate Leave"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-amber-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-amber-50">
            <TableRow>
              <TableHead className="text-amber-900">Employee</TableHead>
              <TableHead className="text-amber-900">Email</TableHead>
              <TableHead className="text-amber-900">Leave Type</TableHead>
              <TableHead className="text-amber-900 text-right">Total Days</TableHead>
              <TableHead className="text-amber-900 text-right">Used Days</TableHead>
              <TableHead className="text-amber-900 text-right">Remaining</TableHead>
              <TableHead className="text-amber-900 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const userBalances = balancesByUser[user.id] || []
              if (userBalances.length === 0) {
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell colSpan={5} className="text-center text-amber-600 italic">
                      No leave allocated yet
                    </TableCell>
                  </TableRow>
                )
              }

              return userBalances.map((balance, index) => (
                <TableRow key={balance.id}>
                  {index === 0 && (
                    <>
                      <TableCell rowSpan={userBalances.length} className="font-medium">
                        {user.full_name}
                      </TableCell>
                      <TableCell rowSpan={userBalances.length}>{user.email}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {balance.leave_type?.name}
                      <Badge variant={balance.leave_type?.is_paid ? "default" : "secondary"} className="text-xs">
                        {balance.leave_type?.is_paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{balance.total_days}</TableCell>
                  <TableCell className="text-right">{balance.used_days}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        balance.remaining_days <= 0
                          ? "text-red-600 font-semibold"
                          : balance.remaining_days < 3
                          ? "text-orange-600 font-semibold"
                          : "text-green-600 font-semibold"
                      }
                    >
                      {balance.remaining_days}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDialog(balance)}
                        disabled={isLoading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(balance.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            })}
          </TableBody>
        </Table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-amber-700">
          <p>No employees found. Add employees first to allocate leave.</p>
        </div>
      )}
    </div>
  )
}
