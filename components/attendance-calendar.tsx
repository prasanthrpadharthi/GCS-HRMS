"use client"

import { useState } from "react"
import type { Attendance, Leave } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useAlert } from "@/components/ui/alert-custom"
import { LoadingSpinner } from "@/components/ui/loading"
import { formatDateToString } from "@/lib/utils"

interface AttendanceCalendarProps {
  attendance: Attendance[]
  leaves: Leave[]
  userId: string
  initialMonth?: number
  initialYear?: number
}

export function AttendanceCalendar({ attendance: initialAttendance, leaves: initialLeaves, userId, initialMonth, initialYear }: AttendanceCalendarProps) {
  const { showAlert, showConfirm } = useAlert()
  const router = useRouter()
  const [attendance, setAttendance] = useState(initialAttendance)
  const [leaves, setLeaves] = useState(initialLeaves)
  const [selectedMonth, setSelectedMonth] = useState((initialMonth || new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState((initialYear || new Date().getFullYear()).toString())
  const [isLoading, setIsLoading] = useState(false)

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const year = parseInt(selectedYear)
      const month = parseInt(selectedMonth)
      
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      
      // Fetch attendance
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", formatDateToString(firstDay))
        .lte("date", formatDateToString(lastDay))
        .order("date", { ascending: false })
      
      // Fetch leaves
      const { data: leavesData } = await supabase
        .from("leaves")
        .select("*, leave_type:leave_types(*)")
        .eq("user_id", userId)
        .gte("from_date", formatDateToString(firstDay))
        .lte("to_date", formatDateToString(lastDay))
        .order("from_date", { ascending: false })
      
      setAttendance(attendanceData || [])
      setLeaves(leavesData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value)
  }

  const handleYearChange = (value: string) => {
    setSelectedYear(value)
  }

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
    const confirmed = await showConfirm("Delete Attendance", "Delete this attendance record? You can re-apply attendance or leave after deletion.")
    if (!confirmed) return

    try {
      const supabase = createClient()
      console.log("Deleting attendance ID:", attendanceId)
      
      const { data, error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendanceId)
        .select()

      console.log("Delete response data:", data)
      console.log("Delete response error:", error)

      if (error) {
        console.error("Delete error details:", JSON.stringify(error, null, 2))
        throw error
      }
      
      router.refresh()
    } catch (error) {
      console.error("Caught delete error:", error)
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  return (
    <div className="space-y-4">
      {/* Month and Year Selectors */}
      <div className="flex gap-4 items-center">
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[140px] border-amber-200">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px] border-amber-200">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={fetchData} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
          {isLoading ? "Loading..." : "Load"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {sortedAttendance.length === 0 && sortedLeaves.length === 0 ? (
            <p className="text-center text-amber-700 py-8">No attendance records for this period</p>
          ) : (
            <>
              {sortedAttendance.map((record) => {
            // Calculate hours worked and deficit
            let hoursWorked = 0
            let deficitHours = 0
            if (record.clock_in && record.clock_out) {
              const clockIn = new Date(`${record.date}T${record.clock_in}`)
              const clockOut = new Date(`${record.date}T${record.clock_out}`)
              const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
              hoursWorked = Math.max(0, totalHours - 1) // Subtract 1 hour lunch
              deficitHours = 8.5 - hoursWorked
            }

            return (
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
                  {record.clock_in && record.clock_out && (
                    <div className="flex gap-2 mt-1 text-xs">
                      <span className="text-blue-700 font-medium">{hoursWorked.toFixed(1)} hrs</span>
                      {deficitHours > 0 && (
                        <span className="text-red-600 font-medium">(-{deficitHours.toFixed(1)} hrs)</span>
                      )}
                      {deficitHours < 0 && (
                        <span className="text-green-600 font-medium">(+{Math.abs(deficitHours).toFixed(1)} hrs)</span>
                      )}
                    </div>
                  )}
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
            )
          })}

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
      )}
    </div>
  )
}
