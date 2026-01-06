"use client"

import { useState, useEffect } from "react"
import type { Attendance, Leave } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LoadingSpinner } from "@/components/ui/loading"

interface DashboardAttendanceCalendarProps {
  userId: string
  initialMonth?: number
  initialYear?: number
}

export function DashboardAttendanceCalendar({ 
  userId, 
  initialMonth = new Date().getMonth() + 1, 
  initialYear = new Date().getFullYear() 
}: DashboardAttendanceCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<any>(null)

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const fetchData = async (month: number, year: number) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      
      // Fetch attendance
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", firstDay.toISOString().split("T")[0])
        .lte("date", lastDay.toISOString().split("T")[0])
      
      // Fetch leaves
      const { data: leavesData } = await supabase
        .from("leaves")
        .select("*, leave_type:leave_types(*)")
        .eq("user_id", userId)
        .eq("status", "approved")
        .gte("from_date", firstDay.toISOString().split("T")[0])
        .lte("to_date", lastDay.toISOString().split("T")[0])
      
      // Fetch settings
      const { data: settingsData } = await supabase
        .from("company_settings")
        .select("*")
        .single()
      
      setAttendance(attendanceData || [])
      setLeaves(leavesData || [])
      setSettings(settingsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch data on mount and when month/year changes
  useEffect(() => {
    fetchData(selectedMonth, selectedYear)
  }, [])

  const handlePreviousMonth = () => {
    let newMonth = selectedMonth - 1
    let newYear = selectedYear
    
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    }
    
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    fetchData(newMonth, newYear)
  }

  const handleNextMonth = () => {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()
    
    // Don't allow going beyond current month
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      return
    }
    
    let newMonth = selectedMonth + 1
    let newYear = selectedYear
    
    if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    fetchData(newMonth, newYear)
  }

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month - 1, 1).getDay()
  }

  const isWeekend = (date: Date) => {
    if (!settings) return false
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
    return settings.weekend_days?.includes(dayName)
  }

  const getDateStatus = (day: number) => {
    const date = new Date(selectedYear, selectedMonth - 1, day)
    const dateString = date.toISOString().split("T")[0]
    
    // Check if it's a weekend
    if (isWeekend(date)) {
      return { status: "weekend", color: "bg-gray-200 text-gray-500", hours: null }
    }
    
    // Check if there's a leave for this date
    const leave = leaves.find(l => {
      const fromDate = new Date(l.from_date)
      const toDate = new Date(l.to_date)
      return date >= fromDate && date <= toDate
    })
    
    if (leave) {
      return { status: "leave", color: "bg-blue-200 text-blue-800 border-blue-400", hours: null }
    }
    
    // Check attendance
    const attendanceRecord = attendance.find(a => a.date === dateString)
    
    if (attendanceRecord) {
      let hoursWorked = 0
      if (attendanceRecord.clock_in && attendanceRecord.clock_out) {
        const clockIn = new Date(`${dateString}T${attendanceRecord.clock_in}`)
        const clockOut = new Date(`${dateString}T${attendanceRecord.clock_out}`)
        const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
        hoursWorked = Math.max(0, totalHours - 1) // Subtract 1 hour lunch
      }
      
      if (attendanceRecord.status === "present") {
        if (hoursWorked < 8.5 && hoursWorked > 0) {
          return { 
            status: "present-short", 
            color: "bg-orange-200 text-orange-800 border-orange-400", 
            hours: hoursWorked.toFixed(1) 
          }
        }
        return { 
          status: "present", 
          color: "bg-green-200 text-green-800 border-green-400", 
          hours: hoursWorked > 0 ? hoursWorked.toFixed(1) : null 
        }
      }
      
      if (attendanceRecord.status === "absent") {
        return { status: "absent", color: "bg-red-200 text-red-800 border-red-400", hours: null }
      }
      
      if (attendanceRecord.status === "half_day") {
        return { status: "half_day", color: "bg-yellow-200 text-yellow-800 border-yellow-400", hours: hoursWorked > 0 ? hoursWorked.toFixed(1) : null }
      }
    }
    
    // Check if date is in the future
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    
    if (date > today) {
      return { status: "future", color: "bg-white text-gray-400", hours: null }
    }
    
    // Absent by default for past dates
    return { status: "absent", color: "bg-red-100 text-red-600 border-red-300", hours: null }
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear)
    const days = []
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="aspect-square p-1 border border-gray-100"></div>
      )
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const { status, color, hours } = getDateStatus(day)
      days.push(
        <div
          key={day}
          className={`aspect-square p-1 border-2 ${color} rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all hover:shadow-md`}
        >
          <span className="text-xs sm:text-sm">{day}</span>
          {hours && <span className="text-[10px] font-normal">{hours}h</span>}
        </div>
      )
    }
    
    return days
  }

  const currentDate = new Date()
  const isCurrentMonth = selectedMonth === currentDate.getMonth() + 1 && selectedYear === currentDate.getFullYear()

  return (
    <div className="space-y-4">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousMonth}
          className="border-amber-300 hover:bg-amber-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="text-lg font-semibold text-amber-900">
          {monthNames[selectedMonth - 1]} {selectedYear}
        </h3>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className="border-amber-300 hover:bg-amber-50 disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-amber-700 mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-amber-200 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-200 border-2 border-green-400 rounded"></div>
              <span className="text-amber-900">Present (≥8.5h)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-orange-200 border-2 border-orange-400 rounded"></div>
              <span className="text-amber-900">Present (&lt;8.5h)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-200 border-2 border-blue-400 rounded"></div>
              <span className="text-amber-900">Leave</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
              <span className="text-amber-900">Absent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded"></div>
              <span className="text-amber-900">Weekend</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
