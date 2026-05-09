"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Eye, EyeOff, UserPlus, Home, Beaker, UserCircle, ShieldCheck, Camera, CheckCircle2, Clock, Link as LinkIcon, Save } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, addDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, writeBatch, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const userSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().min(1, "Required"),
  department: z.string().min(1, "Required"),
  employmentType: z.enum(['Intern', 'Employee']),
  role: z.enum(['Member', 'Team Lead', 'HR Manager', 'CEO/Admin']),
  password: z.string().optional(),
  isWfhAllowed: z.boolean().optional(),
  isDemoAccount: z.boolean().optional(),
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

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading } = useCollection<any>(usersQuery);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phoneNumber: "", jobTitle: "", department: "",
      employmentType: "Intern", role: "Member", password: "", isWfhAllowed: false, isDemoAccount: false
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    try {
        if (editingUser) {
            const userRef = doc(firestore, 'users', editingUser.id);
            const { password, ...updateData } = values;
            const batch = writeBatch(firestore);
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
            batch.set(userRef, { id: newUserId, employeeId: newUserId, hireDate: new Date().toISOString(), ...userData });
            
            batch.set(doc(collection(firestore, 'audit_logs')), {
                timestamp: serverTimestamp(),
                employeeId: newUserId,
                action: 'JOINED',
                details: `Employee ${userData.firstName} ${userData.lastName} added to fleet.`
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

  const handleSignatureUpload = async (file: File) => {
    if (!editingUser) return;
    setIsUploadingSignature(true);
    try {
        const sigRef = ref(storage, `signatures/${editingUser.id}/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(sigRef, file);
        const url = await getDownloadURL(snap.ref);
        const userRef = doc(firestore, 'users', editingUser.id);
        updateDocumentNonBlocking(userRef, { signatureUrl: url, signatureStatus: 'approved' });
        toast({ title: "Signature provisioned and approved." });
        setEditingUser({ ...editingUser, signatureUrl: url, signatureStatus: 'approved' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Bucket Error", description: "Initialize Storage in console or use direct URL option." });
    } finally {
        setIsUploadingSignature(false);
    }
  };

  const handleManualSignatureSave = () => {
      if (!editingUser || !manualSignatureUrl) return;
      const userRef = doc(firestore, 'users', editingUser.id);
      updateDocumentNonBlocking(userRef, { signatureUrl: manualSignatureUrl, signatureStatus: 'approved' });
      toast({ title: "Signature URL Provisioned" });
      setEditingUser({ ...editingUser, signatureUrl: manualSignatureUrl, signatureStatus: 'approved' });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Management" description="Global registry of active and tactical team members.">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setEditingUser(null); setManualSignatureUrl(""); } setIsDialogOpen(open); }}>
            <DialogTrigger asChild><Button className="rounded-full h-11"><PlusCircle className="mr-2" /> Add Employee</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{editingUser ? 'Edit Strategic Profile' : 'Register New Staff Member'}</DialogTitle></DialogHeader>
                <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label>First Name</Label><Input {...field}/></FormItem>)} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label>Last Name</Label><Input {...field}/></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><Label>Email</Label><Input {...field}/></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><Label>Job Title</Label><Input {...field}/></FormItem>)} />
                                <FormField control={form.control} name="department" render={({ field }) => (<FormItem><Label>Department</Label><Input {...field}/></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="employmentType" render={({ field }) => (
                                    <FormItem><Label>Employment Type</Label>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Intern">Intern</SelectItem><SelectItem value="Employee">Employee</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name="role" render={({ field }) => (
                                    <FormItem><Label>System Role</Label>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Member">Member</SelectItem><SelectItem value="Team Lead">Team Lead</SelectItem><SelectItem value="HR Manager">HR Manager</SelectItem><SelectItem value="CEO/Admin">CEO/Admin</SelectItem></SelectContent></Select></FormItem>
                                )} />
                            </div>

                            <Separator className="my-4" />
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Digital Identity Assets</Label>
                                {editingUser ? (
                                    <div className="space-y-4">
                                        {editingUser.signatureUrl ? (
                                            <div className="p-3 bg-muted/20 rounded-xl border border-dashed border-primary/20 flex flex-col items-center gap-2">
                                                <img src={editingUser.signatureUrl} alt="Signature" className="h-12 object-contain" />
                                                <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[8px] font-black uppercase"><CheckCircle2 className="size-2 mr-1" /> Active Signature</Badge>
                                            </div>
                                        ) : (
                                            <div className="h-20 bg-muted/10 rounded-xl border border-dashed border-muted/50 flex flex-col items-center justify-center gap-1.5">
                                                <Camera className="size-5 opacity-20" />
                                                <p className="text-[8px] font-black uppercase text-muted-foreground">Identity Slot Empty</p>
                                            </div>
                                        )}
                                        
                                        <Tabs defaultValue="upload" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 h-8">
                                                <TabsTrigger value="upload" className="text-[10px] uppercase font-bold">Upload</TabsTrigger>
                                                <TabsTrigger value="url" className="text-[10px] uppercase font-bold">Manual URL</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="upload" className="pt-2">
                                                <div className="relative">
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploadingSignature} />
                                                    <Button variant="outline" className="w-full h-10 rounded-xl text-[10px] font-black uppercase" disabled={isUploadingSignature}>
                                                        {isUploadingSignature ? "Syncing..." : editingUser.signatureUrl ? "Update via File" : "Upload File Asset"}
                                                    </Button>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="url" className="pt-2 space-y-2">
                                                <div className="flex gap-2">
                                                    <Input 
                                                        value={manualSignatureUrl} 
                                                        onChange={e => setManualSignatureUrl(e.target.value)} 
                                                        placeholder="Paste image URL here" 
                                                        className="h-9 text-xs"
                                                    />
                                                    <Button type="button" size="icon" className="shrink-0" onClick={handleManualSignatureSave}>
                                                        <Save className="size-4" />
                                                    </Button>
                                                </div>
                                                <p className="text-[8px] text-muted-foreground italic">Useful if Storage bucket is not yet provisioned.</p>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-muted/10 rounded-xl border border-dashed text-center">
                                        <p className="text-[9px] font-bold text-muted-foreground">Register user first to provision identity assets.</p>
                                    </div>
                                )}
                            </div>
                            <Separator className="my-4" />

                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                                <Label className="text-xs font-black uppercase">Demo/Test Account</Label>
                                <FormField control={form.control} name="isDemoAccount" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)} />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                                <Label className="text-xs font-black uppercase">Allow WFH Access</Label>
                                <FormField control={form.control} name="isWfhAllowed" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)} />
                            </div>
                            {!editingUser && <FormField control={form.control} name="password" render={({ field }) => (<FormItem><Label>Temporary Password</Label><Input type="password" {...field}/></FormItem>)} />}
                            <Button type="submit" className="w-full h-12 rounded-full font-black uppercase tracking-widest mt-6">Confirm Dispatch</Button>
                        </form>
                    </Form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="border rounded-2xl overflow-hidden bg-white/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase">Name</TableHead>
              <TableHead className="text-[10px] font-black uppercase">WFH</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Type</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Role</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-32 text-center">Syncing registry...</TableCell></TableRow> : users?.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-bold py-4">
                    <Link href={`/dashboard/users/${u.id}`} className="flex items-center hover:text-primary transition-colors">
                        {u.firstName} {u.lastName} 
                        {u.isDemoAccount && <Badge className="ml-2 bg-purple-100 text-purple-700 text-[8px] uppercase">Demo</Badge>}
                    </Link>
                </TableCell>
                <TableCell>{u.isWfhAllowed ? <Badge className="bg-blue-100 text-blue-700 uppercase text-[8px]">Enabled</Badge> : <Badge variant="outline" className="uppercase text-[8px]">Office Only</Badge>}</TableCell>
                <TableCell className="text-xs">{u.employmentType}</TableCell>
                <TableCell className="text-xs font-bold text-primary">{u.role}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingUser(u); form.reset(u); if(u.signatureUrl) setManualSignatureUrl(u.signatureUrl); setIsDialogOpen(true); }}><Edit className="mr-2 size-4" /> Edit Profile</DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href={`/dashboard/users/${u.id}`}><UserCircle className="mr-2 size-4" /> View Profile</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
