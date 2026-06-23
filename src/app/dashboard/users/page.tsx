
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlusCircle, MoreHorizontal, Trash2, Edit, UserCircle, CheckCircle2, Check, X, LocateFixed, Building2, RotateCcw, Home, Search, Loader2, MapPin, ShieldAlert } from "lucide-react";
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

  const [userToReset, setUserToReset] = React.useState<any | null>(null);
  const [userToDelete, setUserToDelete] = React.useState<any | null>(null);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users"), orderBy("firstName", "asc")), [firestore]);
  const { data: users, isLoading } = useCollection<any>(usersQuery);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const complianceQuery = useMemoFirebase(() => query(collection(firestore, 'compliance_reports')), [firestore]);
  const { data: complianceReports } = useCollection<any>(complianceQuery);

  const nonCompliantUserIds = React.useMemo(() => {
    if (!complianceReports) return new Set<string>();
    return new Set(complianceReports.map(r => r.employeeId));
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
  const selectedHeadIds = form.watch("reportingHeadIds");

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
          toast({ title: "Signal Captured" });
        },
        (error) => {
          toast({ variant: "destructive", title: "GPS Error", description: error.message });
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
            
            if (values.role === 'CEO/Admin') batch.set(doc(firestore, 'system_roles_admin', editingUser.id), { employeeId: editingUser.id });
            if (values.role === 'CEO/MD') batch.set(doc(firestore, 'system_roles_admin', editingUser.id), { employeeId: editingUser.id });
            if (values.role === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', editingUser.id), { employeeId: editingUser.id });
            if (values.role === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', editingUser.id), { employeeId: editingUser.id });

            await batch.commit();
            toast({ title: "User Updated" });
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
            
            if (values.role === 'CEO/Admin') batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
            else if (values.role === 'CEO/MD') batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
            else if (values.role === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', newUserId), { employeeId: newUserId });
            else if (values.role === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', newUserId), { employeeId: newUserId });
            
            await batch.commit();
            toast({ title: "Employee Registered" });
        }
        setIsDialogOpen(false);
        form.reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
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
        toast({ title: "Identity Wiped" });
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Purge Failed", description: err.message });
    } finally {
        setIsPurging(false);
        setUserToDelete(null);
    }
  };

  const handleResetDay = (userId: string) => {
      const todayId = format(new Date(), 'yyyy-MM-dd');
      const attRef = doc(firestore, `users/${userId}/attendances`, todayId);
      deleteDocumentNonBlocking(attRef);
      toast({ title: "Day Reset", description: "Attendance for today has been cleared." });
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
      <PageHeader title="Staff Registry" description="Global directory of team members with industrial table alignment.">
        <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setEditingUser(null); setManagerSearchQuery(""); } setIsDialogOpen(open); }}>
                <DialogTrigger asChild><Button className="rounded-none h-11 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-6"><PlusCircle className="mr-2 h-4 w-4" /> Add Employee</Button></DialogTrigger>
                <DialogContent className="sm:max-w-2xl rounded-none p-8 border-none shadow-2xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingUser ? 'Edit Profile' : 'Register New Member'}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Provision tactical identity access</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-8 px-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4 pb-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">First Name</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Last Name</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Email Address</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reporting To</Label>
                                    
                                    <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-muted/10 border-2 border-dashed border-border/50">
                                        {selectedHeadIds.length === 0 ? (
                                            <span className="text-[11px] font-black uppercase text-muted-foreground/30 tracking-widest self-center px-1">Top Tier Command (Unassigned)</span>
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
                                                placeholder="Search Fleet Roster..." 
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
                                                                const current = form.getValues("reportingHeadIds");
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

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Job Title</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Department</FormLabel><FormControl><Input {...field} className="rounded-none h-12 font-bold text-sm"/></FormControl></FormItem>)} />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="branchId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={cn("text-[10px] font-black uppercase text-primary tracking-widest", isWfhAllowedValue && "opacity-20")}>Office Assignment</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""} disabled={isWfhAllowedValue}>
                                                <FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder={isWfhAllowedValue ? "REMOTE OPS" : "Select Branch"} /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none">
                                                    {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="shiftType" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Shift Profile</FormLabel><FormControl><Input {...field} placeholder="e.g. General Shift" className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>)} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Employment Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Intern">Intern</SelectItem><SelectItem value="Employee">Employee</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Account Tier</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Member">Member</SelectItem><SelectItem value="Team Lead">Team Lead</SelectItem><SelectItem value="HR Manager">HR Manager</SelectItem><SelectItem value="CEO/MD">CEO/MD</SelectItem><SelectItem value="CEO/Admin">CEO/Admin</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="performanceRating" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Performance Rating</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Excellent">Excellent</SelectItem><SelectItem value="Good">Good</SelectItem><SelectItem value="Improving">Improving</SelectItem><SelectItem value="In Review">In Review</SelectItem><SelectItem value="Poor">Poor</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="leaveBalance" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Leave Balance</FormLabel><FormControl><Input type="number" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="payrollAmount" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Payroll Amount</FormLabel><FormControl><Input type="number" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-6 bg-muted/20 border border-dashed border-border/50 rounded-none">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-black uppercase tracking-tight">Allow WFH Mode</Label>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold opacity-60">Authorize remote logging</p>
                                        </div>
                                        <FormField control={form.control} name="isWfhAllowed" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} className="rounded-none" />)} />
                                    </div>

                                    {isWfhAllowedValue && (
                                        <div className="p-6 bg-primary/5 rounded-none border-2 border-primary/10 space-y-6 animate-fade-in-up">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <MapPin className="size-3" /> Home Coordinates
                                                </Label>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 rounded-none text-[9px] font-black uppercase tracking-widest px-4 border border-primary/20 hover:bg-primary/5"
                                                    onClick={handleGetCurrentLocation}
                                                >
                                                    <LocateFixed className="size-3 mr-1.5" /> Capture Signal
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name="homeLatitude" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[9px] uppercase font-black opacity-40">Latitude</FormLabel>
                                                        <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} className="rounded-none h-11 font-mono text-sm font-bold" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="homeLongitude" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[9px] uppercase font-black opacity-40">Longitude</FormLabel>
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
                                
                                {!editingUser && <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest">Password</FormLabel><FormControl><Input type="password" {...field} className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"/></FormControl></FormItem>)} />}
                                <Button type="submit" className="w-full h-14 rounded-none font-black uppercase tracking-widest mt-8 shadow-xl shadow-primary/20">Register Staff Member</Button>
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Identity</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Staff Member</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Sector</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Shift Profile</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">System Tier</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right px-8">Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center animate-pulse uppercase font-black text-sm text-muted-foreground tracking-[0.3em]">Synchronizing Registry...</TableCell></TableRow>
            ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No units registered.</TableCell></TableRow>
            ) : users?.map(u => {
              const userBranch = branches?.find((b: any) => b.id === u.branchId);
              const isRemote = u.isWfhAllowed;
              const hasComplianceIssue = nonCompliantUserIds.has(u.id);

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
                            {isExecutive && hasComplianceIssue && (
                                <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 border-2 border-white shadow-lg animate-pulse">
                                    <ShieldAlert className="size-2.5 text-white" />
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
                                {isExecutive && hasComplianceIssue && (
                                    <Badge className="bg-red-600 text-white animate-pulse rounded-none font-black text-[7px] h-4 px-1.5 border-none">
                                        PROTOCOL ALERT
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{u.jobTitle}</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        {isRemote ? (
                            <Badge className="bg-sky-100 text-sky-700 text-[8px] font-black uppercase border-none px-2 h-6 rounded-none flex gap-1.5 items-center w-fit shadow-sm">
                                <Home className="size-3"/> REMOTE SECTOR
                            </Badge>
                        ) : (
                            <div className="flex items-center gap-2.5 text-xs font-bold uppercase text-foreground/70">
                                <Building2 className="size-4 opacity-40" />
                                {userBranch?.name || "UNASSIGNED"}
                            </div>
                        )}
                    </TableCell>
                    <TableCell className="py-6 align-middle">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">{u.shiftType}</span>
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
                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 px-3 py-2">Mission Control</DropdownMenuLabel>
                                <DropdownMenuItem asChild className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                    <Link href={`/dashboard/users/${u.id}`}><UserCircle className="size-4 text-primary" /> View Profile</Link>
                                </DropdownMenuItem>
                                
                                {isAdmin && (
                                    <>
                                        <DropdownMenuItem onClick={() => { setEditingUser(u); form.reset(u); setIsDialogOpen(true); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                            <Edit className="size-4 text-primary" /> Edit Profile
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem onSelect={e => { e.preventDefault(); setUserToReset(u); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-amber-50 text-amber-600">
                                            <RotateCcw className="size-4" /> Reset Today's Attendance
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        
                                        <DropdownMenuItem onSelect={e => { e.preventDefault(); setUserToDelete(u); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-red-50 text-destructive">
                                            <Trash2 className="size-4" /> Delete User
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
                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-amber-600 flex items-center gap-2">
                      <RotateCcw className="size-5" /> Reset Today's Attendance?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                      Are you sure you want to reset the attendance for <span className="font-bold text-foreground">{userToReset?.firstName} {userToReset?.lastName}</span> for today?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleResetDay(userToReset.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20">
                      Reset
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={o => !o && setUserToDelete(null)}>
          <AlertDialogContent className="rounded-none border-none shadow-2xl">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                      <Trash2 className="size-5" /> Delete User?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                      Are you sure you want to delete <span className="font-bold text-foreground">{userToDelete?.firstName}</span>? This will permanently remove all their data.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
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
