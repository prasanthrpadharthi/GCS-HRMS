"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Overtime, User } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Clock, CheckCircle, XCircle, Clock3 } from "lucide-react"

interface OvertimeWithUser extends Overtime {
  user?: User
}

export function AdminOvertimeReports() {
  const [overtimes, setOvertimes] = useState<OvertimeWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [filteredOvertimes, setFilteredOvertimes] = useState<OvertimeWithUser[]>([])

  const supabase = createClient()

  useEffect(() => {
    const currentDate = new Date()
    setSelectedMonth(String(currentDate.getMonth() + 1).padStart(2, "0"))
    fetchOvertimes()
  }, [])

  useEffect(() => {
    filterOvertimes()
  }, [overtimes, selectedMonth, selectedYear])

  const fetchOvertimes = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("overtime")
        .select(
          `
          *,
          user:user_id (
            id,
            email,
            full_name,
            role,
            salary,
            must_change_password,
            email_verified,
            created_at,
            updated_at
          )
        `
        )
        .order("overtime_date", { ascending: false })

      if (fetchError) throw fetchError

      setOvertimes(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch overtime records"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const filterOvertimes = () => {
    const filtered = overtimes.filter((ot) => {
      const date = new Date(ot.overtime_date)
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const year = date.getFullYear().toString()

      return month === selectedMonth && year === selectedYear
    })
    setFilteredOvertimes(filtered)
  }

  const handleApproveOvertime = async (id: string) => {
    try {
      setError(null)

      const { error: updateError } = await supabase
        .from("overtime")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateError) throw updateError

      await fetchOvertimes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to approve overtime"
      setError(errorMessage)
    }
  }

  const handleRejectOvertime = async (id: string) => {
    try {
      setError(null)

      const { error: updateError } = await supabase
        .from("overtime")
        .update({
          status: "rejected",
        })
        .eq("id", id)

      if (updateError) throw updateError

      await fetchOvertimes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reject overtime"
      setError(errorMessage)
    }
  }

  const getMonthChartData = () => {
    const statusCount = {
      approved: 0,
      pending: 0,
      rejected: 0,
    }

    const totalHours: { [key: string]: number } = {}

    filteredOvertimes.forEach((ot) => {
      statusCount[ot.status as keyof typeof statusCount]++
      const userName = ot.user?.full_name || "Unknown"
      totalHours[userName] = (totalHours[userName] || 0) + ot.hours_worked
    })

    return {
      statusCount: Object.entries(statusCount).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
      })),
      hoursData: Object.entries(totalHours).map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
      })),
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const COLORS = ["#10b981", "#f59e0b", "#ef4444"]

  const { statusCount, hoursData } = getMonthChartData()
  const totalHours = filteredOvertimes.reduce((sum, ot) => sum + ot.hours_worked, 0)
  const totalRecords = filteredOvertimes.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading overtime reports...</p>
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

      {/* Filter Section */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="text-purple-900">Filter by Month & Year</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = String(i + 1).padStart(2, "0")
                    const monthName = new Date(2024, i).toLocaleDateString("en-US", {
                      month: "long",
                    })
                    return (
                      <SelectItem key={month} value={month}>
                        {monthName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = (new Date().getFullYear() - 2 + i).toString()
                    return (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {statusCount.find((s) => s.status === "Approved")?.count || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-900 flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-700">
              {statusCount.find((s) => s.status === "Pending")?.count || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">
              {statusCount.find((s) => s.status === "Rejected")?.count || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">{totalHours.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-900">Status Distribution</CardTitle>
            <CardDescription>Overtime by approval status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusCount.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusCount}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {statusCount.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-900">Hours by Employee</CardTitle>
            <CardDescription>Total overtime hours worked</CardDescription>
          </CardHeader>
          <CardContent>
            {hoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overtime Table */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Clock className="h-5 w-5" />
            Overtime Records
          </CardTitle>
          <CardDescription>
            {new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString(
              "en-US",
              { month: "long", year: "numeric" }
            )}{" "}
            - Total: {totalRecords} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOvertimes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No overtime records for this month</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-purple-200">
                    <TableHead className="text-purple-900 font-semibold">Employee</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Date</TableHead>
                    <TableHead className="text-purple-900 font-semibold">From Time</TableHead>
                    <TableHead className="text-purple-900 font-semibold">To Time</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Type</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Hours</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Status</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Description</TableHead>
                    <TableHead className="text-purple-900 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOvertimes.map((ot) => (
                    <TableRow key={ot.id} className="border-purple-100 hover:bg-purple-50">
                      <TableCell className="font-medium text-gray-900">
                        {ot.user?.full_name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(ot.overtime_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {ot.time_from || "-"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {ot.time_to || "-"}
                      </TableCell>
                      <TableCell className="text-gray-700 capitalize">{ot.overtime_type}</TableCell>
                      <TableCell className="text-gray-700 font-semibold">{ot.hours_worked} hrs</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(
                            ot.status
                          )}`}
                        >
                          {ot.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-xs">
                        {ot.description || "-"}
                      </TableCell>
                      <TableCell>
                        {ot.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveOvertime(ot.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRejectOvertime(ot.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {ot.status !== "pending" && (
                          <span className="text-gray-400 text-sm capitalize">{ot.status}</span>
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
