"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, Calendar, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Attendance, CompanySettings } from "@/lib/types"
import { LeaveApplyDialog } from "@/components/leave-apply-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface AttendanceMarkerProps {
  attendance: Attendance | null
  settings: CompanySettings | null
  userId: string
  today: string
}

export function AttendanceMarker({ attendance, settings, userId, today }: AttendanceMarkerProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [manualDate, setManualDate] = useState("")
  const [manualClockIn, setManualClockIn] = useState("")
  const [manualClockOut, setManualClockOut] = useState("")
  const router = useRouter()

  // Generate time options in 30-minute intervals from 9:00 AM to 7:00 PM
  const generateTimeOptions = () => {
    const times: string[] = []
    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 19 && minute > 0) break // Stop at 7:00 PM
        const hourStr = hour.toString().padStart(2, "0")
        const minuteStr = minute.toString().padStart(2, "0")
        const time24 = `${hourStr}:${minuteStr}`
        
        // Convert to 12-hour format for display
        const hour12 = hour > 12 ? hour - 12 : hour
        const ampm = hour >= 12 ? "PM" : "AM"
        const displayTime = `${hour12}:${minuteStr} ${ampm}`
        
        times.push(`${time24}|${displayTime}`)
      }
    }
    return times
  }

  const timeOptions = generateTimeOptions()

  // Get date range (current month and previous month)
  const getDateRange = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // Previous month's first day
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const minDate = new Date(prevYear, prevMonth, 1).toISOString().split("T")[0]
    
    // Current date
    const maxDate = now.toISOString().split("T")[0]
    
    return { minDate, maxDate }
  }

  const { minDate, maxDate } = getDateRange()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-SG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const canClockIn = () => {
    if (!settings) return false
    const now = new Date()
    const markFromTime = settings.mark_from_time
    const [hours, minutes] = markFromTime.split(":").map(Number)
    const allowedTime = new Date()
    allowedTime.setHours(hours, minutes, 0)

    return now >= allowedTime
  }

  const handleClockIn = async () => {
    if (!canClockIn()) {
      setError(`Clock in is only allowed from ${settings?.mark_from_time} onwards`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const now = new Date()
      const timeString = now.toTimeString().split(" ")[0]

      const { error: insertError } = await supabase.from("attendance").insert({
        user_id: userId,
        date: today,
        clock_in: timeString,
        status: "present",
      })

      if (insertError) throw insertError

      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClockOut = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const now = new Date()
      const timeString = now.toTimeString().split(" ")[0]

      const { error: updateError } = await supabase
        .from("attendance")
        .update({ clock_out: timeString })
        .eq("user_id", userId)
        .eq("date", today)

      if (updateError) throw updateError

      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualAttendance = async () => {
    if (!manualDate || !manualClockIn) {
      setError("Please select date and clock in time")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Check if attendance already exists for this date
      const { data: existingAttendance, error: fetchError } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", manualDate)
        .maybeSingle()

      // Ignore PGRST116 error (no rows returned)
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (existingAttendance) {
        // Delete existing attendance first
        const { error: deleteError } = await supabase
          .from("attendance")
          .delete()
          .eq("id", existingAttendance.id)

        if (deleteError) throw deleteError
      }

      // Insert new attendance record
      const attendanceData: any = {
        user_id: userId,
        date: manualDate,
        clock_in: manualClockIn,
        status: "present",
      }

      if (manualClockOut) {
        attendanceData.clock_out = manualClockOut
      }

      const { error: insertError } = await supabase.from("attendance").insert(attendanceData)

      if (insertError) throw insertError

      // Reset form and close dialog
      setManualDate("")
      setManualClockIn("")
      setManualClockOut("")
      setIsManualDialogOpen(false)
      
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const isWeekend = () => {
    const dayName = currentTime.toLocaleDateString("en-US", { weekday: "long" })
    return settings?.weekend_days.includes(dayName)
  }

  if (isWeekend()) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-amber-700">Today is a weekend. Enjoy your day off!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl font-bold text-amber-900 mb-2">{formatTime(currentTime)}</div>
        <p className="text-sm text-amber-700">
          {currentTime.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">{error}</p>}

      {!attendance ? (
        <div className="space-y-4">
          <Button
            onClick={handleClockIn}
            disabled={!canClockIn() || isLoading}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-14"
          >
            <Clock className="mr-2 h-5 w-5" />
            {isLoading ? "Clocking In..." : "Clock In"}
          </Button>
          {!canClockIn() && (
            <p className="text-sm text-amber-700 text-center">Clock in available from {settings?.mark_from_time}</p>
          )}
          <LeaveApplyDialog userId={userId} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900">Clocked In</span>
            </div>
            <p className="text-sm text-green-700">Clock In Time: {attendance.clock_in}</p>
            {attendance.clock_out && <p className="text-sm text-green-700">Clock Out Time: {attendance.clock_out}</p>}
          </div>

          {!attendance.clock_out && (
            <Button
              onClick={handleClockOut}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white h-14"
            >
              <Clock className="mr-2 h-5 w-5" />
              {isLoading ? "Clocking Out..." : "Clock Out"}
            </Button>
          )}

          {attendance.clock_out && (
            <div className="text-center py-2">
              <p className="text-sm text-amber-700">You have completed your attendance for today</p>
            </div>
          )}
        </div>
      )}

      {/* Manual Attendance Button */}
      <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full border-amber-300 text-amber-900 hover:bg-amber-50">
            <Plus className="mr-2 h-4 w-4" />
            <Calendar className="mr-2 h-4 w-4" />
            Mark Manual Attendance
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Mark Manual Attendance</DialogTitle>
            <DialogDescription>
              Mark attendance for any day in the current or previous month
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manual-date">Date</Label>
              <Input
                id="manual-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                You can select dates from previous month to today
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clock-in">Clock In Time *</Label>
              <Select value={manualClockIn} onValueChange={setManualClockIn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clock in time" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {timeOptions.map((time) => {
                    const [value, display] = time.split("|")
                    return (
                      <SelectItem key={value} value={value}>
                        {display}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clock-out">Clock Out Time (Optional)</Label>
              <Select value={manualClockOut} onValueChange={setManualClockOut}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clock out time" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {timeOptions.map((time) => {
                    const [value, display] = time.split("|")
                    return (
                      <SelectItem key={value} value={value}>
                        {display}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}

            <Button
              onClick={handleManualAttendance}
              disabled={isLoading || !manualDate || !manualClockIn}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isLoading ? "Marking Attendance..." : "Mark Attendance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-t border-amber-200 pt-4 text-sm text-amber-700">
        <p className="font-semibold mb-2 text-amber-900">Work Hours:</p>
        <p>Start: {settings?.work_start_time}</p>
        <p>End: {settings?.work_end_time}</p>
      </div>
    </div>
  )
}
