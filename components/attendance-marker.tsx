"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Attendance, CompanySettings } from "@/lib/types"
import { LeaveApplyDialog } from "@/components/leave-apply-dialog"

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
  const router = useRouter()

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
          {currentTime.toLocaleDateString("en-SG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
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

      <div className="border-t border-amber-200 pt-4 text-sm text-amber-700">
        <p className="font-semibold mb-2 text-amber-900">Work Hours:</p>
        <p>Start: {settings?.work_start_time}</p>
        <p>End: {settings?.work_end_time}</p>
      </div>
    </div>
  )
}
