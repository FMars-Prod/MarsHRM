"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc, collection, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, MapPin, LocateFixed, Search, Edit, Building2, Home, Check, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GeofenceManagementPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const currentUserDataRef = useMemoFirebase(() => (currentUser ? doc(firestore, "users", currentUser.uid) : null), [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);

  const locationSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "location"), [firestore]);
  const { data: locationSettings } = useDoc<any>(locationSettingsRef);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users"), orderBy("firstName", "asc")), [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<any>(usersQuery);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, "branches")), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingUser, setEditingUser] = React.useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Edit Modal State
  const [userLocationType, setUserLocationType] = React.useState<"office" | "home">("office");
  const [userBranchId, setUserBranchId] = React.useState("");
  const [userAttendanceMode, setUserAttendanceMode] = React.useState<"default" | "direct" | "strict">("default");
  const [homeLatitude, setHomeLatitude] = React.useState("");
  const [homeLongitude, setHomeLongitude] = React.useState("");
  const [homeRadius, setHomeRadius] = React.useState("0.5");

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setUserLocationType(u.isWfhAllowed ? "home" : "office");
    setUserBranchId(u.branchId || "");
    setUserAttendanceMode(u.attendanceMode || "default");
    setHomeLatitude(u.homeLatitude != null ? String(u.homeLatitude) : "");
    setHomeLongitude(u.homeLongitude != null ? String(u.homeLongitude) : "");
    setHomeRadius(u.homeRadius != null ? String(u.homeRadius) : "0.5");
    setIsEditDialogOpen(true);
  };

  const handleCaptureCurrentGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setHomeLatitude(String(pos.coords.latitude));
          setHomeLongitude(String(pos.coords.longitude));
          toast({ title: "Coordinates Captured", description: "GPS coordinates updated from your device." });
        },
        (err) => {
          toast({ variant: "destructive", title: "GPS Error", description: err.message });
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSaveUserLocation = async () => {
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      const userRef = doc(firestore, "users", editingUser.id);
      const isHome = userLocationType === "home";

      const updatePayload: any = {
        isWfhAllowed: isHome,
        branchId: isHome ? null : (userBranchId || null),
        attendanceMode: userAttendanceMode,
        homeLatitude: isHome && homeLatitude ? Number(homeLatitude) : null,
        homeLongitude: isHome && homeLongitude ? Number(homeLongitude) : null,
        homeRadius: isHome && homeRadius ? Number(homeRadius) : 0.5,
        updatedAt: serverTimestamp(),
      };

      await updateDocumentNonBlocking(userRef, updatePayload);
      toast({ title: "Location Updated", description: `${editingUser.firstName}'s location configuration was saved.` });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleGlobalDirectMode = (val: boolean) => {
    setDocumentNonBlocking(
      locationSettingsRef!,
      {
        directAttendanceEnabled: val,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    toast({
      title: val ? "Direct Attendance Active" : "Strict Mode Active",
      description: val
        ? "Employees outside office can now clock in directly without manager approval."
        : "Employees outside office must submit approval request with reason.",
    });
  };

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.jobTitle || "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta text-left">
      <PageHeader
        title="Attendance & Geofence Control"
        description="Master control for direct outside attendance and per-employee manual location adjustment."
      />

      {/* 1. Global Master Switch Card */}
      <Card className="border-none ring-1 ring-primary/20 shadow-md overflow-hidden rounded-none bg-gradient-to-r from-purple-50/70 via-white to-purple-50/20">
        <CardHeader className="bg-primary/5 border-b border-primary/10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 bg-primary text-white flex items-center justify-center shrink-0 shadow-lg">
                <ShieldCheck className="size-6" />
              </div>
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                    Direct Outside Attendance Mode
                  </CardTitle>
                  <Badge
                    className={
                      locationSettings?.directAttendanceEnabled
                        ? "bg-emerald-500 text-white rounded-none text-[9px] font-black uppercase px-2.5 h-6"
                        : "bg-slate-200 text-slate-700 rounded-none text-[9px] font-black uppercase px-2.5 h-6"
                    }
                  >
                    {locationSettings?.directAttendanceEnabled ? "ACTIVE (DIRECT CLOCK-IN)" : "OFF (APPROVAL REQUIRED)"}
                  </Badge>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Master organization toggle for remote and out-of-range employee punch-ins.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-center bg-white p-3 ring-1 ring-border shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                {locationSettings?.directAttendanceEnabled ? "Direct Mode ON" : "Direct Mode OFF"}
              </span>
              <Switch
                checked={!!locationSettings?.directAttendanceEnabled}
                onCheckedChange={handleToggleGlobalDirectMode}
                className="rounded-none data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 text-left space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white ring-1 ring-border space-y-1">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">When Turn On (Direct Mode)</p>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Employees anywhere outside the office can clock in and clock out immediately. No waiting for admin approval, and no reason popup during clock-out. Coordinates are silently recorded.
              </p>
            </div>
            <div className="p-4 bg-white ring-1 ring-border space-y-1">
              <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">When Turned Off (Strict Legacy Mode)</p>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Employees outside their geofence must provide a written reason and await approval from Team Leads or HR before attendance is marked present.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Employee Manual Location Adjustment Table */}
      <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none bg-white">
        <CardHeader className="bg-muted/10 border-b p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <MapPin className="size-5 text-primary" /> Employee Work Location & Mode Adjustments
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Manually adjust individual employee office assignments, custom home coordinates, or specific attendance modes.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-none text-xs font-bold uppercase bg-white border-border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 text-left">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="text-[9px] font-black uppercase py-4 px-6">Employee</TableHead>
                <TableHead className="text-[9px] font-black uppercase py-4">Work Location</TableHead>
                <TableHead className="text-[9px] font-black uppercase py-4">Assigned Coordinates</TableHead>
                <TableHead className="text-[9px] font-black uppercase py-4">Individual Mode</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase py-4 pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUsersLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs font-black uppercase text-muted-foreground">
                    Loading Employees...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs font-bold uppercase text-muted-foreground opacity-50">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const branch = branches?.find((b: any) => b.id === u.branchId);
                  const isHome = u.isWfhAllowed;
                  const mode = u.attendanceMode || "default";

                  return (
                    <TableRow key={u.id} className="border-border/50 hover:bg-muted/10 transition-colors">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 rounded-none border">
                            <AvatarFallback className="rounded-none font-black text-xs">
                              {u.firstName?.[0] || "U"}{u.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="font-black text-xs uppercase text-slate-900">{u.firstName} {u.lastName}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{u.jobTitle || u.role}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        {isHome ? (
                          <Badge className="bg-sky-100 text-sky-800 text-[8px] font-black uppercase border-none rounded-none px-2 h-6 flex items-center gap-1 w-fit">
                            <Home className="size-3" /> Home (WFH)
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-700">
                            <Building2 className="size-3.5 opacity-50" />
                            {branch?.name || "HQ / Default Office"}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-4 font-mono text-[10px]">
                        {isHome ? (
                          u.homeLatitude != null ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-700">
                                {Number(u.homeLatitude).toFixed(4)}, {Number(u.homeLongitude).toFixed(4)}
                              </span>
                              <p className="text-[8px] font-sans font-bold text-muted-foreground uppercase">
                                Radius: {u.homeRadius || 0.5} KM
                              </p>
                            </div>
                          ) : (
                            <span className="text-amber-600 font-bold uppercase text-[9px]">No Coordinates Set</span>
                          )
                        ) : (
                          <span className="text-muted-foreground uppercase text-[9px] font-bold">Office Geofence</span>
                        )}
                      </TableCell>

                      <TableCell className="py-4">
                        {mode === "direct" && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase border-none rounded-none px-2 h-6">
                            Always Direct
                          </Badge>
                        )}
                        {mode === "strict" && (
                          <Badge className="bg-rose-100 text-rose-800 text-[8px] font-black uppercase border-none rounded-none px-2 h-6">
                            Strict (Requires Approval)
                          </Badge>
                        )}
                        {mode === "default" && (
                          <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none border-border px-2 h-6 text-muted-foreground">
                            Inherit Global
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-4 text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(u)}
                          className="rounded-none h-8 font-black uppercase text-[9px] tracking-widest border-primary/20 text-primary hover:bg-primary/5"
                        >
                          <Edit className="size-3 mr-1.5" /> Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3. Modal: Manually Adjust Employee Location & Mode */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-none p-8 border-none shadow-3xl text-left">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-primary flex items-center gap-2">
              <MapPin className="size-5" /> Adjust Employee Location
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
              Configure assigned work coordinates and punch-in mode for {editingUser?.firstName} {editingUser?.lastName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 text-left">
            {/* Work Location Mode (Office vs Home/WFH) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Work Location Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={userLocationType === "office" ? "default" : "outline"}
                  onClick={() => setUserLocationType("office")}
                  className="rounded-none h-11 font-black uppercase text-[10px] tracking-wider justify-start px-4 gap-2"
                >
                  <Building2 className="size-4" /> Office Branch
                </Button>
                <Button
                  type="button"
                  variant={userLocationType === "home" ? "default" : "outline"}
                  onClick={() => setUserLocationType("home")}
                  className="rounded-none h-11 font-black uppercase text-[10px] tracking-wider justify-start px-4 gap-2"
                >
                  <Home className="size-4" /> Home / Remote (WFH)
                </Button>
              </div>
            </div>

            {/* Office Branch Selection */}
            {userLocationType === "office" && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Assigned Office</Label>
                <Select value={userBranchId} onValueChange={setUserBranchId}>
                  <SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50">
                    <SelectValue placeholder="Select Branch Office" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {branches?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.city || "Branch"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manual Home Coordinates */}
            {userLocationType === "home" && (
              <div className="p-4 bg-primary/5 border border-primary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">
                    Manual Residential Coordinates
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCaptureCurrentGps}
                    className="h-7 text-[8px] font-black uppercase rounded-none bg-white border-primary/30 text-primary"
                  >
                    <LocateFixed className="size-3 mr-1" /> Use Device GPS
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-muted-foreground">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 10.7709"
                      value={homeLatitude}
                      onChange={(e) => setHomeLatitude(e.target.value)}
                      className="rounded-none h-10 font-mono text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-muted-foreground">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 76.0927"
                      value={homeLongitude}
                      onChange={(e) => setHomeLongitude(e.target.value)}
                      className="rounded-none h-10 font-mono text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[8px] font-bold uppercase text-muted-foreground">Allowed Radius (KM)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0.5"
                    value={homeRadius}
                    onChange={(e) => setHomeRadius(e.target.value)}
                    className="rounded-none h-10 font-mono text-xs bg-white w-1/2"
                  />
                </div>
              </div>
            )}

            {/* Attendance Mode Override */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">
                Attendance Mode for this User
              </Label>
              <Select value={userAttendanceMode} onValueChange={(val: any) => setUserAttendanceMode(val)}>
                <SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="default">Inherit Global Setting (Follows System Toggle)</SelectItem>
                  <SelectItem value="direct">Always Direct (Instant Clock In/Out without approval)</SelectItem>
                  <SelectItem value="strict">Strict (Always require reason & approval outside)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="rounded-none h-11 font-black uppercase text-[10px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveUserLocation}
              disabled={isUpdating}
              className="rounded-none h-11 font-black uppercase text-[10px] shadow-lg"
            >
              {isUpdating ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

