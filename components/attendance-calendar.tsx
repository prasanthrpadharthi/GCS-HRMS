"use client"

import type { Attendance, Leave } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

interface AttendanceCalendarProps {
  attendance: Attendance[]
  leaves: Leave[]
}

export function AttendanceCalendar({ attendance, leaves }: AttendanceCalendarProps) {
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

  const getLeaveTypeColor = (leaveType: string) => {
    return leaveType === "paid"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : "bg-orange-100 text-orange-800 border-orange-300"
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {attendance.length === 0 && leaves.length === 0 ? (
        <p className="text-center text-amber-700 py-8">No attendance records for this month</p>
      ) : (
        <>
          {attendance.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  {new Date(record.date).toLocaleDateString("en-SG", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <div className="flex gap-2 mt-1 text-xs text-amber-700">
                  {record.clock_in && <span>In: {record.clock_in}</span>}
                  {record.clock_out && <span>Out: {record.clock_out}</span>}
                </div>
              </div>
              <Badge className={getStatusColor(record.status)} variant="outline">
                {record.status.replace("_", " ")}
              </Badge>
            </div>
          ))}

          {leaves.map((leave) => (
            <div
              key={leave.id}
              className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  {new Date(leave.date).toLocaleDateString("en-SG", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {leave.reason && <p className="text-xs text-blue-700 mt-1">{leave.reason}</p>}
              </div>
              <div className="flex gap-2">
                <Badge className={getLeaveTypeColor(leave.leave_type)} variant="outline">
                  {leave.leave_type}
                </Badge>
                <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">
                  {leave.day_type}
                </Badge>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
