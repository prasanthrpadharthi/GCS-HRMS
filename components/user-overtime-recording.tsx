"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Overtime, Holiday } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertProvider } from "@/components/ui/alert-custom"
import { Plus, Trash2, Clock } from "lucide-react"

interface UserOvertimeProps {
  userId: string
}

// Helper function to generate time slots from 9:30 AM to 7:00 PM in 30-minute intervals
const generateTimeSlots = (): { label: string; value: string }[] => {
  const slots: { label: string; value: string }[] = []
  const startHour = 9
  const startMin = 30
  const endHour = 19
  const endMin = 0

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === startHour && m < startMin) continue
      if (h === endHour && m > endMin) break

      const hour = String(h).padStart(2, "0")
      const min = String(m).padStart(2, "0")
      const timeValue = `${hour}:${min}`

      const ampm = h >= 12 ? "PM" : "AM"
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
      const displayLabel = `${displayHour}:${min} ${ampm}`

      slots.push({ label: displayLabel, value: timeValue })
    }
  }

  return slots
}

// Helper function to calculate hours between two times
const calculateHours = (timeFrom: string, timeTo: string): number => {
  if (!timeFrom || !timeTo) return 0

  const [fromHour, fromMin] = timeFrom.split(":").map(Number)
  const [toHour, toMin] = timeTo.split(":").map(Number)

  const fromTotalMin = fromHour * 60 + fromMin
  const toTotalMin = toHour * 60 + toMin

  if (toTotalMin <= fromTotalMin) return 0

  const diffMin = toTotalMin - fromTotalMin
  return parseFloat((diffMin / 60).toFixed(2))
}

export function UserOvertimeRecording({ userId }: UserOvertimeProps) {
  const [overtimes, setOvertimes] = useState<Overtime[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [overtimeType, setOvertimeType] = useState<"weekend" | "holiday">("weekend")
  const [formData, setFormData] = useState({
    time_from: "",
    time_to: "",
    hours_worked: "0",
    description: "",
  })

  const supabase = createClient()
  const timeSlots = generateTimeSlots()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [{ data: overtimeData, error: overtimeError }, { data: holidayData, error: holidayError }] = await Promise.all([
        supabase
          .from("overtime")
          .select("*")
          .eq("user_id", userId)
          .order("overtime_date", { ascending: false }),
        supabase
          .from("holidays")
          .select("*")
          .order("holiday_date", { ascending: true }),
      ])

      if (overtimeError) throw overtimeError
      if (holidayError) throw holidayError

      setOvertimes(overtimeData || [])
      setHolidays(holidayData || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch data"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const isWeekend = (date: string): boolean => {
    const d = new Date(date)
    const day = d.getDay()
    return day === 0 || day === 6 // 0 = Sunday, 6 = Saturday
  }

  const isHoliday = (date: string): boolean => {
    return holidays.some((h) => h.holiday_date === date)
  }

  const isWorkingDay = (date: string): boolean => {
    return !isWeekend(date) && !isHoliday(date)
  }

  const canApplyOvertime = (date: string): boolean => {
    return isWeekend(date) || isHoliday(date)
  }

  const getOvertimeTypeForDate = (date: string): "weekend" | "holiday" | null => {
    if (isHoliday(date)) return "holiday"
    if (isWeekend(date)) return "weekend"
    return null
  }

  const handleAddOvertime = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDate || !formData.time_from || !formData.time_to) {
      setError("Please select a date, from time, and to time")
      return
    }

    if (isWorkingDay(selectedDate)) {
      setError("Cannot apply overtime on a working day. Overtime can only be applied for weekends and holidays.")
      return
    }

    const hours = calculateHours(formData.time_from, formData.time_to)
    if (hours <= 0) {
      setError("To time must be later than from time")
      return
    }

    try {
      setError(null)

      const type = getOvertimeTypeForDate(selectedDate)
      if (!type) {
        setError("Invalid date for overtime")
        return
      }

      const { error: insertError } = await supabase
        .from("overtime")
        .insert([
          {
            user_id: userId,
            overtime_date: selectedDate,
            time_from: formData.time_from,
            time_to: formData.time_to,
            hours_worked: hours,
            overtime_type: type,
            description: formData.description || null,
            status: "pending",
          },
        ])

      if (insertError) throw insertError

      setFormData({
        time_from: "",
        time_to: "",
        hours_worked: "0",
        description: "",
      })
      setSelectedDate("")
      setIsDialogOpen(false)
      await fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add overtime"
      setError(errorMessage)
    }
  }

  const handleDeleteOvertime = async (id: string, status: string) => {
    if (status !== "pending") {
      setError("Can only delete pending overtime records")
      return
    }

    if (!window.confirm("Are you sure you want to delete this overtime record?")) {
      return
    }

    try {
      setError(null)

      const { error: deleteError } = await supabase
        .from("overtime")
        .delete()
        .eq("id", id)

      if (deleteError) throw deleteError

      await fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete overtime"
      setError(errorMessage)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "text-red-600 bg-red-50"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading overtime records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <AlertProvider>
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
            </div>
        </AlertProvider>
      )}

      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Plus className="h-5 w-5" />
            Record Overtime
          </CardTitle>
          <CardDescription>
            Record overtime for weekends and holidays only. Working days are not eligible for overtime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Add Overtime
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Overtime</DialogTitle>
                <DialogDescription>
                  Record your overtime hours for weekends and holidays
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOvertime} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Overtime Date
                  </label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      const date = e.target.value
                      setSelectedDate(date)
                      if (date) {
                        if (isWorkingDay(date)) {
                          setError("Cannot apply overtime on a working day. Select a weekend or holiday.")
                        } else {
                          setError(null)
                        }
                      }
                    }}
                    className="border-blue-200"
                  />
                  {selectedDate && (
                    <p className="text-xs mt-2">
                      {isWeekend(selectedDate) && (
                        <span className="text-blue-600">✓ Weekend - Eligible for overtime</span>
                      )}
                      {isHoliday(selectedDate) && (
                        <span className="text-blue-600">✓ Holiday - Eligible for overtime</span>
                      )}
                      {isWorkingDay(selectedDate) && (
                        <span className="text-red-600">✗ Working day - Not eligible for overtime</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      From Time
                    </label>
                    <Select
                      value={formData.time_from}
                      onValueChange={(value) => {
                        setFormData({ ...formData, time_from: value })
                        // Auto-calculate hours if both times are selected
                        if (formData.time_to) {
                          const hours = calculateHours(value, formData.time_to)
                          setFormData((prev) => ({ ...prev, hours_worked: hours.toString() }))
                        }
                      }}
                    >
                      <SelectTrigger className="border-blue-200">
                        <SelectValue placeholder="Select start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      To Time
                    </label>
                    <Select
                      value={formData.time_to}
                      onValueChange={(value) => {
                        setFormData({ ...formData, time_to: value })
                        // Auto-calculate hours if both times are selected
                        if (formData.time_from) {
                          const hours = calculateHours(formData.time_from, value)
                          setFormData((prev) => ({ ...prev, hours_worked: hours.toString() }))
                        }
                      }}
                    >
                      <SelectTrigger className="border-blue-200">
                        <SelectValue placeholder="Select end time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Hours Worked (Auto-calculated)
                  </label>
                  <Input
                    type="text"
                    readOnly
                    value={formData.hours_worked ? `${formData.hours_worked} hrs` : "0 hrs"}
                    className="border-blue-200 bg-gray-100 text-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Description (Optional)
                  </label>
                  <Textarea
                    placeholder="Add any additional details..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="border-blue-200"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  Record Overtime
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Clock className="h-5 w-5" />
            My Overtime Records
          </CardTitle>
          <CardDescription>Your overtime applications and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {overtimes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No overtime records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-blue-200">
                    <TableHead className="text-blue-900 font-semibold">Date</TableHead>
                    <TableHead className="text-blue-900 font-semibold">From Time</TableHead>
                    <TableHead className="text-blue-900 font-semibold">To Time</TableHead>
                    <TableHead className="text-blue-900 font-semibold">Type</TableHead>
                    <TableHead className="text-blue-900 font-semibold">Hours</TableHead>
                    <TableHead className="text-blue-900 font-semibold">Status</TableHead>
                    <TableHead className="text-blue-900 font-semibold">Description</TableHead>
                    <TableHead className="text-blue-900 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overtimes.map((ot) => (
                    <TableRow key={ot.id} className="border-blue-100 hover:bg-blue-50">
                      <TableCell className="font-medium text-gray-900">
                        {new Date(ot.overtime_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {ot.time_from || "-"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {ot.time_to || "-"}
                      </TableCell>
                      <TableCell className="text-gray-700 capitalize">
                        {ot.overtime_type}
                      </TableCell>
                      <TableCell className="text-gray-700">{ot.hours_worked} hrs</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(
                            ot.status
                          )}`}
                        >
                          {ot.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {ot.description || "-"}
                      </TableCell>
                      <TableCell>
                        {ot.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOvertime(ot.id, ot.status)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {ot.status !== "pending" && (
                          <span className="text-gray-400 text-sm">No action</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
