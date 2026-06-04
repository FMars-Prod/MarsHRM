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
    FileDown, Globe, Laptop, User as UserIcon, CalendarClock, AlertCircle, FileCheck
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
import { format, startOfMonth, endOfMonth, differenceInSeconds, isToday, differenceInDays, eachDayOfInterval, isSunday, startOfDay, isBefore } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

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

    const attendanceStats = React.useMemo(() => {
        const today = startOfDay(new Date());
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const totalWorkingDays = daysInMonth.filter(d => !isSunday(d)).length;

        const daysSoFar = eachDayOfInterval({ start: monthStart, end: today });
        const workingDaysSoFar = daysSoFar.filter(d => !isSunday(d)).length;

        if (!attendanceData) return { present: 0, late: 0, absent: workingDaysSoFar, remaining: totalWorkingDays - workingDaysSoFar, percentage: 0, totalWorkingDays };
        
        const present = attendanceData.filter(a => a.status === 'present').length;
        const late = attendanceData.filter(a => a.status === 'late').length;
        const attended = present + late;
        
        const absent = Math.max(0, workingDaysSoFar - attended);
        const remaining = Math.max(0, totalWorkingDays - workingDaysSoFar);

        return { 
            present, 
            late, 
            absent, 
            remaining,
            totalWorkingDays,
            percentage: Math.min(100, Math.round((attended / totalWorkingDays) * 100))
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

    const leaveBal = employee.leaveBalance ?? 24;
    const leaveEnt = employee.totalLeaveEntitlement ?? 24;
    const leavePercentage = Math.round((leaveBal / leaveEnt) * 100);

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-6">
                            <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                                <Avatar className="h-24 w-24 rounded-3xl border-4 border-white shadow-2xl ring-1 ring-border">
                                    {employee.avatar?.startsWith('http') ? (
                                        <AvatarImage src={employee.avatar} className="object-cover" />
                                    ) : (
                                        <AvatarFallback className="text-4xl font-black bg-primary/5 text-primary/40">{employee.avatar || employee.firstName?.[0]}</AvatarFallback>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="size-6 text-white" />
                                    </div>
                                </Avatar>
                                <div className={cn("absolute -bottom-1 -right-1 h-6 px-2 rounded-full border-4 border-white shadow-lg font-black text-[8px] uppercase tracking-widest flex items-center gap-1", operationalStatus === 'Active' ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-700')}>
                                    {operationalStatus === 'Active' && <CheckCircle2 className="size-2"/>} {operationalStatus}
                                </div>
                            </div>

                            <div className="flex-1 space-y-2 pt-1">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                    <div className="space-y-0.5">
                                        <h2 className="text-2xl font-black tracking-tighter text-foreground leading-none">
                                            {employee.firstName} {employee.lastName}
                                        </h2>
                                        <p className="text-sm font-bold text-muted-foreground">{employee.jobTitle}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-xl h-9 px-4 font-black uppercase text-[9px] tracking-widest shadow-sm border-none ring-1 ring-border/50 bg-white">Edit Profile</Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 font-black uppercase text-[9px] tracking-widest bg-white border-none ring-1 ring-border/50">Actions <MoreHorizontal className="size-3 ml-1.5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl p-2 w-48 border-none shadow-2xl">
                                                <DropdownMenuItem onClick={handleDownloadIdCard} className="font-black text-[9px] uppercase tracking-widest cursor-pointer gap-2.5 py-3"><Download className="size-4"/> Save Identity Card</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <Badge className="bg-primary/10 text-primary border-none rounded-full px-2.5 h-4 text-[7px] font-black uppercase tracking-widest">TACTICAL HUB ACTIVE</Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-3 border-t border-dashed border-border/50">
                            <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                            <DetailItem icon={CalendarDays} label="Joining Date" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Mail} label="Email Directive" value={employee.email} />
                            <DetailItem icon={Phone} label="Phone Line" value={employee.phoneNumber || "N/A"} />
                        </div>

                        <Separator className="opacity-50" />

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <DetailItem icon={Users} label="Team Fleet" value={employee.teamId ? "Assigned" : "Unassigned"} />
                            <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                            <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Employee"} />
                            <DetailItem icon={Clock} label="Account Tier" value={employee.role} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-5 space-y-4 ring-1 ring-border/50 hover:shadow-xl transition-all group duration-500">
                    <div className="flex justify-between items-start">
                        <div className="p-2 rounded-xl bg-green-50 text-green-600 shadow-sm transition-transform group-hover:scale-110"><UserCheck className="size-4" /></div>
                        <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest bg-muted/20 border-none">Audit Sync</Badge>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Attendance</p>
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-2xl font-black text-green-600">{attendanceStats.present + attendanceStats.late}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">/ {attendanceStats.totalWorkingDays} Days</span>
                        </div>
                        <Progress value={attendanceStats.percentage} className="h-1.5 mb-4" />
                        <div className="grid grid-cols-4 gap-1">
                            <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground/60 uppercase">Pres</p><p className="text-xs font-black">{attendanceStats.present}</p></div>
                            <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground/60 uppercase">Late</p><p className="text-xs font-black text-amber-500">{attendanceStats.late}</p></div>
                            <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground/60 uppercase">Abs</p><p className="text-xs font-black text-red-500">{attendanceStats.absent}</p></div>
                            <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground/60 uppercase">Rem</p><p className="text-xs font-black text-blue-400">{attendanceStats.remaining}</p></div>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-dashed flex justify-between items-center">
                        <span className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Today's Hub Signal:</span>
                        <Badge className={cn("text-[7px] font-black h-4 px-2 uppercase rounded-full border-none", operationalStatus === 'Active' ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>{operationalStatus}</Badge>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-5 space-y-4 ring-1 ring-border/50 hover:shadow-xl transition-all group duration-500">
                    <div className="flex justify-between items-start">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shadow-sm transition-transform group-hover:scale-110"><CalendarClock className="size-4" /></div>
                        <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest bg-muted/20 border-none">Balance</Badge>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Leave Balance</p>
                            <span className="text-sm font-black text-blue-600">{leaveBal}/{leaveEnt}</span>
                        </div>
                        <Progress value={leavePercentage} className="h-1.5 mb-4" />
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 leading-none">Days remaining for member</p>
                    </div>
                    <div className="pt-2 border-t border-dashed flex justify-between items-center">
                        <span className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Stored Assets:</span>
                        <span className="text-[10px] font-black text-blue-600">{documents?.length || 0} Files</span>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-5 space-y-4 ring-1 ring-border/50 hover:shadow-xl transition-all group duration-500">
                    <div className="flex justify-between items-start">
                        <div className="p-2 rounded-xl bg-orange-50 text-orange-600 shadow-sm transition-transform group-hover:scale-110"><Zap className="size-4" /></div>
                        <Badge variant="outline" className="text-[7px] font-black uppercase bg-muted/20 border-none">Integrity</Badge>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Performance Audit</p>
                        <div className="flex items-center gap-3">
                            <h4 className={cn(
                                "text-2xl font-black tracking-tighter uppercase",
                                employee.performanceRating === 'Excellent' ? "text-green-600" :
                                employee.performanceRating === 'Good' ? "text-blue-600" :
                                employee.performanceRating === 'Average' ? "text-amber-500" : "text-red-500"
                            )}>
                                {employee.performanceRating || "Good"}
                            </h4>
                        </div>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-1">Strategic competence tier</p>
                    </div>
                    <div className="pt-2 border-t border-dashed">
                        <p className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Last Review Date:</p>
                        <p className="text-[9px] font-bold text-foreground/70">{employee.lastReviewDate ? format(new Date(employee.lastReviewDate.toDate ? employee.lastReviewDate.toDate() : employee.lastReviewDate), 'dd MMM yyyy') : 'N/A'}</p>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-5 space-y-4 ring-1 ring-border/50 hover:shadow-xl transition-all group duration-500">
                    <div className="flex justify-between items-start">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shadow-sm transition-transform group-hover:scale-110"><FileCheck className="size-4" /></div>
                        <Badge variant="outline" className="text-[7px] font-black uppercase bg-muted/20 border-none">Ledger</Badge>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Payroll Status</p>
                        <h4 className="text-2xl font-black tracking-tighter text-purple-600 uppercase">
                            {employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : "Audited"}
                        </h4>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-1">
                            {employee.payrollDate ? `Issued: ${format(new Date(employee.payrollDate.toDate ? employee.payrollDate.toDate() : employee.payrollDate), 'dd MMM')}` : "Ledger Synced"}
                        </p>
                    </div>
                    <div className="pt-2 border-t border-dashed">
                        <p className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Next Objective Cycle:</p>
                        <p className="text-[9px] font-black text-purple-700 uppercase">
                            {employee.employmentType === 'Intern' ? "Based on Performance" : "Scheduled cycle"}
                        </p>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                <div className="lg:col-span-12">
                    <Card className="border-none shadow-lg rounded-2xl bg-indigo-700 text-white overflow-hidden">
                        <CardContent className="p-3 h-full flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Globe className="size-3.5" /> Explore MarsOS</h3>
                            </div>
                            <Button asChild size="sm" className="rounded-xl bg-white text-indigo-700 hover:bg-white/90 font-black uppercase text-[9px] tracking-widest px-6 shadow-xl h-8">
                                <Link href="https://fortumars.com/os.html" target="_blank">Activate Environment</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-12">
                    <Tabs defaultValue="overview" className="space-y-4">
                        <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-xl p-1 h-auto gap-2">
                            {["Overview", "Attendance", "Documents", "Assets"].map(tab => (
                                <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2 font-black uppercase text-[9px] tracking-[0.2em] transition-all bg-transparent border-none">
                                    {tab}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="overview" className="mt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                                    <h3 className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">Activity Timeline</h3>
                                    <div className="space-y-4">
                                        {userReports.length > 0 ? userReports.map(r => (
                                            <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={r.date?.toDate ? format(r.date.toDate(), 'dd MMM') : 'N/A'} desc={`Shift finalized for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                                        )) : <p className="text-[9px] text-center opacity-30 font-black uppercase py-6 tracking-widest flex flex-col items-center gap-2"><Activity className="size-6"/> No activity detected</p>}
                                    </div>
                                    {userReports.length > 0 && <Button variant="ghost" className="w-full h-8 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl" asChild><Link href="/dashboard/reports">View All</Link></Button>}
                                </Card>
                                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                                    <h3 className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-[0.2em]">Employment Details</h3>
                                    <div className="space-y-3">
                                        <InfoRow label="Designation" value={employee.jobTitle} />
                                        <InfoRow label="Department" value={employee.department} />
                                        <InfoRow label="Work Location" value={branchName} />
                                        <InfoRow label="Work Schedule" value={employee.shiftType || 'General Shift'} />
                                        <InfoRow label="Experience" value={experience} />
                                    </div>
                                </Card>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="attendance">
                            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-border/50">
                                <Table>
                                    <TableHeader className="bg-muted/5 border-b"><TableRow><TableHead className="text-[8px] font-black px-6 py-4 uppercase tracking-widest">Mission Date</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest">Time Sync</TableHead><TableHead className="text-[8px] font-black text-right px-6 uppercase tracking-widest">Map Point</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                            <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                                <TableCell className="text-[10px] font-black px-6 py-3 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-[10px] font-mono font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="text-right px-6">
                                                    {rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="inline-flex p-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-all shadow-sm"><MapPin className="size-3" /></Link>}
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-[9px] font-black uppercase opacity-30 grayscale"><Clock className="size-8 mx-auto mb-2"/> Registry Clear</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        <TabsContent value="documents">
                            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {documents && documents.length > 0 ? documents.map(doc => (
                                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl hover:bg-white hover:shadow-lg hover:border-primary/20 border-2 border-transparent transition-all group">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><FileBox className="size-4" /></div>
                                            <span className="text-[10px] font-black truncate uppercase tracking-tight">{doc.title}</span>
                                        </Link>
                                    )) : <div className="col-span-full py-10 text-center opacity-30 font-black uppercase text-[9px] tracking-widest grayscale flex flex-col items-center gap-2"><FileBox className="size-8"/> No Intelligence Assets</div>}
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assets">
                            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                        <div key={asset.id} className="p-3 bg-muted/5 rounded-xl space-y-2 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary/20 group">
                                            <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden border border-dashed border-border/50 p-1">
                                                {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full rounded-md" /> : <Laptop className="size-6 opacity-10" />}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] font-black truncate uppercase tracking-tighter">{asset.name}</p>
                                                <p className="text-[7px] font-bold text-muted-foreground uppercase">{asset.category}</p>
                                            </div>
                                        </div>
                                    )) : <div className="col-span-full py-10 text-center opacity-30 font-black uppercase text-[9px] tracking-widest flex flex-col items-center gap-2 grayscale"><Laptop className="size-8" /> Fleet Directory Clear</div>}
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-[2rem] p-8 sm:max-w-md border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Identity Recalibration</DialogTitle></DialogHeader>
                    <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary tracking-widest">First Name</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs font-bold" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary tracking-widest">Last Name</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs font-bold" /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary tracking-widest">Phone Line</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs font-bold" /></FormControl></FormItem>)} />
                        <Button type="submit" className="w-full h-12 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <Zap className="size-4 mr-2"/>} Synchronize Identity</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-[2rem] p-8 sm:max-w-xs border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-lg font-black uppercase tracking-tighter text-primary">Visual Identity</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="relative group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                            <Button variant="outline" className="w-full h-14 border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl text-[9px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-primary/10" disabled={isUploadingAvatar}>
                                {isUploadingAvatar ? <Loader2 className="animate-spin size-4"/> : <Camera className="size-4" />}
                                {isUploadingAvatar ? "Transmitting..." : "Upload Square Asset"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {emojiCategories.map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-2xl p-3 rounded-xl hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20 bg-muted/20 flex items-center justify-center">{emoji}</button>
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
        <div className="flex items-start gap-3 group">
            <div className="p-2 rounded-xl bg-primary/5 text-primary/60 shrink-0 shadow-sm transition-transform group-hover:scale-110"><Icon className="size-4" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none mb-1">{label}</p>
                <p className="text-[11px] font-black truncate text-foreground/80 uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative group">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0 z-10 shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", color)}><Icon className="size-4" /></div>
            <div className="space-y-1 flex-1">
                <p className="font-black text-xs uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1"><Clock className="size-2.5"/> {time}</span>
                    <Badge variant="outline" className="h-4 px-2 text-[7px] font-black uppercase border-none bg-muted/30 tracking-[0.15em]">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest group-hover:text-primary transition-colors">{label}</span>
            <span className="text-[11px] font-black text-foreground/80 uppercase text-right pl-3">{value}</span>
        </div>
    );
}
