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
    const margin = 15
    let yPosition = margin

    // Load company logo (PNG)
    try {
      const logoResponse = await fetch("/images/icon-512.jpg")
      const logoBlob = await logoResponse.blob()
      const logoUrl = URL.createObjectURL(logoBlob)

      // Add logo to top left
      doc.addImage(logoUrl, "JPEG", margin, yPosition, 25, 25)
      URL.revokeObjectURL(logoUrl)
    } catch (error) {
      console.log("Logo not found, using text only")
    }

    // Company name header
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(37, 99, 235) // Blue color
    doc.text("General Commercial Services", margin + 30, yPosition + 8)

    // Report title
    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    doc.text(`Attendance Report - ${monthName} ${selectedYear}`, margin + 40, yPosition + 20)

    yPosition += 35

    // Generate PDF for each user
    for (const data of reportData) {
      // Check if we need a new page
      if (yPosition > 170) {
        doc.addPage()
        yPosition = margin
      }

      // Employee details section
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(245, 245, 245)
      const detailsBoxHeight = isAdmin ? 35 : 28
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, detailsBoxHeight, 2, 2, "FD")

      yPosition += 8
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text("Employee Details:", margin + 5, yPosition)

      yPosition += 7
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`Name: ${data.user.full_name}`, margin + 5, yPosition)
      doc.text(`Email: ${data.user.email}`, margin + 80, yPosition)

      yPosition += 7
      doc.text(`Role: ${data.user.role}`, margin + 5, yPosition)

      // Only show salary for admin users
      if (isAdmin) {
        doc.text(`Monthly Salary: $${data.user.salary?.toFixed(2) || "N/A"}`, margin + 80, yPosition)
        yPosition += 5
      }

      yPosition += 5

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
            fillColor: [37, 99, 235], // Blue color
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
          didParseCell: function (tableData) {
            // Color code status cells
            if (tableData.section === "body" && tableData.column.index === 5) {
              const status = tableData.cell.raw as string
              if (status === "Present" || status === "Holiday") {
                tableData.cell.styles.textColor = [34, 197, 94] // green
                tableData.cell.styles.fontStyle = "bold"
              } else if (status === "Absent") {
                tableData.cell.styles.textColor = [239, 68, 68] // red
                tableData.cell.styles.fontStyle = "bold"
              } else if (status === "Paid Leave") {
                tableData.cell.styles.textColor = [59, 130, 246] // blue
              } else if (status === "Unpaid Leave") {
                tableData.cell.styles.textColor = [249, 115, 22] // orange
              } else if (status === "Weekend") {
                tableData.cell.styles.textColor = [107, 114, 128] // gray
              } else if (status === "Overtime") {
                tableData.cell.styles.textColor = [168, 85, 247] // purple
                tableData.cell.styles.fontStyle = "bold"
              }
            }
          },
        })

        yPosition = (doc as any).lastAutoTable.finalY + 10

        // Check if we need a new page for summary
        if (yPosition > 190) {
          doc.addPage()
          yPosition = margin
        }

        // Summary section at the bottom - increased height for better spacing
        const summaryHeight = isAdmin ? 75 : 65
        doc.setDrawColor(37, 99, 235) // Blue border
        doc.setFillColor(249, 250, 251) // Light gray background
        doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, summaryHeight, 2, 2, "FD")

        yPosition += 8
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(37, 99, 235)
        doc.text("Monthly Summary", margin + 5, yPosition)

        yPosition += 10
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(0, 0, 0)

        // Left column summary
        const leftColX = margin + 5
        const rightColX = isAdmin ? margin + 95 : margin + 85

        doc.setFont("helvetica", "bold")
        doc.text("Attendance Details:", leftColX, yPosition)
        doc.setFont("helvetica", "normal")
        yPosition += 6
        doc.text(`• Total Working Days: ${data.workingDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Present Days: ${data.presentDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Absent Days: ${data.absentDays.toFixed(1)}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Leave Days: ${data.leaveDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`  - Paid Leave: ${data.paidLeaveDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`  - Unpaid Leave: ${data.unpaidLeaveDays}`, leftColX, yPosition)

        // Right column summary
        let rightColY = yPosition - 25
        doc.setFont("helvetica", "bold")
        doc.text("Hours & Details:", rightColX, rightColY)
        doc.setFont("helvetica", "normal")
        rightColY += 6
        doc.text(`• Total Hours Worked: ${data.totalHoursWorked.toFixed(2)} hrs`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Deficit Hours: ${data.deficitHours.toFixed(2)} hrs`, rightColX, rightColY)
        rightColY += 5
        const absentFromDeficit = data.deficitHours / 8.5
        doc.text(`• Absent from Deficit: ${absentFromDeficit.toFixed(2)} days`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Effective Days: ${data.effectiveDays.toFixed(2)}`, rightColX, rightColY)

        // Only show salary details for admin users
        if (isAdmin) {
          rightColY += 5
          doc.text(`• Calculated Salary: $${data.calculatedSalary.toFixed(2)}`, rightColX, rightColY)
          rightColY += 5
          doc.text(`• Overtime Pay: $${data.overtimePay.toFixed(2)}`, rightColX, rightColY)
          rightColY += 5
          doc.setFont("helvetica", "bold")
          doc.setTextColor(34, 197, 94) // Green
          doc.setFontSize(10)
          doc.text(`Total Salary: $${data.totalSalaryWithOvertime.toFixed(2)}`, rightColX, rightColY)
          yPosition += 5
        }

        yPosition += isAdmin ? 60 : 50

        // Add note about MOM calculation
        doc.setFontSize(7)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(100, 100, 100)
        doc.text(
          "* Deficit hours converted to absent days based on Singapore MOM standard of 8.5 hours per working day",
          margin,
          yPosition,
          { maxWidth: pageWidth - 2 * margin }
        )

        yPosition += 10
      } else {
        yPosition += 5
      }

      // Add page break between users (except last user)
      if (data !== reportData[reportData.length - 1]) {
        doc.addPage()
        yPosition = margin
      }
    }

    // Save PDF with user name in filename
    let filename = ""
    if (reportData.length === 1) {
      // Single user - include their name
      const userName = reportData[0].user.full_name.replace(/\s+/g, "_").toLowerCase()
      filename = `Attendance_report_${userName}_${monthName}_${selectedYear}.pdf`
    } else {
      // Multiple users - use all_employees
      filename = `attendance_report_all_employees_${monthName}_${selectedYear}.pdf`
    }
    doc.save(filename)
  }

  const exportIndividualPDFs = async () => {
    const monthName = months.find((m) => m.value === selectedMonth)?.label

    // Generate individual PDF for each user
    for (const data of reportData) {
      const doc = new jsPDF("p", "mm", "a4")
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15
      let yPosition = margin

      // Load company logo (JPEG)
      try {
        const logoResponse = await fetch("/images/icon-512.jpg")
        const logoBlob = await logoResponse.blob()
        const logoUrl = URL.createObjectURL(logoBlob)

        // Add logo to top left
        doc.addImage(logoUrl, "JPEG", margin, yPosition, 25, 25)
        URL.revokeObjectURL(logoUrl)
      } catch (error) {
        console.log("Logo not found, using text only")
      }

      // Company name header
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(37, 99, 235) // Blue color
      doc.text("General Commercial Services", margin + 30, yPosition + 8)

      // Report title
      doc.setFontSize(14)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0, 0, 0)
      doc.text(`Attendance Report - ${monthName} ${selectedYear}`, margin + 40, yPosition + 20)

      yPosition += 35

      // Employee details section
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(245, 245, 245)
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 2, 2, "FD")

      yPosition += 8
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text("Employee Details:", margin + 5, yPosition)

      yPosition += 7
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`Name: ${data.user.full_name}`, margin + 5, yPosition)
      doc.text(`Email: ${data.user.email}`, margin + 80, yPosition)

      yPosition += 7
      doc.text(`Role: ${data.user.role}`, margin + 5, yPosition)
      doc.text(`Monthly Salary: $${data.user.salary?.toFixed(2) || "N/A"}`, margin + 80, yPosition)

      yPosition += 10

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
            fillColor: [37, 99, 235], // Blue color
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
          didParseCell: function (tableData) {
            // Color code status cells
            if (tableData.section === "body" && tableData.column.index === 5) {
              const status = tableData.cell.raw as string
              if (status === "Present" || status === "Holiday") {
                tableData.cell.styles.textColor = [34, 197, 94] // green
                tableData.cell.styles.fontStyle = "bold"
              } else if (status === "Absent") {
                tableData.cell.styles.textColor = [239, 68, 68] // red
                tableData.cell.styles.fontStyle = "bold"
              } else if (status === "Paid Leave") {
                tableData.cell.styles.textColor = [59, 130, 246] // blue
              } else if (status === "Unpaid Leave") {
                tableData.cell.styles.textColor = [249, 115, 22] // orange
              } else if (status === "Weekend") {
                tableData.cell.styles.textColor = [107, 114, 128] // gray
              } else if (status === "Overtime") {
                tableData.cell.styles.textColor = [168, 85, 247] // purple
                tableData.cell.styles.fontStyle = "bold"
              }
            }
          },
        })

        yPosition = (doc as any).lastAutoTable.finalY + 10

        // Check if we need a new page for summary
        if (yPosition > 190) {
          doc.addPage()
          yPosition = margin
        }

        // Summary section at the bottom
        doc.setDrawColor(37, 99, 235) // Blue border
        doc.setFillColor(249, 250, 251) // Light gray background
        doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 55, 2, 2, "FD")

        yPosition += 8
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(37, 99, 235)
        doc.text("Monthly Summary", margin + 5, yPosition)

        yPosition += 10
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(0, 0, 0)

        // Left column summary
        const leftColX = margin + 5
        const rightColX = margin + 95

        doc.setFont("helvetica", "bold")
        doc.text("Attendance Details:", leftColX, yPosition)
        doc.setFont("helvetica", "normal")
        yPosition += 6
        doc.text(`• Total Working Days: ${data.workingDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Present Days: ${data.presentDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Absent Days: ${data.absentDays.toFixed(1)}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`• Leave Days: ${data.leaveDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`  - Paid Leave: ${data.paidLeaveDays}`, leftColX, yPosition)
        yPosition += 5
        doc.text(`  - Unpaid Leave: ${data.unpaidLeaveDays}`, leftColX, yPosition)

        // Right column summary
        let rightColY = yPosition - 25
        doc.setFont("helvetica", "bold")
        doc.text("Hours & Salary:", rightColX, rightColY)
        doc.setFont("helvetica", "normal")
        rightColY += 6
        doc.text(`• Total Hours Worked: ${data.totalHoursWorked.toFixed(2)} hrs`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Deficit Hours: ${data.deficitHours.toFixed(2)} hrs`, rightColX, rightColY)
        rightColY += 5
        const absentFromDeficit = data.deficitHours / 8.5
        doc.text(`• Absent from Deficit: ${absentFromDeficit.toFixed(2)} days`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Effective Days: ${data.effectiveDays.toFixed(2)}`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Calculated Salary: $${data.calculatedSalary.toFixed(2)}`, rightColX, rightColY)
        rightColY += 5
        doc.text(`• Overtime Pay: $${data.overtimePay.toFixed(2)}`, rightColX, rightColY)
        rightColY += 5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(34, 197, 94) // Green
        doc.setFontSize(10)
        doc.text(`Total Salary: $${data.totalSalaryWithOvertime.toFixed(2)}`, rightColX, rightColY)

        yPosition += 60

        // Add note about MOM calculation
        doc.setFontSize(7)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(100, 100, 100)
        doc.text(
          "* Deficit hours converted to absent days based on Singapore MOM standard of 8.5 hours per working day",
          margin,
          yPosition,
          { maxWidth: pageWidth - 2 * margin }
        )
      }

      // Save individual PDF
      const userName = data.user.full_name.replace(/\s+/g, "_").toLowerCase()
      const filename = `attendance_report_${userName}_${monthName}_${selectedYear}.pdf`
      doc.save(filename)

      // Small delay between downloads to avoid browser blocking
      await new Promise(resolve => setTimeout(resolve, 500))
    }
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

        {isAdmin && reportData.length > 1 && (
          <Button
            onClick={exportIndividualPDFs}
            disabled={isLoading || reportData.length === 0}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Download Individual PDFs
          </Button>
        )}
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
