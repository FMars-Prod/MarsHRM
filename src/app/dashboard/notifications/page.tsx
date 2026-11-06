"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { doc, collection, query, where, orderBy, limit, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import Link from "next/link";
import { 
  Bell, CheckCircle2, Clock, MapPin, Command, 
  UserCheck, LifeBuoy, Megaphone, Calendar, Search, 
  ExternalLink, Check, X, ShieldAlert, Filter, Sparkles, AlertCircle
} from "lucide-react";

export default function NotificationManagementPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const currentUserDocRef = useMemoFirebase(
    () => (currentUser ? doc(firestore, "users", currentUser.uid) : null),
    [currentUser, firestore]
  );
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

  const [activeTab, setActiveTab] = React.useState<"pending" | "approved" | "all">("pending");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // 1. Attendance Approval Requests
  const attPendingQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "attendanceApprovalRequests"), where("status", "==", "Pending"), limit(50));
  }, [firestore, isAuthorized]);
  const { data: attPending } = useCollection<any>(attPendingQuery);

  const attProcessedQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "attendanceApprovalRequests"), where("status", "in", ["Approved", "Rejected"]), limit(50));
  }, [firestore, isAuthorized]);
  const { data: attProcessed } = useCollection<any>(attProcessedQuery);

  // 2. Leave Requests
  const leavePendingQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "leave_requests"), where("status", "in", ["Pending", "Pending HR Approval"]), limit(50));
  }, [firestore, isAuthorized]);
  const { data: leavePending } = useCollection<any>(leavePendingQuery);

  const leaveApprovedQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "leave_requests"), where("status", "in", ["Approved", "Rejected"]), limit(50));
  }, [firestore, isAuthorized]);
  const { data: leaveApproved } = useCollection<any>(leaveApprovedQuery);

  // 3. Location Requests
  const locPendingQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "location_change_requests"), where("status", "==", "pending"), limit(50));
  }, [firestore, isAuthorized]);
  const { data: locPending } = useCollection<any>(locPendingQuery);

  const locProcessedQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, "location_change_requests"), where("status", "in", ["approved", "rejected"]), limit(50));
  }, [firestore, isAuthorized]);
  const { data: locProcessed } = useCollection<any>(locProcessedQuery);

  // 4. Quick Actions
  const handleApproveAttendance = (req: any) => {
    if (!currentUser) return;
    try {
      const requestRef = doc(firestore, "attendanceApprovalRequests", req.id);
      updateDocumentNonBlocking(requestRef, {
        status: "Approved",
        approvalTimestamp: serverTimestamp(),
        approverEmployeeId: currentUser.uid,
      });

      const attDateId = req.dateId || format(new Date(), "yyyy-MM-dd");
      const attendanceRef = doc(firestore, `users/${req.employeeId}/attendances`, attDateId);
      
      const attendanceUpdate: any = {
        id: attDateId,
        employeeId: req.employeeId,
        isOutOfRange: false,
      };

      const userInitiatedTime = req.requestTimestamp;
      if (req.type === 'Clock Out') {
        if (userInitiatedTime) attendanceUpdate.checkOutTime = userInitiatedTime;
        if (req.requestedLatitude != null) attendanceUpdate.locationCheckOutLatitude = req.requestedLatitude;
        if (req.requestedLongitude != null) attendanceUpdate.locationCheckOutLongitude = req.requestedLongitude;
      } else {
        if (userInitiatedTime) attendanceUpdate.checkInTime = userInitiatedTime;
        attendanceUpdate.status = req.intendedStatus || 'present';
        if (req.requestedLatitude != null) attendanceUpdate.locationCheckInLatitude = req.requestedLatitude;
        if (req.requestedLongitude != null) attendanceUpdate.locationCheckInLongitude = req.requestedLongitude;
      }

      setDocumentNonBlocking(attendanceRef, attendanceUpdate, { merge: true });

      toast({ title: "Approved", description: `Punch request approved for ${req.employeeName || 'employee'}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleRejectAttendance = (req: any) => {
    if (!currentUser) return;
    try {
      const requestRef = doc(firestore, "attendanceApprovalRequests", req.id);
      updateDocumentNonBlocking(requestRef, {
        status: "Rejected",
        approvalTimestamp: serverTimestamp(),
        approverEmployeeId: currentUser.uid,
      });
      toast({ title: "Rejected", description: `Punch request rejected.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleApproveLocation = (req: any) => {
    if (!currentUser) return;
    try {
      const requestRef = doc(firestore, "location_change_requests", req.id);
      updateDocumentNonBlocking(requestRef, {
        status: "approved",
        approvedBy: currentUser.uid,
        resolvedAt: serverTimestamp(),
      });
      toast({ title: "Location Approved", description: `Location permission granted for ${req.employeeName}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  // Consolidate into standardized items
  const allNotifications = React.useMemo(() => {
    const list: any[] = [];

    // Attendance
    (attPending || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Attendance",
        type: "Attendance Punch Approval",
        employeeName: item.employeeName || "Employee",
        details: `${item.type || 'Punch'} • ${item.reason || 'Requested punch verification'}`,
        status: "Pending",
        rawStatus: item.status,
        timestamp: item.requestTimestamp || item.createdAt,
        link: "/dashboard/attendance-requests",
        rawItem: item,
      });
    });

    (attProcessed || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Attendance",
        type: "Attendance Punch Approval",
        employeeName: item.employeeName || "Employee",
        details: `${item.type || 'Punch'} • Status: ${item.status}`,
        status: item.status === "Approved" ? "Approved" : "Rejected",
        rawStatus: item.status,
        timestamp: item.approvalTimestamp || item.requestTimestamp || item.createdAt,
        link: "/dashboard/attendance-requests",
        rawItem: item,
      });
    });

    // Leaves
    (leavePending || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Leave",
        type: `${item.category || 'Leave'} Request`,
        employeeName: item.employeeName || "Employee",
        details: `${item.leaveType || item.category || 'Leave'}: ${item.reason || 'Personal'}`,
        status: "Pending",
        rawStatus: item.status,
        timestamp: item.createdAt,
        link: "/dashboard/leave",
        rawItem: item,
      });
    });

    (leaveApproved || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Leave",
        type: `${item.category || 'Leave'} Request`,
        employeeName: item.employeeName || "Employee",
        details: `${item.leaveType || item.category || 'Leave'}: ${item.reason || 'Personal'}`,
        status: item.status === "Approved" ? "Approved" : "Rejected",
        rawStatus: item.status,
        timestamp: item.createdAt,
        link: "/dashboard/leave",
        rawItem: item,
      });
    });

    // Location
    (locPending || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Location",
        type: "Remote / Branch Change",
        employeeName: item.employeeName || "Employee",
        details: `Reason: ${item.reason || 'WFH/Branch Change'}`,
        status: "Pending",
        rawStatus: item.status,
        timestamp: item.createdAt,
        link: "/dashboard/location-requests",
        rawItem: item,
      });
    });

    (locProcessed || []).forEach((item: any) => {
      list.push({
        id: item.id,
        category: "Location",
        type: "Remote / Branch Change",
        employeeName: item.employeeName || "Employee",
        details: `Status: ${item.status}`,
        status: item.status === "approved" ? "Approved" : "Rejected",
        rawStatus: item.status,
        timestamp: item.resolvedAt || item.createdAt,
        link: "/dashboard/location-requests",
        rawItem: item,
      });
    });

    // Sort newest first
    return list.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    });
  }, [attPending, attProcessed, leavePending, leaveApproved, locPending, locProcessed]);

  // Filtered view
  const filteredNotifications = React.useMemo(() => {
    return allNotifications.filter((n) => {
      if (activeTab === "pending" && n.status !== "Pending") return false;
      if (activeTab === "approved" && n.status !== "Approved") return false;
      if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          n.employeeName?.toLowerCase().includes(query) ||
          n.details?.toLowerCase().includes(query) ||
          n.type?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allNotifications, activeTab, categoryFilter, searchQuery]);

  const pendingCount = allNotifications.filter(n => n.status === "Pending").length;
  const approvedCount = allNotifications.filter(n => n.status === "Approved").length;

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-4 font-jakarta">
        <ShieldAlert className="size-16 text-destructive mx-auto" />
        <h2 className="text-xl font-black uppercase tracking-tight">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">Notification Management is only accessible to Executives and Nithya Prakash.</p>
        <Button asChild className="rounded-none uppercase font-black text-xs"><Link href="/dashboard">Return to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta text-left">
      <PageHeader
        title="Notification Management & Operations Centre"
        description="Unified hub for tracking, reviewing, approving, and auditing all company notifications and operational requests."
      >
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 rounded-none font-black uppercase text-[10px] px-3 py-1.5">
            <Sparkles className="size-3 mr-1.5" /> {pendingCount} Pending Action Items
          </Badge>
        </div>
      </PageHeader>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="rounded-none border-none ring-1 ring-border/50 shadow-sm bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-700">Requires Action</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{pendingCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-xs font-semibold text-slate-600">Pending Attendance, Leave & Location Approvals</p>
          </CardContent>
        </Card>

        <Card className="rounded-none border-none ring-1 ring-border/50 shadow-sm bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Approved & Resolved</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{approvedCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-xs font-semibold text-slate-600">Successfully validated requests</p>
          </CardContent>
        </Card>

        <Card className="rounded-none border-none ring-1 ring-border/50 shadow-sm bg-gradient-to-br from-blue-500/10 via-white to-blue-500/5">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-blue-700">Total System Stream</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{allNotifications.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-xs font-semibold text-slate-600">All recorded notifications & approvals</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <Card className="rounded-none border-none ring-1 ring-border/50 shadow-sm">
        <CardHeader className="p-6 border-b bg-muted/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant={activeTab === "pending" ? "default" : "outline"} 
              onClick={() => setActiveTab("pending")} 
              className="rounded-none h-10 px-5 font-black uppercase text-[10px] tracking-wider"
            >
              Pending ({pendingCount})
            </Button>
            <Button 
              variant={activeTab === "approved" ? "default" : "outline"} 
              onClick={() => setActiveTab("approved")} 
              className="rounded-none h-10 px-5 font-black uppercase text-[10px] tracking-wider"
            >
              Approved ({approvedCount})
            </Button>
            <Button 
              variant={activeTab === "all" ? "default" : "outline"} 
              onClick={() => setActiveTab("all")} 
              className="rounded-none h-10 px-5 font-black uppercase text-[10px] tracking-wider"
            >
              All Notifications ({allNotifications.length})
            </Button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee or request..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-none h-10 pl-9 font-medium text-xs bg-white"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 bg-white border border-input rounded-none font-bold uppercase text-[10px] tracking-wider focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Attendance">Attendance</option>
              <option value="Leave">Leave Requests</option>
              <option value="Location">Location Access</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Type / Stream</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Details & Reason</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Date / Time</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Quick Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="size-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="font-bold uppercase text-xs tracking-wider">No notifications in this category</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotifications.map((item) => (
                  <TableRow key={`${item.category}_${item.id}`} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-bold text-xs">
                      <div className="flex items-center gap-2">
                        {item.category === "Attendance" && <UserCheck className="size-4 text-amber-600" />}
                        {item.category === "Leave" && <Command className="size-4 text-indigo-600" />}
                        {item.category === "Location" && <MapPin className="size-4 text-purple-600" />}
                        <span>{item.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-black text-xs uppercase tracking-tight text-slate-800">
                      {item.employeeName}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-slate-600 max-w-xs truncate">
                      {item.details}
                    </TableCell>
                    <TableCell className="font-bold text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.timestamp?.toDate ? format(item.timestamp.toDate(), "MMM d, yyyy • p") : "Recent"}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        item.status === "Pending" ? "bg-amber-500/10 text-amber-800 border-amber-300 rounded-none text-[9px] font-black uppercase" :
                        item.status === "Approved" ? "bg-emerald-500/10 text-emerald-800 border-emerald-300 rounded-none text-[9px] font-black uppercase" :
                        "bg-red-500/10 text-red-800 border-red-300 rounded-none text-[9px] font-black uppercase"
                      }>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "Pending" && item.category === "Attendance" && (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveAttendance(item.rawItem)} 
                              className="h-8 rounded-none px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider"
                            >
                              <Check className="size-3 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleRejectAttendance(item.rawItem)} 
                              className="h-8 rounded-none px-3 text-red-600 border-red-200 hover:bg-red-50 font-bold text-[9px] uppercase tracking-wider"
                            >
                              <X className="size-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}

                        {item.status === "Pending" && item.category === "Location" && (
                          <Button 
                            size="sm" 
                            onClick={() => handleApproveLocation(item.rawItem)} 
                            className="h-8 rounded-none px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[9px] uppercase tracking-wider"
                          >
                            <Check className="size-3 mr-1" /> Approve
                          </Button>
                        )}

                        <Button asChild size="sm" variant="ghost" className="h-8 rounded-none px-3 font-bold text-[9px] uppercase tracking-wider">
                          <Link href={item.link}>
                            View <ExternalLink className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

