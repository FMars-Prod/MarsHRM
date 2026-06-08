
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
    Mail, Briefcase, MoreHorizontal, Download, 
    Clock, Activity, UserCheck, Zap, ChevronRight,
    Globe, ShieldAlert, FileCheck, FileBox, Users, ListTodo, Laptop, MapPin, CalendarClock,
    History, MessageSquareWarning, Timer
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
import { format, startOfMonth, endOfMonth, differenceInMonths, eachDayOfInterval, isSunday, isToday, startOfDay, isBefore } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

    const teamDocRef = useMemoFirebase(() => employee?.teamId ? doc(firestore, 'teams', employee.teamId) : null, [employee?.teamId, firestore]);
    const { data: teamData } = useDoc<any>(teamDocRef);

    const teamLeadDocRef = useMemoFirebase(() => teamData?.teamLeadId ? doc(firestore, 'users', teamData.teamLeadId) : null, [teamData?.teamLeadId, firestore]);
    const { data: teamLead } = useDoc<any>(teamLeadDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const docsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'vault_assets'), where('ownerId', '==', user.uid), orderBy('uploadedAt', 'desc')) : null, [user, firestore]);
    const { data: documents } = useCollection<any>(docsQuery);

    const assetsQuery = useMemoFirebase(() => user ? query(collection(firestore, "assets"), where("assignedToId", "==", user.uid)) : null, [user, firestore]);
    const { data: assignedAssets } = useCollection<any>(assetsQuery);

    // Activity Handshake Queries
    const lastAttQuery = useMemoFirebase(() => user ? query(collection(firestore, `users/${user.uid}/attendances`), orderBy('checkInTime', 'desc'), limit(1)) : null, [user, firestore]);
    const { data: lastAtt } = useCollection<any>(lastAttQuery);

    const lastLeaveQuery = useMemoFirebase(() => user ? query(collection(firestore, 'leave_requests'), where('employeeId', '==', user.uid), orderBy('createdAt', 'desc'), limit(1)) : null, [user, firestore]);
    const { data: lastLeave } = useCollection<any>(lastLeaveQuery);

    const lastTicketQuery = useMemoFirebase(() => user ? query(collection(firestore, 'issue_reports'), where('employeeId', '==', user.uid), orderBy('submissionDate', 'desc'), limit(1)) : null, [user, firestore]);
    const { data: lastTicket } = useCollection<any>(lastTicketQuery);

    const lastReportQuery = useMemoFirebase(() => user ? query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(1)) : null, [user, firestore]);
    const { data: lastReport } = useCollection<any>(lastReportQuery);

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const attendanceQuery = useMemoFirebase(() => user ? query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', Timestamp.fromDate(monthStart)),
        where('checkInTime', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('checkInTime', 'desc')
    ) : null, [user, firestore]);
    const { data: attendanceData } = useCollection<any>(attendanceQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Office Hub";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Office Hub";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const now = new Date();
        const totalMonths = differenceInMonths(now, start);
        const years = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        if (years > 0) return `${years} yr${remainingMonths > 0 ? ` ${remainingMonths} mo` : ''}`;
        return `${totalMonths} mo`;
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

    if (isEmployeeLoading || !employee) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Loading Hub...</div>;

    const leaveBalValue = employee.leaveBalance;
    const leaveEntValue = employee.totalLeaveEntitlement || 24;
    const isLeaveConfigured = leaveBalValue !== undefined;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in-up pb-4 space-y-3 font-jakarta">
            {/* Main Identity Hub */}
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                        <Avatar className="h-16 w-16 rounded-xl border-2 border-white shadow-md ring-1 ring-border">
                            <AvatarImage src={employee.avatar} className="object-cover" />
                            <AvatarFallback className="text-xl font-black bg-muted">{employee.firstName?.[0]}</AvatarFallback>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="size-4 text-white" /></div>
                        </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h2 className="text-lg font-black tracking-tighter leading-none">{employee.firstName} {employee.lastName}</h2>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{employee.jobTitle}</p>
                            </div>
                            <div className="flex gap-1.5">
                                <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-lg font-black uppercase text-[8px] tracking-widest h-7 px-3">Edit Profile</Button>
                                <Button asChild size="sm" className="rounded-lg font-black uppercase text-[8px] tracking-widest h-7 px-3 shadow-sm shadow-primary/20"><Link href="https://fortumars.com/os.html" target="_blank">Activate MarsOS</Link></Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 mt-3 pt-3 border-t border-dashed border-border/50">
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
                    <div className="grid grid-cols-4 gap-0.5 mt-2">
                        <MetricStat label="P" val={attendanceStats.present} />
                        <MetricStat label="L" val={attendanceStats.late} color="text-amber-500" />
                        <MetricStat label="A" val={attendanceStats.absent} color="text-rose-500" />
                        <MetricStat label="R" val={attendanceStats.remaining} color="text-sky-500" />
                    </div>
                </MetricCard>
                <MetricCard icon={CalendarClock} title="Leave" ratio={isLeaveConfigured ? `${leaveBalValue}/${leaveEntValue}` : "NIL"} progress={isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 0} color="text-sky-600" />
                <MetricCard icon={Zap} title="Performance" ratio={employee.performanceRating || "Good"} color="text-orange-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-2">Review: {employee.lastReviewDate ? format(employee.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
                </MetricCard>
                <MetricCard icon={FileCheck} title="Payroll" ratio={employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : (employee.employmentType === 'Intern' ? "Performance Based" : "Audited")} color="text-purple-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-2">Next: {employee.employmentType === 'Intern' ? "Performance Based" : "Scheduled cycle"}</p>
                </MetricCard>
                <MetricCard icon={FileBox} title="Vault" ratio={documents?.length || 0} color="text-emerald-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-2">
                        {documents?.[0] ? `Updated: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "Empty"}
                    </p>
                </MetricCard>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="activity" className="space-y-2">
                <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-xl p-1 h-auto gap-1">
                    {["Activity", "Attendance", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-1.5 font-black uppercase text-[8px] tracking-[0.2em] transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="activity" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                        <Card className="lg:col-span-8 border-none shadow-sm rounded-2xl bg-white p-4 space-y-4">
                            <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Registry Log</h3>
                            <div className="space-y-2.5">
                                {userReports.length > 0 ? userReports.slice(0, 3).map(r => (
                                    <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd')} desc={`Finalized.`} color="bg-primary/10 text-primary" />
                                )) : <p className="text-[8px] font-black uppercase text-center opacity-30 py-6">No recent handshakes detected</p>}
                            </div>
                        </Card>
                        <div className="lg:col-span-4 space-y-2">
                            <Card className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-3">
                                <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Identity Details</h3>
                                <div className="space-y-2">
                                    <InfoRow label="Birth" value={employee.dob ? format(new Date(employee.dob), 'dd MMM yyyy') : 'N/A'} />
                                    <InfoRow label="Gender" value={employee.gender || 'N/A'} />
                                    <InfoRow label="Origin" value={employee.nationality || 'N/A'} />
                                    <InfoRow label="Status" value={employee.maritalStatus || 'N/A'} />
                                    <InfoRow label="Blood" value={employee.bloodGroup || 'N/A'} />
                                    <div className="pt-1 flex flex-wrap gap-1">
                                        {employee.languages?.map((lang: string) => (
                                            <Badge key={lang} variant="secondary" className="text-[7px] font-bold px-1.5 h-4 uppercase">{lang}</Badge>
                                        )) || <span className="text-[8px] opacity-30">No languages registered</span>}
                                    </div>
                                </div>
                            </Card>

                            <Card className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-3">
                                <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Reporting Protocol</h3>
                                <div className="space-y-2">
                                     <InfoRow label="Structure" value={employee.teamId ? "Tactical Unit" : "Individual Fleet"} />
                                     <div className="p-3 bg-muted/20 rounded-xl border border-dashed border-border/50">
                                        <p className="text-[7px] font-black uppercase text-muted-foreground/60 mb-2">Direct Command</p>
                                        {teamLead ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8 rounded-lg">
                                                    <AvatarImage src={teamLead.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px]">{teamLead.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-xs truncate">{teamLead.firstName} {teamLead.lastName}</p>
                                                    <p className="text-[8px] font-black uppercase text-primary truncate">{teamLead.jobTitle}</p>
                                                </div>
                                                <ShieldCheck className="size-3 text-primary" />
                                            </div>
                                        ) : (
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">Direct reporting to Admin</p>
                                        )}
                                     </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="attendance">
                    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden max-h-[250px]">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[8px] font-black px-6 py-2 uppercase tracking-widest">Date</TableHead><TableHead className="text-[8px] font-black py-2 uppercase tracking-widest text-right pr-6">Status</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {attendanceData?.slice(0, 10).map((rec, i) => (
                                        <TableRow key={i} className="border-border/50">
                                            <TableCell className="text-[9px] font-black px-6 py-2 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yy')}</TableCell>
                                            <TableCell className="text-right pr-6"><Badge variant="outline" className="text-[7px] font-black uppercase border-none bg-green-50 text-green-600">{rec.status}</Badge></TableCell>
                                        </TableRow>
                                    )) || <TableRow><TableCell colSpan={2} className="h-20 text-center text-[8px] font-black uppercase opacity-30">No records</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Tactical Handshake (Linear Tasks) */}
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
                    value={lastReport?.[0] ? `${lastReport[0].reportType}` : 'No Reports'} 
                    status={lastReport?.[0] ? format(lastReport[0].date.toDate(), 'MMM dd') : 'Awaiting'}
                    color="bg-purple-500"
                />
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-[2.5rem] p-8 sm:max-w-xl border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Edit Identity</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-8 px-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">First Name</Label><FormControl><Input {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Last Name</Label><FormControl><Input {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Phone Number</Label><FormControl><Input {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                                        <FormItem><Label className="text-[9px] uppercase font-black text-primary">Blood Group</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Date of Birth</Label><FormControl><Input type="date" {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="gender" render={({ field }) => (
                                        <FormItem><Label className="text-[9px] uppercase font-black text-primary">Gender</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="nationality" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Nationality</Label><FormControl><Input {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                                        <FormItem><Label className="text-[9px] uppercase font-black text-primary">Marital Status</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="languages" render={({ field }) => (
                                    <FormItem><Label className="text-[9px] uppercase font-black text-primary">Languages Known (comma separated)</Label><FormControl><Input {...field} placeholder="e.g. English, Tamil, Hindi" className="h-10 rounded-xl text-xs" /></FormControl></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="password" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">New Password (optional)</Label><FormControl><Input type="password" {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Confirm Password</Label><FormControl><Input type="password" {...field} className="h-10 rounded-xl text-xs" /></FormControl></FormItem>)} />
                                </div>
                                <Button type="submit" className="w-full h-12 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <UserCheck className="size-4 mr-2"/>} Synchronize Identity</Button>
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
        <Card className="border-none shadow-sm rounded-xl bg-white p-2.5 flex items-center gap-3 group hover:shadow-md transition-all ring-1 ring-border/50">
            <div className={cn("p-1.5 rounded-lg text-white shrink-0 group-hover:scale-105 transition-transform", color)}>
                <Icon className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[8px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-0.5">{title}</p>
                <p className="text-[10px] font-black truncate text-foreground leading-tight">{value}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1 w-1 rounded-full bg-current opacity-40" />
                    <p className="text-[7px] font-bold uppercase opacity-40">{status}</p>
                </div>
            </div>
        </Card>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg bg-primary/5 text-primary/60 shrink-0"><Icon className="size-3" /></div>
            <div className="min-w-0">
                <p className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-0.5">{label}</p>
                <p className="text-[9px] font-black truncate text-foreground/90 uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-sm rounded-2xl bg-white p-3 space-y-2 ring-1 ring-border/50 group">
            <div className="flex justify-between items-start">
                <div className={cn("p-1.5 rounded-xl bg-muted/20 shadow-sm", color)}><Icon className="size-3" /></div>
                <Badge variant="outline" className="text-[6px] font-black uppercase bg-muted/20 border-none px-1 h-3.5">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-1"><p className="text-[8px] font-black uppercase text-muted-foreground">{title}</p><span className={cn("text-xs font-black", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-1 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[7px] font-bold text-muted-foreground/60 uppercase">{label}</p><p className={cn("text-[9px] font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-3 items-start relative group">
            <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform", color)}><Icon className="size-3" /></div>
            <div className="space-y-0.5 flex-1">
                <p className="font-black text-[10px] uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-3 px-1.5 text-[6px] font-black uppercase border-none bg-muted/30 tracking-widest">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-3 text-muted-foreground/20 group-hover:text-primary transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[8px] font-black uppercase text-muted-foreground/50 tracking-widest">{label}</span>
            <span className="text-[9px] font-black text-foreground/80 uppercase text-right pl-3 truncate">{value}</span>
        </div>
    );
}
