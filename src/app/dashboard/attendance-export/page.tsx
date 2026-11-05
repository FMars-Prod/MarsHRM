"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, getDocs, collectionGroup, doc, Timestamp, orderBy } from "firebase/firestore";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isValid, differenceInSeconds } from "date-fns";
import { 
  Download, FileSpreadsheet, Calendar, Search, Filter, RefreshCw, 
  MapPin, Clock, UserCheck, AlertCircle, CheckCircle2, ShieldCheck, Users, Building2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function AttendanceExportPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const currentUserDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, "users", currentUser.uid) : null), [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDocRef);

  const isNithya = 
    currentUser?.email?.toLowerCase()?.includes('nithya') ||
    currentUserData?.email?.toLowerCase()?.includes('nithya') ||
    (currentUserData?.firstName?.toLowerCase()?.includes('nithya') && currentUserData?.role === 'HR Manager');

  const isAuthorized = 
    currentUserData?.role === 'HR Manager' || 
    currentUserData?.role === 'CEO/Admin' || 
    currentUserData?.role === 'CEO/MD' || 
    isNithya;

  // Date filters
  const [startDateStr, setStartDateStr] = React.useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDateStr, setEndDateStr] = React.useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [attendanceRecords, setAttendanceRecords] = React.useState<any[]>([]);

  // Users list
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const departments = React.useMemo(() => {
    if (!allUsers) return [];
    const depts = new Set<string>();
    allUsers.forEach(u => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts);
  }, [allUsers]);

  // Fetch Attendance Records
  const fetchAttendance = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      const start = startOfDay(new Date(startDateStr));
      const end = endOfDay(new Date(endDateStr));

      // Query all attendances in range across all users
      const attQuery = query(
        collectionGroup(firestore, "attendances"),
        where("checkInTime", ">=", Timestamp.fromDate(start)),
        where("checkInTime", "<=", Timestamp.fromDate(end))
      );

      const snap = await getDocs(attQuery);
      const userMap = new Map<string, any>();
      (allUsers || []).forEach(u => userMap.set(u.id, u));

      const rows: any[] = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const empId = data.employeeId || docSnap.ref.parent.parent?.id;
        const emp = userMap.get(empId) || {};

        // Parse timestamps
        const checkIn = data.checkInTime instanceof Timestamp ? data.checkInTime.toDate() : (data.checkInTime ? new Date(data.checkInTime) : null);
        const checkOut = data.checkOutTime instanceof Timestamp ? data.checkOutTime.toDate() : (data.checkOutTime ? new Date(data.checkOutTime) : null);
        const lunchOut = data.lunchOutTime instanceof Timestamp ? data.lunchOutTime.toDate() : (data.lunchOutTime ? new Date(data.lunchOutTime) : null);
        const lunchIn = data.lunchInTime instanceof Timestamp ? data.lunchInTime.toDate() : (data.lunchInTime ? new Date(data.lunchInTime) : null);

        // Compute total work hours
        let totalHours = 0;
        if (checkIn && checkOut) {
          const diffSec = differenceInSeconds(checkOut, checkIn) - (data.totalBreakDuration || 0);
          totalHours = Math.max(0, diffSec / 3600);
        }

        // Location verification
        const checkInLat = data.locationCheckInLatitude != null ? Number(data.locationCheckInLatitude).toFixed(5) : "";
        const checkInLng = data.locationCheckInLongitude != null ? Number(data.locationCheckInLongitude).toFixed(5) : "";
        const checkOutLat = data.locationCheckOutLatitude != null ? Number(data.locationCheckOutLatitude).toFixed(5) : "";
        const checkOutLng = data.locationCheckOutLongitude != null ? Number(data.locationCheckOutLongitude).toFixed(5) : "";

        const locationType = data.locationCheckInType || (data.isAtHome ? "Home (WFH)" : (data.isOutOfRange ? "Outside Authorized" : "Office Geofence"));

        const uniqueRowKey = `${empId}_${docSnap.id}`;

        rows.push({
          id: uniqueRowKey,
          docId: docSnap.id,
          employeeId: empId,
          employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName || ""}`.trim() : (data.employeeName || "Employee"),
          email: emp.email || "",
          department: emp.department || "General",
          jobTitle: emp.jobTitle || "",
          dateStr: checkIn ? format(checkIn, "yyyy-MM-dd") : docSnap.id,
          dateFormatted: checkIn ? format(checkIn, "dd MMM yyyy") : docSnap.id,
          status: data.status || "present",
          isOutOfRange: !!data.isOutOfRange,
          isAtHome: !!data.isAtHome,
          checkInTime: checkIn ? format(checkIn, "HH:mm:ss") : "--",
          checkOutTime: checkOut ? format(checkOut, "HH:mm:ss") : "--",
          lunchOutTime: lunchOut ? format(lunchOut, "HH:mm:ss") : "--",
          lunchInTime: lunchIn ? format(lunchIn, "HH:mm:ss") : "--",
          totalHours: totalHours > 0 ? totalHours.toFixed(2) : "--",
          breakDurationMinutes: data.totalBreakDuration ? Math.round(data.totalBreakDuration / 60) : 0,
          locationType,
          checkInCoords: checkInLat ? `${checkInLat}, ${checkInLng}` : "",
          checkOutCoords: checkOutLat ? `${checkOutLat}, ${checkOutLng}` : "",
          notes: data.notes || ""
        });
      });

      // Sort by date desc
      rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
      setAttendanceRecords(rows);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, startDateStr, endDateStr, allUsers, toast]);

  React.useEffect(() => {
    if (allUsers && allUsers.length > 0) {
      fetchAttendance();
    }
  }, [allUsers, fetchAttendance]);

  // Filtering
  const filteredRecords = React.useMemo(() => {
    return attendanceRecords.filter(row => {
      if (selectedDepartment !== "all" && row.department !== selectedDepartment) return false;
      if (selectedEmployeeId !== "all" && row.employeeId !== selectedEmployeeId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.employeeName.toLowerCase().includes(q);
        const matchEmail = row.email.toLowerCase().includes(q);
        const matchTitle = row.jobTitle.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchTitle) return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedDepartment, selectedEmployeeId, searchQuery]);

  // Download Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast({ variant: "destructive", title: "No Records", description: "No attendance records available for the selected range." });
      return;
    }

    const excelData = filteredRecords.map(r => ({
      "Date": r.dateFormatted,
      "Employee ID": r.employeeId,
      "Employee Name": r.employeeName,
      "Email": r.email,
      "Department": r.department,
      "Designation": r.jobTitle,
      "Status": r.status.toUpperCase(),
      "Location Status": r.isOutOfRange ? "Outside Range" : (r.isAtHome ? "WFH" : "Authorized Geofence"),
      "Check In Time": r.checkInTime,
      "Check Out Time": r.checkOutTime,
      "Lunch Out Time": r.lunchOutTime,
      "Lunch In Time": r.lunchInTime,
      "Total Break (Mins)": r.breakDurationMinutes,
      "Total Working Hours": r.totalHours,
      "Check-In GPS Coordinates": r.checkInCoords,
      "Check-Out GPS Coordinates": r.checkOutCoords,
      "Notes / Remarks": r.notes
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance_Report");

    // Auto-fit column width
    const maxWidths = Object.keys(excelData[0] || {}).map(key => ({
      wch: Math.max(key.length + 4, 16)
    }));
    worksheet["!cols"] = maxWidths;

    const filename = `Attendance_Report_${startDateStr}_to_${endDateStr}.xlsx`;
    XLSX.writeFile(workbook, filename);

    toast({
      title: "Export Complete",
      description: `Downloaded ${filteredRecords.length} attendance rows to ${filename}`
    });
  };

  // Quick Range Presets
  const handleQuickPreset = (preset: "today" | "week" | "month") => {
    const today = new Date();
    if (preset === "today") {
      setStartDateStr(format(today, "yyyy-MM-dd"));
      setEndDateStr(format(today, "yyyy-MM-dd"));
    } else if (preset === "week") {
      setStartDateStr(format(subDays(today, 7), "yyyy-MM-dd"));
      setEndDateStr(format(today, "yyyy-MM-dd"));
    } else if (preset === "month") {
      setStartDateStr(format(startOfMonth(today), "yyyy-MM-dd"));
      setEndDateStr(format(endOfMonth(today), "yyyy-MM-dd"));
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="size-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-black uppercase text-slate-900">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">Only Admins and Nithya Prakash (HR Management) have clearance to export organizational attendance logs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta text-left">
      <PageHeader
        title="Attendance Records Export"
        description="Comprehensive attendance audit log and Excel report generation synced live with geofence, clock times, break intervals, and employee profiles."
      >
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchAttendance}
            variant="outline"
            disabled={isLoading}
            className="rounded-none h-11 px-4 font-black uppercase text-[10px] tracking-widest bg-white"
          >
            <RefreshCw className={cn("size-4 mr-2", isLoading && "animate-spin")} />
            Sync Database
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={filteredRecords.length === 0 || isLoading}
            className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="size-4 mr-2" />
            Download Excel (.XLSX)
          </Button>
        </div>
      </PageHeader>

      {/* FILTER PANEL */}
      <Card className="border-none ring-1 ring-border/50 bg-white rounded-none shadow-sm text-left">
        <CardHeader className="bg-muted/10 p-5 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-2">
                <Filter className="size-4" /> Attendance Query & Range Filter
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">
                Select custom date range, department or individual employee
              </CardDescription>
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleQuickPreset("today")} className="h-7 rounded-none text-[8px] font-black uppercase">Today</Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickPreset("week")} className="h-7 rounded-none text-[8px] font-black uppercase">Last 7 Days</Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickPreset("month")} className="h-7 rounded-none text-[8px] font-black uppercase">This Month</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" /> From Date
              </Label>
              <Input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="rounded-none h-10 font-mono text-xs font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" /> To Date
              </Label>
              <Input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="rounded-none h-10 font-mono text-xs font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3" /> Department
              </Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="rounded-none h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                <Users className="size-3" /> Employee
              </Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="rounded-none h-10 text-xs font-bold uppercase">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Employees</SelectItem>
                  {allUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.jobTitle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-dashed">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground opacity-50" />
              <Input
                placeholder="Search by name, email, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-none text-xs font-bold"
              />
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
              <span className="font-mono text-primary font-black">{filteredRecords.length}</span> Records Synced
            </div>
          </div>
        </CardContent>
      </Card>

      {/* METRICS SUMMARY STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
        <div className="p-4 bg-white border ring-1 ring-border/50 text-left space-y-1">
          <p className="text-[9px] font-black uppercase text-muted-foreground">Total Rows</p>
          <p className="text-2xl font-black text-slate-900">{filteredRecords.length}</p>
        </div>
        <div className="p-4 bg-emerald-50/50 border border-emerald-200 text-left space-y-1">
          <p className="text-[9px] font-black uppercase text-emerald-900">Present Shifts</p>
          <p className="text-2xl font-black text-emerald-700">
            {filteredRecords.filter(r => r.status === "present").length}
          </p>
        </div>
        <div className="p-4 bg-blue-50/50 border border-blue-200 text-left space-y-1">
          <p className="text-[9px] font-black uppercase text-blue-900">Average Work Hours</p>
          <p className="text-2xl font-black text-blue-700">
            {filteredRecords.length > 0 
              ? (filteredRecords.reduce((acc, curr) => acc + (parseFloat(curr.totalHours) || 0), 0) / filteredRecords.length).toFixed(1) + "h"
              : "0h"}
          </p>
        </div>
        <div className="p-4 bg-purple-50/50 border border-purple-200 text-left space-y-1">
          <p className="text-[9px] font-black uppercase text-purple-900">Geofence Compliance</p>
          <p className="text-2xl font-black text-purple-700">
            {filteredRecords.length > 0
              ? `${Math.round(((filteredRecords.length - filteredRecords.filter(r => r.isOutOfRange).length) / filteredRecords.length) * 100)}%`
              : "100%"}
          </p>
        </div>
      </div>

      {/* ATTENDANCE DATA TABLE */}
      <Card className="border-none ring-1 ring-border/50 bg-white rounded-none shadow-sm overflow-hidden text-left">
        <CardHeader className="bg-muted/10 p-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-600" /> Synced Attendance Database Records
          </CardTitle>
          <Badge className="bg-emerald-100 text-emerald-800 rounded-none border-none text-[8px] font-black uppercase px-2 py-0.5">
            Excel Ready
          </Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-black uppercase text-[9px] py-4 px-6">Date</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Employee</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Department</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Status</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Check-In</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Check-Out</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Break (Mins)</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4">Work Hours</TableHead>
                <TableHead className="font-black uppercase text-[9px] py-4 px-6">Location Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground">
                    Syncing Attendance Records from Cloud Firestore...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center uppercase font-bold text-xs text-muted-foreground italic">
                    No attendance records found for the selected query.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((row) => (
                  <TableRow key={row.id} className="border-border/50 hover:bg-muted/5 transition-colors">
                    <TableCell className="font-mono text-xs font-bold py-4 px-6 text-slate-800">
                      {row.dateFormatted}
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="font-black text-xs uppercase text-slate-900">{row.employeeName}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{row.jobTitle}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold uppercase text-slate-700 py-4">
                      {row.department}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={cn(
                        "rounded-none text-[8px] font-black uppercase px-2 py-0.5 border-none",
                        row.status === "present" ? "bg-emerald-100 text-emerald-800" :
                        row.status === "late" ? "bg-amber-100 text-amber-800" :
                        "bg-rose-100 text-rose-800"
                      )}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold py-4 text-emerald-700">
                      {row.checkInTime}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold py-4 text-rose-700">
                      {row.checkOutTime}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold py-4 text-slate-700">
                      {row.breakDurationMinutes}m
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black py-4 text-primary">
                      {row.totalHours !== "--" ? `${row.totalHours} hrs` : "--"}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-none",
                            row.isOutOfRange ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          )}>
                            {row.locationType}
                          </span>
                        </div>
                        {row.checkInCoords && (
                          <p className="text-[8px] font-mono text-muted-foreground font-bold">
                            {row.checkInCoords}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

