"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Clock, LogIn, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Attendance, CompanySettings } from "@/lib/types"

interface ClockPromptModalProps {
  attendance: Attendance | null
  settings: CompanySettings | null
  userId: string
  today: string
}

export function ClockPromptModal({ attendance, settings, userId, today }: ClockPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [promptType, setPromptType] = useState<"clock-in" | "clock-out" | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Check if we need to show the modal
    const checkAttendanceStatus = () => {
      // Don't show if settings are not loaded
      if (!settings) return

      const now = new Date()
      const markFromTime = settings.mark_from_time
      const [hours, minutes] = markFromTime.split(":").map(Number)
      const allowedTime = new Date()
      allowedTime.setHours(hours, minutes, 0)

      // Check if it's before the allowed clock-in time
      if (now < allowedTime) {
        return
      }

      // No attendance record at all - prompt to clock in
      if (!attendance) {
        setPromptType("clock-in")
        setIsOpen(true)
        return
      }

      // Has clock in but no clock out - prompt to clock out
      if (attendance.clock_in && !attendance.clock_out) {
        setPromptType("clock-out")
        setIsOpen(true)
        return
      }

      // Both clock in and clock out exist - don't show modal
      if (attendance.clock_in && attendance.clock_out) {
        setIsOpen(false)
        return
      }
    }

    // Only check once when component mounts
    const hasShownPrompt = sessionStorage.getItem(`clock-prompt-${today}`)
    if (!hasShownPrompt) {
      checkAttendanceStatus()
    }
  }, [attendance, settings, today])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-SG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const handleClockIn = async () => {
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

      // Mark that we've shown the prompt for today
      sessionStorage.setItem(`clock-prompt-${today}`, "true")
      setIsOpen(false)
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

      // Mark that we've shown the prompt for today
      sessionStorage.setItem(`clock-prompt-${today}`, "true")
      setIsOpen(false)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    // Mark that we've shown the prompt for today
    sessionStorage.setItem(`clock-prompt-${today}`, "true")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-900">
            <Clock className="h-5 w-5" />
            {promptType === "clock-in" ? "Clock In" : "Clock Out"}
          </DialogTitle>
          <DialogDescription className="text-amber-700">
            {promptType === "clock-in"
              ? "You haven't clocked in today. Would you like to clock in now?"
              : "You haven't clocked out yet. Would you like to clock out now?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center p-4 bg-amber-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-amber-700 mb-1">Current Time</div>
              <div className="text-2xl font-bold text-amber-900">{formatTime(currentTime)}</div>
              <div className="text-xs text-amber-600 mt-1">
                {currentTime.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
              disabled={isLoading}
            >
              Later
            </Button>
            <Button
              onClick={promptType === "clock-in" ? handleClockIn : handleClockOut}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  {promptType === "clock-in" ? (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Clock In
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Clock Out
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
