
'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, useUser, useStorage, useFirestore, useMemoFirebase, useCollection, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, where, serverTimestamp, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
    Edit, MapPin, Camera, CheckCircle2, ShieldCheck, 
    ExternalLink, FileText, CalendarDays, 
    FileBox, Loader2, Phone, 
    Mail, Briefcase, MoreHorizontal, Download, 
    Clock, Activity, UserCheck, Zap, ChevronRight,
    FileDown, Globe, Laptop, User as UserIcon
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { updateProfile, updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, differenceInSeconds, isToday, differenceInDays, eachDayOfInterval, isSunday } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const profileFormSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(1, "Phone is required"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
}).refine(data => {
    if (data.password && data.password.length > 0 && data.password.length < 6) return false;
    return true;
}, {
    message: "Password must be at least 6 characters.",
    path: ["password"],
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const emojiCategories = ["🧑", "👨", "👩", "🕵️", "🧑‍💻", "👨‍💻", "👩‍💻", "🦸", "🦹"];

export default function ProfilePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
    const [userReports, setUserReports] = React.useState<any[]>([]);

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
    const { data: employee, isLoading: isEmployeeLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const docsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'vault_assets'), where('ownerId', '==', user.uid), orderBy('uploadedAt', 'desc')) : null, [user, firestore]);
    const { data: documents } = useCollection<any>(docsQuery);

    const assetsQuery = useMemoFirebase(() => user ? query(collection(firestore, "assets"), where("assignedToId", "==", user.uid)) : null, [user, firestore]);
    const { data: assignedAssets } = useCollection<any>(assetsQuery);

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const attendanceQuery = useMemoFirebase(() => user ? query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', Timestamp.fromDate(monthStart)),
        where('checkInTime', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('checkInTime', 'desc')
    ) : null, [user, firestore]);
    const { data: attendanceData } = useCollection<any>(attendanceQuery);

    const todaysAttendance = React.useMemo(() => {
        if (!attendanceData) return null;
        return attendanceData.find(a => a.checkInTime && isToday(a.checkInTime.toDate()));
    }, [attendanceData]);

    const operationalStatus = React.useMemo(() => {
        if (!todaysAttendance) return "Away";
        if (todaysAttendance.checkOutTime) return "Off-Duty";
        return "Active";
    }, [todaysAttendance]);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "HQ Hub";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "HQ Hub";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const totalDays = differenceInDays(new Date(), start);
        return `${totalDays} d`;
    }, [employee]);

    const monthlyStats = React.useMemo(() => {
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const workingDaysInMonth = days.filter(d => !isSunday(d)).length;

        if (!attendanceData) return { hours: "0.0", percentage: "0", count: 0, totalWorkingDays: workingDaysInMonth };
        let totalSec = 0;
        const presentDays = attendanceData.length;
        attendanceData.forEach(r => {
            if (r.checkInTime && r.checkOutTime) {
                totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
            }
        });
        return { 
            hours: (totalSec / 3600).toFixed(1),
            percentage: Math.min(100, Math.round((presentDays / workingDaysInMonth) * 100)),
            count: presentDays,
            totalWorkingDays: workingDaysInMonth
        };
    }, [attendanceData, monthStart, monthEnd]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { firstName: "", lastName: "", phoneNumber: "", password: "", confirmPassword: "" },
    });

    React.useEffect(() => {
        if (employee) {
            form.reset({ 
                firstName: employee.firstName || '', 
                lastName: employee.lastName || '', 
                phoneNumber: employee.phoneNumber || '',
                password: '', 
                confirmPassword: '' 
            });
        }
    }, [employee, form]);

    React.useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(5));
            const snap = await getDocs(q);
            setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchReports();
    }, [user, firestore]);
    
    async function onSubmit(data: ProfileFormValues) {
        setIsSubmitting(true);
        if (!user || !auth.currentUser) return;
        try {
            const { password, confirmPassword, ...updateData } = data;
            if (userDocRef) updateDocumentNonBlocking(userDocRef, updateData);
            await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
            if (data.password) await updatePassword(auth.currentUser, data.password);
            toast({ title: "Profile updated" });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update failed", description: error.message });
        } finally { setIsSubmitting(false); }
    }
    
    const handleAvatarEmojiUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Icon updated" });
        setIsAvatarDialogOpen(false);
    }

    const handleAvatarImageUpload = async (file: File) => {
        if (!user || !userDocRef || !storage) return;
        setIsUploadingAvatar(true);
        try {
            const avatarRef = ref(storage, `avatars/${user.uid}/${Date.now()}-${file.name}`);
            const snap = await uploadBytes(avatarRef, file);
            const url = await getDownloadURL(snap.ref);
            updateDocumentNonBlocking(userDocRef, { avatar: url });
            toast({ title: "Picture saved" });
            setIsAvatarDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload error" });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDownloadIdCard = async () => {
        if (!employee) return;
        const pdfDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: [54, 86] });
        pdfDoc.setFillColor(107, 33, 168);
        pdfDoc.rect(0, 0, 54, 30, 'F');
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFontSize(8);
        pdfDoc.text("FORTUMARS", 27, 10, { align: 'center' });
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFontSize(11);
        pdfDoc.text(`${employee.firstName} ${employee.lastName}`, 27, 52, { align: 'center' });
        pdfDoc.save(`ID_CARD_${employee.firstName}.pdf`);
    };

    if (isEmployeeLoading || !employee) return <div className="p-20 text-center animate-pulse uppercase font-black text-[10px] tracking-[0.3em]">Loading Hub...</div>;

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in-up pb-10 space-y-6 font-jakarta">
            <div className="flex flex-col gap-1 mb-1">
                <h1 className="text-2xl font-black tracking-tighter uppercase text-foreground/90">Identity Hub</h1>
            </div>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                <CardContent className="p-8 lg:p-12">
                    <div className="flex flex-col gap-10">
                        {/* Top Partition: Square Identity + Basic Details */}
                        <div className="flex items-start gap-10">
                            <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                                <Avatar className="h-32 w-32 md:h-44 md:w-44 rounded-3xl border-4 border-white shadow-2xl ring-1 ring-border">
                                    {employee.avatar?.startsWith('http') ? (
                                        <AvatarImage src={employee.avatar} className="object-cover" />
                                    ) : (
                                        <AvatarFallback className="text-5xl font-black bg-primary/5 text-primary/40">{employee.avatar || employee.firstName?.[0]}</AvatarFallback>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="size-8 text-white" />
                                    </div>
                                </Avatar>
                                <div className={cn("absolute -bottom-2 -right-2 h-7 px-3 rounded-full border-4 border-white shadow-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5", operationalStatus === 'Active' ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-700')}>
                                    {operationalStatus === 'Active' && <CheckCircle2 className="size-2.5"/>} {operationalStatus}
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 pt-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-1">
                                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground leading-none">
                                            {employee.firstName} {employee.lastName}
                                        </h2>
                                        <p className="text-lg md:text-2xl font-bold text-muted-foreground">{employee.jobTitle}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" className="rounded-2xl h-10 px-5 font-black uppercase text-[10px] tracking-widest shadow-sm border-none ring-1 ring-border/50 bg-white">Edit Profile</Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="rounded-2xl h-10 px-4 font-black uppercase text-[10px] tracking-widest bg-white border-none ring-1 ring-border/50">Actions <MoreHorizontal className="size-3.5 ml-2" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 border-none shadow-2xl">
                                                <DropdownMenuItem onClick={handleDownloadIdCard} className="font-black text-[9px] uppercase tracking-widest cursor-pointer gap-2.5 py-3"><Download className="size-4"/> Save Identity Card</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <Badge className="bg-primary/10 text-primary border-none rounded-full px-3 h-5 text-[8px] font-black uppercase tracking-widest">{employee.department} Division</Badge>
                            </div>
                        </div>

                        {/* Partition 1: Identity Data Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-8 border-t border-dashed border-border/50">
                            <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                            <DetailItem icon={CalendarDays} label="Date of Joining" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Mail} label="Email Address" value={employee.email} />
                            <DetailItem icon={Phone} label="Phone Line" value={employee.phoneNumber || "N/A"} />
                        </div>

                        <Separator className="opacity-50" />

                        {/* Partition 2: Employment Details Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            <DetailItem icon={Users} label="Team" value={employee.teamId ? "Assigned" : "Unassigned"} />
                            <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                            <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Employee"} />
                            <DetailItem icon={Clock} label="Account Tier" value={employee.role} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard label="Attendance (MTD)" value={`${monthlyStats.percentage}%`} sub={`${monthlyStats.count}/26 Days Active`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
                <MetricCard label="Intelligence Vault" value={documents?.length || 0} sub="Records Stored" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
                <MetricCard label="Account Authority" value={employee.role === 'CEO/Admin' ? 'Executive' : 'Tactical'} sub="System Permission" icon={ShieldCheck} color="text-orange-600" bg="bg-orange-50" />
                <MetricCard label="Tactical Hours" value={`${monthlyStats.hours}h`} sub="MTD Shift Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-indigo-700 text-white overflow-hidden h-full">
                        <CardContent className="p-8 h-full flex flex-col justify-between space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2.5"><Globe className="size-4" /> Explore MarsOS</h3>
                                <p className="text-[10px] text-white/70 uppercase leading-relaxed font-bold tracking-tight">Access the next-generation operating system interface for high-fidelity operations.</p>
                            </div>
                            <Button asChild className="w-full h-11 rounded-2xl bg-white text-indigo-700 hover:bg-white/90 font-black uppercase text-[10px] tracking-widest shadow-2xl">
                                <Link href="https://fortumars.com/os.html" target="_blank">Activate OS Environment</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8">
                    <Tabs defaultValue="overview" className="space-y-6">
                        <TabsList className="w-full justify-start bg-transparent border-none p-0 h-auto gap-10">
                            {["Overview", "Attendance", "Documents", "Assets"].map(tab => (
                                <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary p-0 pb-2.5 bg-transparent font-black uppercase text-[11px] tracking-[0.2em]">
                                    {tab}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="overview" className="mt-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-6">
                                    <h3 className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">Activity Timeline</h3>
                                    <div className="space-y-6">
                                        {userReports.length > 0 ? userReports.map(r => (
                                            <TimelineItem key={r.id} icon={FileText} title={r.reportType} time={r.date?.toDate ? format(r.date.toDate(), 'dd MMM') : 'N/A'} desc={r.employeeDepartment} color="bg-primary/10 text-primary" />
                                        )) : <p className="text-[10px] text-center opacity-30 font-black uppercase py-10 tracking-widest grayscale flex flex-col items-center gap-3"><Activity className="size-8"/> No activity detected</p>}
                                    </div>
                                    {userReports.length > 0 && <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl" asChild><Link href="/dashboard/reports">View All Submissions</Link></Button>}
                                </Card>
                                <div className="space-y-4">
                                    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-6">
                                        <h3 className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">Employment Details</h3>
                                        <div className="space-y-4">
                                            <InfoRow label="Designation" value={employee.jobTitle} />
                                            <InfoRow label="Department" value={employee.department} />
                                            <InfoRow label="Work Location" value={branchName} />
                                            <InfoRow label="Work Schedule" value={employee.shiftType || 'General Shift'} />
                                            <InfoRow label="Experience" value={experience} />
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="attendance">
                            <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                                <Table>
                                    <TableHeader className="bg-muted/5 border-b"><TableRow><TableHead className="text-[9px] font-black px-8 py-5 uppercase tracking-widest">Mission Date</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest">Time Sync</TableHead><TableHead className="text-[9px] font-black text-right px-8 uppercase tracking-widest">Map Point</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                            <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                                <TableCell className="text-[11px] font-black px-8 py-5 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-[11px] font-mono font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="text-right px-8">
                                                    {rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="inline-flex p-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all shadow-sm"><MapPin className="size-3.5" /></Link>}
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={3} className="h-48 text-center text-[10px] font-black uppercase opacity-30 grayscale"><Clock className="size-10 mx-auto mb-4"/> Registry Clear</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        <TabsContent value="documents">
                            <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {documents && documents.length > 0 ? documents.map(doc => (
                                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-4 p-5 bg-muted/10 rounded-[1.5rem] hover:bg-white hover:shadow-xl hover:border-primary/20 border-2 border-transparent transition-all group">
                                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><FileBox className="size-5" /></div>
                                            <span className="text-[11px] font-black truncate uppercase tracking-tight">{doc.title}</span>
                                        </Link>
                                    )) : <div className="col-span-full py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest grayscale flex flex-col items-center gap-4"><FileBox className="size-12"/> No Intelligence Assets Provisioned</div>}
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assets">
                            <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                        <div key={asset.id} className="p-5 bg-muted/5 rounded-[2rem] space-y-4 hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/20 group">
                                            <div className="aspect-square bg-white rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-border/50 p-2">
                                                {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full rounded-xl" /> : <Laptop className="size-8 opacity-10" />}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black truncate uppercase tracking-tighter">{asset.name}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{asset.category}</p>
                                            </div>
                                        </div>
                                    )) : <div className="col-span-full py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-4 grayscale"><Laptop className="size-12" /> Fleet Hardware Directory Clear</div>}
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Profile Edit Dialog */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 sm:max-w-md border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Identity Recalibration</DialogTitle></DialogHeader>
                    <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-5">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary tracking-widest">First Name</Label><FormControl><Input {...field} className="h-12 rounded-xl text-xs font-bold" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary tracking-widest">Last Name</Label><FormControl><Input {...field} className="h-12 rounded-xl text-xs font-bold" /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary tracking-widest">Secure Phone Line</Label><FormControl><Input {...field} className="h-12 rounded-xl text-xs font-bold" /></FormControl></FormItem>)} />
                        <Button type="submit" className="w-full h-14 rounded-full font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02]" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <Zap className="size-4 mr-2"/>} Synchronize Identity</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>

            {/* Avatar Update Dialog */}
            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 sm:max-w-xs border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Visual Identity</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-8">
                        <div className="relative group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                            <Button variant="outline" className="w-full h-16 border-4 border-dashed border-primary/20 bg-primary/5 rounded-[1.5rem] text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all hover:bg-primary/10" disabled={isUploadingAvatar}>
                                {isUploadingAvatar ? <Loader2 className="animate-spin size-5"/> : <Camera className="size-5" />}
                                {isUploadingAvatar ? "Transmitting..." : "Upload Square Asset"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {emojiCategories.map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-3xl p-4 rounded-2xl hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20 bg-muted/20 flex items-center justify-center">{emoji}</button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4 group">
            <div className="p-3 rounded-2xl bg-primary/5 text-primary/60 shrink-0 shadow-sm transition-transform group-hover:scale-110"><Icon className="size-5" /></div>
            <div className="min-w-0 pt-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none mb-1.5">{label}</p>
                <p className="text-sm font-black truncate text-foreground/80 uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-4 ring-1 ring-border/50 hover:shadow-2xl transition-all duration-500 group">
            <div className={cn("p-3 rounded-2xl w-fit transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-md", bg, color)}><Icon className="size-5" /></div>
            <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 leading-none mb-2 tracking-[0.2em]">{label}</p>
                <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/40 mt-3 uppercase tracking-widest leading-none">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-6 items-start relative group">
            <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", color)}><Icon className="size-5" /></div>
            <div className="space-y-1.5 flex-1">
                <p className="font-black text-sm uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1.5"><Clock className="size-3"/> {time}</span>
                    <Badge variant="outline" className="h-5 px-3 text-[8px] font-black uppercase border-none bg-muted/30 tracking-[0.15em]">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest group-hover:text-primary transition-colors">{label}</span>
            <span className="text-xs font-black text-foreground/80 uppercase text-right pl-4">{value}</span>
        </div>
    );
}
