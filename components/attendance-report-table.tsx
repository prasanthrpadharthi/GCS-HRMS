"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import type { User } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/loading"
import { formatDateToString } from "@/lib/utils"

interface AttendanceReportTableProps {
  currentUserId: string
  currentUserData: User | null
  isAdmin: boolean
  allUsers: User[]
  defaultYear: number
  defaultMonth: number
}

interface ReportData {
  user: User
  totalDays: number
  workingDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  halfDays: number
  totalHoursWorked: number
  effectiveDays: number
  deficitHours: number
  calculatedSalary: number
}

export function AttendanceReportTable({
  currentUserId,
  currentUserData,
  isAdmin,
  allUsers,
  defaultYear,
  defaultMonth,
}: AttendanceReportTableProps) {
  const [selectedYear, setSelectedYear] = useState(defaultYear.toString())
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth.toString())
  const [selectedUserId, setSelectedUserId] = useState(isAdmin ? "all" : currentUserId)
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Generate years (current year and 2 years back)
  const years = Array.from({ length: 3 }, (_, i) => defaultYear - i)
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

  useEffect(() => {
    fetchReportData()
  }, [selectedYear, selectedMonth, selectedUserId])

  const calculateWorkingDays = (year: number, month: number, weekendDays: string[]) => {
    const date = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    let workingDays = 0

    for (let day = 1; day <= daysInMonth; day++) {
      date.setDate(day)
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
      if (!weekendDays.includes(dayName)) {
        workingDays++
      }
    }

    return workingDays
  }

  const calculateSalaryPerDay = (monthlySalary: number, workingDays: number) => {
    // Singapore MOM: Daily rate = Monthly salary / Number of working days in the month
    return monthlySalary / workingDays
  }

  const fetchReportData = async () => {
    setIsLoading(true)

    try {
      const supabase = createClient()
      const year = Number.parseInt(selectedYear)
      const month = Number.parseInt(selectedMonth)

      // Get date range - use proper date formatting without timezone conversion
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const startDate = formatDateToString(firstDay)
      const endDate = formatDateToString(lastDay)
      const daysInMonth = lastDay.getDate()

      // Get company settings for working days
      const { data: settings } = await supabase.from("company_settings").select("*").single()
      const weekendDays = settings?.weekend_days || ["Saturday", "Sunday"]
      const workingDays = calculateWorkingDays(year, month, weekendDays)

      // Determine which users to fetch
      let usersToProcess: User[] = []
      if (selectedUserId === "all") {
        usersToProcess = allUsers
      } else {
        // Find the selected user from allUsers or use currentUserData
        const selectedUser = allUsers.find(u => u.id === selectedUserId) || currentUserData
        usersToProcess = selectedUser ? [selectedUser] : []
      }

      const reports: ReportData[] = []

      for (const user of usersToProcess) {
        // Get attendance records
        const { data: attendance } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)

        // Get leave records
        const { data: leaves } = await supabase
          .from("leaves")
          .select("*, leave_type:leave_types(*)")
          .eq("user_id", user.id)
          .gte("from_date", startDate)
          .lte("to_date", endDate)
          .eq("status", "approved")  // Only count approved leaves

        // Calculate metrics
        const presentDays = attendance?.filter((a) => a.status === "present").length || 0
        
        // Build a map of leaves by date for easy lookup
        const leavesByDate = new Map<string, { isPaid: boolean, isFullDay: boolean, session: string }>()
        
        leaves?.forEach((leave) => {
          const isPaid = leave.leave_type?.is_paid || false
          const fromDate = new Date(leave.from_date)
          const toDate = new Date(leave.to_date)
          const currentDate = new Date(fromDate)
          
          while (currentDate <= toDate) {
            const dateString = formatDateToString(currentDate)
            const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" })
            
            // Skip weekends
            if (!weekendDays.includes(dayName)) {
              let isFullDay = true
              let session = "full"
              
              // Check if it's a partial day
              if (leave.from_date === leave.to_date) {
                // Single day leave
                if (leave.from_session !== "full" || leave.to_session !== "full") {
                  isFullDay = false
                  session = leave.from_session
                }
              } else {
                // Multi-day leave - check first and last days
                if (formatDateToString(currentDate) === leave.from_date && leave.from_session === "afternoon") {
                  isFullDay = false
                  session = "afternoon"
                } else if (formatDateToString(currentDate) === leave.to_date && leave.to_session === "morning") {
                  isFullDay = false
                  session = "morning"
                }
              }
              
              leavesByDate.set(dateString, { isPaid, isFullDay, session })
            }
            
            currentDate.setDate(currentDate.getDate() + 1)
          }
        })
        
        // Calculate total hours worked (excluding 1 hour lunch break per day)
        // For paid leaves: Add 8.5 hours for full day, or remaining hours for half day
        let totalHoursWorked = 0
        let deficitHours = 0
        let paidLeaveHours = 0
        
        if (attendance) {
          attendance.forEach((record) => {
            if (record.clock_in && record.clock_out && record.status === "present") {
              const clockIn = new Date(`${record.date}T${record.clock_in}`)
              const clockOut = new Date(`${record.date}T${record.clock_out}`)
              const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
              // Subtract 1 hour for lunch break
              const netHours = Math.max(0, hoursWorked - 1)
              
              // Check if there's a half-day paid leave on this date
              const leaveInfo = leavesByDate.get(record.date)
              if (leaveInfo && leaveInfo.isPaid && !leaveInfo.isFullDay) {
                // Half day paid leave - add remaining hours to reach 8.5
                const remainingHours = Math.max(0, 8.5 - netHours)
                paidLeaveHours += remainingHours
                totalHoursWorked += netHours + remainingHours
              } else {
                totalHoursWorked += netHours
                
                // Calculate deficit for this day (8.5 expected - actual hours)
                const dayDeficit = 8.5 - netHours
                if (dayDeficit > 0) {
                  deficitHours += dayDeficit
                }
              }
            }
          })
        }
        
        // Add full day paid leaves as 8.5 hours each
        leaves?.forEach((leave) => {
          const isPaid = leave.leave_type?.is_paid || false
          
          if (isPaid) {
            const fromDate = new Date(leave.from_date)
            const toDate = new Date(leave.to_date)
            const currentDate = new Date(fromDate)
            
            while (currentDate <= toDate) {
              const dateString = formatDateToString(currentDate)
              const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" })
              
              // Skip weekends
              if (!weekendDays.includes(dayName)) {
                const leaveInfo = leavesByDate.get(dateString)
                
                // Only count if it's a full day leave AND there's no attendance record for this date
                const hasAttendance = attendance?.some(a => a.date === dateString)
                
                if (leaveInfo && leaveInfo.isFullDay && !hasAttendance) {
                  paidLeaveHours += 8.5
                  totalHoursWorked += 8.5
                }
              }
              
              currentDate.setDate(currentDate.getDate() + 1)
            }
          }
        })
        
        // Calculate effective days (total hours / 8.5 hours per day)
        const effectiveDays = totalHoursWorked > 0 ? totalHoursWorked / 8.5 : 0
        
        // Calculate total leave days excluding weekends (for display purposes)
        let totalLeaveDays = 0
        let paidLeaveDays = 0
        let unpaidLeaveDays = 0
        
        leaves?.forEach((leave) => {
          const isPaid = leave.leave_type?.is_paid || false
          
          // Recalculate leave days excluding weekends
          const fromDate = new Date(leave.from_date)
          const toDate = new Date(leave.to_date)
          let workingDaysInLeave = 0
          const currentDate = new Date(fromDate)
          
          while (currentDate <= toDate) {
            const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" })
            if (!weekendDays.includes(dayName)) {
              workingDaysInLeave++
            }
            currentDate.setDate(currentDate.getDate() + 1)
          }
          
          // Adjust for half days (from_session and to_session)
          let adjustedLeaveDays = workingDaysInLeave
          if (leave.from_date === leave.to_date) {
            // Same day leave
            if (leave.from_session !== "full" || leave.to_session !== "full") {
              adjustedLeaveDays = 0.5
            }
          } else {
            // Multi-day leave
            if (leave.from_session === "afternoon") {
              adjustedLeaveDays -= 0.5
            }
            if (leave.to_session === "morning") {
              adjustedLeaveDays -= 0.5
            }
          }
          
          totalLeaveDays += adjustedLeaveDays
          
          if (isPaid) {
            paidLeaveDays += adjustedLeaveDays
          } else {
            unpaidLeaveDays += adjustedLeaveDays
          }
        })

        const absentDays = Math.max(0, workingDays - presentDays - totalLeaveDays)

        // Calculate salary based on effective hours worked (Singapore MOM compliant)
        let calculatedSalary = 0
        if (user.salary) {
          const salaryPerDay = calculateSalaryPerDay(user.salary, workingDays)

          // Use effective days (based on total hours including paid leave hours)
          // Total hours already includes paid leave hours adjustment
          // Salary = Effective Days × Daily rate
          calculatedSalary = effectiveDays * salaryPerDay
        }

        reports.push({
          user,
          totalDays: daysInMonth,
          workingDays,
          presentDays,
          absentDays,
          leaveDays: totalLeaveDays,
          paidLeaveDays,
          unpaidLeaveDays,
          halfDays: 0, // This field can be removed or calculated properly if needed
          totalHoursWorked,
          effectiveDays,
          deficitHours,
          calculatedSalary,
        })
      }

      setReportData(reports)
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const monthName = months.find((m) => m.value === selectedMonth)?.label
    const filename = `attendance_report_${monthName}_${selectedYear}.csv`

    // CSV headers
    const headers = [
      "Employee Name",
      "Email",
      "Total Days",
      "Working Days",
      "Present Days",
      "Total Hours Worked",
      "Deficit Hours",
      "Effective Days",
      "Absent Days",
      "Leave Days",
      "Paid Leaves",
      "Unpaid Leaves",
      "Monthly Salary (SGD)",
      "Calculated Salary (SGD)",
    ]

    // CSV rows
    const rows = reportData.map((data) => [
      data.user.full_name,
      data.user.email,
      data.totalDays,
      data.workingDays,
      data.presentDays,
      data.totalHoursWorked.toFixed(2),
      data.deficitHours.toFixed(2),
      data.effectiveDays.toFixed(2),
      data.absentDays.toFixed(1),
      data.leaveDays,
      data.paidLeaveDays,
      data.unpaidLeaveDays,
      data.user.salary?.toFixed(2) || "N/A",
      data.calculatedSalary.toFixed(2),
    ])

    // Create CSV content
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-amber-900">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="border-amber-200">
              <SelectValue />
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

        <div className="space-y-2 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-amber-900">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="border-amber-200">
              <SelectValue />
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

        {isAdmin && (
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-amber-900">Employee</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={exportToCSV}
          disabled={isLoading || reportData.length === 0}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Generating attendance report..." />
      ) : reportData.length === 0 ? (
        <div className="text-center py-8 text-amber-700">No data available for selected period</div>
      ) : (
        <div className="border border-amber-200 rounded-lg overflow-x-auto bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-100">
                <TableHead className="text-amber-900">Employee</TableHead>
                <TableHead className="text-amber-900 text-right">Working Days</TableHead>
                <TableHead className="text-amber-900 text-right">Present</TableHead>
                <TableHead className="text-amber-900 text-right">Total Hours</TableHead>
                <TableHead className="text-amber-900 text-right">Deficit Hours</TableHead>
                <TableHead className="text-amber-900 text-right">Effective Days</TableHead>
                <TableHead className="text-amber-900 text-right">Absent</TableHead>
                <TableHead className="text-amber-900 text-right">Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Paid Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Unpaid Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Monthly Salary</TableHead>
                <TableHead className="text-amber-900 text-right">Calculated Salary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((data) => (
                <TableRow key={data.user.id} className="hover:bg-amber-50">
                  <TableCell className="text-amber-900">
                    <div>
                      <p className="font-medium">{data.user.full_name}</p>
                      <p className="text-xs text-amber-700">{data.user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-amber-900">{data.workingDays}</TableCell>
                  <TableCell className="text-right text-green-700 font-medium">{data.presentDays}</TableCell>
                  <TableCell className="text-right text-blue-700 font-medium">{data.totalHoursWorked.toFixed(1)} hrs</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    {data.deficitHours > 0 ? `${data.deficitHours.toFixed(1)} hrs` : '0 hrs'}
                  </TableCell>
                  <TableCell className="text-right text-green-700 font-bold">{data.effectiveDays.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-red-700 font-medium">{data.absentDays.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-amber-900">{data.leaveDays}</TableCell>
                  <TableCell className="text-right text-blue-700">{data.paidLeaveDays}</TableCell>
                  <TableCell className="text-right text-orange-700">{data.unpaidLeaveDays}</TableCell>
                  <TableCell className="text-right text-amber-900">
                    {data.user.salary ? `$${data.user.salary.toFixed(2)}` : "N/A"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    ${data.calculatedSalary.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">Singapore MOM Salary Calculation (Hours-Based with Paid Leave):</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Expected Hours: 8.5 hours per day (9:30 AM - 7:00 PM with 1 hour lunch break)</li>
          <li>Total Hours Worked: Sum of all daily hours (Clock Out - Clock In - 1 hour lunch)</li>
          <li><strong>Paid Leave Logic:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Full Day Paid Leave: Adds 8.5 hours to total hours worked</li>
              <li>Half Day Paid Leave: Adds remaining hours needed to reach 8.5 hours for that day</li>
              <li>Example: If employee works 4 hours and takes half-day paid leave, system adds 4.5 hours (8.5 - 4 = 4.5)</li>
            </ul>
          </li>
          <li>Deficit Hours: Total hours short of expected hours (only counting shortfalls on non-leave days)</li>
          <li>Effective Days = Total Hours Worked (including paid leave adjustments) ÷ 8.5 hours</li>
          <li>Daily Rate = Monthly Salary ÷ Number of Working Days in Month</li>
          <li>Calculated Salary = Effective Days × Daily Rate</li>
          <li>Unpaid leaves reduce the effective days in the calculation</li>
          <li>Weekends (Saturday & Sunday) are excluded from working days calculation</li>
        </ul>
      </div>
    </div>
  )
}
