'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser, useStorage, useFirestore, useMemoFirebase, useCollection, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, where, serverTimestamp, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
    Edit, MapPin, Camera, CheckCircle2, ShieldCheck, 
    ExternalLink, FileText, Lock, CalendarDays, 
    FileBox, Loader2, Phone, 
    Mail, Briefcase, MoreHorizontal, Download, 
    Clock, Activity, UserCheck, Zap, ChevronRight,
    FileDown, Target, ImageIcon,
    Table as TableIcon, Laptop, Sparkles, Globe
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
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
        if (!branches || !employee?.branchId) return "HQ Office";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "HQ Office";
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

    const greeting = React.useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Morning";
        if (hour < 17) return "Afternoon";
        return "Evening";
    }, []);

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

    if (isEmployeeLoading || !employee) return <div className="p-20 text-center animate-pulse uppercase font-black text-[10px] tracking-[0.3em]">Loading...</div>;

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
            <div className="flex flex-col gap-0.5 mb-1">
                <h1 className="text-xl font-black tracking-tighter">
                    Good {greeting}, {employee.firstName} ,
                </h1>
            </div>

            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-border/50">
                <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                        <div className="relative group cursor-pointer" onClick={() => setIsAvatarDialogOpen(true)}>
                            <Avatar className="h-16 w-16 md:h-24 md:w-24 rounded-full border-2 border-white shadow-md ring-1 ring-border">
                                {employee.avatar?.startsWith('http') ? (
                                    <AvatarImage src={employee.avatar} className="object-cover" />
                                ) : (
                                    <AvatarFallback className="text-3xl bg-primary/5 text-primary/40 font-black">{employee.avatar || employee.firstName?.[0]}</AvatarFallback>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="size-5 text-white" />
                                </div>
                            </Avatar>
                            <div className={cn("absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm", operationalStatus === 'Active' ? 'bg-green-500' : 'bg-slate-300')} />
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-4 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-3 justify-center md:justify-start">
                                        <h2 className="text-lg md:text-2xl font-black tracking-tighter">{employee.firstName} {employee.lastName}</h2>
                                        <Badge className="bg-primary/10 text-primary border-none rounded-full px-2 py-0 h-5 text-[8px] font-black uppercase tracking-widest">{operationalStatus}</Badge>
                                    </div>
                                    <p className="text-sm font-semibold text-muted-foreground/80">{employee.jobTitle}</p>
                                    <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">{employee.department}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-xl h-9 px-4 text-[9px] font-black uppercase tracking-[0.1em] shadow-sm border-none ring-1 ring-border/50">Edit Profile</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 text-[9px] font-black uppercase tracking-[0.1em] bg-white border-none ring-1 ring-border/50">More <MoreHorizontal className="size-4 ml-1" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 border-none shadow-2xl">
                                            <DropdownMenuItem onClick={handleDownloadIdCard} className="font-black text-[9px] uppercase tracking-widest cursor-pointer gap-2 py-3"><Download className="size-4"/> Save ID Card</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-border/50">
                                <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                                <DetailItem icon={Mail} label="Email Directive" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone Line" value={employee.phoneNumber || "N/A"} />
                                <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                                <DetailItem icon={CalendarDays} label="Joined Operational" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Clock} label="Experience" value={experience} />
                            </div>
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
                    <Card className="border-none shadow-sm rounded-2xl bg-indigo-700 text-white overflow-hidden h-full">
                        <CardContent className="p-6 h-full flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Globe className="size-4" /> Explore MarsOS</h3>
                                <p className="text-[10px] text-white/70 uppercase leading-relaxed font-bold">Access the next-generation operating system interface for high-fidelity operations.</p>
                            </div>
                            <Button asChild className="w-full h-10 rounded-xl bg-white text-indigo-700 hover:bg-white/90 font-black uppercase text-[10px] tracking-widest shadow-xl">
                                <Link href="https://fortumars.com/os.html" target="_blank">Activate OS Environment</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8">
                    <Tabs defaultValue="overview" className="space-y-4">
                        <TabsList className="w-full justify-start bg-transparent border-none p-0 h-auto gap-12">
                            {["Overview", "Attendance", "Documents", "Assets"].map(tab => (
                                <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary p-0 pb-2 bg-transparent font-black uppercase text-[10px] tracking-[0.2em]">
                                    {tab}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="overview" className="mt-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                                    <h3 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Activity Timeline</h3>
                                    <div className="space-y-6">
                                        {userReports.length > 0 ? userReports.map(r => (
                                            <TimelineItem key={r.id} icon={FileText} title={r.reportType} time={r.date?.toDate ? format(r.date.toDate(), 'dd MMM') : 'N/A'} desc={r.employeeDepartment} color="bg-primary/10 text-primary" />
                                        )) : <p className="text-[10px] text-center opacity-30 font-bold uppercase py-10">No activity detected</p>}
                                    </div>
                                    <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg" asChild><Link href="/dashboard/reports">View All</Link></Button>
                                </Card>
                                <div className="space-y-4">
                                    <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                                        <h3 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Recent Assets</h3>
                                        <div className="space-y-3">
                                            {documents && documents.length > 0 ? documents.slice(0, 3).map(doc => (
                                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-transparent hover:border-primary/20 transition-all">
                                                    <FileBox className="size-4 text-blue-600" />
                                                    <p className="text-[11px] font-bold truncate">{doc.title}</p>
                                                </div>
                                            )) : <p className="text-[10px] text-center opacity-30 font-bold uppercase py-4">Vault Access Empty</p>}
                                        </div>
                                        <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg" asChild><Link href="/dashboard/documents">Vault Access</Link></Button>
                                    </Card>
                                    <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                                        <h3 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Employment Details</h3>
                                        <div className="space-y-3">
                                            <InfoRow label="Designation" value={employee.department} />
                                            <InfoRow label="Work Location" value={branchName} />
                                            <InfoRow label="Work Schedule" value={employee.shiftType || 'General Shift'} />
                                            <InfoRow label="Experience" value={experience} />
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="attendance">
                            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-border/50">
                                <Table>
                                    <TableHeader className="bg-muted/5 border-b"><TableRow><TableHead className="text-[9px] font-black px-6 uppercase tracking-widest">Mission Date</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest">Time Sync</TableHead><TableHead className="text-[9px] font-black text-right px-6 uppercase tracking-widest">Verification</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                            <TableRow key={i} className="border-border/50">
                                                <TableCell className="text-xs font-black px-6 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-xs font-mono font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="text-right px-6">
                                                    {rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="inline-flex p-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-all"><MapPin className="size-4" /></Link>}
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={3} className="h-40 text-center text-[10px] font-black uppercase opacity-30">Identity Stamped Registry Clear</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="documents">
                            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {documents && documents.length > 0 ? documents.map(doc => (
                                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-4 p-4 bg-muted/20 rounded-2xl hover:bg-white hover:shadow-lg hover:border-primary/20 border-2 border-transparent transition-all">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><FileBox className="size-5" /></div>
                                            <span className="text-xs font-black truncate uppercase tracking-tight">{doc.title}</span>
                                        </Link>
                                    )) : <div className="col-span-full py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest">No assets found</div>}
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assets">
                            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                        <div key={asset.id} className="p-4 bg-muted/20 rounded-2xl space-y-4 hover:shadow-lg transition-all border border-transparent hover:border-primary/20">
                                            <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden border border-border/50">
                                                {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full" /> : <Laptop className="size-8 opacity-20" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black truncate uppercase tracking-tighter">{asset.name}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{asset.category}</p>
                                            </div>
                                        </div>
                                    )) : <div className="col-span-full py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-4"><Laptop className="size-10" /> Fleet Hardware Clear</div>}
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-[2rem] p-8 sm:max-w-md border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Modify Identity</DialogTitle></DialogHeader>
                    <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">First Name</Label><FormControl><Input {...field} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Last Name</Label><FormControl><Input {...field} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Phone Line</Label><FormControl><Input {...field} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                        <Button type="submit" className="w-full h-12 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>Synchronize Changes</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-[2rem] p-8 sm:max-w-xs border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-lg font-black uppercase text-primary">Update Visual ID</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="relative">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                            <Button variant="outline" className="w-full h-16 border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl text-[10px] uppercase font-black" disabled={isUploadingAvatar}>{isUploadingAvatar ? "Transmitting..." : "Upload Asset"}</Button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {emojiCategories.map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-2xl p-2 rounded-xl hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 bg-muted/20">{emoji}</button>
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
        <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/5 text-primary/60 shrink-0"><Icon className="size-4" /></div>
            <div className="min-w-0">
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 leading-none mb-1 tracking-widest">{label}</p>
                <p className="text-xs font-bold truncate text-foreground/80">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-[1.5rem] bg-white p-5 space-y-3 ring-1 ring-border/50 hover:shadow-xl transition-all">
            <div className={cn("p-2 rounded-xl w-fit shadow-sm", bg, color)}><Icon className="size-4" /></div>
            <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground/50 leading-none mb-1.5 tracking-[0.15em]">{label}</p>
                <p className="text-2xl font-black tracking-tighter leading-none">{value}</p>
                <p className="text-[9px] font-bold text-muted-foreground/40 mt-2 uppercase leading-none">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative">
            <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0 z-10 shadow-sm", color)}><Icon className="size-3" /></div>
            <div className="space-y-1">
                <p className="font-black text-[10px] uppercase tracking-tight">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-3 px-1 text-[7px] font-black uppercase border-none bg-muted/20">{desc}</Badge>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/50 last:border-none">
            <span className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">{label}</span>
            <span className="text-[11px] font-bold text-foreground/80">{value}</span>
        </div>
    );
}
