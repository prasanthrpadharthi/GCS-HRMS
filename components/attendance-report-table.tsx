"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileDown } from "lucide-react"
import type { User, Holiday } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/loading"
import { formatDateToString } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

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
  overtimePay: number
  totalSalaryWithOvertime: number
  detailedAttendance?: DetailedAttendanceRecord[]
}

interface DetailedAttendanceRecord {
  date: string
  dayName: string
  clockIn: string | null
  clockOut: string | null
  totalHours: number
  status: string
  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string
  isOvertime: boolean
  overtimeHours?: number
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

      // Get holidays for the month
      const { data: holidaysData } = await supabase
        .from("holidays")
        .select("*")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate)
      
      const holidays: Holiday[] = holidaysData || []

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

        // Get overtime records
        const { data: overtimes } = await supabase
          .from("overtime")
          .select("*")
          .eq("user_id", user.id)
          .gte("overtime_date", startDate)
          .lte("overtime_date", endDate)
          .eq("status", "approved")  // Only count approved overtime

        // Calculate metrics
        const presentDays = attendance?.filter((a) => a.status === "present").length || 0
        
        // Count holidays as present days (excluding those that fall on weekends)
        let holidayCount = 0
        holidays.forEach((holiday) => {
          const holidayDate = holiday.holiday_date
          const holidayDateObj = new Date(holidayDate)
          const dayName = holidayDateObj.toLocaleDateString("en-US", { weekday: "long" })
          
          // Only count holidays that are not on weekends
          if (!weekendDays.includes(dayName)) {
            // Only count if there's no attendance record and no leave record for this date
            const hasAttendance = attendance?.some(a => a.date === holidayDate)
            const hasLeave = leaves?.some(l => {
              const fromDate = new Date(l.from_date)
              const toDate = new Date(l.to_date)
              const currentDate = new Date(holidayDate)
              return currentDate >= fromDate && currentDate <= toDate
            })
            
            if (!hasAttendance && !hasLeave) {
              holidayCount++
            }
          }
        })
        
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
        // For holidays: Add 8.5 hours by default
        let totalHoursWorked = 0
        let deficitHours = 0
        let paidLeaveHours = 0
        
        if (attendance) {
          attendance.forEach((record) => {
            if (record.clock_in && record.clock_out && record.status === "present") {
              const clockIn = new Date(`${record.date}T${record.clock_in}`)
              const clockOut = new Date(`${record.date}T${record.clock_out}`)
              const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
              
              // Check if there's a half-day paid leave on this date
              const leaveInfo = leavesByDate.get(record.date)
              const isHalfDayLeave = leaveInfo && !leaveInfo.isFullDay
              
              // Don't deduct lunch if hours ≤ 5 or half-day leave scenario
              const shouldDeductLunch = hoursWorked > 5 && !isHalfDayLeave
              const netHours = shouldDeductLunch ? Math.max(0, hoursWorked - 1) : hoursWorked
              
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
        
        // Add holidays as full day present (8.5 hours) by default
        holidays.forEach((holiday) => {
          const holidayDate = holiday.holiday_date
          const holidayDateObj = new Date(holidayDate)
          const dayName = holidayDateObj.toLocaleDateString("en-US", { weekday: "long" })
          
          // Skip if it's already a weekend
          if (!weekendDays.includes(dayName)) {
            // Only count if there's no attendance record and no leave record for this date
            const hasAttendance = attendance?.some(a => a.date === holidayDate)
            const hasLeave = leavesByDate.has(holidayDate)
            
            if (!hasAttendance && !hasLeave) {
              // Count holiday as full day present (8.5 hours) for payroll purposes
              totalHoursWorked += 8.5
              paidLeaveHours += 8.5
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

        const absentDays = Math.max(0, workingDays - presentDays - totalLeaveDays - holidayCount)

        // Calculate salary based on effective hours worked (Singapore MOM compliant)
        let calculatedSalary = 0
        if (user.salary) {
          const salaryPerDay = calculateSalaryPerDay(user.salary, workingDays)

          // Use effective days (based on total hours including paid leave hours)
          // Total hours already includes paid leave hours adjustment
          // Salary = Effective Days × Daily rate
          calculatedSalary = effectiveDays * salaryPerDay
        }

        // Calculate overtime pay (1.5x hourly rate)
        let overtimePay = 0
        if (user.salary && overtimes && overtimes.length > 0) {
          const salaryPerDay = calculateSalaryPerDay(user.salary, workingDays)
          const hourlyRate = salaryPerDay / 8.5
          const overtimeHourlyRate = hourlyRate * 1.5
          
          overtimes.forEach((ot) => {
            overtimePay += overtimeHourlyRate * ot.hours_worked
          })
        }

        const totalSalaryWithOvertime = calculatedSalary + overtimePay

        // Build detailed attendance records for PDF export
        const detailedAttendance: DetailedAttendanceRecord[] = []
        const attendanceMap = new Map(attendance?.map(a => [a.date, a]) || [])
        const overtimeMap = new Map(overtimes?.map(ot => [ot.overtime_date, ot]) || [])

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month - 1, day)
          const dateString = formatDateToString(date)
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
          const isWeekend = weekendDays.includes(dayName)

          // Find holiday for this date
          const holiday = holidays.find(h => h.holiday_date === dateString)
          const isHoliday = !!holiday

          // Find overtime for this date
          const overtime = overtimeMap.get(dateString)
          const isOvertime = !!overtime

          // Determine status and hours
          let clockIn = null
          let clockOut = null
          let totalHours = 0
          let status = ""

          if (isHoliday && holiday) {
            status = "Holiday"
            totalHours = 8.5
          } else if (isWeekend) {
            status = "Weekend"
          } else if (overtime && isOvertime) {
            status = "Overtime"
            totalHours = overtime.hours_worked
          } else {
            const attendanceRecord = attendanceMap.get(dateString)
            const leaveInfo = leavesByDate.get(dateString)

            if (attendanceRecord && attendanceRecord.clock_in && attendanceRecord.clock_out) {
              clockIn = attendanceRecord.clock_in
              clockOut = attendanceRecord.clock_out
              const clockInTime = new Date(`${dateString}T${clockIn}`)
              const clockOutTime = new Date(`${dateString}T${clockOut}`)
              let hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)

              const isHalfDayLeave = leaveInfo && !leaveInfo.isFullDay
              const shouldDeductLunch = hoursWorked > 5 && !isHalfDayLeave
              totalHours = shouldDeductLunch ? Math.max(0, hoursWorked - 1) : hoursWorked
              status = "Present"
            } else if (leaveInfo) {
              status = leaveInfo.isPaid ? "Paid Leave" : "Unpaid Leave"
              totalHours = leaveInfo.isPaid ? 8.5 : 0
            } else {
              status = "Absent"
            }
          }

          detailedAttendance.push({
            date: dateString,
            dayName,
            clockIn,
            clockOut,
            totalHours,
            status,
            isWeekend,
            isHoliday,
            holidayName: holiday?.holiday_name,
            isOvertime,
            overtimeHours: overtime?.hours_worked,
          })
        }

        reports.push({
          user,
          totalDays: daysInMonth,
          workingDays,
          presentDays: presentDays + holidayCount, // Add holidays to present days
          absentDays,
          leaveDays: totalLeaveDays,
          paidLeaveDays,
          unpaidLeaveDays,
          halfDays: 0, // This field can be removed or calculated properly if needed
          totalHoursWorked,
          effectiveDays,
          deficitHours,
          calculatedSalary,
          overtimePay,
          totalSalaryWithOvertime,
          detailedAttendance,
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
      "Overtime Pay (SGD)",
      "Total Salary With Overtime (SGD)",
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
      data.overtimePay.toFixed(2),
      data.totalSalaryWithOvertime.toFixed(2),
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

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-"
    const [hours, minutes] = timeString.split(":")
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const exportToPDF = async () => {
    const monthName = months.find((m) => m.value === selectedMonth)?.label
    const doc = new jsPDF("p", "mm", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let yPosition = margin

    // Load company logo
    try {
      const logoResponse = await fetch("/icon.svg")
      const logoSvg = await logoResponse.text()
      const logoUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(logoSvg)))

      // Add logo to top left
      doc.addImage(logoUrl, "SVG", margin, yPosition, 25, 25)
    } catch (error) {
      console.log("Logo not found, using text only")
    }

    // Company name header
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("General Commercial Services", margin + 30, yPosition + 8)

    // Report title
    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.text(`Attendance Report - ${monthName} ${selectedYear}`, margin, yPosition + 20)

    yPosition += 35

    // Generate PDF for each user
    for (const data of reportData) {
      // Check if we need a new page
      if (yPosition > 180) {
        doc.addPage()
        yPosition = margin
      }

      // Employee details section
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(245, 245, 245)
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 2, 2, "FD")

      yPosition += 8
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Employee Details:", margin + 5, yPosition)

      yPosition += 7
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`Name: ${data.user.full_name}`, margin + 5, yPosition)
      doc.text(`Email: ${data.user.email}`, margin + 80, yPosition)

      yPosition += 7
      doc.text(`Role: ${data.user.role}`, margin + 5, yPosition)
      doc.text(`Monthly Salary: ${data.user.salary ? `$${data.user.salary.toFixed(2)}` : "N/A"}`, margin + 80, yPosition)

      yPosition += 12

      // Summary section
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text(
        `Working Days: ${data.workingDays} | Present: ${data.presentDays} | Absent: ${data.absentDays.toFixed(1)} | Leaves: ${data.leaveDays} | Total Hours: ${data.totalHoursWorked.toFixed(1)} hrs`,
        margin,
        yPosition
      )

      yPosition += 8

      // Build table data
      if (data.detailedAttendance && data.detailedAttendance.length > 0) {
        const tableData = data.detailedAttendance.map((record) => [
          record.date,
          record.dayName,
          formatTime(record.clockIn),
          formatTime(record.clockOut),
          record.totalHours > 0 ? `${record.totalHours.toFixed(2)} hrs` : "-",
          record.status,
        ])

        // Add table using autoTable
        autoTable(doc, {
          startY: yPosition,
          head: [["Date", "Day", "From Time", "To Time", "Total Hours", "Status"]],
          body: tableData,
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            font: "helvetica",
          },
          headStyles: {
            fillColor: [245, 158, 11],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 25 }, // Day
            2: { cellWidth: 30 }, // From Time
            3: { cellWidth: 30 }, // To Time
            4: { cellWidth: 35 }, // Total Hours
            5: { cellWidth: 35 }, // Status
          },
          didParseCell: function (data) {
            // Color code status cells
            if (data.section === "body" && data.column.index === 5) {
              const status = data.cell.raw as string
              if (status === "Present" || status === "Holiday") {
                data.cell.styles.textColor = [34, 197, 94] // green
                data.cell.styles.fontStyle = "bold"
              } else if (status === "Absent") {
                data.cell.styles.textColor = [239, 68, 68] // red
                data.cell.styles.fontStyle = "bold"
              } else if (status === "Paid Leave") {
                data.cell.styles.textColor = [59, 130, 246] // blue
              } else if (status === "Unpaid Leave") {
                data.cell.styles.textColor = [249, 115, 22] // orange
              } else if (status === "Weekend") {
                data.cell.styles.textColor = [107, 114, 128] // gray
              } else if (status === "Overtime") {
                data.cell.styles.textColor = [168, 85, 247] // purple
                data.cell.styles.fontStyle = "bold"
              }
            }
          },
          // Add page footer
          didDrawPage: function () {
            doc.setFontSize(8)
            doc.setTextColor(150)
            doc.text(
              `Generated by GCS HRMS - ${new Date().toLocaleString()}`,
              pageWidth / 2,
              pageHeight - 5,
              { align: "center" }
            )
          },
        })

        yPosition = (doc as any).lastAutoTable.finalY + 15
      } else {
        yPosition += 5
      }

      // Add page break between users (except last user)
      if (data !== reportData[reportData.length - 1]) {
        doc.addPage()
        yPosition = margin
      }
    }

    // Save PDF
    const filename = `attendance_report_${monthName}_${selectedYear}.pdf`
    doc.save(filename)
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

        <Button
          onClick={exportToPDF}
          disabled={isLoading || reportData.length === 0}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
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
                <TableHead className="text-amber-900 text-right">Overtime Pay (1.5x)</TableHead>
                <TableHead className="text-amber-900 text-right">Total Salary (with OT)</TableHead>
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
                  <TableCell className="text-right font-bold text-orange-700">
                    ${data.overtimePay.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-purple-700 text-lg">
                    ${data.totalSalaryWithOvertime.toFixed(2)}
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
          <li><strong>Expected Hours:</strong> 8.5 hours per day (9:30 AM - 7:00 PM with 1 hour lunch break)</li>
          <li><strong>Total Hours Worked:</strong> Sum of all daily hours (Clock Out - Clock In - 1 hour lunch if hours &gt; 5)</li>
          <li><strong>Paid Leave Logic:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Full Day Paid Leave: Adds 8.5 hours to total hours worked</li>
              <li>Half Day Paid Leave: Adds remaining hours needed to reach 8.5 hours for that day</li>
              <li>Example: If employee works 4 hours and takes half-day paid leave, system adds 4.5 hours (8.5 - 4 = 4.5)</li>
            </ul>
          </li>
          <li><strong>Holiday Handling:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Public holidays are automatically counted as present days</li>
              <li>Each holiday adds 8.5 hours to total hours worked (counted as full day paid)</li>
              <li>Holidays are excluded from absent days calculation</li>
              <li>If an employee works on a holiday, the actual hours worked are counted instead</li>
              <li>Holidays falling on weekends are not counted as they're already non-working days</li>
            </ul>
          </li>
          <li><strong>Deficit Hours:</strong> Total hours short of expected hours (only counting shortfalls on non-leave days and non-holidays)</li>
          <li><strong>Effective Days Calculation:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Formula: Effective Days = Total Hours Worked (including paid leave and holidays) ÷ 8.5 hours</li>
              <li>Example: If total hours = 187 hours, then Effective Days = 187 ÷ 8.5 = 22 days</li>
              <li>This ensures employees are fairly compensated for partial days worked</li>
            </ul>
          </li>
          <li><strong>Daily Rate Calculation:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Formula: Daily Rate = Monthly Salary ÷ Number of Working Days in Month</li>
              <li>Working days exclude weekends (Saturday & Sunday by default)</li>
              <li>Example: If monthly salary is $3,000 and working days = 22, then Daily Rate = $136.36</li>
            </ul>
          </li>
          <li><strong>Final Salary Calculation:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Formula: Calculated Salary = Effective Days × Daily Rate</li>
              <li>This ensures pro-rated salary based on actual work performed</li>
              <li>Unpaid leaves reduce the effective days in the calculation</li>
              <li>Example: If Effective Days = 22 and Daily Rate = $136.36, then Salary = $3,000</li>
            </ul>
          </li>
          <li><strong>Overtime Pay:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Calculated at 1.5× the hourly rate (as per Singapore MOM guidelines)</li>
              <li>Hourly Rate = Daily Rate ÷ 8.5 hours</li>
              <li>Only approved overtime hours are included</li>
            </ul>
          </li>
          <li><strong>Important Notes:</strong>
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>All calculations follow Singapore Ministry of Manpower (MOM) guidelines</li>
              <li>Weekends are excluded from working days calculation</li>
              <li>Lunch breaks (1 hour) are automatically deducted if work hours exceed 5 hours</li>
              <li>Present Days count includes actual attendance + holidays (not on weekends)</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  )
}
