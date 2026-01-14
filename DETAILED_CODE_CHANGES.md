# Detailed Code Changes

## File 1: `components/attendance-marker.tsx`

### Change 1: Import Holiday Type
**Location**: Line 6
```typescript
// BEFORE:
import type { Attendance, CompanySettings } from "@/lib/types"

// AFTER:
import type { Attendance, CompanySettings, Holiday } from "@/lib/types"
```

### Change 2: Add State for Holidays
**Location**: Line 34-37
```typescript
// ADDED:
const [holidays, setHolidays] = useState<Holiday[]>([])
const [loadingHolidays, setLoadingHolidays] = useState(true)
```

### Change 3: Add Holiday Fetching in useEffect
**Location**: Line 64-85 (NEW useEffect)
```typescript
// ADDED:
useEffect(() => {
  const fetchHolidays = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date")
      
      setHolidays(data || [])
    } catch (err) {
      console.error("Failed to fetch holidays:", err)
    } finally {
      setLoadingHolidays(false)
    }
  }

  fetchHolidays()
}, [])
```

### Change 4: Add Holiday Helper Functions
**Location**: Line 101-115 (NEW functions)
```typescript
// ADDED:
const isHoliday = (date: string): boolean => {
  return holidays.some((h) => h.holiday_date === date)
}

const getHolidayName = (date: string): string | null => {
  const holiday = holidays.find((h) => h.holiday_date === date)
  return holiday ? holiday.holiday_name : null
}
```

### Change 5: Update handleClockIn Function
**Location**: Line 117-135 (MODIFIED)
```typescript
// BEFORE:
const handleClockIn = async () => {
  // Check if today is a weekend
  const todayDate = new Date()
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" })
  if (settings?.weekend_days.includes(dayName)) {
    await showAlert("Weekend Day", "Attendance marking is not allowed on weekends.")
    return
  }

// AFTER:
const handleClockIn = async () => {
  // Check if today is a holiday
  if (isHoliday(today)) {
    const holidayName = getHolidayName(today)
    await showAlert(
      "Holiday Detected",
      `${holidayName} is a public holiday. Attendance marking is not required. If you worked today, you can record overtime instead.`
    )
    return
  }

  // Check if today is a weekend
  const todayDate = new Date()
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" })
  if (settings?.weekend_days.includes(dayName)) {
    await showAlert("Weekend Day", "Attendance marking is not allowed on weekends. If you worked, you can record overtime instead.")
    return
  }
```

### Change 6: Update handleManualAttendance Function
**Location**: Line 217-240 (ADDED at beginning)
```typescript
// ADDED:
const handleManualAttendance = async () => {
  if (!manualDate || !manualClockIn) {
    setError("Please select date and clock in time")
    return
  }

  // Check if selected date is a holiday
  if (isHoliday(manualDate)) {
    const holidayName = getHolidayName(manualDate)
    await showAlert(
      "Holiday Detected",
      `${holidayName} is a public holiday. Attendance marking is not required. If you worked on this date, please record overtime instead.`
    )
    return
  }

  // Check if selected date is a weekend
  const selectedDate = new Date(manualDate)
  const dayName = selectedDate.toLocaleDateString("en-US", { weekday: "long" })
  if (settings?.weekend_days.includes(dayName)) {
    await showAlert("Weekend Day", "Attendance marking is not allowed on weekends. Please select a working day.")
    return
  }

  // ... rest of the function remains same
```

---

## File 2: `components/attendance-report-table.tsx`

### Change 1: Import Holiday Type
**Location**: Line 9
```typescript
// BEFORE:
import type { User } from "@/lib/types"

// AFTER:
import type { User, Holiday } from "@/lib/types"
```

### Change 2: Add Holiday Fetching
**Location**: Line 101-119 (ADDED in fetchReportData)
```typescript
// ADDED in fetchReportData function after getting company settings:
// Get holidays for the month
const { data: holidaysData } = await supabase
  .from("holidays")
  .select("*")
  .gte("holiday_date", startDate)
  .lte("holiday_date", endDate)

const holidays: Holiday[] = holidaysData || []
```

### Change 3: Add Holidays to Hours Calculation
**Location**: Line 269-290 (ADDED after paid leaves calculation)
```typescript
// ADDED:
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
```

---

## File 3: `components/admin-overtime-reports.tsx`

### Change 1: Update getMonthChartData Function
**Location**: Line 134-165 (MODIFIED)
```typescript
// BEFORE:
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

// AFTER:
const getMonthChartData = () => {
  const statusCount = {
    approved: 0,
    pending: 0,
    rejected: 0,
  }

  const totalHours: { [key: string]: number } = {}
  const overtimePay: { [key: string]: number } = {}

  filteredOvertimes.forEach((ot) => {
    statusCount[ot.status as keyof typeof statusCount]++
    const userName = ot.user?.full_name || "Unknown"
    totalHours[userName] = (totalHours[userName] || 0) + ot.hours_worked
    
    // Calculate overtime pay: 1.5x hourly rate
    // Monthly salary / 22 working days / 8.5 hours per day = hourly rate
    if (ot.user?.salary && ot.status === "approved") {
      const hourlyRate = ot.user.salary / 22 / 8.5
      const overtimeHourlyRate = hourlyRate * 1.5 // 1.5x multiplier
      const pay = overtimeHourlyRate * ot.hours_worked
      overtimePay[userName] = (overtimePay[userName] || 0) + pay
    }
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
    payData: Object.entries(overtimePay).map(([name, pay]) => ({
      name,
      pay: parseFloat(pay.toFixed(2)),
    })),
  }
}
```

### Change 2: Update Chart Data Destructuring
**Location**: Line 180-189 (MODIFIED)
```typescript
// BEFORE:
const { statusCount, hoursData } = getMonthChartData()
const totalHours = filteredOvertimes.reduce((sum, ot) => sum + ot.hours_worked, 0)
const totalRecords = filteredOvertimes.length

// AFTER:
const { statusCount, hoursData, payData } = getMonthChartData()
const totalHours = filteredOvertimes.reduce((sum, ot) => sum + ot.hours_worked, 0)
const totalOvertimePay = filteredOvertimes.reduce((sum, ot) => {
  if (ot.user?.salary && ot.status === "approved") {
    const hourlyRate = ot.user.salary / 22 / 8.5
    const overtimeHourlyRate = hourlyRate * 1.5
    return sum + (overtimeHourlyRate * ot.hours_worked)
  }
  return sum
}, 0)
const totalRecords = filteredOvertimes.length
```

### Change 3: Update Statistics Cards Grid
**Location**: Line 217 (MODIFIED)
```typescript
// BEFORE:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// AFTER:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
```

### Change 4: Add Overtime Pay Statistics Card
**Location**: Line 260-272 (ADDED after Total Hours card)
```typescript
// ADDED:
<Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-orange-900 flex items-center gap-2">
      <Clock className="h-4 w-4" />
      OT Pay (1.5x)
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-orange-700">₹{totalOvertimePay.toFixed(2)}</p>
  </CardContent>
</Card>
```

### Change 5: Add Overtime Payroll Chart
**Location**: Line 328-356 (ADDED after Hours by Employee chart)
```typescript
// ADDED:
{/* Overtime Payroll Chart */}
{payData && payData.length > 0 && (
  <Card className="border-orange-200">
    <CardHeader>
      <CardTitle className="text-orange-900">Overtime Pay by Employee (1.5x Rate)</CardTitle>
      <CardDescription>Pro-rata overtime compensation based on hourly rate</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={payData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip 
              formatter={(value) => `₹${(value as number).toFixed(2)}`}
              contentStyle={{ backgroundColor: "#f5f3ff", border: "1px solid #ddd" }}
            />
            <Bar dataKey="pay" fill="#f97316" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
)}
```

### Change 6: Add OT Pay Column to Table
**Location**: Line 369-410 (MODIFIED table header and body)
```typescript
// BEFORE:
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

// AFTER:
<TableHeader>
  <TableRow className="hover:bg-transparent border-purple-200">
    <TableHead className="text-purple-900 font-semibold">Employee</TableHead>
    <TableHead className="text-purple-900 font-semibold">Date</TableHead>
    <TableHead className="text-purple-900 font-semibold">From Time</TableHead>
    <TableHead className="text-purple-900 font-semibold">To Time</TableHead>
    <TableHead className="text-purple-900 font-semibold">Type</TableHead>
    <TableHead className="text-purple-900 font-semibold">Hours</TableHead>
    <TableHead className="text-purple-900 font-semibold">OT Pay (1.5x)</TableHead>
    <TableHead className="text-purple-900 font-semibold">Status</TableHead>
    <TableHead className="text-purple-900 font-semibold">Description</TableHead>
    <TableHead className="text-purple-900 font-semibold">Action</TableHead>
  </TableRow>
</TableHeader>

// Table Body - wrap in calculation:
<TableBody>
  {filteredOvertimes.map((ot) => {
    let overtimePay = 0
    if (ot.user?.salary && ot.status === "approved") {
      const hourlyRate = ot.user.salary / 22 / 8.5
      const overtimeHourlyRate = hourlyRate * 1.5
      overtimePay = overtimeHourlyRate * ot.hours_worked
    }
    return (
    <TableRow key={ot.id} className="border-purple-100 hover:bg-purple-50">
      {/* ... existing cells ... */}
      
      {/* NEW Cell: OT Pay */}
      <TableCell className="text-orange-700 font-semibold">
        {ot.status === "approved" ? `₹${overtimePay.toFixed(2)}` : "-"}
      </TableCell>
      
      {/* ... rest of cells ... */}
    </TableRow>
    )
  })}
</TableBody>
```

---

## Summary of Code Changes

| File | Changes | Lines | Type |
|------|---------|-------|------|
| attendance-marker.tsx | 6 changes | ~50 lines added | Feature |
| attendance-report-table.tsx | 3 changes | ~30 lines added | Feature |
| admin-overtime-reports.tsx | 6 changes | ~100 lines added/modified | Feature |
| **Total** | **15 changes** | **~180 lines** | **3 Features** |

---

## Testing These Changes

### 1. Test Holiday Blocking
```
Step 1: Go to dashboard
Step 2: Click "Clock In" on Jan 1, 2026 (New Year)
Step 3: Verify error message appears
Step 4: Try manual attendance with holiday date
Step 5: Verify prevention works
```

### 2. Test Holiday Payroll
```
Step 1: Go to Reports → Attendance Report
Step 2: Select January 2026
Step 3: View report
Step 4: Verify "Effective Days" includes 2 holidays (New Year + Republic Day)
Step 5: Verify final salary includes holiday payment
```

### 3. Test Overtime Pay
```
Step 1: Go to Reports → Overtime Reports
Step 2: Approve an overtime record (e.g., 5 hours)
Step 3: Check "OT Pay (1.5x)" card shows amount
Step 4: Verify table shows correct calculation
Step 5: Check chart displays payroll breakdown
```
