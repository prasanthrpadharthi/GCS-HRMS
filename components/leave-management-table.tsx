"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Leave {
  id: string
  user_id: string
  date: string
  leave_type: "paid" | "unpaid"
  day_type: "full" | "half"
  reason?: string
  users?: {
    full_name: string
    email: string
  }
}

interface LeaveManagementTableProps {
  leaves: Leave[]
  isAdmin: boolean
}

export function LeaveManagementTable({ leaves, isAdmin }: LeaveManagementTableProps) {
  const router = useRouter()

  const getLeaveTypeColor = (leaveType: string) => {
    return leaveType === "paid"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : "bg-orange-100 text-orange-800 border-orange-300"
  }

  const getDayTypeColor = (dayType: string) => {
    return dayType === "full"
      ? "bg-purple-100 text-purple-800 border-purple-300"
      : "bg-yellow-100 text-yellow-800 border-yellow-300"
  }

  const handleDeleteLeave = async (leaveId: string, date: string, userId: string) => {
    if (!confirm("Are you sure you want to delete this leave?")) return

    try {
      const supabase = createClient()

      // Delete leave
      const { error: deleteError } = await supabase.from("leaves").delete().eq("id", leaveId)

      if (deleteError) throw deleteError

      // Delete associated attendance record
      await supabase.from("attendance").delete().eq("user_id", userId).eq("date", date)

      router.refresh()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
      {leaves.length === 0 ? (
        <div className="text-center py-8 text-amber-700">No leave records found</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-100">
              {isAdmin && <TableHead className="text-amber-900">Employee</TableHead>}
              <TableHead className="text-amber-900">Date</TableHead>
              <TableHead className="text-amber-900">Leave Type</TableHead>
              <TableHead className="text-amber-900">Day Type</TableHead>
              <TableHead className="text-amber-900">Reason</TableHead>
              <TableHead className="text-amber-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((leave) => (
              <TableRow key={leave.id} className="hover:bg-amber-50">
                {isAdmin && (
                  <TableCell className="text-amber-900">
                    <div>
                      <p className="font-medium">{leave.users?.full_name}</p>
                      <p className="text-xs text-amber-700">{leave.users?.email}</p>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-amber-900">
                  {new Date(leave.date).toLocaleDateString("en-SG", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <Badge className={getLeaveTypeColor(leave.leave_type)} variant="outline">
                    {leave.leave_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getDayTypeColor(leave.day_type)} variant="outline">
                    {leave.day_type === "full" ? "Full Day" : "Half Day"}
                  </Badge>
                </TableCell>
                <TableCell className="text-amber-700">{leave.reason || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLeave(leave.id, leave.date, leave.user_id)}
                    className="hover:bg-red-100 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
