"use client"

import type { Attendance } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface AllUsersAttendanceTableProps {
  attendance: Attendance[]
}

export function AllUsersAttendanceTable({ attendance }: AllUsersAttendanceTableProps) {
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

  // Group attendance by user
  const groupedAttendance = attendance.reduce((acc: any, record) => {
    const userName = record.user?.full_name || "Unknown User"
    if (!acc[userName]) {
      acc[userName] = []
    }
    acc[userName].push(record)
    return acc
  }, {})

  // Sort each user's records by date descending (latest first)
  Object.keys(groupedAttendance).forEach(userName => {
    groupedAttendance[userName].sort((a: Attendance, b: Attendance) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  })

  return (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  )
}
