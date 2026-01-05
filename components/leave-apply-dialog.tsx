"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import type { LeaveType } from "@/lib/types"

interface LeaveApplyDialogProps {
  userId: string
}

export function LeaveApplyDialog({ userId }: LeaveApplyDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const router = useRouter()

  const [formData, setFormData] = useState({
    from_date: "",
    to_date: "",
    from_session: "full" as "full" | "morning" | "afternoon",
    to_session: "full" as "full" | "morning" | "afternoon",
    leave_type_id: "",
    reason: "",
  })

  useEffect(() => {
    if (isOpen) {
      fetchLeaveTypes()
    }
  }, [isOpen])

  const fetchLeaveTypes = async () => {
    try {
      const supabase = createClient()
      const currentYear = new Date().getFullYear()
      
      // Try to get leave balances with leave types for current user
      const { data: balances, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*, leave_type:leave_types(*)")
        .eq("user_id", userId)
        .eq("year", currentYear)
        .gt("allocated_days", 0) // Only show types with allocation

      // If user has allocated balances, use those
      if (balances && balances.length > 0) {
        const types = balances.map(balance => balance.leave_type).filter(Boolean)
        setLeaveTypes(types as LeaveType[])
      } else {
        // Fallback: If no balances allocated, show all active leave types
        const { data: allTypes, error: typesError } = await supabase
          .from("leave_types")
          .select("*")
          .eq("is_active", true)
          .order("name")

        if (typesError) throw typesError
        setLeaveTypes(allTypes || [])
      }
    } catch (error) {
      console.error("Error fetching leave types:", error)
    }
  }

  const calculateTotalDays = () => {
    if (!formData.from_date || !formData.to_date) return 0

    const start = new Date(formData.from_date)
    const end = new Date(formData.to_date)
    
    if (end < start) return 0

    // Calculate total days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // Adjust for half days
    let totalDays = daysDiff
    
    if (formData.from_date === formData.to_date) {
      // Same day - check if half day
      if (formData.from_session !== "full" || formData.to_session !== "full") {
        totalDays = 0.5
      }
    } else {
      // Different days
      if (formData.from_session === "afternoon") {
        totalDays -= 0.5
      }
      if (formData.to_session === "morning") {
        totalDays -= 0.5
      }
    }

    return totalDays
  }

  const resetForm = () => {
    setFormData({
      from_date: "",
      to_date: "",
      from_session: "full",
      to_session: "full",
      leave_type_id: "",
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

      if (!formData.leave_type_id) {
        throw new Error("Please select a leave type")
      }

      const totalDays = calculateTotalDays()
      if (totalDays <= 0) {
        throw new Error("Invalid date range")
      }

      // Check for overlapping leaves
      const { data: existingLeaves } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", userId)
        .or(`and(from_date.lte.${formData.to_date},to_date.gte.${formData.from_date})`)

      if (existingLeaves && existingLeaves.length > 0) {
        throw new Error("Leave already applied for dates in this range")
      }

      // Insert leave application (auto-approved)
      const { error: insertError } = await supabase.from("leaves").insert({
        user_id: userId,
        leave_type_id: formData.leave_type_id,
        from_date: formData.from_date,
        to_date: formData.to_date,
        from_session: formData.from_session,
        to_session: formData.to_session,
        total_days: totalDays,
        reason: formData.reason,
        status: "approved",
        approved_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

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
      <DialogContent className="bg-gradient-to-br from-amber-50 to-orange-50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-900">Apply for Leave</DialogTitle>
          <DialogDescription className="text-amber-700">Fill in the details to apply for leave</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_date" className="text-amber-900">
                From Date *
              </Label>
              <Input
                id="from_date"
                type="date"
                required
                value={formData.from_date}
                onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="border-amber-200"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_date" className="text-amber-900">
                To Date *
              </Label>
              <Input
                id="to_date"
                type="date"
                required
                value={formData.to_date}
                onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="border-amber-200"
                min={formData.from_date || new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_session" className="text-amber-900">
                From Session
              </Label>
              <Select
                value={formData.from_session}
                onValueChange={(value) => setFormData({ ...formData, from_session: value as any })}
              >
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Day</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_session" className="text-amber-900">
                To Session
              </Label>
              <Select
                value={formData.to_session}
                onValueChange={(value) => setFormData({ ...formData, to_session: value as any })}
              >
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Day</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave_type_id" className="text-amber-900">
              Leave Type *
            </Label>
            <Select
              value={formData.leave_type_id}
              onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
            >
              <SelectTrigger className="border-amber-200">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} {!type.is_paid && "(Unpaid)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-amber-900">
              Reason
            </Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for leave (optional)"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="border-amber-200 resize-none"
              rows={3}
            />
          </div>

          {formData.from_date && formData.to_date && (
            <div className="bg-amber-100 p-3 rounded-lg">
              <p className="text-sm font-semibold text-amber-900">
                Total Days: {calculateTotalDays()}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
          >
            {isLoading ? "Submitting..." : "Submit Leave Application"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
