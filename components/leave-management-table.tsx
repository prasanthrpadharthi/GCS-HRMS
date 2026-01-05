"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Check, X, RotateCcw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Leave } from "@/lib/types"

interface LeaveManagementTableProps {
  leaves: Leave[]
  isAdmin: boolean
  currentUserId: string
}

export function LeaveManagementTable({ leaves, isAdmin, currentUserId }: LeaveManagementTableProps) {
  const router = useRouter()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-300"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
    }
  }

  const getSessionDisplay = (session: string) => {
    switch (session) {
      case "morning":
        return "Morning"
      case "afternoon":
        return "Afternoon"
      default:
        return "Full Day"
    }
  }

  const handleApproveLeave = async (leaveId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "approved",
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", leaveId)

      if (error) {
        console.error("Leave approval error:", error)
        throw error
      }
      router.refresh()
    } catch (error) {
      console.error("Error approving leave:", error)
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const handleRejectLeave = async (leaveId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "rejected",
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", leaveId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm("Are you sure you want to delete this leave?")) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("leaves").delete().eq("id", leaveId)

      if (error) throw error
      router.refresh()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const handleResetLeave = async (leaveId: string) => {
    if (!confirm("Reset this leave to pending status?")) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "pending",
          approved_by: null,
          approved_at: null,
        })
        .eq("id", leaveId)

      if (error) throw error
      router.refresh()
    } catch (error) {
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
              <TableHead className="text-amber-900">From Date</TableHead>
              <TableHead className="text-amber-900">To Date</TableHead>
              <TableHead className="text-amber-900">Duration</TableHead>
              <TableHead className="text-amber-900">Leave Type</TableHead>
              <TableHead className="text-amber-900">Status</TableHead>
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
                      <p className="font-medium">{leave.user?.full_name}</p>
                      <p className="text-xs text-amber-700">{leave.user?.email}</p>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-amber-900">
                  <div>
                    {new Date(leave.from_date).toLocaleDateString("en-SG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    <div className="text-xs text-amber-600">{getSessionDisplay(leave.from_session)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-amber-900">
                  <div>
                    {new Date(leave.to_date).toLocaleDateString("en-SG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    <div className="text-xs text-amber-600">{getSessionDisplay(leave.to_session)}</div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-amber-900">{leave.total_days} days</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    {leave.leave_type?.name || "N/A"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(leave.status)} variant="outline">
                    {leave.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-amber-900 text-sm max-w-xs">
                  {leave.reason || <span className="text-gray-400 italic">No reason provided</span>}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {isAdmin && leave.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleApproveLeave(leave.id)}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRejectLeave(leave.id)}
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isAdmin && leave.status !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleResetLeave(leave.id)}
                        title="Reset to Pending"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {(!isAdmin && leave.status === "pending") || isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteLeave(leave.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
