
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlusCircle, MoreHorizontal, Trash2, Edit, UserCircle, ShieldCheck, Camera, CheckCircle2, Clock, Link as LinkIcon, Save, RotateCcw, MapPin, RefreshCcw, Building2, Trash, Home, ChevronDown, Check, LocateFixed, Users } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, updateDocumentNonBlocking, useStorage, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { doc, collection, query, writeBatch, serverTimestamp, deleteDoc, where, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  role: z.enum(['Member', 'Team Lead', 'HR Manager', 'CEO/Admin']),
  password: z.string().optional(),
  isWfhAllowed: z.boolean().default(false),
  isDemoAccount: z.boolean().default(false),
  homeLatitude: z.coerce.number().optional(),
  homeLongitude: z.coerce.number().optional(),
  homeRadius: z.coerce.number().optional().default(0.5),
  performanceRating: z.string().optional(),
  leaveBalance: z.coerce.number().default(24),
  payrollAmount: z.coerce.number().optional(),
  reportingHeadIds: z.array(z.string()).default([]),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const storage = useStorage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any | null>(null);
  const [isUploadingSignature, setIsUploadingSignature] = React.useState(false);
  const [manualSignatureUrl, setManualSignatureUrl] = React.useState("");
  
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users"), orderBy("firstName", "asc")), [firestore]);
  const { data: users, isLoading } = useCollection<any>(usersQuery);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, "users", currentUser.uid) : null), [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phoneNumber: "", jobTitle: "", department: "",
      branchId: undefined, shiftType: "General Shift",
      employmentType: "Intern", role: "Member", password: "", isWfhAllowed: false, isDemoAccount: false,
      homeLatitude: undefined, homeLongitude: undefined, homeRadius: 0.5,
      performanceRating: "Average", leaveBalance: 24, payrollAmount: 0, reportingHeadIds: []
    },
  });

  const isWfhAllowedValue = form.watch("isWfhAllowed");
  const selectedHeadIds = form.watch("reportingHeadIds");

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("homeLatitude", position.coords.latitude);
          form.setValue("homeLongitude", position.coords.longitude);
          toast({ title: "Signal Captured", description: "Current coordinates updated with high precision." });
        },
        (error) => {
          toast({ variant: "destructive", title: "GPS Error", description: error.message });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
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

            batch.update(userRef, updateData);
            
            if (values.role === 'CEO/Admin') batch.set(doc(firestore, 'system_roles_admin', editingUser.id), { employeeId: editingUser.id });
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
            batch.set(userRef, { 
                id: newUserId, 
                employeeId: newUserId, 
                hireDate: new Date().toISOString(), 
                ...userData, 
                canUpdateSignature: true,
                totalLeaveEntitlement: 24,
                lastReviewDate: serverTimestamp()
            });
            
            if (values.role === 'CEO/Admin') batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
            else if (values.role === 'HR Manager') batch.set(doc(firestore, 'system_roles_hr', newUserId), { employeeId: newUserId });
            else if (values.role === 'Team Lead') batch.set(doc(firestore, 'system_roles_teamlead', newUserId), { employeeId: newUserId });
            
            await batch.commit();
            toast({ title: "Employee Dispatched" });
        }
        setIsDialogOpen(false);
        form.reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Dispatch Failed', description: e.message });
    }
  };

  const handleDeleteUser = async (userId: string) => {
      try {
          await deleteDoc(doc(firestore, 'users', userId));
          toast({ title: "Registry Purged", description: "User document removed from Firestore." });
          setSelectedUserIds(prev => prev.filter(id => id !== userId));
      } catch (err: any) {
          toast({ variant: 'destructive', title: "Purge Failed", description: err.message });
      }
  };

  const toggleSelectAll = (checked: boolean) => {
      if (checked && users) {
          setSelectedUserIds(users.map(u => u.id));
      } else {
          setSelectedUserIds([]);
      }
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
      setSelectedUserIds(prev => checked ? [...prev, id] : prev.filter(uid => uid !== id));
  };

  return (
    <TooltipProvider delayDuration={0}>
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="Staff Registry" description="Global directory of active team members.">
        <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setEditingUser(null); setManualSignatureUrl(""); } setIsDialogOpen(open); }}>
                <DialogTrigger asChild><Button className="rounded-full h-11 shadow-lg shadow-primary/20"><PlusCircle className="mr-2 h-4 w-4" /> Add Employee</Button></DialogTrigger>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-8 border-none shadow-2xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingUser ? 'Edit Profile' : 'Register New Member'}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Provision tactical identity access</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-8 px-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4 pb-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">First Name</Label><Input {...field} className="rounded-xl h-11"/></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Last Name</Label><Input {...field} className="rounded-xl h-11"/></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Email Directive</Label><Input {...field} className="rounded-xl h-11"/></FormItem>)} />
                                
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reporting Command Heads</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between h-11 rounded-xl bg-muted/20 border-none ring-1 ring-border/50">
                                                <span className="text-xs font-bold uppercase">
                                                    {selectedHeadIds.length === 0 ? "Assign Managers" : `${selectedHeadIds.length} Managers Selected`}
                                                </span>
                                                <ChevronDown className="size-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[350px] p-0 rounded-none border-none shadow-2xl" align="start">
                                            <div className="p-3 border-b bg-muted/10">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Fleet Roster</p>
                                            </div>
                                            <ScrollArea className="h-64">
                                                <div className="p-2 space-y-1">
                                                    {users?.filter(u => u.id !== editingUser?.id).map(manager => {
                                                        const isSelected = !!selectedHeadIds.includes(manager.id);
                                                        return (
                                                            <div 
                                                                key={manager.id} 
                                                                className={cn(
                                                                    "flex items-center gap-3 p-2 rounded-none transition-colors cursor-pointer",
                                                                    isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    const current = form.getValues("reportingHeadIds");
                                                                    if (isSelected) {
                                                                        form.setValue("reportingHeadIds", current.filter(id => id !== manager.id), { shouldDirty: true, shouldValidate: true });
                                                                    } else {
                                                                        form.setValue("reportingHeadIds", [...current, manager.id], { shouldDirty: true, shouldValidate: true });
                                                                    }
                                                                }}
                                                            >
                                                                <Checkbox checked={isSelected} className="rounded-none pointer-events-none" />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-black uppercase truncate">{manager.firstName} {manager.lastName}</p>
                                                                    <p className="text-[9px] font-bold text-muted-foreground truncate">{manager.jobTitle}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Job Title</Label><Input {...field} className="rounded-xl h-11"/></FormItem>)} />
                                    <FormField control={form.control} name="department" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Department</Label><Input {...field} className="rounded-xl h-11"/></FormItem>)} />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="branchId" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Office Assignment</Label>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select Branch" /></SelectTrigger></FormControl><SelectContent>{branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="shiftType" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Work Schedule</Label><Input {...field} placeholder="e.g. General Shift" className="rounded-xl h-11"/></FormItem>)} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Classification</Label>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Intern">Intern</SelectItem><SelectItem value="Employee">Employee</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Account Tier</Label>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Member">Member</SelectItem><SelectItem value="Team Lead">Team Lead</SelectItem><SelectItem value="HR Manager">HR Manager</SelectItem><SelectItem value="CEO/Admin">CEO/Admin</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="performanceRating" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Performance Rating</Label>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Excellent">Excellent</SelectItem><SelectItem value="Good">Good</SelectItem><SelectItem value="Average">Average</SelectItem><SelectItem value="Poor">Poor</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="leaveBalance" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Leave Balance</Label><FormControl><Input type="number" {...field} className="rounded-xl h-11"/></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="payrollAmount" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] font-black uppercase text-primary">Last Payroll Amount</Label><FormControl><Input type="number" {...field} className="rounded-xl h-11"/></FormControl></FormItem>
                                    )} />
                                </div>

                                <Separator className="my-4 opacity-50" />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl border border-dashed border-border/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-black uppercase">Enable WFH Mode</Label>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold opacity-60">Authorize residential logging</p>
                                        </div>
                                        <FormField control={form.control} name="isWfhAllowed" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)} />
                                    </div>

                                    {isWfhAllowedValue && (
                                        <div className="p-5 bg-primary/5 rounded-3xl border-2 border-primary/10 space-y-5 animate-fade-in-up">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <MapPin className="size-3" /> Home Base Coordinates
                                                </Label>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 rounded-full text-[8px] font-black uppercase tracking-widest px-3 border border-primary/20 hover:bg-primary/5"
                                                    onClick={handleGetCurrentLocation}
                                                >
                                                    <LocateFixed className="size-2.5 mr-1.5" /> Capture Signal
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name="homeLatitude" render={({ field }) => (
                                                    <FormItem>
                                                        <Label className="text-[9px] uppercase font-bold opacity-40">Latitude</Label>
                                                        <Input type="number" step="any" {...field} value={field.value ?? ""} className="rounded-xl h-10 font-mono text-xs" />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="homeLongitude" render={({ field }) => (
                                                    <FormItem>
                                                        <Label className="text-[9px] uppercase font-bold opacity-40">Longitude</Label>
                                                        <Input type="number" step="any" {...field} value={field.value ?? ""} className="rounded-xl h-10 font-mono text-xs" />
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FormField control={form.control} name="homeRadius" render={({ field }) => (
                                                <FormItem>
                                                    <Label className="text-[9px] uppercase font-bold opacity-40">Geofence Radius (KM)</Label>
                                                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} className="rounded-xl h-10" />
                                                    <p className="text-[8px] text-muted-foreground italic mt-1.5">Standard precision: 0.5 KM</p>
                                                </FormItem>
                                            )} />
                                        </div>
                                    )}
                                </div>
                                
                                {!editingUser && <FormField control={form.control} name="password" render={({ field }) => (<FormItem><Label className="text-[10px] font-black uppercase text-primary">Temporary Cipher</Label><Input type="password" {...field} className="rounded-xl h-11"/></FormItem>)} />}
                                <Button type="submit" className="w-full h-14 rounded-full font-black uppercase tracking-widest mt-8 shadow-xl shadow-primary/20">Finalize Dispatch Protocol</Button>
                            </form>
                        </Form>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
      </PageHeader>

      <div className="border-none ring-1 ring-border/50 rounded-[2.5rem] overflow-hidden bg-white shadow-xl">
        <Table>
          <TableHeader className="bg-muted/10 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50px] py-6">
                  <Checkbox checked={selectedUserIds.length === (users?.length || 0) && (users?.length || 0) > 0} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Staff Member</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Command Matrix</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right px-6">Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Synchronizing Registry...</TableCell></TableRow>
            ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No tactical units registered.</TableCell></TableRow>
            ) : users?.map(u => (
              <TableRow key={u.id} className={cn("border-border/50 group hover:bg-primary/5 transition-colors", selectedUserIds.includes(u.id) && "bg-primary/5")}>
                <TableCell className="py-5">
                    <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={(c) => toggleSelectUser(u.id, !!c)} />
                </TableCell>
                <TableCell className="py-5">
                    <div className="flex flex-col">
                        <Link href={`/dashboard/users/${u.id}`} className="font-black text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                            {u.firstName} {u.lastName} 
                            {u.isDemoAccount && <Badge className="bg-purple-100 text-purple-700 text-[8px] font-black uppercase border-none px-2 h-4">DEMO</Badge>}
                        </Link>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{u.jobTitle}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {u.reportingHeadIds?.length ? (
                            u.reportingHeadIds.map((headId: string) => {
                                const head = users.find(h => h.id === headId);
                                return head ? (
                                    <Badge key={headId} variant="outline" className="text-[8px] font-black uppercase bg-primary/5 border-primary/10 text-primary px-2">
                                        {head.firstName}
                                    </Badge>
                                ) : null;
                            })
                        ) : (
                            <span className="text-[9px] font-black uppercase opacity-20">Direct to Admin</span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex justify-end items-center gap-1.5">
                    {isAdmin && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/5 transition-all" onClick={() => { setEditingUser(u); form.reset(u); setIsDialogOpen(true); }}>
                                        <Edit className="size-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-sidebar text-white text-[10px] font-black uppercase">Edit Profile</TooltipContent>
                            </Tooltip>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:bg-red-50 transition-all">
                                        <Trash2 className="size-4" />
                                    </Button>
                                </TooltipTrigger>
                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Purge Personnel Record?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm font-medium">
                                            This will remove {u.firstName}'s entry from the tactical registry. Access credentials will be blocked immediately.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-6 gap-3">
                                        <AlertDialogCancel className="rounded-full font-black uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="rounded-full font-black uppercase text-[10px] bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Confirm Purge</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-muted/50"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 w-52">
                            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Operations</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5">
                                <Link href={`/dashboard/users/${u.id}`}><UserCircle className="size-3.5" /> Personnel Audit</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}

