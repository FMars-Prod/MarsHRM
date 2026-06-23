
'use client';

import * as React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, differenceInMonths, differenceInDays, addMonths, eachDayOfInterval, isSunday, isToday, startOfDay } from 'date-fns';
import { ShieldCheck, FileText, Clock, Users, Building2, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MapPin, ChevronRight, CalendarClock, FileCheck, Laptop, Network, Edit, SearchSlash, ExternalLink, Mic, PhoneCall, Target, CheckCircle2, Brain, Trash2, FileDown, Camera, UserPlus, X, Loader2, UserCheck as UserCheckIcon, Coffee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger 
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { updateProfile, updatePassword } from "firebase/auth";
import { useAuth } from "@/firebase";

const profileFormSchema = z.object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    phoneNumber: z.string().min(1, "Required"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    nationality: z.string().optional(),
    maritalStatus: z.string().optional(),
    bloodGroup: z.string().optional(),
    languages: z.array(z.string()).default([]),
}).refine(data => !data.password || data.password.length >= 6, { message: "Min 6 chars", path: ["password"] })
  .refine(data => data.password === data.confirmPassword, { message: "Mismatch", path: ["confirmPassword"] });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type AttendanceRecord = {
    id: string;
    checkInTime?: Timestamp;
    checkOutTime?: Timestamp;
    status: 'present' | 'late' | 'absent' | 'on_leave' | 'out_of_range';
    totalBreakDuration?: number;
    locationCheckInLatitude?: number;
    locationCheckInLongitude?: number;
    locationCheckOutLatitude?: number;
    locationCheckOutLongitude?: number;
    isOutOfRange?: boolean;
};

const formatIST = (date: any) => {
    if (!date) return "N/A";
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(d) + " IST";
};

const formatSecondsToHours = (seconds: number) => {
    const h = Math.floor(Math.max(0, seconds) / 3600);
    const m = Math.floor((Math.max(0, seconds) % 3600) / 60);
    return `${h}h ${m}m`;
};

const BusinessAuditDetail = ({ report, isNested = false }: { report: any, isNested?: boolean }) => {
    const totalOutreach = Number(report.coldCalls || 0) + Number(report.linkedinOutreach || 0) + Number(report.emailsSent || 0);
    const potential = Number(report.potentialClients || 0);
    const efficiency = totalOutreach > 0 ? (potential / totalOutreach) * 100 : 0;
    
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Results</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-primary text-white rounded-3xl shadow-xl flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest opacity-80">Efficiency Rate</span><span className="text-4xl font-black">{efficiency.toFixed(2)}%</span></div>
                    <div className="p-6 bg-white rounded-3xl ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Potential Clients</span><span className="text-3xl font-black">{potential}</span></div>
                    <div className="p-6 bg-white rounded-3xl ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follow-ups</span><span className="text-3xl font-black">{report.followUps || 0}</span></div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-black uppercase text-[10px] tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue & Impact</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Revenue Collected</p><p className="text-xl font-black text-green-900">${report.revenueCollected || 0}</p></div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Committed Revenue</p><p className="text-xl font-black text-green-900">${report.committedRevenue || 0}</p></div>
                </div>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4" /> 4️⃣ Call Intelligence</p>
                <div className="grid gap-4">
                    {report.totalCallRecordings && <Button variant="outline" className="h-10 text-[10px] uppercase font-bold rounded-xl bg-white w-full text-primary" asChild><Link href={report.totalCallRecordings} target="_blank"><Download className="size-3 mr-2" /> View Recordings</Link></Button>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[['Best Call', report.bestCallRecording, 'text-green-600'], ['Worst Call', report.worstCallRecording, 'text-red-600']].map(([l, v, c], i) => v && (
                            <div key={i} className="p-3 bg-white rounded-xl ring-1 ring-border/50 space-y-2"><p className={cn("text-[9px] font-black uppercase flex items-center gap-1.5", c)}><Mic className="size-3"/> {l}</p><audio controls className="w-full h-8 scale-90 -ml-2"><source src={v as string} /></audio></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MarketingAuditDetail = ({ report }: { report: any }) => {
    const deliverables = [{ label: 'Content', key: 'dmContent' }, { label: 'Poster', key: 'dmPoster' }, { label: 'Reel', key: 'dmReel' }, { label: 'Shoot', key: 'dmShoot' }];
    return (
        <div className="space-y-6">
            <BusinessAuditDetail report={report} isNested />
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Status</TableHead>{deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                        {['Approved', 'Pending', 'Rejected'].map(status => (
                            <TableRow key={status}><TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>{deliverables.map(d => (<TableCell key={d.key} className="text-center font-bold">{report[`${d.key}${status}`] || 0}</TableCell>))}</TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const TechnicalAuditDetail = ({ report }: { report: any }) => (
    <div className="space-y-8">
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4"/> Client Engagements</p>
            <div className="grid grid-cols-1 gap-3">{report.technicalMeetings?.map((m: any, i: number) => (
                <div key={i} className="p-3 bg-white rounded-xl border flex items-center justify-between"><div><p className="font-bold text-sm">{m.clientName}</p><p className="text-[10px] uppercase text-muted-foreground">{m.productName}</p></div><Badge variant="outline" className="text-[8px] uppercase font-black">{m.status}</Badge></div>
            )) || <p className="text-xs italic text-muted-foreground">No engagements logged.</p>}</div>
        </div>
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Briefcase className="size-4"/> Task Progress</p>
            <div className="grid grid-cols-1 gap-4">{report.technicalProjects?.map((p: any, i: number) => (
                <Card key={i} className="p-4 border-none ring-1 ring-border/50 bg-white"><div className="flex justify-between items-start mb-3"><div><p className="font-bold text-sm">{p.projectName}</p><p className="text-[10px] uppercase text-muted-foreground">{p.type}</p></div><div className="text-right"><p className="text-lg font-black text-primary">{p.statusPercent}%</p><p className="text-[8px] uppercase font-bold text-muted-foreground">Progress</p></div></div><p className="text-xs italic text-muted-foreground mb-3">"{p.description}"</p>{p.isCompleted && p.liveLink && <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] font-bold uppercase gap-2 bg-primary/5 text-primary" asChild><Link href={p.liveLink} target="_blank"><ExternalLink className="size-3"/> View Project</Link></Button>}</Card>
            )) || <p className="text-xs italic text-muted-foreground">No projects logged.</p>}</div>
        </div>
        <div className="space-y-3"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Brain className="size-4"/> Notes & Learnings</p>
            <div className="flex flex-wrap gap-2">{report.learnedToday?.map((l: string, i: number) => <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-full text-[10px] font-bold">{l}</Badge>) || <p className="text-xs italic text-muted-foreground">No learnings recorded.</p>}</div>
        </div>
    </div>
);

export default function ProfilePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
    const [userReports, setUserReports] = React.useState<any[]>([]);
    const [langInput, setLangInput] = React.useState('');
    const [selectedReportForReview, setSelectedReportForReview] = React.useState<any | null>(null);

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
    const { data: employee, isLoading: isEmployeeLoading } = useDoc<any>(userDocRef);

    const allUsersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: allUsers } = useCollection<any>(allUsersQuery);

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
    const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);

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
        return { present, late, absent, remaining, totalWorkingDays, percentage: Math.min(100, Math.round((attended / totalWorkingDays) * 100)) };
    }, [attendanceData, monthStart, monthEnd]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { firstName: "", lastName: "", phoneNumber: "", password: "", confirmPassword: "", dob: "", gender: "", nationality: "", maritalStatus: "", bloodGroup: "", languages: [] },
    });

    React.useEffect(() => {
        if (employee) form.reset({ 
            firstName: employee.firstName || '', 
            lastName: employee.lastName || '', 
            phoneNumber: employee.phoneNumber || '', 
            dob: employee.dob || '',
            gender: employee.gender || '',
            nationality: employee.nationality || '',
            maritalStatus: employee.maritalStatus || '',
            bloodGroup: employee.bloodGroup || '',
            languages: Array.isArray(employee.languages) ? employee.languages : [],
            password: '', 
            confirmPassword: '' 
        });
    }, [employee, form]);

    React.useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(10));
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
        } catch (e: any) { toast({ variant: "destructive", title: "Update failed", description: e.message }); }
        finally { setIsSubmitting(false); }
    }

    const handleDownloadPdfReport = (report: any) => {
        const pdfDoc = new jsPDF();
        pdfDoc.setFontSize(16);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text("FortuMars AI Technologies & Business Solutions.", pdfDoc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(100);
        pdfDoc.text(`${report.reportType} Daily Report`, pdfDoc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(0);
        pdfDoc.text(`Employee: ${report.employeeName}`, 14, 45);
        pdfDoc.text(`Designation: ${report.employeeJobTitle} | Dept: ${report.employeeDepartment}`, 14, 50);
        pdfDoc.text(`Submission Time: ${formatIST(report.date)}`, 14, 55);
        pdfDoc.text(`Shift Hours: ${report.logInTime || '--:--'} to ${report.logOutTime || '--:--'}`, 14, 60);
    
        const tableData: any[] = [];
        if (report.reportType === 'Business' || report.reportType === 'Digital Marketing') {
            tableData.push(['Cold Calls', report.coldCalls], ['LinkedIn', report.linkedinOutreach], ['Emails', report.emailsSent], ['Follow-ups', report.followUps], ['Potential Clients', report.potentialClients], ['Revenue Collected', `$${report.revenueCollected}`]);
        }
        autoTable(pdfDoc, { startY: 70, head: [['Metric', 'Value']], body: tableData, theme: 'striped', headStyles: { fillColor: [107, 33, 168] } });
        const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
        pdfDoc.setFontSize(11);
        pdfDoc.text("Planning for Tomorrow:", 14, finalY);
        pdfDoc.setFontSize(9);
        pdfDoc.text(`Main Goal: ${report.criticalPathTomorrow || 'NIL'}`, 14, finalY + 10);
        pdfDoc.save(`${report.employeeName}_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    if (isEmployeeLoading || !employee) return <div className="p-10 text-center animate-pulse uppercase font-black text-sm">Loading...</div>;

    const isEmployeeType = employee.employmentType === 'Employee';
    const leaveBalValue = employee.leaveBalance;
    const leaveEntValue = employee.totalLeaveEntitlement || (isEmployeeType ? 12 : 0);
    const isLeaveConfigured = leaveBalValue !== undefined && isEmployeeType;
    const branchName = branches?.find((b: any) => b.id === employee.branchId)?.name || "Office Hub";

    return (
        <div className="max-w-6xl mx-auto animate-fade-in-up pb-10 space-y-6 font-jakarta">
            {/* Profile Overview */}
            <Card className="border-none shadow-2xl rounded-none bg-white overflow-hidden p-0 ring-1 ring-border/50">
                <div className="flex flex-col lg:flex-row items-stretch">
                    {/* Profile Picture */}
                    <div className="relative group cursor-pointer shrink-0 lg:border-r border-dashed border-border/50 bg-muted/5 p-8 lg:p-10 flex flex-col items-center justify-center" onClick={() => setIsAvatarDialogOpen(true)}>
                        <Avatar className="size-40 sm:size-48 rounded-none ring-8 ring-white shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <AvatarImage src={employee.avatar} className="object-cover" />
                            <AvatarFallback className="text-5xl font-black bg-primary/10 text-primary rounded-none">{employee.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute top-12 right-12 size-8 bg-green-500 rounded-full border-4 border-white shadow-lg animate-pulse" />
                        <Button variant="ghost" size="sm" className="mt-6 rounded-none font-bold uppercase text-[9px] tracking-widest bg-white shadow-sm ring-1 ring-border/50 hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100">
                           <Camera className="size-3 mr-2" /> Change Photo
                        </Button>
                    </div>

                    {/* Employee Details */}
                    <div className="flex-1 p-8 lg:p-10 space-y-10 flex flex-col justify-center">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="space-y-2">
                                <h2 className="text-3xl lg:text-4xl font-black tracking-tighter leading-tight uppercase">{employee.firstName} {employee.lastName}</h2>
                                <p className="text-md font-bold text-muted-foreground uppercase tracking-widest">{employee.jobTitle}</p>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-none h-11 px-6 font-bold uppercase text-[10px] tracking-widest bg-white shadow-sm hover:shadow-md transition-all">Edit Info</Button>
                                <Button asChild size="sm" className="rounded-none h-11 px-6 font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"><Link href="https://fortumars.com/os.html" target="_blank">Access OS</Link></Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12 pt-8 border-t border-dashed border-border/50">
                            <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                            <DetailItem icon={CalendarDays} label="Joined Date" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Mail} label="Email Address" value={employee.email} />
                            <DetailItem icon={Phone} label="Phone Number" value={employee.phoneNumber || 'N/A'} />
                            <DetailItem icon={MapPin} label="Office Location" value={branchName} />
                            <DetailItem icon={Building2} label="Department" value={employee.department} />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Statistics Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard icon={UserCheck} title="Attendance" ratio={`${attendanceStats.present + attendanceStats.late}/${attendanceStats.totalWorkingDays}`} progress={attendanceStats.percentage} color="text-green-600">
                    <div className="grid grid-cols-4 gap-2 mt-4">
                        <MetricStat label="Pres" val={attendanceStats.present} />
                        <MetricStat label="Late" val={attendanceStats.late} color="text-amber-500" />
                        <MetricStat label="Abs" val={attendanceStats.absent} color="text-rose-500" />
                        <MetricStat label="Rem" val={attendanceStats.remaining} color="text-sky-500" />
                    </div>
                </MetricCard>
                <MetricCard 
                    icon={CalendarClock} 
                    title="Leave Balance" 
                    ratio={isEmployeeType ? (isLeaveConfigured ? `${leaveBalValue}/${leaveEntValue}` : "12/12") : "0/0"} 
                    progress={isEmployeeType ? (isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 100) : 0} 
                    color="text-sky-600" 
                />
                <MetricCard icon={Zap} title="Performance" ratio={employee.performanceRating || "Good"} color="text-primary" />
                <MetricCard icon={FileCheck} title="Payroll Status" ratio={employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : "Audited"} color="text-purple-600" />
                <MetricCard icon={FileBox} title="Documents" ratio={documents?.length || 0} color="text-emerald-600" />
            </div>

            {/* Selection Hub */}
            <Tabs defaultValue="activity" className="space-y-4">
                <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                    {["Activity", "Attendance", "Hierarchy", "Documents", "Assets", "Bio Data"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-8 py-3 font-bold uppercase text-[10px] tracking-widest transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="activity" className="mt-0">
                    <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-8">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Activity History</h3>
                        <div className="space-y-6">
                            {userReports.length > 0 ? userReports.slice(0, 10).map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd, yyyy')} desc={`Report Submitted`} color="bg-primary/10 text-primary" onClick={() => setSelectedReportForReview(r)} />
                            )) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                    <div className="p-5 bg-muted/20 rounded-full"><SearchSlash className="size-12 text-primary/40" /></div>
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest">No Activity</p>
                                        <p className="text-[11px] font-bold uppercase mt-1">No reports found in history.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
                <TabsContent value="attendance">
                    <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden min-h-[400px]">
                        <ScrollArea className="h-full">
                            {attendanceData && attendanceData.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-muted/5">
                                        <TableRow>
                                            <TableHead className="text-[11px] font-bold px-8 py-5 uppercase tracking-widest">Date</TableHead>
                                            <TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest">Status</TableHead>
                                            <TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest">Clock In</TableHead>
                                            <TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest text-center">Total Break</TableHead>
                                            <TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest">Clock Out</TableHead>
                                            <TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest text-right pr-8">Location</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceData.slice(0, 30).map((rec: any, i: number) => (
                                            <TableRow key={i} className="border-border/50 hover:bg-primary/5 transition-colors">
                                                <TableCell className="text-sm font-bold px-8 py-5 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] font-bold uppercase border-none rounded-none h-6 px-3 shadow-sm",
                                                        rec.status === 'present' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                                                    )}>
                                                        {rec.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                        <Coffee className="size-3 opacity-30" />
                                                        {rec.totalBreakDuration ? formatSecondsToHours(rec.totalBreakDuration) : '0m'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold text-slate-900">
                                                    {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex justify-end gap-2">
                                                        {rec.locationCheckInLatitude && (
                                                            <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-none bg-primary/5 border-none shadow-sm hover:scale-110">
                                                                <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                                    <MapPin className="size-3.5 text-primary" />
                                                                </Link>
                                                            </Button>
                                                        )}
                                                        {rec.locationCheckOutLatitude && (
                                                            <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-none bg-slate-100 border-none shadow-sm hover:scale-110">
                                                                <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckOutLatitude},${rec.locationCheckOutLongitude}`} target="_blank">
                                                                    <MapPin className="size-3.5 text-slate-600" />
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                    <div className="p-5 bg-muted/20 rounded-full"><Clock className="size-12 text-primary/40" /></div>
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest">No Records</p>
                                        <p className="text-[11px] font-bold uppercase mt-1">No attendance logs detected.</p>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </Card>
                </TabsContent>
                <TabsContent value="bio data">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Bio Data Profile</h3>
                            <div className="space-y-4">
                                <InfoRow label="Date of Birth" value={employee.dob ? format(new Date(employee.dob), 'dd MMM yyyy') : 'N/A'} />
                                <InfoRow label="Gender" value={employee.gender || 'N/A'} />
                                <InfoRow label="Nationality" value={employee.nationality || 'N/A'} />
                                <InfoRow label="Marital Status" value={employee.maritalStatus || 'N/A'} />
                                <InfoRow label="Blood Group" value={employee.bloodGroup || 'N/A'} />
                                <div className="pt-4 flex flex-wrap gap-2">
                                    {employee.languages?.map((lang: string) => (
                                        <Badge key={lang} variant="secondary" className="text-[10px] font-bold px-3 py-1 uppercase rounded-none">{lang}</Badge>
                                    )) || <span className="text-[10px] opacity-30">No languages listed</span>}
                                </div>
                            </div>
                        </Card>
                        <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Mission Context</h3>
                            <div className="space-y-4">
                                <InfoRow label="Deployment" value={employee.role} />
                                <InfoRow label="Shift" value={employee.shiftType} />
                                <InfoRow label="Sector" value={employee.department} />
                                <InfoRow label="Home Authorization" value={employee.isWfhAllowed ? "Active" : "Disabled"} />
                            </div>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Report Review Dialog */}
            <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
                <DialogContent className="max-w-3xl rounded-3xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                    <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center shrink-0">
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Mission Audit Log</DialogTitle>
                            <p className="text-xs font-bold text-muted-foreground">{selectedReportForReview && formatIST(selectedReportForReview.date)} • Shift: {selectedReportForReview?.logInTime || '--'} - {selectedReportForReview?.logOutTime || '--'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary" onClick={() => handleDownloadPdfReport(selectedReportForReview)}><FileDown className="size-3 mr-1.5" /> Download Audit</Button>
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-8">{selectedReportForReview?.reportType}</Badge>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-secondary/10">
                        <div className="p-8 space-y-8 pb-20">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Personnel</p><p className="font-bold text-lg uppercase">{selectedReportForReview?.employeeName}</p></div>
                                <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sector</p><p className="font-bold text-lg uppercase">{selectedReportForReview?.employeeDepartment}</p></div>
                            </div>
                            <Separator className="opacity-50" />
                            {(selectedReportForReview?.reportType === 'Business' || selectedReportForReview?.reportType === 'Digital Marketing') && <BusinessAuditDetail report={selectedReportForReview} />}
                            {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetail report={selectedReportForReview} />}
                            {selectedReportForReview?.reportType === 'Technical' && <TechnicalAuditDetail report={selectedReportForReview} />}
                            
                            <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm">
                                <CardHeader className="bg-muted/10 py-3">
                                    <CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Target className="size-4"/> Planning (T+1)</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Target Meets</p><p className="font-black">{selectedReportForReview?.meetingsTomorrow || 0}</p></div>
                                        <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Priority Trigger</p><p className={cn("font-black", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-green-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div>
                                    </div>
                                    <div className="p-4 bg-muted/10 border-l-4 border-primary">
                                        <p className="text-[8px] font-black uppercase text-primary mb-1">Primary Objective</p>
                                        <p className="text-sm font-medium italic">"{selectedReportForReview?.criticalPathTomorrow || 'NIL'}"</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="pt-10 flex flex-col items-center text-center space-y-6">
                                <div className="h-20 w-48 border-b-2 border-dashed border-primary/20 flex flex-col items-center justify-center">
                                    {selectedReportForReview?.signatureUrl ? (
                                        <img src={selectedReportForReview.signatureUrl} alt="E-Signature" className="h-16 object-contain" />
                                    ) : (
                                        <span className="font-mono text-[10px] italic opacity-60 uppercase">Verified Digitally</span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle}</p>
                                    <p className="text-[8px] font-mono text-muted-foreground italic mt-2">Audit Timestamp: {selectedReportForReview && formatIST(selectedReportForReview.date)}</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ActivityBarItem({ icon: Icon, title, value, status, color }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-4 flex items-center gap-5 group hover:shadow-md transition-all ring-1 ring-border/50">
            <div className={cn("p-3 rounded-none text-white shrink-0 group-hover:scale-110 transition-transform shadow-md", color)}>
                <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase text-muted-foreground/40 tracking-widest leading-none mb-1.5">{title}</p>
                <p className="text-sm font-bold truncate text-foreground leading-tight tracking-tight uppercase">{value}</p>
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 w-1.5 rounded-none bg-current opacity-40" />
                    <p className="text-[9px] font-bold uppercase opacity-30 tracking-wider">{status}</p>
                </div>
            </div>
        </Card>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-3 rounded-none bg-primary/5 text-primary/60 shrink-0 shadow-sm border border-primary/10"><Icon className="size-5" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-2">{label}</p>
                <p className="text-[13px] font-bold text-foreground/90 uppercase tracking-tight break-all">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-xl rounded-none bg-white p-6 space-y-5 ring-1 ring-border/50 group hover:shadow-primary/5 transition-all">
            <div className="flex justify-between items-start">
                <div className={cn("p-4 rounded-none shadow-md", color, "bg-muted/10")}><Icon className="size-6" /></div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2.5"><p className="text-[12px] font-black uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-xl font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-xs font-bold", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color, onClick }: any) {
    return (
        <div className="flex gap-6 items-start relative group cursor-pointer" onClick={onClick}>
            <div className={cn("h-10 w-10 rounded-none flex items-center justify-center shrink-0 z-10 shadow-md transition-transform group-hover:scale-110", color)}><Icon className="size-5" /></div>
            <div className="space-y-1.5 flex-1 pt-0.5">
                <p className="font-bold text-base uppercase tracking-tight text-foreground/90 leading-none group-hover:text-primary transition-colors">{title}</p>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-5 px-3 text-[9px] font-bold uppercase border-none bg-muted/40 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground/20 group-hover:text-primary transition-all self-center" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-dashed border-border/50 last:border-none group gap-4">
            <span className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest shrink-0">{label}</span>
            <span className="text-sm font-bold text-foreground/80 uppercase text-right leading-tight">{value}</span>
        </div>
    );
}
