"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import type { User } from "@/lib/types"

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

      // Get date range
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const startDate = firstDay.toISOString().split("T")[0]
      const endDate = lastDay.toISOString().split("T")[0]
      const daysInMonth = lastDay.getDate()

      // Get company settings for working days
      const { data: settings } = await supabase.from("company_settings").select("*").single()
      const weekendDays = settings?.weekend_days || ["Saturday", "Sunday"]
      const workingDays = calculateWorkingDays(year, month, weekendDays)

      // Determine which users to fetch
      const usersToProcess = selectedUserId === "all" ? allUsers : ([currentUserData].filter(Boolean) as User[])

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
          .select("*")
          .eq("user_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)

        // Calculate metrics
        const presentDays = attendance?.filter((a) => a.status === "present").length || 0
        const leaveDays = leaves?.length || 0
        const paidLeaveDays = leaves?.filter((l) => l.leave_type === "paid").length || 0
        const unpaidLeaveDays = leaves?.filter((l) => l.leave_type === "unpaid").length || 0
        const halfDays = leaves?.filter((l) => l.day_type === "half").length || 0
        const fullLeaveDays = leaveDays - halfDays
        const absentDays = workingDays - presentDays - fullLeaveDays - halfDays * 0.5

        // Calculate salary (Singapore MOM compliant)
        let calculatedSalary = 0
        if (user.salary) {
          const salaryPerDay = calculateSalaryPerDay(user.salary, workingDays)

          // Salary = (Present days + Paid leave days + (Half paid leaves * 0.5)) * Daily rate
          const paidFullDays = presentDays + paidLeaveDays
          const paidHalfDays = leaves?.filter((l) => l.leave_type === "paid" && l.day_type === "half").length || 0

          calculatedSalary = (paidFullDays + paidHalfDays * 0.5) * salaryPerDay
        }

        reports.push({
          user,
          totalDays: daysInMonth,
          workingDays,
          presentDays,
          absentDays,
          leaveDays,
          paidLeaveDays,
          unpaidLeaveDays,
          halfDays,
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
      "Absent Days",
      "Leave Days",
      "Paid Leaves",
      "Unpaid Leaves",
      "Half Days",
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
      data.absentDays.toFixed(1),
      data.leaveDays,
      data.paidLeaveDays,
      data.unpaidLeaveDays,
      data.halfDays,
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
        <div className="text-center py-8 text-amber-700">Loading report...</div>
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
                <TableHead className="text-amber-900 text-right">Absent</TableHead>
                <TableHead className="text-amber-900 text-right">Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Paid Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Unpaid Leaves</TableHead>
                <TableHead className="text-amber-900 text-right">Half Days</TableHead>
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
                  <TableCell className="text-right text-red-700 font-medium">{data.absentDays.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-amber-900">{data.leaveDays}</TableCell>
                  <TableCell className="text-right text-blue-700">{data.paidLeaveDays}</TableCell>
                  <TableCell className="text-right text-orange-700">{data.unpaidLeaveDays}</TableCell>
                  <TableCell className="text-right text-yellow-700">{data.halfDays}</TableCell>
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
        <p className="font-semibold mb-2">Singapore MOM Salary Calculation:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Daily Rate = Monthly Salary ÷ Number of Working Days in Month</li>
          <li>Calculated Salary = (Present Days + Paid Leave Days + Paid Half Days × 0.5) × Daily Rate</li>
          <li>Unpaid leaves are deducted from the calculated salary</li>
          <li>Weekends (Saturday & Sunday) are excluded from working days calculation</li>
        </ul>
      </div>
    </div>
  )
}
