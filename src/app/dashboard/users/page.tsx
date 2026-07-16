"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlusCircle, MoreHorizontal, Trash2, Edit, UserCircle, Check, X, LocateFixed, Building2, RotateCcw, Home, Search, Loader2, MapPin, ShieldAlert, Clock, CheckSquare, Layers, Settings2 } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { doc, collection, query, writeBatch, serverTimestamp, getDocs, where, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const userSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().min(1, "Required"),
  department: z.string().min(1, "Required"),
  branchId: z.string().optional(),
  shiftType: z.string().min(1, "Required"),
  employmentType: z.enum(['Intern', 'Employee']),
  role: z.enum(['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin']),
  password: z.string().optional(),
  isWfhAllowed: z.boolean().default(false),
  isDemoAccount: z.boolean().default(false),
  homeLatitude: z.coerce.number().optional(),
  homeLongitude: z.coerce.number().optional(),
  homeRadius: z.coerce.number().optional().default(0.5),
  performanceRating: z.string().optional(),
  leaveBalance: z.coerce.number().default(0),
  payrollAmount: z.coerce.number().optional(),
  reportingHeadIds: z.array(z.string()).default([]),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any | null>(null);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [isPurging, setIsPurging] = React.useState(false);

  // Bulk Edit States
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = React.useState(false);
  const [bulkShift, setBulkShift] = React.useState<string>("");
  const [bulkRole, setBulkRole] = React.useState<string>("");
  const [bulkBranch, setBulkBranch] = React.useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);

  const [userToReset, setUserToReset] = React.useState<any | null>(null);
  const [userToDelete, setUserToDelete] = React.useState<any | null>(null);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users"), orderBy("firstName", "asc")), [firestore]);
  const { data: users, isLoading } = useCollection<any>(usersQuery);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const shiftsQuery = useMemoFirebase(() => query(collection(firestore, 'settings', 'config', 'shifts'), orderBy('name', 'asc')), [firestore]);
  const { data: shifts } = useCollection<any>(shiftsQuery);

  const complianceQuery = useMemoFirebase(() => query(collection(firestore, 'compliance_reports')), [firestore]);
  const { data: complianceReports } = useCollection<any>(complianceQuery);

  const complianceCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (complianceReports) {
      complianceReports.forEach(r => {
        counts[r.employeeId] = (counts[r.employeeId] || 0) + 1;
      });
    }
    return counts;
  }, [complianceReports]);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, "users", currentUser.uid) : null), [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD' || currentUserData?.role === 'Team Lead';
  const isExecutive = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD';

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phoneNumber: "", jobTitle: "", department: "",
      branchId: undefined, shiftType: "General Shift",
      employmentType: "Intern", role: "Member", password: "", isWfhAllowed: false, isDemoAccount: false,
      homeLatitude: undefined, homeLongitude: undefined, homeRadius: 0.5,
      performanceRating: "Good", leaveBalance: 0, payrollAmount: 0, reportingHeadIds: []
    },
  });

  const isWfhAllowedValue = form.watch("isWfhAllowed");
  const selectedHeadIds = form.watch("reportingHeadIds") || [];

  React.useEffect(() => {
      if (isWfhAllowedValue) {
          form.setValue("branchId", undefined);
      }
  }, [isWfhAllowedValue, form]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("homeLatitude", position.coords.latitude);
          form.setValue("homeLongitude", position.coords.longitude);
          toast({ title: "Location saved" });
        },
        (error) => {
          toast({ variant: "destructive", title: "Error", description: error.message });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  };

  const onSubmit = async (values: UserFormValues) => {
    try {
        if (editingUser) {
            const userRef = doc(firestore, 'users', editingUser.id);
            const { password, ...updateData } = values;
            const batch = writeBatch(firestore);
            
            if (values.performanceRating !== editingUser.performanceRating) {
                (updateData as any).lastReviewDate = serverTimestamp();
            }

            if (values.payrollAmount !== editingUser.payrollAmount) {
                (updateData as any).payrollDate = serverTimestamp();
            }

            const isEmployeeType = values.employmentType === 'Employee';
            updateData.totalLeaveEntitlement = isEmployeeType ? 12 : 0;
            if (!isEmployeeType) updateData.leaveBalance = 0;

            batch.update(userRef, updateData);
            
            if (values.role === 'CEO/Admin' || values.role === 'CEO/MD') batch.set(doc(firestore, 'system_roles_admin', editingUser.id), { employeeId: editingUser.id });
            if (values.role === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', editingUser.id), { employeeId: editingUser.id });
            if (values.role === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', editingUser.id), { employeeId: editingUser.id });

            await batch.commit();
            toast({ title: "Updated" });
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password!);
            const newUserId = userCredential.user.uid;
            const userRef = doc(firestore, 'users', newUserId);
            const { password, ...userData } = values;
            
            const batch = writeBatch(firestore);
            const isEmployeeType = values.employmentType === 'Employee';
            const totalLeave = isEmployeeType ? 12 : 0;
            const leaveBal = isEmployeeType ? values.leaveBalance : 0;

            batch.set(userRef, { 
                id: newUserId, 
                employeeId: newUserId, 
                hireDate: new Date().toISOString(), 
                ...userData, 
                leaveBalance: leaveBal,
                totalLeaveEntitlement: totalLeave,
                canUpdateSignature: true,
                lastReviewDate: serverTimestamp()
            });
            
            if (values.role === 'CEO/Admin' || values.role === 'CEO/MD') batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
            else if (values.role === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', newUserId), { employeeId: newUserId });
            else if (values.role === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', newUserId), { employeeId: newUserId });
            
            await batch.commit();
            toast({ title: "Person added" });
        }
        setIsDialogOpen(false);
        form.reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsPurging(true);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'users', userId));
        batch.delete(doc(firestore, 'system_roles_admin', userId));
        batch.delete(doc(firestore, 'system_roles_hr', userId));
        batch.delete(doc(firestore, 'system_roles_teamlead', userId));

        const purgePaths = [
            { path: 'leave_requests', field: 'employeeId' },
            { path: 'issue_reports', field: 'employeeId' },
            { path: 'location_change_requests', field: 'employeeId' },
            { path: 'attendanceApprovalRequests', field: 'employeeId' },
            { path: 'compliance_reports', field: 'employeeId' },
            { path: 'payslips', field: 'employeeId' },
            { path: 'vault_assets', field: 'ownerId' },
            { path: 'folders', field: 'ownerId' },
        ];

        for (const mapping of purgePaths) {
            const q = query(collection(firestore, mapping.path), where(mapping.field, '==', userId));
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
        }

        const subCollections = ['attendances', 'reports', 'todos', 'readAnnouncements', 'policy_acknowledgments'];
        for (const sub of subCollections) {
            const q = collection(firestore, `users/${userId}/${sub}`);
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
        }

        const teamsQuery = query(collection(firestore, 'teams'), where('memberIds', 'array-contains', userId));
        const teamsSnap = await getDocs(teamsQuery);
        teamsSnap.docs.forEach(tDoc => {
            const data = tDoc.data();
            const updatedMembers = data.memberIds.filter((id: string) => id !== userId);
            const teamUpdate: any = { memberIds: updatedMembers };
            if (data.teamLeadId === userId) teamUpdate.teamLeadId = null;
            batch.update(tDoc.ref, teamUpdate);
        });

        const subordinatesQuery = query(collection(firestore, 'users'), where('reportingHeadIds', 'array-contains', userId));
        const subSnap = await getDocs(subordinatesQuery);
        subSnap.docs.forEach(sDoc => {
            const data = sDoc.data();
            const updatedHeads = data.reportingHeadIds.filter((id: string) => id !== userId);
            batch.update(sDoc.ref, { reportingHeadIds: updatedHeads });
        });

        await batch.commit();
        toast({ title: "Account deleted" });
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
        setIsPurging(false);
        setUserToDelete(null);
    }
  };

  const handleBulkUpdate = async () => {
      if (selectedUserIds.length === 0) return;
      setIsBulkUpdating(true);
      try {
          const batch = writeBatch(firestore);
          const updateData: any = {};
          if (bulkShift) updateData.shiftType = bulkShift;
          if (bulkRole) updateData.role = bulkRole;
          if (bulkBranch) updateData.branchId = bulkBranch;

          if (Object.keys(updateData).length === 0) {
              toast({ variant: 'destructive', title: "No changes selected" });
              setIsBulkUpdating(false);
              return;
          }

          selectedUserIds.forEach(uid => {
              batch.update(doc(firestore, 'users', uid), updateData);
              // Handle role permissions if role changed
              if (bulkRole) {
                if (bulkRole === 'CEO/Admin' || bulkRole === 'CEO/MD') batch.set(doc(firestore, 'system_roles_admin', uid), { employeeId: uid });
                if (bulkRole === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', uid), { employeeId: uid });
                if (bulkRole === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', uid), { employeeId: uid });
              }
          });

          await batch.commit();
          toast({ title: "Updated all selected people" });
          setIsBulkEditDialogOpen(false);
          setSelectedUserIds([]);
          setBulkShift("");
          setBulkRole("");
          setBulkBranch("");
      } catch (err: any) {
          toast({ variant: 'destructive', title: "Update failed", description: err.message });
      } finally {
          setIsBulkUpdating(false);
      }
  };

  const handleBulkDeleteAction = async () => {
    if (selectedUserIds.length === 0) return;
    setIsPurging(true);
    try {
        // We delete users one by one using the existing robust logic
        for (const uid of selectedUserIds) {
            await handleDeleteUser(uid);
        }
        toast({ title: "Deleted selected accounts" });
        setSelectedUserIds([]);
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Action failed" });
    } finally {
        setIsPurging(false);
    }
  };

  const handleResetDay = (userId: string) => {
      const todayId = format(new Date(), 'yyyy-MM-dd');
      const attRef = doc(firestore, `users/${userId}/attendances`, todayId);
      deleteDocumentNonBlocking(attRef);
      toast({ title: "Cleared today's attendance" });
      setUserToReset(null);
  };

  const toggleSelectAll = (checked: boolean) => {
      if (checked && users) setSelectedUserIds(users.map(u => u.id));
      else setSelectedUserIds([]);
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
      setSelectedUserIds(prev => checked ? [...prev, id] : prev.filter(uid => uid !== id));
  };

  return (
    <TooltipProvider delayDuration={0}>
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader title="People" description="Manage all team members and their roles.">
        <div className="flex gap-2">
            {selectedUserIds.length > 0 && isExecutive && (
                <div className="flex gap-2 animate-fade-in-up">
                    <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-none h-11 bg-white shadow-sm ring-1 ring-border/50 border-none font-black uppercase text-[10px] tracking-widest gap-2">
                                <Edit className="size-4" /> Edit ({selectedUserIds.length})
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Edit Multiple People</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Update settings for all selected members</DialogDescription>
                            </DialogHeader>
                            <div className="py-6 space-y-6 text-left">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Update Shift</Label>
                                    <Select value={bulkShift} onValueChange={setBulkShift}>
                                        <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="No Change" /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {shifts?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Update Role</Label>
                                    <Select value={bulkRole} onValueChange={setBulkRole}>
                                        <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="No Change" /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Update Location</Label>
                                    <Select value={bulkBranch} onValueChange={setBulkBranch}>
                                        <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="No Change" /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleBulkUpdate} disabled={isBulkUpdating} className="w-full h-12 rounded-none font-black uppercase tracking-widest shadow-2xl">
                                    {isBulkUpdating ? <Loader2 className="size-4 animate-spin mr-2"/> : null}
                                    Update Selected
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="rounded-none h-11 shadow-sm font-black uppercase text-[10px] tracking-widest gap-2">
                                <Trash2 className="size-4" /> Delete ({selectedUserIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-none border-none shadow-3xl">
                            <AlertDialogHeader className="text-left">
                                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Delete selected people?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm font-medium leading-relaxed">This will remove all data for {selectedUserIds.length} people. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-8 gap-3">
                                <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDeleteAction} className="rounded-none font-bold uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700">Confirm</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setEditingUser(null); setManagerSearchQuery(""); } setIsDialogOpen(open); }}>
                <DialogTrigger asChild><Button className="rounded-none h-11 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-6"><PlusCircle className="mr-2 h-4 w-4" /> Add Person</Button></DialogTrigger>
                <DialogContent className="sm:max-w-2xl rounded-none p-8 border-none shadow-3xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingUser ? 'Edit Person' : 'Add New Person'}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Give them access and set their details</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-8 px-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4 pb-8">
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">First Name</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Last Name</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem className="text-left"><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Email</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                
                                <div className="space-y-4 text-left">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reporting To</Label>
                                    
                                    <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-muted/10 border-2 border-dashed border-border/50">
                                        {(selectedHeadIds?.length || 0) === 0 ? (
                                            <span className="text-[11px] font-black uppercase text-muted-foreground/30 tracking-widest self-center px-1">None (Direct report to admin)</span>
                                        ) : (
                                            selectedHeadIds.map(headId => {
                                                const head = users?.find(h => h.id === headId);
                                                return head ? (
                                                    <Badge key={headId} className="bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-none h-8 px-4 border-none gap-2 shadow-sm">
                                                        {head.firstName} {head.lastName}
                                                        <X className="size-3.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => { 
                                                            const current = form.getValues("reportingHeadIds");
                                                            form.setValue("reportingHeadIds", current.filter(id => id !== headId));
                                                        }} />
                                                    </Badge>
                                                ) : null;
                                            })
                                        )}
                                    </div>

                                    <div className="border border-border">
                                        <div className="p-4 border-b bg-muted/20 flex items-center gap-4">
                                            <Search className="size-4 text-muted-foreground/50" />
                                            <Input 
                                                placeholder="Search people..." 
                                                className="h-8 border-none ring-0 focus-visible:ring-0 bg-transparent text-xs font-bold uppercase tracking-tight p-0"
                                                onChange={(e) => setManagerSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <ScrollArea className="h-48 bg-white">
                                            <div className="p-2 space-y-1">
                                                {users?.filter(u => {
                                                    const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(managerSearchQuery.toLowerCase()) || u.jobTitle.toLowerCase().includes(managerSearchQuery.toLowerCase());
                                                    return u.id !== editingUser?.id && matchesSearch;
                                                }).map(manager => {
                                                    const isSelected = !!selectedHeadIds.includes(manager.id);
                                                    return (
                                                        <div 
                                                            key={manager.id} 
                                                            className={cn(
                                                                "flex items-center gap-4 p-4 rounded-none transition-all cursor-pointer group border border-transparent",
                                                                isSelected ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                                                            )}
                                                            onClick={() => {
                                                                const current = form.getValues("reportingHeadIds") || [];
                                                                if (isSelected) form.setValue("reportingHeadIds", current.filter(id => id !== manager.id));
                                                                else form.setValue("reportingHeadIds", [...current, manager.id]);
                                                            }}
                                                        >
                                                            <Checkbox checked={isSelected} className="rounded-none pointer-events-none" />
                                                            <Avatar className="size-10 rounded-none border shrink-0">
                                                                <AvatarImage src={manager.avatar} className="object-cover rounded-none" />
                                                                <AvatarFallback className="rounded-none text-xs font-black">{manager.firstName[0]}{manager.lastName[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-black uppercase truncate group-hover:text-primary transition-colors">{manager.firstName} {manager.lastName}</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground truncate uppercase">{manager.jobTitle}</p>
                                                            </div>
                                                            {isSelected && <Check className="size-4 text-primary" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Job Title</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Department</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <FormField control={form.control} name="branchId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={cn("text-[10px] font-black uppercase text-primary tracking-widest", isWfhAllowedValue && "opacity-20")}>Office Location</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""} disabled={isWfhAllowedValue}>
                                                <FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder={isWfhAllowedValue ? "HOME" : "Select Office"} /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none">
                                                    {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="shiftType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Shift</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select Shift" /></SelectTrigger></FormControl><SelectContent className="rounded-none">
                                            {shifts?.map(s => <SelectItem key={s.id} value={s.name}>{s.name} ({s.start}-{s.end})</SelectItem>)}
                                            {(!shifts || shifts.length === 0) && <SelectItem value="General Shift">General Shift</SelectItem>}
                                        </SelectContent></Select></FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Intern">Intern</SelectItem><SelectItem value="Employee">Employee</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Role</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Member">Member</SelectItem><SelectItem value="Team Lead">Team Lead</SelectItem><SelectItem value="HR Manager">HR Manager</SelectItem><SelectItem value="CEO/MD">CEO/MD</SelectItem><SelectItem value="CEO/Admin">CEO/Admin</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                    <FormField control={form.control} name="performanceRating" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Performance</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Excellent">Excellent</SelectItem><SelectItem value="Good">Good</SelectItem><SelectItem value="Improving">Improving</SelectItem><SelectItem value="In Review">In Review</SelectItem><SelectItem value="Poor">Poor</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="leaveBalance" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Leave Balance</FormLabel><FormControl><Input type="number" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="payrollAmount" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Monthly Amount</FormLabel><FormControl><Input type="number" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-6 bg-muted/20 border border-dashed border-border/50 rounded-none">
                                        <div className="space-y-0.5 text-left">
                                            <Label className="text-sm font-black uppercase tracking-tight">Allow Work From Home</Label>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold opacity-60">Enable remote check-in</p>
                                        </div>
                                        <FormField control={form.control} name="isWfhAllowed" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} className="rounded-none" />)} />
                                    </div>

                                    {isWfhAllowedValue && (
                                        <div className="p-6 bg-primary/5 rounded-none border-2 border-primary/10 space-y-6 animate-fade-in-up text-left">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <MapPin className="size-3" /> Home Location
                                                </Label>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 rounded-none text-[9px] font-black uppercase tracking-widest px-4 border border-primary/20 hover:bg-primary/5"
                                                    onClick={handleGetCurrentLocation}
                                                >
                                                    <LocateFixed className="size-3 mr-1.5" /> Use My Location
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name="homeLatitude" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[9px] uppercase font-black opacity-40">Lat</FormLabel>
                                                        <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} className="rounded-none h-11 font-mono text-sm font-bold" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="homeLongitude" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[9px] uppercase font-black opacity-40">Lng</FormLabel>
                                                        <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} className="rounded-none h-11 font-mono text-sm font-bold" /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FormField control={form.control} name="homeRadius" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[9px] uppercase font-black opacity-40">Radius (KM)</FormLabel>
                                                    <FormControl><Input type="number" step="0.1" {...field} value={field.value ?? ""} className="rounded-none h-11 font-bold" /></FormControl>
                                                </FormItem>
                                            )} />
                                        </div>
                                    )}
                                </div>
                                
                                {!editingUser && <FormField control={form.control} name="password" render={({ field }) => (<FormItem className="text-left"><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Password</FormLabel><FormControl><Input type="password" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>)} />}
                                <Button type="submit" className="w-full h-14 rounded-none font-black uppercase tracking-widest mt-8 shadow-xl shadow-primary/20">Save</Button>
                            </form>
                        </Form>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
      </PageHeader>

      <div className="border-none ring-1 ring-border/50 rounded-none overflow-hidden bg-white shadow-xl">
        <Table>
          <TableHeader className="bg-muted/10 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[60px] py-6 px-6">
                  <Checkbox checked={selectedUserIds.length === (users?.length || 0) && (users?.length || 0) > 0} onCheckedChange={toggleSelectAll} className="rounded-none" />
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Avatar</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Name</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Location</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Shift</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Role</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right px-8">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center animate-pulse uppercase font-black text-sm text-muted-foreground tracking-[0.3em]">Loading...</TableCell></TableRow>
            ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No one here.</TableCell></TableRow>
            ) : users?.map(u => {
              const userBranch = branches?.find((b: any) => b.id === u.branchId);
              const isRemote = u.isWfhAllowed;
              const complianceCount = complianceCounts[u.id] || 0;

              return (
                <TableRow key={u.id} className={cn("border-border/50 group hover:bg-primary/5 transition-colors", selectedUserIds.includes(u.id) && "bg-primary/5")}>
                    <TableCell className="py-6 px-6 align-middle">
                        <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={(c) => toggleSelectUser(u.id, !!c)} className="rounded-none" />
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        <div className="relative">
                            <Avatar className="h-10 w-10 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                <AvatarImage src={u.avatar} className="object-cover" />
                                <AvatarFallback className="rounded-none font-black text-xs bg-muted">{u.firstName?.[0]}{u.lastName?.[0]}</AvatarFallback>
                            </Avatar>
                            {isExecutive && complianceCount > 0 && (
                                <div className="absolute -top-2 -right-2 bg-red-600 rounded-full size-6 flex items-center justify-center border-2 border-white shadow-lg animate-pulse z-10">
                                    <span className="text-white font-black text-[10px]">{complianceCount}</span>
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <Link href={`/dashboard/users/${u.id}`} className="font-black text-base uppercase tracking-tight group-hover:text-primary transition-colors flex items-center gap-2 leading-none">
                                    {u.firstName} {u.lastName} 
                                    {u.isDemoAccount && <Badge className="bg-purple-100 text-purple-700 text-[8px] font-black uppercase border-none px-2 h-4 rounded-none">DEMO</Badge>}
                                </Link>
                                {isExecutive && complianceCount > 0 && (
                                    <Badge className="bg-red-600 text-white animate-pulse rounded-none font-black text-[7px] h-4 px-1.5 border-none">
                                        {complianceCount} ALERTS
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{u.jobTitle}</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        {isRemote ? (
                            <Badge className="bg-sky-100 text-sky-700 text-[8px] font-black uppercase border-none px-2 h-6 rounded-none flex gap-1.5 items-center w-fit shadow-sm">
                                <Home className="size-3"/> HOME
                            </Badge>
                        ) : (
                            <div className="flex items-center gap-2.5 text-xs font-bold uppercase text-foreground/70">
                                <Building2 className="size-4 opacity-40" />
                                {userBranch?.name || "UNASSIGNED"}
                            </div>
                        )}
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
                            <Clock className="size-3 opacity-40" />
                            {u.shiftType}
                        </div>
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        <Badge variant="outline" className="rounded-none font-black text-[9px] uppercase tracking-widest px-2.5 h-6 bg-muted/20 border-none">
                            {u.role}
                        </Badge>
                    </TableCell>
                    <TableCell className="py-6 align-middle text-right px-8">
                    <div className="flex justify-end items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-none h-9 w-9 hover:bg-muted/50"><MoreHorizontal className="size-4.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none border-none shadow-2xl p-2 w-56">
                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 px-3 py-2">Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                    <Link href={`/dashboard/users/${u.id}`}><UserCircle className="size-4 text-primary" /> View Profile</Link>
                                </DropdownMenuItem>
                                
                                {isAdmin && (
                                    <>
                                        <DropdownMenuItem onClick={() => { setEditingUser(u); form.reset(u); setIsDialogOpen(true); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                            <Edit className="size-4 text-primary" /> Edit Details
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem onSelect={e => { e.preventDefault(); setUserToReset(u); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-amber-50 text-amber-600">
                                            <RotateCcw className="size-4" /> Reset Today
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        
                                        <DropdownMenuItem onSelect={e => { e.preventDefault(); setUserToDelete(u); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-red-50 text-destructive">
                                            <Trash2 className="size-4" /> Delete Person
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!userToReset} onOpenChange={o => !o && setUserToReset(null)}>
          <AlertDialogContent className="rounded-none border-none shadow-2xl">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-amber-600 flex items-center gap-2 text-left">
                      <RotateCcw className="size-5" /> Reset Today?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium leading-relaxed text-left">
                      Clear attendance for <span className="font-bold text-foreground">{userToReset?.firstName}</span> for today?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleResetDay(userToReset.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20">
                      Reset
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={o => !o && setUserToDelete(null)}>
          <AlertDialogContent className="rounded-none border-none shadow-2xl">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2 text-left">
                      <Trash2 className="size-5" /> Delete Person?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium leading-relaxed text-left">
                      Remove <span className="font-bold text-foreground">{userToDelete?.firstName}</span>? All their data will be lost.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isPurging} onClick={() => handleDeleteUser(userToDelete.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">
                      {isPurging ? <Loader2 className="size-4 animate-spin mr-2"/> : null}
                      Delete
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-3 rounded-none bg-primary/5 text-primary/60 shrink-0 shadow-sm border border-primary/10"><Icon className="size-6" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 leading-none">{label}</p>
                <p className="text-sm font-black text-foreground/90 uppercase tracking-tight break-all">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-2xl rounded-none bg-white p-8 space-y-6 ring-1 ring-border/50 group hover:shadow-primary/5 transition-all">
            <div className="flex justify-between items-start">
                <div className={cn("p-4 rounded-none shadow-md", color, "bg-muted/10")}><Icon className="size-6" /></div>
                <Badge variant="outline" className="text-[10px] font-bold uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div className="text-left">
                <div className="flex items-center justify-between mb-3.5"><p className="text-[12px] font-black uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-xl font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-sm font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color, onClick }: any) {
    return (
        <div className="flex gap-8 items-start relative group cursor-pointer" onClick={onClick}>
            <div className={cn("h-12 w-12 rounded-none flex items-center justify-center shrink-0 z-10 shadow-lg transition-transform group-hover:scale-110", color)}><Icon className="size-6" /></div>
            <div className="space-y-2 flex-1 pt-1 text-left">
                <p className="font-black text-lg uppercase tracking-tight text-foreground/90 leading-none group-hover:text-primary transition-colors">{title}</p>
                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-6 px-4 text-[10px] font-black uppercase border-none bg-muted/40 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-6 text-muted-foreground/20 group-hover:text-primary transition-all self-center" />
        </div>
    );
}
