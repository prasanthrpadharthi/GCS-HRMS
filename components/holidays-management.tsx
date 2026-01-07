"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Holiday } from "@/lib/types"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertProvider } from "@/components/ui/alert-custom"
import { Plus, Trash2, Calendar } from "lucide-react"

interface HolidaysManagementProps {
  isAdmin: boolean
}

export function HolidaysManagement({ isAdmin }: HolidaysManagementProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    holiday_name: "",
    holiday_date: "",
    description: "",
  })

  const supabase = createClient()

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      setHolidays(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch holidays"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.holiday_name.trim() || !formData.holiday_date) {
      setError("Holiday name and date are required")
      return
    }

    try {
      setError(null)

      const { error: insertError } = await supabase
        .from("holidays")
        .insert([
          {
            holiday_name: formData.holiday_name,
            holiday_date: formData.holiday_date,
            description: formData.description || null,
          },
        ])

      if (insertError) {
        throw insertError
      }

      setFormData({
        holiday_name: "",
        holiday_date: "",
        description: "",
      })
      setIsDialogOpen(false)
      await fetchHolidays()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add holiday"
      setError(errorMessage)
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) {
      return
    }

    try {
      setError(null)

      const { error: deleteError } = await supabase
        .from("holidays")
        .delete()
        .eq("id", id)

      if (deleteError) {
        throw deleteError
      }

      await fetchHolidays()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete holiday"
      setError(errorMessage)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.toLocaleDateString("en-US", { weekday: "long" }),
      date: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "long" }),
      year: date.getFullYear(),
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading holidays...</p>
        </div>
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

      {isAdmin && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Plus className="h-5 w-5" />
              Add New Holiday
            </CardTitle>
            <CardDescription>Create a new company holiday</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Holiday</DialogTitle>
                  <DialogDescription>
                    Fill in the details to add a new company holiday
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddHoliday} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Holiday Name
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., Deepavali"
                      value={formData.holiday_name}
                      onChange={(e) =>
                        setFormData({ ...formData, holiday_name: e.target.value })
                      }
                      className="border-amber-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Holiday Date
                    </label>
                    <Input
                      type="date"
                      value={formData.holiday_date}
                      onChange={(e) =>
                        setFormData({ ...formData, holiday_date: e.target.value })
                      }
                      className="border-amber-200"
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
                      className="border-amber-200"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
                    Add Holiday
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Calendar className="h-5 w-5" />
            Company Holidays
          </CardTitle>
          <CardDescription>List of all company holidays</CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No holidays found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-amber-200">
                    <TableHead className="text-amber-900 font-semibold">Holiday Name</TableHead>
                    <TableHead className="text-amber-900 font-semibold">Day</TableHead>
                    <TableHead className="text-amber-900 font-semibold">Date</TableHead>
                    <TableHead className="text-amber-900 font-semibold">Month</TableHead>
                    <TableHead className="text-amber-900 font-semibold">Year</TableHead>
                    {isAdmin && <TableHead className="text-amber-900 font-semibold">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => {
                    const { day, date, month, year } = formatDate(holiday.holiday_date)
                    return (
                      <TableRow key={holiday.id} className="border-amber-100 hover:bg-amber-50">
                        <TableCell className="font-medium text-gray-900">
                          {holiday.holiday_name}
                        </TableCell>
                        <TableCell className="text-gray-700">{day}</TableCell>
                        <TableCell className="text-gray-700">{date}</TableCell>
                        <TableCell className="text-gray-700">{month}</TableCell>
                        <TableCell className="text-gray-700">{year}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
