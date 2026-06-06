
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, UserCircle, ShieldCheck, Camera, CheckCircle2, Clock, Link as LinkIcon, Save, RotateCcw, MapPin, RefreshCcw, Building2, Trash, Home, ChevronDown, Check, LocateFixed } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, updateDocumentNonBlocking, useStorage, deleteDocumentNonBlocking } from "@/firebase";
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
  
  // Selection State
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [isBulkBranchDialogOpen, setIsBulkBranchDialogOpen] = React.useState(false);
  const [bulkBranchId, setBulkBranchId] = React.useState<string>("");

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading } = useCollection<any>(usersQuery);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phoneNumber: "", jobTitle: "", department: "",
      branchId: undefined, shiftType: "General Shift",
      employmentType: "Intern", role: "Member", password: "", isWfhAllowed: false, isDemoAccount: false,
      homeLatitude: undefined, homeLongitude: undefined, homeRadius: 0.5,
      performanceRating: "Average", leaveBalance: 24, payrollAmount: 0
    },
  });

  const isWfhAllowedValue = form.watch("isWfhAllowed");

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("homeLatitude", position.coords.latitude);
          form.setValue("homeLongitude", position.coords.longitude);
          toast({ title: "Signal Captured", description: "Current coordinates updated." });
        },
        (error) => {
          toast({ variant: "destructive", title: "GPS Error", description: error.message });
        }
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

  const handleBulkDelete = async () => {
      const batch = writeBatch(firestore);
      selectedUserIds.forEach(id => {
          batch.delete(doc(firestore, 'users', id));
      });
      await batch.commit();
      toast({ title: "Bulk Purge Complete", description: `${selectedUserIds.length} records removed.` });
      setSelectedUserIds([]);
  };

  const handleBulkBranchUpdate = async () => {
      if (!bulkBranchId) return;
      const batch = writeBatch(firestore);
      selectedUserIds.forEach(id => {
          batch.update(doc(firestore, 'users', id), { branchId: bulkBranchId });
      });
      await batch.commit();
      toast({ title: "Sector Reassigned", description: `Reassigned ${selectedUserIds.length} units to ${getBranchName(bulkBranchId)}.` });
      setSelectedUserIds([]);
      setIsBulkBranchDialogOpen(false);
  };

  const handleBulkToggleWfh = async (allowed: boolean) => {
      const batch = writeBatch(firestore);
      selectedUserIds.forEach(id => {
          batch.update(doc(firestore, 'users', id), { isWfhAllowed: allowed });
      });
      await batch.commit();
      toast({ title: "Protocol Updated", description: `WFH Access ${allowed ? 'Authorized' : 'Rescinded'} for ${selectedUserIds.length} units.` });
      setSelectedUserIds([]);
  };

  const handleResetDay = async (userId: string) => {
      const todayId = format(new Date(), 'yyyy-MM-dd');
      const attRef = doc(firestore, `users/${userId}/attendances`, todayId);
      
      try {
          await deleteDoc(attRef);
          const reportsRef = collection(firestore, `users/${userId}/reports`);
          const todayStart = startOfDay(new Date());
          const todayEnd = endOfDay(new Date());
          const q = query(reportsRef, where('date', '>=', todayStart), where('date', '<=', todayEnd));
          const snap = await getDocs(q);
          const batch = writeBatch(firestore);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          toast({ title: "Day Reset Completed" });
      } catch (err: any) {
          toast({ variant: 'destructive', title: "Reset Failed", description: err.message });
      }
  };

  const handleSignatureUpload = async (file: File) => {
    if (!editingUser) return;
    setIsUploadingSignature(true);
    try {
        const sigRef = ref(storage, `signatures/${editingUser.id}/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(sigRef, file);
        const url = await getDownloadURL(snap.ref);
        const userRef = doc(firestore, 'users', editingUser.id);
        updateDocumentNonBlocking(userRef, { signatureUrl: url, signatureStatus: 'approved', canUpdateSignature: false });
        toast({ title: "Signature provisioned." });
        setEditingUser({ ...editingUser, signatureUrl: url, signatureStatus: 'approved', canUpdateSignature: false });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Upload Error" });
    } finally {
        setIsUploadingSignature(false);
    }
  };

  const handleManualSignatureSave = () => {
      if (!editingUser || !manualSignatureUrl) return;
      const userRef = doc(firestore, 'users', editingUser.id);
      updateDocumentNonBlocking(userRef, { signatureUrl: manualSignatureUrl, signatureStatus: 'approved', canUpdateSignature: false });
      toast({ title: "Signature Synced" });
      setEditingUser({ ...editingUser, signatureUrl: manualSignatureUrl, signatureStatus: 'approved', canUpdateSignature: false });
  };

  const handleResetSignaturePermission = () => {
      if (!editingUser) return;
      const userRef = doc(firestore, 'users', editingUser.id);
      updateDocumentNonBlocking(userRef, { canUpdateSignature: true });
      toast({ title: "Re-upload Permission Granted" });
      setEditingUser({ ...editingUser, canUpdateSignature: true });
  };

  const getBranchName = (bId?: string) => {
      return branches?.find(b => b.id === bId)?.name || 'Unassigned';
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
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="Staff Registry" description="Global directory of active and tactical team members.">
        <div className="flex gap-2">
            {selectedUserIds.length > 0 && (
                <div className="flex gap-2 animate-in slide-in-from-right-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-full h-11 px-6 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest shadow-sm">
                                Bulk Operations ({selectedUserIds.length}) <ChevronDown className="ml-2 size-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Tactical Command</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setIsBulkBranchDialogOpen(true)} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5">
                                <Building2 className="size-3.5" /> Reassign Sector
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleBulkToggleWfh(true)} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5 text-blue-600">
                                <Home className="size-3.5" /> Authorize WFH
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkToggleWfh(false)} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5 text-orange-600">
                                <ShieldCheck className="size-3.5" /> Rescind WFH
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5 text-destructive">
                                        <Trash className="size-3.5" /> Bulk Purge Registry
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-black uppercase tracking-tighter">Purge Multiple Records?</AlertDialogTitle>
                                        <AlertDialogDescription>This will remove {selectedUserIds.length} units from the tactical registry. This action cannot be reversed.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBulkDelete} className="rounded-full font-bold uppercase text-[10px] bg-red-600">Confirm Bulk Purge</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
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

                                <Separator className="my-4 opacity-50" />

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Identity Authentication Assets</Label>
                                    {editingUser ? (
                                        <div className="space-y-4">
                                            {editingUser.signatureUrl ? (
                                                <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center gap-3">
                                                    <img src={editingUser.signatureUrl} alt="Signature" className="h-14 object-contain" />
                                                    <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[8px] font-black uppercase px-3 py-1"><CheckCircle2 className="size-2.5 mr-1.5" /> Verified Signature</Badge>
                                                </div>
                                            ) : (
                                                <div className="h-24 bg-muted/10 rounded-2xl border-2 border-dashed border-muted/30 flex flex-col items-center justify-center gap-2">
                                                    <Camera className="size-6 opacity-20" />
                                                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">No Signature Asset Provisioned</p>
                                                </div>
                                            )}
                                            
                                            {editingUser.signatureUrl && !editingUser.canUpdateSignature ? (
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="w-full rounded-2xl border-2 border-dashed border-primary/30 text-primary font-black text-[9px] uppercase tracking-widest h-12 hover:bg-primary/5 transition-all"
                                                    onClick={handleResetSignaturePermission}
                                                >
                                                    <RotateCcw className="size-3.5 mr-2" /> Allow Signature Recalibration
                                                </Button>
                                            ) : (
                                                <Tabs defaultValue="upload" className="w-full">
                                                    <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/30 p-1 rounded-xl">
                                                        <TabsTrigger value="upload" className="text-[9px] uppercase font-black rounded-lg">Upload Asset</TabsTrigger>
                                                        <TabsTrigger value="url" className="text-[9px] uppercase font-black rounded-lg">URL Link</TabsTrigger>
                                                    </TabsList>
                                                    <TabsContent value="upload" className="pt-3">
                                                        <div className="relative group">
                                                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploadingSignature} />
                                                            <Button variant="outline" className="w-full h-12 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] group-hover:bg-primary/10 transition-all" disabled={isUploadingSignature}>
                                                                {isUploadingSignature ? <Clock className="size-4 animate-spin mr-2"/> : <Camera className="size-4 mr-2" />}
                                                                {isUploadingSignature ? "Transmitting..." : "Update via Binary File"}
                                                            </Button>
                                                        </div>
                                                    </TabsContent>
                                                    <TabsContent value="url" className="pt-3 space-y-3">
                                                        <div className="flex gap-2">
                                                            <Input value={manualSignatureUrl} onChange={e => setManualSignatureUrl(e.target.value)} placeholder="Paste asset URL here" className="h-12 rounded-xl text-xs" />
                                                            <Button type="button" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleManualSignatureSave}><Save className="size-5" /></Button>
                                                        </div>
                                                    </TabsContent>
                                                </Tabs>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-muted/5 rounded-2xl border-2 border-dashed border-border/50 text-center">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest leading-relaxed">Registry entry required before identity asset provisioning.</p>
                                        </div>
                                    )}
                                </div>
                                <Separator className="my-4 opacity-50" />

                                <div className="flex items-center justify-between p-5 bg-purple-50/50 rounded-2xl border border-dashed border-purple-200">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-black uppercase text-purple-900">Demo Account Tier</Label>
                                        <p className="text-[9px] text-purple-700 font-bold uppercase opacity-60">Exempt from operational reporting</p>
                                    </div>
                                    <FormField control={form.control} name="isDemoAccount" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-purple-600" />)} />
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Work Mode</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Work Schedule</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Account Level</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6">Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Synchronizing Registry...</TableCell></TableRow>
            ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No tactical units registered.</TableCell></TableRow>
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
                    <Badge variant="outline" className={cn(
                        "uppercase text-[9px] font-black tracking-widest border-none px-3 h-7 flex items-center w-fit gap-1.5",
                        u.isWfhAllowed ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    )}>
                        {u.isWfhAllowed ? <Home className="size-3" /> : <Building2 className="size-3" />}
                        {u.isWfhAllowed ? "WFH" : "OFFICE"}
                    </Badge>
                </TableCell>
                <TableCell className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{u.shiftType || 'General'}</TableCell>
                <TableCell>
                    <Badge className={cn(
                        "rounded-full text-[8px] font-black uppercase tracking-[0.2em] border-none px-3",
                        u.role === 'CEO/Admin' ? 'bg-indigo-600 text-white' : 
                        u.role === 'HR Manager' ? 'bg-blue-600 text-white' :
                        u.role === 'Team Lead' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                        {u.role}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-white hover:shadow-sm"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 w-52">
                        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Unit Operations</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => { setEditingUser(u); form.reset(u); if(u.signatureUrl) setManualSignatureUrl(u.signatureUrl); setIsDialogOpen(true); }} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5"><Edit className="size-3.5" /> Edit Profile</DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5"><Link href={`/dashboard/users/${u.id}`}><UserCircle className="size-3.5" /> Personnel Audit</Link></DropdownMenuItem>
                        <DropdownMenuSeparator className="opacity-50" />
                        <DropdownMenuItem onClick={() => handleResetDay(u.id)} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5 text-orange-600 hover:bg-orange-50"><RotateCcw className="size-3.5" /> Reset Today (Test)</DropdownMenuItem>
                        <DropdownMenuSeparator className="opacity-50" />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="rounded-xl font-bold text-xs uppercase cursor-pointer gap-2 py-2.5 text-destructive hover:bg-red-50">
                                    <Trash2 className="size-3.5" /> Purge Entry
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Purge Personnel Record?</AlertDialogTitle>
                                    <AlertDialogDescription>This will remove {u.firstName}'s entry from the tactical registry. Access credentials will be blocked.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="rounded-full font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Confirm Purge</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Branch Dialog */}
      <Dialog open={isBulkBranchDialogOpen} onOpenChange={setIsBulkBranchDialogOpen}>
          <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8 border-none shadow-2xl">
              <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Work Location Reassignment</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Reassign {selectedUserIds.length} units to a new work location</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Target Location</Label>
                  <Select value={bulkBranchId} onValueChange={setBulkBranchId}>
                      <SelectTrigger className="rounded-xl h-12 shadow-sm"><SelectValue placeholder="Target Branch" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                          {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <DialogFooter>
                  <Button onClick={handleBulkBranchUpdate} disabled={!bulkBranchId} className="w-full h-14 rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/20">Execute Reassignment</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
