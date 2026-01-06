"use client"

import { useState } from "react"
import type { Attendance } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading"
import { useAlert } from "@/components/ui/alert-custom"
import { formatDateToString } from "@/lib/utils"

interface AdminAttendanceTableProps {
  initialAttendance: Attendance[]
  initialMonth: number
  initialYear: number
}

export function AdminAttendanceTable({ initialAttendance, initialMonth, initialYear }: AdminAttendanceTableProps) {
  const { showAlert, showConfirm } = useAlert()
  const [attendance, setAttendance] = useState(initialAttendance)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth.toString())
  const [selectedYear, setSelectedYear] = useState(initialYear.toString())
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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

  const years = Array.from({ length: 3 }, (_, i) => initialYear - i)

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

  const formatTime = (timeString: string | null | undefined) => {
    if (!timeString) return "-"
    const [hours, minutes] = timeString.split(":")
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const calculateWorkingHours = (clockIn: string | null | undefined, clockOut: string | null | undefined) => {
    if (!clockIn || !clockOut) return "-"
    
    const [inHours, inMinutes] = clockIn.split(":").map(Number)
    const [outHours, outMinutes] = clockOut.split(":").map(Number)
    
    const inTotalMinutes = inHours * 60 + inMinutes
    const outTotalMinutes = outHours * 60 + outMinutes
    
    const diffMinutes = outTotalMinutes - inTotalMinutes
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    
    return `${hours}h ${minutes}m`
  }

  const fetchAttendance = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const year = parseInt(selectedYear)
      const month = parseInt(selectedMonth)
      
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      
      const { data } = await supabase
        .from("attendance")
        .select("*, user:users!attendance_user_id_fkey(id, full_name, email)")
        .gte("date", formatDateToString(firstDay))
        .lte("date", formatDateToString(lastDay))
        .order("date", { ascending: false })
      
      setAttendance(data || [])
    } catch (error) {
      console.error("Error fetching attendance:", error)
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

  const handleDeleteAttendance = async (attendanceId: string, userName: string, date: string) => {
    const confirmed = await showConfirm("Delete Attendance", `Are you sure you want to delete attendance record for ${userName} on ${date}?`)
    if (!confirmed) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("attendance").delete().eq("id", attendanceId)

      if (error) throw error

      // Remove from local state
      setAttendance(attendance.filter(a => a.id !== attendanceId))
      router.refresh()
    } catch (error: unknown) {
      await showAlert("Error", error instanceof Error ? error.message : "An error occurred")
    }
  }

  // Group attendance by user
  const groupedAttendance = attendance.reduce((acc: any, record) => {
    const userName = record.user?.full_name || "Unknown User"
    if (!acc[userName]) {
      acc[userName] = []
    }
    acc[userName].push(record)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Month and Year Selectors */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="border-amber-300">
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
        </div>
        <div className="flex-1">
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="border-amber-300">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchAttendance} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
          {isLoading ? "Loading..." : "Load Records"}
        </Button>
      </div>

      {/* Attendance Tables */}
      {isLoading ? (
        <LoadingSpinner message="Loading attendance records..." />
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedAttendance).length === 0 ? (
            <div className="text-center py-8 text-amber-700">No attendance records found</div>
          ) : (
            Object.entries(groupedAttendance).map(([userName, records]: [string, any]) => (
            <div key={userName} className="border border-amber-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-amber-100 px-4 py-3 border-b border-amber-200">
                <h3 className="font-semibold text-amber-900">{userName}</h3>
                <p className="text-sm text-amber-700">{records[0]?.user?.email}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50">
                    <TableHead className="text-amber-900">Date</TableHead>
                    <TableHead className="text-amber-900">Clock In</TableHead>
                    <TableHead className="text-amber-900">Clock Out</TableHead>
                    <TableHead className="text-amber-900">Working Hours</TableHead>
                    <TableHead className="text-amber-900">Status</TableHead>
                    <TableHead className="text-amber-900 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record: Attendance) => (
                    <TableRow key={record.id} className="hover:bg-amber-50">
                      <TableCell className="text-amber-900 font-medium">
                        {new Date(record.date).toLocaleDateString("en-SG", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-amber-900">{formatTime(record.clock_in)}</TableCell>
                      <TableCell className="text-amber-900">{formatTime(record.clock_out)}</TableCell>
                      <TableCell className="text-amber-900 font-semibold">
                        {calculateWorkingHours(record.clock_in, record.clock_out)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.status)} variant="outline">
                          {record.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteAttendance(
                              record.id, 
                              userName, 
                              new Date(record.date).toLocaleDateString("en-GB")
                            )}
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
          ))
        )}
        </div>
      )}
    </div>
  )
}
