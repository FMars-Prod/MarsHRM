
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
    MessageSquareWarning, RotateCcw, Network, Check, X, SearchSlash, Building2,
    ExternalLink
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

    if (isEmployeeLoading || !employee) return <div className="p-10 text-center animate-pulse uppercase font-black text-sm">Loading...</div>;

    const isEmployeeType = employee.employmentType === 'Employee';
    const leaveBalValue = employee.leaveBalance;
    const leaveEntValue = employee.totalLeaveEntitlement || (isEmployeeType ? 12 : 0);
    const isLeaveConfigured = leaveBalValue !== undefined && isEmployeeType;
    const isAdmin = employee.role === 'HR Manager' || employee.role === 'CEO/Admin';

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
                <MetricCard icon={Zap} title="Performance" ratio={employee.performanceRating || "Good"} color="text-primary">
                    <div className="flex items-center justify-between mt-4">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground/60">Review: {employee.lastReviewDate ? format(employee.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
                        {isAdmin && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 hover:bg-primary/5 rounded-none">
                                        <Edit className="size-3 text-primary" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-none sm:max-w-sm border-none shadow-2xl">
                                    <DialogHeader><DialogTitle className="text-xl font-bold uppercase tracking-tighter text-primary">Performance Rating</DialogTitle></DialogHeader>
                                    <div className="py-6 space-y-4">
                                        <Label className="text-[10px] font-bold uppercase text-primary tracking-widest">Update Rating</Label>
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
                <MetricCard icon={FileCheck} title="Payroll Status" ratio={employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : "Audited"} color="text-purple-600" />
                <MetricCard icon={FileBox} title="Documents" ratio={documents?.length || 0} color="text-emerald-600">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground/60 mt-4">
                        {documents?.[0] ? `Updated: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "No Files"}
                    </p>
                </MetricCard>
            </div>

            {/* Selection Hub */}
            <Tabs defaultValue="activity" className="space-y-4">
                <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                    {["Activity", "Attendance", "Hierarchy", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-8 py-3 font-bold uppercase text-[10px] tracking-widest transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="activity" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white p-8 space-y-8">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Activity History</h3>
                            <div className="space-y-6">
                                {userReports.length > 0 ? userReports.slice(0, 5).map(r => (
                                    <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd, yyyy')} desc={`Report Submitted`} color="bg-primary/10 text-primary" />
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
                        <div className="lg:col-span-4 space-y-4">
                            <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Personal Information</h3>
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
                                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Reporting Hierarchy</h3>
                                <div className="space-y-6">
                                     <InfoRow label="Reporting Type" value={employee.reportingHeadIds?.length ? "Team Member" : "Individual"} />
                                     <div className="p-5 bg-muted/20 rounded-none border border-dashed border-border/50">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground/60 mb-5">Reporting To</p>
                                        <ScrollArea className={cn(reportingHeads.length > 3 ? "h-48" : "h-auto")}>
                                            <div className="space-y-4">
                                                {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                                    <Link key={head.id} href={`/dashboard/users/${head.id}`} className="flex items-center gap-5 group">
                                                        <Avatar className="size-12 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                                            <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                            <AvatarFallback className="font-bold rounded-none">{head.firstName[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{head.firstName} {head.lastName}</p>
                                                            <p className="text-[10px] font-bold uppercase text-primary truncate tracking-tight">{head.jobTitle}</p>
                                                        </div>
                                                        <CheckCircle2 className="size-5 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    </Link>
                                                )) : (
                                                    <p className="text-sm font-bold text-muted-foreground uppercase opacity-40 italic">Reports to Admin</p>
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
                    <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden min-h-[400px]">
                        <ScrollArea className="h-full">
                            {attendanceData && attendanceData.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[11px] font-bold px-8 py-5 uppercase tracking-widest">Date</TableHead><TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest">Clock In</TableHead><TableHead className="text-[11px] font-bold py-5 uppercase tracking-widest text-right pr-8">Status</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {attendanceData.slice(0, 15).map((rec: any, i: number) => (
                                            <TableRow key={i} className="border-border/50 hover:bg-primary/5 transition-colors">
                                                <TableCell className="text-sm font-bold px-8 py-5 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="font-mono text-xs font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="text-right pr-8"><Badge variant="outline" className="text-[9px] font-bold uppercase border-none bg-green-50 text-green-600 rounded-none h-6 px-3">{rec.status}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
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
                <TabsContent value="hierarchy">
                    <Card className="border-none shadow-sm rounded-none bg-white p-10 overflow-x-auto min-h-[600px]">
                        <div className="flex flex-col items-center space-y-16 py-10 min-w-fit">
                            {/* Managers Section (Upward) */}
                            <div className="flex flex-col items-center space-y-6 w-full">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/30">Managers</h4>
                                <div className="flex flex-wrap justify-center gap-12 w-full">
                                    {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                        <div key={head.id} className="flex flex-col items-center">
                                             <Link href={`/dashboard/users/${head.id}`} className="p-6 bg-muted/20 border-2 border-dashed border-border/50 rounded-none w-56 text-center group hover:border-primary/40 transition-all cursor-pointer shadow-sm">
                                                <Avatar className="size-16 rounded-none mx-auto mb-4 shadow-md border border-white">
                                                    <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="font-black text-lg">{head.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <p className="font-bold text-sm uppercase tracking-tight truncate">{head.firstName} {head.lastName}</p>
                                                <p className="text-[10px] font-bold text-primary uppercase truncate tracking-tight mt-1">{head.jobTitle}</p>
                                             </Link>
                                             <div className="w-px h-10 bg-border" />
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center">
                                            <Badge variant="outline" className="rounded-none font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-10 px-6">Direct Admin Report</Badge>
                                            <div className="w-px h-10 bg-border" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Current User Section */}
                            <div className="relative flex flex-col items-center w-full">
                                <div className="p-10 bg-primary text-white shadow-2xl rounded-none w-72 text-center ring-8 ring-primary/10 transition-transform hover:scale-105 duration-500">
                                    <Avatar className="size-40 rounded-none mx-auto mb-6 border-4 border-white/20 shadow-xl">
                                        <AvatarImage src={employee.avatar} className="object-cover" />
                                        <AvatarFallback className="font-black text-4xl text-primary bg-white">{employee.firstName[0]}</AvatarFallback>
                                    </Avatar>
                                    <p className="font-black text-xl uppercase tracking-tighter leading-none">{employee.firstName} {employee.lastName}</p>
                                    <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest mt-3">{employee.jobTitle}</p>
                                </div>
                                {directReports.length > 0 && <div className="w-px h-16 bg-border" />}
                            </div>

                            {/* Direct Reports Section (Downward) */}
                            {directReports.length > 0 && (
                                <div className="flex flex-col items-center space-y-6 w-full">
                                    <div className="h-px bg-border w-1/2 max-w-[500px]" />
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/30 mt-6">Direct Reports</h4>
                                    <div className="flex flex-wrap justify-center gap-12 w-full pt-6">
                                        {directReports.map((report: any) => (
                                            <div key={report.id} className="flex flex-col items-center">
                                                <div className="w-px h-6 bg-border mb-0" />
                                                <Link href={`/dashboard/users/${report.id}`} className="p-6 bg-white ring-1 ring-border/50 shadow-xl rounded-none w-56 text-center group hover:ring-primary/40 transition-all cursor-pointer">
                                                    <Avatar className="size-16 rounded-none mx-auto mb-4 border border-muted shadow-sm">
                                                        <AvatarImage src={report.avatar} className="object-cover rounded-none" />
                                                        <AvatarFallback className="font-black text-lg">{report.firstName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="font-bold text-sm uppercase tracking-tight truncate group-hover:text-primary transition-colors">{report.firstName} {report.lastName}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase truncate tracking-tight mt-1">{report.jobTitle}</p>
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
                    <Card className="border-none shadow-sm rounded-none bg-white p-8">
                        {documents && documents.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {documents.map((doc: any) => (
                                    <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-6 rounded-none bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group shadow-sm">
                                        <div className="flex items-center gap-5">
                                            <div className="p-3 bg-blue-50 text-blue-600 rounded-none shadow-sm"><FileBox className="size-6" /></div>
                                            <div className="min-w-0">
                                                <span className="font-bold text-xs uppercase truncate block">{doc.title}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{format(doc.uploadedAt.toDate(), 'dd MMM yy')}</span>
                                            </div>
                                        </div>
                                        <ExternalLink className="size-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                <div className="p-5 bg-muted/20 rounded-full"><FileBox className="size-12 text-primary/40" /></div>
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-widest">No Documents</p>
                                    <p className="text-[11px] font-bold uppercase mt-1">No saved documents found.</p>
                                </div>
                            </div>
                        )}
                    </Card>
                </TabsContent>
                <TabsContent value="assets">
                    <Card className="border-none shadow-sm rounded-none bg-white p-8">
                        {assignedAssets && assignedAssets.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                {assignedAssets.map((asset: any) => (
                                    <div key={asset.id} className="p-6 rounded-none ring-1 ring-border/50 bg-muted/5 space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="aspect-square bg-white rounded-none flex items-center justify-center border-2 border-dashed border-border/50 p-3">
                                            {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-none" /> : <Laptop className="size-10 opacity-10" />}
                                        </div>
                                        <div><p className="font-bold text-sm uppercase tracking-tighter truncate">{asset.name}</p><p className="text-[10px] font-bold text-primary uppercase tracking-widest">{asset.category}</p></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                <div className="p-5 bg-muted/20 rounded-full"><Laptop className="size-12 text-primary/40" /></div>
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-widest">No Assets</p>
                                    <p className="text-[11px] font-bold uppercase mt-1">No company equipment assigned.</p>
                                </div>
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ActivityBarItem 
                    icon={Clock} 
                    title="Last Clock In" 
                    value={lastAtt?.[0]?.checkInTime ? format(lastAtt[0].checkInTime.toDate(), 'dd MMM, p') : 'No Records'} 
                    status={lastAtt?.[0]?.status === 'present' ? 'Verified' : 'Pending'}
                    color="bg-green-500"
                />
                <ActivityBarItem 
                    icon={CalendarClock} 
                    title="Leave Status" 
                    value={lastLeave?.[0] ? `${lastLeave[0].category}` : 'No Records'} 
                    status={lastLeave?.[0]?.status || 'Inactive'}
                    color="bg-sky-500"
                />
                <ActivityBarItem 
                    icon={MessageSquareWarning} 
                    title="Tickets" 
                    value={lastTicket?.[0] ? `${lastTicket[0].category.split(' ')[0]}` : '0 Open'} 
                    status={lastTicket?.[0]?.status || 'Resolved'}
                    color="bg-amber-500"
                />
                <ActivityBarItem 
                    icon={FileText} 
                    title="Latest Report" 
                    value={userReports?.[0] ? `${userReports[0].reportType}` : 'No Reports'} 
                    status={userReports?.[0] ? format(userReports[0].date.toDate(), 'MMM dd') : 'Awaiting'}
                    color="bg-purple-500"
                />
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-none p-10 sm:max-w-xl border-none shadow-2xl">
                    <DialogHeader className="text-left"><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Edit Profile</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-10 px-10">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6 pb-10">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">First Name</Label><FormControl><Input {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Last Name</Label><FormControl><Input {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Phone Number</Label><FormControl><Input {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Blood Group</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Birth Date</Label><FormControl><Input type="date" {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="gender" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Gender</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="nationality" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Nationality</Label><FormControl><Input {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                                        <FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Marital Status</Label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-none"><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="languages" render={({ field }) => (
                                    <FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Languages</Label><FormControl><Input {...field} placeholder="e.g. English, Tamil" className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>
                                )} />
                                <Separator className="my-4 opacity-50" />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="password" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">New Password</Label><FormControl><Input type="password" {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Confirm Password</Label><FormControl><Input type="password" {...field} className="h-12 rounded-none font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50" /></FormControl></FormItem>)} />
                                </div>
                                <Button type="submit" className="w-full h-14 rounded-none font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20 mt-4" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <UserCheck className="size-4 mr-2"/>} Save Changes</Button>
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
                <p className="text-[13px] font-bold truncate text-foreground/90 uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-xl rounded-none bg-white p-6 space-y-5 ring-1 ring-border/50 group hover:shadow-primary/5 transition-all">
            <div className="flex justify-between items-start">
                <div className={cn("p-4 rounded-none shadow-md", color, "bg-muted/10")}><Icon className="size-5" /></div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2.5"><p className="text-[11px] font-bold uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-lg font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-1.5 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-xs font-bold", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-6 items-start relative group">
            <div className={cn("h-10 w-10 rounded-none flex items-center justify-center shrink-0 z-10 shadow-md transition-transform group-hover:scale-110", color)}><Icon className="size-5" /></div>
            <div className="space-y-1.5 flex-1 pt-0.5">
                <p className="font-bold text-base uppercase tracking-tight text-foreground/90 leading-none">{title}</p>
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
