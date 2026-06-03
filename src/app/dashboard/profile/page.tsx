
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
    FileDown, Target, Image as ImageIcon,
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
    const { data: documents } = useCollection(docsQuery);

    const assetsQuery = useMemoFirebase(() => user ? query(collection(firestore, "assets"), where("assignedToId", "==", user.uid)) : null, [user, firestore]);
    const { data: assignedAssets } = useCollection(assetsQuery);

    const ticketsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid));
    }, [user, firestore]);
    const { data: userTickets } = useCollection(ticketsQuery);

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
        if (todaysAttendance.status === 'out_of_range') return "Pending Verification";
        return "Active";
    }, [todaysAttendance]);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "HQ Sector";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "HQ Sector";
    }, [branches, employee?.branchId]);

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

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const totalDays = differenceInDays(new Date(), new Date(employee.hireDate));
        return `${totalDays} day`;
    }, [employee]);

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
            toast({ title: "Profile Synchronized" });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally { setIsSubmitting(false); }
    }
    
    const handleAvatarEmojiUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Identity Icon Updated" });
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
            toast({ title: "Profile Portrait Saved" });
            setIsAvatarDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload Error" });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDownloadIdCard = async () => {
        if (!employee) return;
        const pdfDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: [54, 86] });
        
        pdfDoc.setFillColor(255, 255, 255);
        pdfDoc.rect(0, 0, 54, 86, 'F');
        
        pdfDoc.setFillColor(107, 33, 168);
        pdfDoc.rect(0, 0, 54, 30, 'F');
        
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFontSize(8);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text("FORTUMARS", 27, 10, { align: 'center' });
        pdfDoc.setFontSize(6);
        pdfDoc.text("AI TECHNOLOGIES & BUSINESS SOLUTIONS", 27, 14, { align: 'center' });

        pdfDoc.setFillColor(240, 240, 240);
        pdfDoc.roundedRect(15, 20, 24, 24, 3, 3, 'F');
        
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFontSize(11);
        pdfDoc.text(`${employee.firstName} ${employee.lastName}`, 27, 52, { align: 'center' });
        
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(107, 33, 168);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text(employee.jobTitle?.toUpperCase() || 'FLEET MEMBER', 27, 57, { align: 'center' });

        pdfDoc.setTextColor(100, 100, 100);
        pdfDoc.setFontSize(5);
        pdfDoc.setFont('helvetica', 'normal');
        
        const startY = 65;
        pdfDoc.text("EMPLOYEE ID", 10, startY);
        pdfDoc.text("DEPT", 10, startY + 5);
        pdfDoc.text("TYPE", 10, startY + 10);
        pdfDoc.text("JOINED", 10, startY + 15);

        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFontSize(5);
        pdfDoc.text(`MR-${employee.id.slice(0, 8).toUpperCase()}`, 25, startY);
        pdfDoc.text(employee.department?.toUpperCase() || 'HQ', 25, startY + 5);
        pdfDoc.text(employee.employmentType?.toUpperCase() || 'EMPLOYEE', 25, startY + 10);
        pdfDoc.text(employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy').toUpperCase() : 'N/A', 25, startY + 15);

        pdfDoc.setFillColor(245, 245, 245);
        pdfDoc.rect(0, 82, 54, 4, 'F');
        pdfDoc.setTextColor(150);
        pdfDoc.setFontSize(4);
        pdfDoc.text("VERIFIED TACTICAL HUB • FORTUMARS AI SOLUTIONS", 27, 84.5, { align: 'center' });

        pdfDoc.save(`ID_CARD_${employee.firstName}.pdf`);
    };

    if (isEmployeeLoading || !employee) return <div className="p-20 text-center animate-pulse uppercase font-black text-[10px] tracking-[0.3em]">Syncing Identity Hub...</div>;

    return (
        <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8 font-jakarta">
            <div className="flex flex-col gap-1 mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{format(new Date(), 'EEEE, MMMM dd')}</p>
                <h1 className="text-4xl font-black tracking-tighter">
                    Good {greeting}, {employee.firstName || 'Strategist'} ,
                </h1>
            </div>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                <CardContent className="p-8 md:p-12">
                    <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-start">
                        <div className="relative group cursor-pointer" onClick={() => setIsAvatarDialogOpen(true)}>
                            <Avatar className="h-32 w-32 md:h-48 md:w-48 rounded-full border-4 border-white shadow-2xl ring-1 ring-border">
                                {employee.avatar?.startsWith('http') ? (
                                    <AvatarImage src={employee.avatar} className="object-cover" />
                                ) : (
                                    <AvatarFallback className="text-7xl bg-primary/5 text-primary/40 font-black">{employee.avatar || employee.firstName?.[0]}</AvatarFallback>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="size-10 text-white" />
                                </div>
                            </Avatar>
                            <div className={cn("absolute bottom-4 right-4 h-8 w-8 rounded-full border-4 border-white shadow-xl", operationalStatus === 'Active' ? 'bg-green-500 shadow-green-500/50' : 'bg-slate-300')} />
                        </div>

                        <div className="flex-1 text-center lg:text-left space-y-8 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-4 justify-center lg:justify-start">
                                        <h2 className="text-4xl font-black tracking-tighter">{employee.firstName} {employee.lastName}</h2>
                                        <Badge className="bg-primary/10 text-primary border-none rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm">{operationalStatus}</Badge>
                                    </div>
                                    <p className="text-2xl font-semibold text-muted-foreground/80">{employee.jobTitle}</p>
                                    <p className="text-[11px] font-black uppercase text-primary tracking-[0.25em]">{employee.department} Division</p>
                                </div>
                                <div className="flex gap-4">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">Edit Profile</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-[0.1em] bg-white border-none ring-1 ring-border/50 shadow-sm transition-all hover:shadow-md">More Actions <MoreHorizontal className="size-4 ml-2" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-64 border-none shadow-2xl">
                                            <DropdownMenuItem onClick={handleDownloadIdCard} className="font-black text-[10px] uppercase tracking-widest cursor-pointer gap-2.5 py-3"><Download className="size-4"/> Download ID Card</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-8 border-t border-dashed border-border/50">
                                <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 5).toUpperCase()}`} />
                                <DetailItem icon={Mail} label="Email Directive" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone Line" value={employee.phoneNumber || "N/A"} />
                                <DetailItem icon={MapPin} label="Sector Location" value={branchName} />
                                <DetailItem icon={CalendarDays} label="Joined Operational" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Clock} label="Fleet Tenure" value={experience} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <MetricCard label="Attendance (MTD)" value={`${monthlyStats.percentage}%`} sub={`${monthlyStats.count}/${monthlyStats.totalWorkingDays} Days Active`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
                    <MetricCard label="Intelligence Vault" value={documents?.length || 0} sub="Records Stored" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
                    <MetricCard label="Account Authority" value={employee.role === 'CEO/Admin' ? 'Executive' : employee.role === 'HR Manager' ? 'Admin' : 'Tactical'} sub="System Permission" icon={ShieldCheck} color="text-orange-600" bg="bg-orange-50" />
                    <MetricCard label="Tactical Hours" value={`${monthlyStats.hours}h`} sub="MTD Shift Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
                </div>
                <div className="lg:col-span-4">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-800 text-white overflow-hidden h-full group hover:shadow-2xl transition-all duration-500">
                        <CardContent className="p-8 h-full flex flex-col justify-between relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                                <Globe className="size-32" />
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-white/20 rounded-2xl w-fit"><Sparkles className="size-6 text-white" /></div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black uppercase tracking-tighter">Explore MarsOS</h3>
                                    <p className="text-xs font-medium text-white/70 uppercase tracking-widest leading-relaxed">Access the next-generation operating system interface for high-fidelity operations.</p>
                                </div>
                            </div>
                            <Button asChild className="w-full h-12 rounded-2xl bg-white text-indigo-700 hover:bg-white/90 font-black uppercase text-[10px] tracking-widest shadow-lg mt-8">
                                <Link href="https://fortumars.com/os.html" target="_blank">Activate OS Environment <ChevronRight className="size-4 ml-2" /></Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-8">
                <TabsList className="w-full justify-start bg-transparent border-none p-0 h-auto gap-12">
                    {["Overview", "Attendance", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase().replace(' ', '-')} className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary p-0 pb-5 bg-transparent font-black uppercase text-[11px] tracking-[0.25em] transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-8">
                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Activity Timeline</h3>
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-full px-4" asChild>
                                        <Link href="/dashboard/reports">View All</Link>
                                    </Button>
                                </div>
                                <div className="space-y-10 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                                    {userReports.length > 0 ? userReports.map(r => (
                                        <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Submission`} time={r.date?.toDate ? format(r.date.toDate(), 'PPP') : 'N/A'} desc={`Implementation log for ${r.employeeDepartment} unit.`} color="bg-primary/10 text-primary" />
                                    )) : (
                                        <div className="py-24 text-center opacity-30 italic text-[10px] uppercase font-black tracking-[0.3em]">No activity detected</div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        <div className="lg:col-span-4 space-y-8">
                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Recent Assets</h3>
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-full px-4" asChild>
                                        <Link href="/dashboard/documents">Vault Access</Link>
                                    </Button>
                                </div>
                                <div className="space-y-5">
                                    {documents && documents.length > 0 ? documents.slice(0, 3).map(doc => (
                                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-5 p-5 hover:bg-muted/30 rounded-3xl transition-all border border-transparent hover:border-border/50 group shadow-sm hover:shadow-md">
                                            <div className="h-12 w-12 bg-red-50 text-red-600 flex items-center justify-center rounded-2xl font-black text-[11px] shadow-sm">
                                                {doc.sourceType === 'file' ? 'FILE' : 'LINK'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{doc.title}</p>
                                                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60 mt-1 tracking-tighter">Uploaded: {doc.uploadedAt?.toDate ? format(doc.uploadedAt.toDate(), 'dd MMM yyyy') : 'N/A'}</p>
                                            </div>
                                        </Link>
                                    )) : (
                                        <div className="py-12 text-center opacity-20 text-[10px] font-black uppercase tracking-widest">No assets found</div>
                                    )}
                                </div>
                            </Card>

                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Fleet Hardware</h3>
                                <div className="space-y-5">
                                    {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                        <div key={asset.id} className="flex items-center gap-5 p-4 rounded-3xl bg-muted/20 border border-border/50">
                                            <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-inner ring-1 ring-border/30">
                                                {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full" /> : <Briefcase className="size-6 opacity-20" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate">{asset.name}</p>
                                                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60 mt-1 tracking-widest">{asset.category}</p>
                                            </div>
                                            <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full text-[8px] font-black px-3 py-1 shadow-sm">IN USE</Badge>
                                        </div>
                                    )) : (
                                        <div className="py-8 text-center opacity-20 text-[10px] font-black uppercase tracking-widest">No assigned hardware</div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        <div className="lg:col-span-4 space-y-8">
                             <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Tactical Specifications</h3>
                                <div className="space-y-5 pt-2">
                                    <InfoRow label="Deployment Unit" value={employee.department} />
                                    <InfoRow label="Sector Location" value={branchName} />
                                    <InfoRow label="Shift Profile" value={employee.shiftType || 'Standard'} />
                                    <InfoRow label="Fleet Experience" value={experience} />
                                </div>
                            </Card>

                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary/5 p-10 text-center space-y-6 ring-2 ring-primary/10">
                                <ShieldCheck className="size-12 text-primary mx-auto opacity-30 animate-pulse" />
                                <div>
                                    <p className="text-sm font-black uppercase tracking-[0.2em] text-primary leading-tight">Identity Stamped</p>
                                    <p className="text-[10px] font-bold text-primary/50 mt-2 uppercase tracking-widest">Vertical tenure verified</p>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                
                <TabsContent value="attendance">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="font-black uppercase text-[10px] py-6 px-10">Mission Date</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] py-6">Signal Status</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] py-6">Log In</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] py-6">Tactical Break</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] py-6">Log Out</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] py-6 text-right px-10">Verification</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell className="py-6 px-10 font-black text-sm">{format(rec.checkInTime.toDate(), 'PPP')}</TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "rounded-full uppercase text-[9px] font-black tracking-widest px-3 border-none",
                                                rec.status === 'present' ? "bg-green-100 text-green-700" :
                                                rec.status === 'late' ? "bg-amber-100 text-amber-700" :
                                                "bg-rose-100 text-rose-700"
                                            )}>
                                                {rec.isOutOfRange ? "REMOTE" : rec.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                        <TableCell className="font-mono text-[10px] font-bold opacity-60">
                                            {rec.totalBreakDuration ? `${(rec.totalBreakDuration / 60).toFixed(0)}m` : '0m'}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-primary">
                                            {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                        </TableCell>
                                        <TableCell className="text-right px-10">
                                            <div className="flex justify-end gap-2">
                                                {rec.locationCheckInLatitude && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-primary/5 text-primary" asChild>
                                                        <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                            <MapPin className="size-3.5" />
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-20"><CheckCircle2 className="size-3.5" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={6} className="h-64 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">No mission records found for this period</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                
                <TabsContent value="documents">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {documents && documents.length > 0 ? documents.map(doc => (
                                <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-muted/20 hover:bg-white border-2 border-transparent hover:border-primary/20 transition-all group shadow-sm hover:shadow-xl">
                                    <div className="flex items-center gap-5">
                                        <div className={cn("p-3 rounded-2xl shadow-sm", doc.sourceType === 'file' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                                            <FileBox className="size-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm group-hover:text-primary transition-colors">{doc.title}</p>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground mt-1 opacity-60">Linked on {doc.uploadedAt?.toDate ? format(doc.uploadedAt.toDate(), 'dd MMM yyyy') : 'N/A'}</p>
                                        </div>
                                    </div>
                                    <ExternalLink className="size-4 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                                </Link>
                            )) : (
                                <div className="col-span-full py-32 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-4">
                                    <FileBox className="size-16" />
                                    <p className="font-black uppercase text-[10px] tracking-[0.3em]">Identity Vault Empty</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
                
                <TabsContent value="assets">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-12">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                            {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                <Card key={asset.id} className="border-none ring-1 ring-border/50 shadow-sm rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500">
                                    <div className="aspect-square bg-muted relative overflow-hidden">
                                        {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center opacity-10"><Briefcase className="size-20" /></div>}
                                        <Badge className="absolute top-4 right-4 bg-emerald-500 text-white border-none rounded-full text-[8px] font-black uppercase px-3 py-1">IN USE</Badge>
                                    </div>
                                    <CardContent className="p-6 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-tight truncate">{asset.name}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{asset.category}</p>
                                    </CardContent>
                                </Card>
                            )) : (
                                <div className="col-span-full py-32 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-4">
                                    <Laptop className="size-16" />
                                    <p className="font-black uppercase text-[10px] tracking-[0.3em]">No Hardware Registered to Profile</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-[2.5rem] sm:max-w-xl p-10 border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Identity Calibration</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-6">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">First Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-12 shadow-sm" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Last Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-12 shadow-sm" /></FormControl></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Phone Line</FormLabel><FormControl><Input {...field} className="rounded-xl h-12 shadow-sm" /></FormControl></FormItem>
                            )} />
                            <Separator className="opacity-50" />
                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Reset Cipher</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-12 shadow-sm" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Confirm Cipher</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-12 shadow-sm" /></FormControl></FormItem>
                                )} />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-full font-black uppercase tracking-widest shadow-2xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? "CALIBRATING..." : "Finalize Protocol"}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-[3rem] sm:max-w-md p-10 border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Identity Portrait Sync</DialogTitle></DialogHeader>
                    <div className="py-8 space-y-10">
                        <div className="relative group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                            <Button className="w-full h-28 rounded-[2rem] border-2 border-dashed border-primary/30 bg-primary/5 text-primary flex-col gap-2 font-black uppercase text-[11px] tracking-widest hover:bg-primary/10 transition-all" disabled={isUploadingAvatar}>
                                {isUploadingAvatar ? <Loader2 className="animate-spin size-6"/> : <ImageIcon className="size-8" />}
                                {isUploadingAvatar ? "TRANSMITTING..." : "Upload Professional Asset"}
                            </Button>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="grid grid-cols-5 gap-4">
                            {emojiCategories.map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-4xl p-4 rounded-2xl hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20 bg-muted/10">{emoji}</button>
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
        <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-primary/5 text-primary/60 shadow-sm"><Icon className="size-4.5" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1 leading-none">{label}</p>
                <p className="text-sm font-black truncate max-w-[180px] text-foreground/80">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 space-y-6 ring-1 ring-border/50 hover:-translate-y-1 transition-all duration-500 group">
            <div className={cn("p-3 rounded-2xl w-fit shadow-sm transition-transform group-hover:scale-110", bg, color)}><Icon className="size-5" /></div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">{label}</p>
                <p className="text-3xl font-black tracking-tighter text-foreground">{value}</p>
                <p className="text-[11px] font-bold text-muted-foreground/40 mt-1 uppercase tracking-tight">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-6 items-start relative">
            <div className={cn("h-8 w-8 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-sm", color)}><Icon className="size-4" /></div>
            <div className="space-y-1 pt-0.5">
                <p className="font-black text-sm uppercase tracking-tight">{title}</p>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">{time}</p>
                <p className="text-xs font-medium text-muted-foreground/80 leading-relaxed mt-2">"{desc}"</p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-dashed border-border/50 last:border-none">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{label}</span>
            <span className="text-sm font-black text-foreground/80">{value}</span>
        </div>
}
