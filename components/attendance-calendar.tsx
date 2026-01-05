"use client"

import type { Attendance, Leave } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface AttendanceCalendarProps {
  attendance: Attendance[]
  leaves: Leave[]
  userId: string
}

export function AttendanceCalendar({ attendance, leaves, userId }: AttendanceCalendarProps) {
  const router = useRouter()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-300"
      case "absent":
        return "bg-red-100 text-red-800 border-red-300"
      case "leave":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "half_day":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-300"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-300"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  // Sort attendance by date descending (latest first)
  const sortedAttendance = [...attendance].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Sort leaves by from_date descending (latest first)
  const sortedLeaves = [...leaves].sort((a, b) => 
    new Date(b.from_date).getTime() - new Date(a.from_date).getTime()
  )

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!confirm("Delete this attendance record? You can re-apply attendance or leave after deletion.")) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendanceId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {sortedAttendance.length === 0 && sortedLeaves.length === 0 ? (
        <p className="text-center text-amber-700 py-8">No attendance records for this month</p>
      ) : (
        <>
          {sortedAttendance.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  {new Date(record.date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
                <div className="flex gap-2 mt-1 text-xs text-amber-700">
                  {record.clock_in && <span>In: {record.clock_in}</span>}
                  {record.clock_out && <span>Out: {record.clock_out}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(record.status)} variant="outline">
                  {record.status.replace("_", " ")}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  onClick={() => handleDeleteAttendance(record.id)}
                  title="Delete attendance"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {sortedLeaves.map((leave) => (
            <div
              key={leave.id}
              className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  {new Date(leave.from_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  {leave.from_date !== leave.to_date && (
                    <span> - {new Date(leave.to_date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}</span>
                  )}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {leave.leave_type?.name || "Leave"} - {leave.total_days} day{leave.total_days !== 1 ? "s" : ""}
                </p>
                {leave.reason && <p className="text-xs text-blue-600 mt-1">{leave.reason}</p>}
              </div>
              <div className="flex gap-2">
                <Badge className={getLeaveStatusColor(leave.status)} variant="outline">
                  {leave.status}
                </Badge>
                {leave.leave_type?.is_paid !== undefined && (
                  <Badge className={leave.leave_type.is_paid ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-orange-100 text-orange-800 border-orange-300"} variant="outline">
                    {leave.leave_type.is_paid ? "Paid" : "Unpaid"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
