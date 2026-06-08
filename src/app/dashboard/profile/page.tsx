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
    Globe, ShieldAlert, FileCheck, FileBox, Users, ListTodo, Laptop, MapPin, CalendarClock
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
import { format, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, isSunday, isToday, startOfDay, isBefore } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

const profileFormSchema = z.object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    phoneNumber: z.string().min(1, "Required"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
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

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Office Hub";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Office Hub";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const totalDays = differenceInDays(new Date(), start);
        
        if (totalDays < 30) return `${totalDays} d`;
        const years = Math.floor(totalDays / 365);
        const months = Math.floor((totalDays % 365) / 30);
        
        if (years > 0) {
            return `${years} yr${months > 0 ? ` ${months} mo` : ''}`;
        }
        return `${months} mo`;
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
        defaultValues: { firstName: "", lastName: "", phoneNumber: "", password: "", confirmPassword: "" },
    });

    React.useEffect(() => {
        if (employee) form.reset({ firstName: employee.firstName || '', lastName: employee.lastName || '', phoneNumber: employee.phoneNumber || '', password: '', confirmPassword: '' });
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
        } catch (e: any) { toast({ variant: "destructive", title: "Update failed", description: e.message }); }
        finally { setIsSubmitting(false); }
    }

    if (isEmployeeLoading || !employee) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Loading Hub...</div>;

    const leaveBalValue = employee.leaveBalance;
    const leaveEntValue = employee.totalLeaveEntitlement || 24;
    const isLeaveConfigured = leaveBalValue !== undefined;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-6">
                <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-6">
                        <div className="relative group cursor-pointer" onClick={() => setIsAvatarDialogOpen(true)}>
                            <Avatar className="h-24 w-24 rounded-2xl border-4 border-white shadow-md ring-1 ring-border">
                                <AvatarImage src={employee.avatar} className="object-cover" />
                                <AvatarFallback className="text-3xl font-black bg-muted">{employee.firstName?.[0]}</AvatarFallback>
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="size-6 text-white" /></div>
                            </Avatar>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-0.5">
                                    <h2 className="text-2xl font-black tracking-tighter">{employee.firstName} {employee.lastName}</h2>
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{employee.jobTitle}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} variant="outline" size="sm" className="rounded-xl font-bold uppercase text-[9px] tracking-widest h-9 px-4">Edit Profile</Button>
                                    <Button asChild size="sm" className="rounded-xl font-bold uppercase text-[9px] tracking-widest h-9 px-4 shadow-lg shadow-primary/20"><Link href="https://fortumars.com/os.html" target="_blank">Activate MarsOS</Link></Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4 border-y border-dashed border-border/50">
                                <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 8).toUpperCase()}`} />
                                <DetailItem icon={CalendarDays} label="Joining Date" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Mail} label="Email Address" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone Number" value={employee.phoneNumber || "N/A"} />
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                <DetailItem icon={Users} label="Team" value={employee.teamId ? "Assigned" : "Unassigned"} />
                                <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                                <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Employee"} />
                                <DetailItem icon={Clock} label="System Level" value={employee.role} />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard icon={UserCheck} title="Attendance" ratio={`${attendanceStats.present + attendanceStats.late} / ${attendanceStats.totalWorkingDays}`} progress={attendanceStats.percentage} color="text-green-600">
                    <div className="grid grid-cols-4 gap-1 mt-4">
                        <MetricStat label="Pres" val={attendanceStats.present} />
                        <MetricStat label="Late" val={attendanceStats.late} color="text-amber-500" />
                        <MetricStat label="Abs" val={attendanceStats.absent} color="text-rose-500" />
                        <MetricStat label="Rem" val={attendanceStats.remaining} color="text-sky-500" />
                    </div>
                </MetricCard>

                <MetricCard icon={CalendarClock} title="Leave Balance" ratio={isLeaveConfigured ? `${leaveBalValue} / ${leaveEntValue}` : "NIL"} progress={isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 0} color="text-sky-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">{isLeaveConfigured ? "Days available for use" : "Awaiting HR configuration"}</p>
                </MetricCard>

                <MetricCard icon={Zap} title="Performance" ratio={employee.performanceRating || "Good"} color="text-orange-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">Review: {employee.lastReviewDate ? format(employee.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
                </MetricCard>

                <MetricCard icon={FileCheck} title="Payroll Status" ratio={employee.payrollAmount ? `₹${employee.payrollAmount.toLocaleString()}` : (employee.employmentType === 'Intern' ? "Based on Performance" : "Audited")} color="text-purple-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">Next: {employee.employmentType === 'Intern' ? "Based on Performance" : "Scheduled cycle"}</p>
                </MetricCard>

                <MetricCard icon={FileBox} title="Stored Intelligence" ratio={documents?.length || 0} color="text-emerald-600">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">Professional assets in vault</p>
                </MetricCard>
            </div>

            <Tabs defaultValue="activity" className="space-y-4">
                <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-xl p-1 h-auto gap-2">
                    {["Activity", "Attendance", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2 font-black uppercase text-[9px] tracking-[0.2em] transition-all">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="activity" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        <Card className="lg:col-span-8 border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Report History</h3>
                            <div className="space-y-4">
                                {userReports.length > 0 ? userReports.map(r => (
                                    <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd')} desc={`Finalized for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                                )) : <p className="text-[9px] font-black uppercase text-center opacity-30 py-10">No recent activity detected</p>}
                            </div>
                        </Card>
                        <Card className="lg:col-span-4 border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Employment Details</h3>
                            <div className="space-y-3">
                                <InfoRow label="Designation" value={employee.jobTitle} />
                                <InfoRow label="Department" value={employee.department} />
                                <InfoRow label="Work Schedule" value={employee.shiftType || 'General Shift'} />
                                <InfoRow label="Experience" value={experience} />
                            </div>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="attendance">
                    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[8px] font-black px-6 py-4 uppercase tracking-widest">Date</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest">Login</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest text-right px-6">Location</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {attendanceData?.map((rec, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell className="text-[10px] font-black px-6 py-3 uppercase">{format(rec.checkInTime.toDate(), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-bold text-primary">{format(rec.checkInTime.toDate(), 'p')}</TableCell>
                                        <TableCell className="text-right px-6">{rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-1.5 rounded-lg bg-primary/5 text-primary inline-block"><MapPin className="size-3" /></Link>}</TableCell>
                                    </TableRow>
                                )) || <TableRow><TableCell colSpan={3} className="h-32 text-center text-[9px] font-black uppercase opacity-30">No records found</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                <TabsContent value="documents">
                    <Card className="border-none shadow-sm rounded-2xl bg-white p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {documents?.map(doc => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl hover:bg-white hover:shadow-md transition-all group">
                                <div className="p-2 bg-sky-50 text-sky-600 rounded-lg"><FileBox className="size-4" /></div>
                                <span className="text-[10px] font-black uppercase truncate">{doc.title}</span>
                            </Link>
                        )) || <div className="col-span-full py-10 text-center text-[9px] font-black uppercase opacity-30">No documents found</div>}
                    </div></Card>
                </TabsContent>
                <TabsContent value="assets">
                    <Card className="border-none shadow-sm rounded-2xl bg-white p-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {assignedAssets?.map(asset => (
                            <div key={asset.id} className="p-3 bg-muted/5 rounded-xl space-y-2">
                                <div className="aspect-square bg-white rounded-lg flex items-center justify-center border border-dashed p-1">
                                    {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full rounded-md" /> : <Laptop className="size-6 opacity-10" />}
                                </div>
                                <div><p className="text-[9px] font-black truncate uppercase">{asset.name}</p><p className="text-[7px] font-bold text-muted-foreground uppercase">{asset.category}</p></div>
                            </div>
                        )) || <div className="col-span-full py-10 text-center text-[9px] font-black uppercase opacity-30">No assets assigned</div>}
                    </div></Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}><DialogContent className="rounded-3xl p-8 sm:max-w-md"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Edit Profile</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">First Name</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Last Name</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs" /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><Label className="text-[9px] uppercase font-black text-primary">Phone Number</Label><FormControl><Input {...field} className="h-10 rounded-lg text-xs" /></FormControl></FormItem>)} />
                <Button type="submit" className="w-full h-12 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <UserCheck className="size-4 mr-2"/>} Update Identity</Button>
            </form></Form></DialogContent></Dialog>
        </div>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/5 text-primary/60 shrink-0"><Icon className="size-4" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">{label}</p>
                <p className="text-[10px] font-black truncate text-foreground/90 uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-sm rounded-2xl bg-white p-5 space-y-4 ring-1 ring-border/50 group">
            <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-xl bg-muted/20 shadow-sm", color)}><Icon className="size-4" /></div>
                <Badge variant="outline" className="text-[7px] font-black uppercase bg-muted/20 border-none">Active Sync</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black uppercase text-muted-foreground">{title}</p><span className={cn("text-sm font-black", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-1.5" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[8px] font-bold text-muted-foreground/60 uppercase">{label}</p><p className={cn("text-xs font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative group">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform group-hover:scale-105", color)}><Icon className="size-4" /></div>
            <div className="space-y-1 flex-1">
                <p className="font-black text-xs uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-4 px-2 text-[7px] font-black uppercase border-none bg-muted/30 tracking-widest">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">{label}</span>
            <span className="text-[11px] font-black text-foreground/80 uppercase text-right pl-3">{value}</span>
        </div>
    );
}