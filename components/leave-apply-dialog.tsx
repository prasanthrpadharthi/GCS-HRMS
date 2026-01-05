"use client"

import type React from "react"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface LeaveApplyDialogProps {
  userId: string
}

export function LeaveApplyDialog({ userId }: LeaveApplyDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    date: "",
    leave_type: "paid" as "paid" | "unpaid",
    day_type: "full" as "full" | "half",
    reason: "",
  })

  const resetForm = () => {
    setFormData({
      date: "",
      leave_type: "paid",
      day_type: "full",
      reason: "",
    })
    setError(null)
  }

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Check if leave already exists for this date
      const { data: existingLeave } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", userId)
        .eq("date", formData.date)
        .single()

      if (existingLeave) {
        throw new Error("Leave already applied for this date")
      }

      // Check if attendance exists for this date
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", formData.date)
        .single()

      if (existingAttendance) {
        throw new Error("Attendance already marked for this date")
      }

      // Insert leave
      const { error: insertError } = await supabase.from("leaves").insert({
        user_id: userId,
        date: formData.date,
        leave_type: formData.leave_type,
        day_type: formData.day_type,
        reason: formData.reason,
      })

      if (insertError) throw insertError

      // Also create an attendance record with status leave
      await supabase.from("attendance").insert({
        user_id: userId,
        date: formData.date,
        status: formData.day_type === "half" ? "half_day" : "leave",
      })

      setIsOpen(false)
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-amber-300 hover:bg-amber-50 text-amber-900 bg-transparent"
          onClick={() => {
            resetForm()
            setIsOpen(true)
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          Apply for Leave
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-amber-50 to-orange-50">
        <DialogHeader>
          <DialogTitle className="text-amber-900">Apply for Leave</DialogTitle>
          <DialogDescription className="text-amber-700">Fill in the details to apply for leave</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date" className="text-amber-900">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="border-amber-200"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave_type" className="text-amber-900">
              Leave Type
            </Label>
            <Select
              value={formData.leave_type}
              onValueChange={(value) => setFormData({ ...formData, leave_type: value as "paid" | "unpaid" })}
            >
              <SelectTrigger className="border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid Leave</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="day_type" className="text-amber-900">
              Day Type
            </Label>
            <Select
              value={formData.day_type}
              onValueChange={(value) => setFormData({ ...formData, day_type: value as "full" | "half" })}
            >
              <SelectTrigger className="border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Day</SelectItem>
                <SelectItem value="half">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-amber-900">
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="border-amber-200"
              placeholder="Enter reason for leave"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-amber-300"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            >
              {isLoading ? "Submitting..." : "Apply Leave"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
