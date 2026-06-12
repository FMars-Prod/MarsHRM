
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
    Edit, Camera, CheckCircle2, ShieldCheck, 
    FileText, CalendarDays, Loader2, Phone, 
    Mail, Briefcase, Download, 
    Clock, Activity, UserCheck, Zap, ChevronRight,
    FileCheck, FileBox, Users, Laptop, MapPin, CalendarClock,
    MessageSquareWarning, RotateCcw, Network, Check, X
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { format, startOfMonth, endOfMonth, differenceInMonths, differenceInDays, addMonths, eachDayOfInterval, isSunday, isToday, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    languages: z.string().optional(),
}).refine(data => !data.password || data.password.length >= 6, { message: "Min 6 chars", path: ["password"] })
  .refine(data => data.password === data.confirmPassword, { message: "Mismatch", path: ["confirmPassword"] });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

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

    const allUsersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: allUsers } = useCollection<any>(allUsersQuery);

    const reportingHeads = React.useMemo(() => {
        if (!employee?.reportingHeadIds || !allUsers) return [];
        return allUsers.filter((u: any) => employee.reportingHeadIds.includes(u.id));
    }, [employee?.reportingHeadIds, allUsers]);

    const directReports = React.useMemo(() => {
        if (!employee || !allUsers) return [];
        return allUsers.filter((u: any) => u.reportingHeadIds?.includes(employee.id));
    }, [employee?.id, allUsers]);

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

    const lastAtt = attendanceData;
    
    const leavePulseQuery = useMemoFirebase(() => user ? query(
        collection(firestore, "leave_requests"),
        where("employeeId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(1)
    ) : null, [user, firestore]);
    const { data: lastLeave } = useCollection<any>(leavePulseQuery);

    const ticketPulseQuery = useMemoFirebase(() => user ? query(
        collection(firestore, "issue_reports"),
        where("employeeId", "==", user.uid),
        orderBy("submissionDate", "desc"),
        limit(1)
    ) : null, [user, firestore]);
    const { data: lastTicket } = useCollection<any>(ticketPulseQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Office Hub";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Office Hub";
    }, [branches, employee?.branchId]);

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
        defaultValues: { firstName: "", lastName: "", phoneNumber: "", password: "", confirmPassword: "", dob: "", gender: "", nationality: "", maritalStatus: "", bloodGroup: "", languages: "" },
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
            languages: employee.languages?.join(', ') || '',
            password: '', 
            confirmPassword: '' 
        });
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
            const { password, confirmPassword, languages, ...updateData } = data;
            const finalUpdateData: any = {
                ...updateData,
                languages: languages ? languages.split(',').map(s => s.trim()).filter(Boolean) : []
            };
            if (userDocRef) updateDocumentNonBlocking(userDocRef, finalUpdateData);
            await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
            if (data.password) await updatePassword(auth.currentUser, data.password);
            toast({ title: "Profile updated" });
            setIsProfileDialogOpen(false);
        } catch (e: any) { toast({ variant: "destructive", title: "Update failed", description: e.message }); }
        finally { setIsSubmitting(false); }
    }

    if (isEmployeeLoading || !employee) return <div className="p-10 text-center animate-pulse uppercase font-black text-sm">Loading Hub...</div>;

    const isEmployeeType = employee.employmentType === 'Employee';
    const leaveBalValue = employee.leaveBalance;
    const leaveEntValue = employee.totalLeaveEntitlement || (isEmployeeType ? 12 : 0);
    const isLeaveConfigured = leaveBalValue !== undefined && isEmployeeType;
    const isAdmin = employee.role === 'HR Manager' || employee.role === 'CEO/Admin';

    return (
        <div className="max-w-6xl mx-auto animate-fade-in-up pb-4 space-y-3 font-jakarta">
            {/* Main Identity Hub */}
            <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden p-4">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                        <Avatar className="h-32 w-32 rounded-none border-2 border-white shadow-md ring-1 ring-border">
                            <AvatarImage src={employee.avatar} className="object-cover" />
                            <AvatarFallback className="text-4xl font-black bg-muted rounded-none">{employee.firstName?.[0]}</AvatarFallback>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-none opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="size-8 text-white" /></div>
                        </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h2 className="text-2xl font-black tracking-tighter leading-none">{employee.firstName} {employee.lastName}</h2>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{employee.jobTitle}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-none font-black uppercase text-[10px] tracking-widest h-8 px-4">Edit Profile</Button>
                                <Button asChild size="sm" className="rounded-none font-black uppercase text-[10px] tracking-widest h-8 px-4 shadow-sm shadow-primary/20"><Link href="https://fortumars.com/os.html" target="_blank">Activate MarsOS</Link></Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-6 mt-4 pt-4 border-t border-dashed border-border/50">
                            <DetailItem icon={ShieldCheck} label="ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                            <DetailItem icon={CalendarDays} label="Joined" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A'} />
                            <DetailItem icon={Mail} label="Email" value={employee.email} />
                            <DetailItem icon={MapPin} label="Sector" value={branchName} />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Performance Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <MetricCard icon={UserCheck} title="Attendance" ratio={`${attendanceStats.present + attendanceStats.late}/${attendanceStats.totalWorkingDays}`} progress={attendanceStats.percentage} color="text-green-600">
                    <div className="grid grid-cols-4 gap-1 mt-2.5">
                        <MetricStat label="P" val={attendanceStats.present} />
                        <MetricStat label="L" val={attendanceStats.late} color="text-amber-500" />
                        <MetricStat label="A" val={attendanceStats.absent} color="text-rose-500" />
                        <MetricStat label="R" val={attendanceStats.remaining} color="text-sky-500" />
                    </div>
                </MetricCard>
                <MetricCard 
                    icon={CalendarClock} 
                    title="Leave" 
                    ratio={isEmployeeType ? (isLeaveConfigured ? `${leaveBalValue}/${leaveEntValue}` : "12/12") : "NIL"} 
                    progress={isEmployeeType ? (isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 100) : 0} 
                    color="text-sky-600" 
                />
                <MetricCard icon={Zap} title="Performance" ratio={employee.performanceRating || "Good"} color="text-primary">
                    <div className="flex items-center justify-between mt-2.5">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/60">Review: {employee.lastReviewDate ? format(employee.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
                        {isAdmin && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 hover:bg-primary/5 rounded-none">
                                        <Edit className="size-3 text-primary" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-none sm:max-w-sm border-none shadow-2xl">
                                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Performance Tier</DialogTitle></DialogHeader>
                                    <div className="py-6 space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign Rating</Label>
                                        <Select 
                                            onValueChange={(v) => {
                                                if (userDocRef) updateDocumentNonBlocking(userDocRef, { performanceRating: v, lastReviewDate: serverTimestamp() });
                                                toast({ title: "Performance Updated" });
                                            }} 
                                            defaultValue={employee.performanceRating || "Good"}
                                        >
                                            <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-none">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Improving">Improving</SelectItem>
                                                <SelectItem value="In Review">In Review</SelectItem>
                                                <SelectItem value="Poor">Poor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </MetricCard>
                <MetricCard icon={FileCheck} title="Payroll" ratio={employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : (employee.employmentType === 'Intern' ? "Performance Based" : "Audited")} color="text-purple-600" />
                <MetricCard icon={FileBox} title="Vault" ratio={documents?.length || 0} color="text-emerald-600">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 mt-2.5">
                        {documents?.[0] ? `Updated: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "Empty"}
                    </p>
                </MetricCard>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="activity" className="space-y-2">
                <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                    {["Activity", "Attendance", "Hierarchy", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-5 py-2 font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="activity" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                        <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white p-5 space-y-5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Registry Log</h3>
                            <div className="space-y-3">
                                {userReports.length > 0 ? userReports.slice(0, 3).map(r => (
                                    <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd')} desc={`Finalized.`} color="bg-primary/10 text-primary" />
                                )) : <p className="text-[10px] font-black uppercase text-center opacity-30 py-8">No recent handshakes detected</p>}
                            </div>
                        </Card>
                        <div className="lg:col-span-4 space-y-2">
                            <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Bio Data</h3>
                                <div className="space-y-3">
                                    <InfoRow label="Birth" value={employee.dob ? format(new Date(employee.dob), 'dd MMM yyyy') : 'N/A'} />
                                    <InfoRow label="Gender" value={employee.gender || 'N/A'} />
                                    <InfoRow label="Origin" value={employee.nationality || 'N/A'} />
                                    <InfoRow label="Status" value={employee.maritalStatus || 'N/A'} />
                                    <InfoRow label="Blood" value={employee.bloodGroup || 'N/A'} />
                                    <div className="pt-2 flex flex-wrap gap-1.5">
                                        {employee.languages?.map((lang: string) => (
                                            <Badge key={lang} variant="secondary" className="text-[9px] font-bold px-2.5 h-5 uppercase rounded-none">{lang}</Badge>
                                        )) || <span className="text-[10px] opacity-30">No languages registered</span>}
                                    </div>
                                </div>
                            </Card>

                            <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Mission Assets</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Assigned Units</span>
                                        <Badge className="bg-primary/10 text-primary rounded-none font-black text-[10px]">{assignedAssets?.length || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Vault Items</span>
                                        <Badge className="bg-emerald-500/10 text-emerald-600 rounded-none font-black text-[10px]">{documents?.length || 0}</Badge>
                                    </div>
                                </div>
                            </Card>

                            <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Reporting Protocol</h3>
                                <div className="space-y-4">
                                     <InfoRow label="Structure" value={employee.reportingHeadIds?.length ? "Tactical Matrix" : "Individual Fleet"} />
                                     <div className="p-4 bg-muted/20 rounded-none border border-dashed border-border/50">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 mb-3">Direct Command Matrix</p>
                                        <ScrollArea className={cn(reportingHeads.length > 2 ? "h-32" : "h-auto")}>
                                            <div className="space-y-3">
                                                {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                                    <Link key={head.id} href={`/dashboard/users/${head.id}`} className="flex items-center gap-4 group">
                                                        <Avatar className="size-10 rounded-none">
                                                            <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                            <AvatarFallback className="text-xs font-bold rounded-none">{head.firstName[0]}{head.lastName[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{head.firstName} {head.lastName}</p>
                                                            <p className="text-[9px] font-black uppercase text-primary truncate">{head.jobTitle}</p>
                                                        </div>
                                                        <ShieldCheck className="size-4 text-primary" />
                                                    </Link>
                                                )) : (
                                                    <p className="text-sm font-bold text-muted-foreground uppercase opacity-40">Direct reporting to Admin</p>
                                                )}
                                            </div>
                                        </ScrollArea>
                                     </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="attendance">
                    <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden max-h-[400px]">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[10px] font-black px-6 py-3 uppercase tracking-widest">Date</TableHead><TableHead className="text-[10px] font-black py-3 uppercase tracking-widest text-right pr-6">Status</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {attendanceData?.slice(0, 10).map((rec: any, i: number) => (
                                        <TableRow key={i} className="border-border/50">
                                            <TableCell className="text-[11px] font-black px-6 py-3 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yy')}</TableCell>
                                            <TableCell className="text-right pr-6"><Badge variant="outline" className="text-[9px] font-black uppercase border-none bg-green-50 text-green-600 rounded-none">{rec.status}</Badge></TableCell>
                                        </TableRow>
                                    )) || <TableRow><TableCell colSpan={2} className="h-24 text-center text-[10px] font-black uppercase opacity-30">No records</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </Card>
                </TabsContent>
                <TabsContent value="hierarchy">
                    <Card className="border-none shadow-sm rounded-none bg-white p-6 overflow-x-auto min-h-[500px]">
                        <div className="flex flex-col items-center space-y-12 py-10 min-w-fit">
                            {/* Managers Section (Upward) */}
                            <div className="flex flex-col items-center space-y-4 w-full">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Command Level (Managers)</h4>
                                <div className="flex flex-wrap justify-center gap-8 w-full">
                                    {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                        <div key={head.id} className="flex flex-col items-center">
                                             <Link href={`/dashboard/users/${head.id}`} className="p-4 bg-muted/20 border-2 border-dashed border-border/50 rounded-none w-48 text-center group hover:border-primary/40 transition-all cursor-pointer">
                                                <Avatar className="size-12 rounded-none mx-auto mb-3 shadow-sm border border-white">
                                                    <AvatarImage src={head.avatar} className="object-cover" />
                                                    <AvatarFallback className="font-black">{head.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <p className="font-black text-xs uppercase tracking-tight truncate">{head.firstName} {head.lastName}</p>
                                                <p className="text-[9px] font-bold text-primary uppercase truncate">{head.jobTitle}</p>
                                             </Link>
                                             <div className="w-px h-8 bg-border mt-0" />
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center">
                                            <Badge variant="outline" className="rounded-none font-black text-[9px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-8 px-4">Top Tier Command</Badge>
                                            <div className="w-px h-8 bg-border" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Current User Section */}
                            <div className="relative flex flex-col items-center w-full">
                                <div className="p-6 bg-primary text-white shadow-xl rounded-none w-64 text-center ring-4 ring-primary/10">
                                    <Avatar className="size-16 rounded-none mx-auto mb-4 border-2 border-white/20 shadow-md">
                                        <AvatarImage src={employee.avatar} className="object-cover" />
                                        <AvatarFallback className="font-black text-primary bg-white">{employee.firstName[0]}</AvatarFallback>
                                    </Avatar>
                                    <p className="font-black text-base uppercase tracking-tighter mt-1">{employee.firstName} {employee.lastName}</p>
                                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">{employee.jobTitle}</p>
                                </div>
                                {directReports.length > 0 && <div className="w-px h-12 bg-border" />}
                            </div>

                            {/* Direct Reports Section (Downward) */}
                            {directReports.length > 0 && (
                                <div className="flex flex-col items-center space-y-4 w-full">
                                    <div className="h-px bg-border w-1/2 max-w-[400px]" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-4">Fleet Division (Direct Reports)</h4>
                                    <div className="flex flex-wrap justify-center gap-8 w-full pt-4">
                                        {directReports.map((report: any) => (
                                            <div key={report.id} className="flex flex-col items-center">
                                                <div className="w-px h-4 bg-border mb-0" />
                                                <Link href={`/dashboard/users/${report.id}`} className="p-4 bg-white ring-1 ring-border/50 shadow-md rounded-none w-48 text-center group hover:ring-primary/40 transition-all cursor-pointer">
                                                    <Avatar className="size-10 rounded-none mx-auto mb-3 border border-muted">
                                                        <AvatarImage src={report.avatar} className="object-cover rounded-none" />
                                                        <AvatarFallback className="font-black">{report.firstName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="font-black text-xs uppercase tracking-tight truncate">{report.firstName} {report.lastName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase truncate">{report.jobTitle}</p>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
                <TabsContent value="documents">
                    <Card className="border-none shadow-sm rounded-none bg-white p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {documents?.map((doc: any) => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-5 rounded-none bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group">
                                <div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-none"><FileBox className="size-5" /></div><span className="font-black text-xs uppercase truncate">{doc.title}</span></div>
                            </Link>
                        )) || <div className="col-span-full py-12 text-center text-[11px] font-black uppercase opacity-30">No documents in vault</div>}
                    </div></Card>
                </TabsContent>
                <TabsContent value="assets">
                    <Card className="border-none shadow-sm rounded-none bg-white p-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {assignedAssets?.map((asset: any) => (
                            <div key={asset.id} className="p-5 rounded-none ring-1 ring-border/50 bg-muted/5 space-y-3">
                                <div className="aspect-square bg-white rounded-none flex items-center justify-center border border-dashed p-2">
                                    {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-none" /> : <Laptop className="size-8 opacity-10" />}
                                </div>
                                <div><p className="font-black text-xs uppercase tracking-tighter truncate">{asset.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{asset.category}</p></div>
                            </div>
                        )) || <div className="col-span-full py-12 text-center text-[11px] font-black uppercase opacity-30">No assets assigned</div>}
                    </div></Card>
                </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <ActivityBarItem 
                    icon={Clock} 
                    title="Last Shift" 
                    value={lastAtt?.[0]?.checkInTime ? format(lastAtt[0].checkInTime.toDate(), 'dd MMM, p') : 'None'} 
                    status={lastAtt?.[0]?.status === 'present' ? 'Verified' : 'Flagged'}
                    color="bg-green-500"
                />
                <ActivityBarItem 
                    icon={CalendarClock} 
                    title="Leave Pulse" 
                    value={lastLeave?.[0] ? `${lastLeave[0].category}` : 'No Records'} 
                    status={lastLeave?.[0]?.status || 'Inactive'}
                    color="bg-sky-500"
                />
                <ActivityBarItem 
                    icon={MessageSquareWarning} 
                    title="Support Desk" 
                    value={lastTicket?.[0] ? `${lastTicket[0].category.split(' ')[0]}` : 'Zero Tickets'} 
                    status={lastTicket?.[0]?.status || 'Resolved'}
                    color="bg-amber-500"
                />
                <ActivityBarItem 
                    icon={FileText} 
                    title="Last Audit" 
                    value={userReports?.[0] ? `${userReports[0].reportType}` : 'No Reports'} 
                    status={userReports?.[0] ? format(userReports[0].date.toDate(), 'MMM dd') : 'Awaiting'}
                    color="bg-purple-500"
                />
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-none p-8 sm:max-w-xl border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Edit Identity</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-8 px-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">First Name</Label><FormControl><Input {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">Last Name</Label><FormControl><Input {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">Phone Number</Label><FormControl><Input {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-black text-primary">Blood Group</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-none text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">Date of Birth</Label><FormControl><Input type="date" {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="gender" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-black text-primary">Gender</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-none text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="nationality" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">Nationality</Label><FormControl><Input {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-black text-primary">Marital Status</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-none text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="languages" render={({ field }) => (
                                    <FormItem><Label className="text-[10px] uppercase font-black text-primary">Languages Known (comma separated)</Label><FormControl><Input {...field} placeholder="e.g. English, Tamil, Hindi" className="h-10 rounded-none text-xs" /></FormControl></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="password" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">New Password (optional)</Label><FormControl><Input type="password" {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-black text-primary">Confirm Password</Label><FormControl><Input type="password" {...field} className="h-10 rounded-none text-xs" /></FormControl></FormItem>)} />
                                </div>
                                <Button type="submit" className="w-full h-12 rounded-none font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <UserCheck className="size-4 mr-2"/>} Synchronize Identity</Button>
                            </form>
                        </Form>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ActivityBarItem({ icon: Icon, title, value, status, color }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-3 flex items-center gap-3.5 group hover:shadow-md transition-all ring-1 ring-border/50">
            <div className={cn("p-2 rounded-none text-white shrink-0 group-hover:scale-105 transition-transform", color)}>
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-1">{title}</p>
                <p className="text-xs font-black truncate text-foreground leading-tight">{value}</p>
                <div className="flex items-center gap-1.5 mt-1">
                    <div className="h-1.5 w-1.5 rounded-none bg-current opacity-40" />
                    <p className="text-[9px] font-bold uppercase opacity-40">{status}</p>
                </div>
            </div>
        </Card>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-none bg-primary/5 text-primary/60 shrink-0"><Icon className="size-4" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">{label}</p>
                <p className="text-[11px] font-black truncate text-foreground/90 uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-4 space-y-3 ring-1 ring-border/50 group">
            <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-none bg-muted/20 shadow-sm", color)}><Icon className="size-4" /></div>
                <Badge variant="outline" className="text-[8px] font-black uppercase bg-muted/20 border-none px-1.5 h-4 rounded-none">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-1.5"><p className="text-[10px] font-black uppercase text-muted-foreground">{title}</p><span className={cn("text-sm font-black", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-1.5 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[9px] font-bold text-muted-foreground/60 uppercase">{label}</p><p className={cn("text-xs font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative group">
            <div className={cn("h-7 w-7 rounded-none flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform", color)}><Icon className="size-3.5" /></div>
            <div className="space-y-1 flex-1">
                <p className="font-black text-sm uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-4 px-2 text-[8px] font-black uppercase border-none bg-muted/30 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">{label}</span>
            <span className="text-sm font-black text-foreground/80 uppercase text-right pl-3 truncate">{value}</span>
        </div>
    );
}
