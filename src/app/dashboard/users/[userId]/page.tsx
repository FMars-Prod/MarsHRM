'use client';

import * as React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, differenceInMonths, eachDayOfInterval, isSunday, isToday, startOfDay } from 'date-fns';
import { ShieldCheck, FileText, Clock, Users, Building2, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MapPin, ChevronRight, CalendarClock, FileCheck, Laptop } from 'lucide-react';
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

type AttendanceRecord = {
  id: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'out_of_range';
  totalBreakDuration?: number;
  locationCheckInLatitude?: number;
  locationCheckInLongitude?: number;
  isOutOfRange?: boolean;
};

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  
  const [userReports, setUserReports] = React.useState<any[]>([]);

  const userDocRef = useMemoFirebase(() => (userId ? doc(firestore, 'users', userId) : null), [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<any>(userDocRef);

  const teamDocRef = useMemoFirebase(() => user?.teamId ? doc(firestore, 'teams', user.teamId) : null, [user?.teamId, firestore]);
  const { data: teamData } = useDoc<any>(teamDocRef);

  const teamLeadDocRef = useMemoFirebase(() => teamData?.teamLeadId ? doc(firestore, 'users', teamData.teamLeadId) : null, [teamData?.teamLeadId, firestore]);
  const { data: teamLead } = useDoc<any>(teamLeadDocRef);

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const docsQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'vault_assets'), where('ownerId', '==', userId), orderBy('uploadedAt', 'desc')) : null, [userId, firestore]);
  const { data: documents } = useCollection<any>(docsQuery);

  const assetsQuery = useMemoFirebase(() => userId ? query(collection(firestore, "assets"), where("assignedToId", "==", userId)) : null, [userId, firestore]);
  const { data: assignedAssets } = useCollection<any>(assetsQuery);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  React.useEffect(() => {
    if (!isUserLoading && currentUser && currentUserData) {
        const isSelf = currentUser.uid === userId;
        if (!isSelf && !isAdmin) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'Administrative authorization required.' });
            router.push('/dashboard');
        }
    }
  }, [currentUser, currentUserData, userId, isUserLoading, router, toast, isAdmin]);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);

  const branchName = React.useMemo(() => {
    if (!branches || !user?.branchId) return "Unassigned";
    const b = branches.find((b: any) => b.id === user.branchId);
    return b ? b.name : "Unassigned";
  }, [branches, user?.branchId]);

  const experience = React.useMemo(() => {
    if (!user?.hireDate) return "N/A";
    const start = new Date(user.hireDate);
    const now = new Date();
    
    const totalMonths = differenceInMonths(now, start);
    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (years > 0) {
        return `${years} yr${remainingMonths > 0 ? ` ${remainingMonths} mo` : ''}`;
    }
    return `${totalMonths} mo`;
  }, [user]);

  const attendanceStats = React.useMemo(() => {
    const today = startOfDay(new Date());
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const totalWorkingDays = daysInMonth.filter(d => !isSunday(d)).length;
    const daysSoFar = eachDayOfInterval({ start: monthStart, end: today });
    const workingDaysSoFar = daysSoFar.filter(d => !isSunday(d)).length;

    if (!attendanceData) return { present: 0, late: 0, absent: workingDaysSoFar, remaining: totalWorkingDays - workingDaysSoFar, percentage: 0, totalWorkingDays };
    const monthlyAtt = attendanceData.filter(a => a.checkInTime && a.checkInTime.toDate() >= monthStart);
    const present = monthlyAtt.filter(a => a.status === 'present').length;
    const late = monthlyAtt.filter(a => a.status === 'late').length;
    const attended = present + late;
    const absent = Math.max(0, workingDaysSoFar - attended);
    const remaining = Math.max(0, totalWorkingDays - workingDaysSoFar);
    return { present, late, absent, remaining, totalWorkingDays, percentage: Math.min(100, Math.round((attended / totalWorkingDays) * 100)) };
  }, [attendanceData, monthStart, monthEnd]);

  React.useEffect(() => {
      const fetchReports = async () => {
          if (!userId) return;
          const q = query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(10));
          const snap = await getDocs(q);
          setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchReports();
  }, [userId, firestore]);

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.text(`Employee Audit: ${user.firstName} ${user.lastName}`, 14, 20);
    autoTable(pdfDoc, {
        startY: 30,
        head: [['Metric', 'Value']],
        body: [['Attendance %', `${attendanceStats.percentage}%`], ['ID', user.id]]
    });
    pdfDoc.save(`Audit_${user.firstName}.pdf`);
  };

  if (isUserLoading || !user) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Loading Profile...</div>;

  const leaveBalValue = user.leaveBalance;
  const leaveEntValue = user.totalLeaveEntitlement || 24;
  const isLeaveConfigured = leaveBalValue !== undefined;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
        <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden p-6">
            <div className="flex flex-col gap-6">
                <div className="flex items-start gap-6">
                    <Avatar className="h-24 w-24 rounded-none border-4 border-white shadow-md ring-1 ring-border shrink-0 bg-muted">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="text-3xl font-black rounded-none">{user.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-black tracking-tighter">{user.firstName} {user.lastName}</h2>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{user.jobTitle}</p>
                            </div>
                            <div className="flex gap-2">
                                {isAdmin && <Button onClick={handleExportPdf} variant="outline" size="sm" className="rounded-none h-9 px-4 font-black uppercase text-[9px] tracking-widest">Export PDF</Button>}
                                <Button asChild size="sm" className="rounded-none h-9 px-4 font-black uppercase text-[9px] tracking-widest shadow-xl shadow-primary/20"><Link href="/dashboard/users"><Users className="size-3.5 mr-1.5" /> Staff List</Link></Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4 border-y border-dashed border-border/50">
                            <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${user.id.slice(0, 8).toUpperCase()}`} />
                            <DetailItem icon={CalendarDays} label="Joining Date" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Mail} label="Email Address" value={user.email} />
                            <DetailItem icon={Phone} label="Phone Number" value={user.phoneNumber || "N/A"} />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <DetailItem icon={Users} label="Team" value={user.teamId ? "Assigned" : "Unassigned"} />
                            <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                            <DetailItem icon={Briefcase} label="Employment Type" value={user.employmentType || "Employee"} />
                            <DetailItem icon={Clock} label="System Level" value={user.role} />
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
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">{isLeaveConfigured ? "Days available for use" : "Awaiting config"}</p>
            </MetricCard>

            <MetricCard icon={Zap} title="Performance" ratio={user.performanceRating || "Good"} color="text-orange-600">
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">Review: {user.lastReviewDate ? format(user.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
            </MetricCard>

            <MetricCard icon={FileCheck} title="Payroll Status" ratio={user.payrollAmount ? `₹${user.payrollAmount.toLocaleString()}` : (user.employmentType === 'Intern' ? "Performance Based" : "Audited")} color="text-purple-600">
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">Next: {user.employmentType === 'Intern' ? "Performance Based" : "Scheduled"}</p>
            </MetricCard>

            <MetricCard icon={FileBox} title="Documents" ratio={documents?.length || 0} color="text-emerald-600">
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 mt-4">
                    {documents?.[0] ? `Updated: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "Empty Vault"}
                </p>
            </MetricCard>
        </div>

        <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1 h-auto gap-2">
                {["Activity", "Attendance", "Documents", "Assets"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2 font-black uppercase text-[9px] tracking-[0.2em] transition-all">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Recent Activity</h3>
                        <div className="space-y-4">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd')} desc={`Finalized for ${r.employeeDepartment}.`} color="bg-primary/10 text-primary" />
                            )) : <p className="text-[9px] font-black uppercase text-center opacity-30 py-10">No recent activity</p>}
                        </div>
                    </Card>
                    <div className="lg:col-span-4 space-y-3">
                        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Identity Details</h3>
                            <div className="space-y-3">
                                <InfoRow label="Birth" value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : 'N/A'} />
                                <InfoRow label="Gender" value={user.gender || 'N/A'} />
                                <InfoRow label="Origin" value={user.nationality || 'N/A'} />
                                <InfoRow label="Status" value={user.maritalStatus || 'N/A'} />
                                <InfoRow label="Blood" value={user.bloodGroup || 'N/A'} />
                                <div className="pt-1 flex flex-wrap gap-1">
                                    {user.languages?.map((lang: string) => (
                                        <Badge key={lang} variant="secondary" className="text-[8px] font-bold px-2 py-0.5 uppercase rounded-none">{lang}</Badge>
                                    )) || <span className="text-[9px] opacity-30">No languages</span>}
                                </div>
                            </div>
                        </Card>
                        
                        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Reporting Protocol</h3>
                            <div className="space-y-3">
                                <InfoRow label="Structure" value={user.teamId ? "Tactical Unit" : "Individual Fleet"} />
                                <div className="p-4 bg-muted/20 rounded-none border border-dashed border-border/50">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 mb-3">Direct Command</p>
                                    {teamLead ? (
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-10 rounded-none">
                                                <AvatarImage src={teamLead.avatar} className="object-cover" />
                                                <AvatarFallback className="font-bold rounded-none">{teamLead.firstName[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-sm truncate">{teamLead.firstName} {teamLead.lastName}</p>
                                                <p className="text-[9px] font-bold uppercase text-primary truncate">{teamLead.jobTitle}</p>
                                            </div>
                                            <ShieldCheck className="size-4 text-primary" />
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
                <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[8px] font-black px-6 py-4 uppercase tracking-widest">Date</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest">Login</TableHead><TableHead className="text-right px-6 text-[8px] font-black uppercase tracking-widest">Location</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {attendanceData?.map((rec, i) => (
                                <TableRow key={i} className="border-border/50">
                                    <TableCell className="py-3 px-6 font-black text-[10px] uppercase">{format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="font-mono text-[10px] font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="text-right px-6">{rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-1.5 rounded-none bg-primary/5 text-primary inline-block"><MapPin className="size-3" /></Link>}</TableCell>
                                </TableRow>
                            )) || <TableRow><TableCell colSpan={3} className="h-32 text-center text-[9px] font-black uppercase opacity-30">No records</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>
            <TabsContent value="documents">
                <Card className="border-none shadow-sm rounded-none bg-white p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {documents?.map(doc => (
                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-4 rounded-none bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group">
                            <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-none"><FileBox className="size-4" /></div><span className="font-black text-[10px] uppercase truncate">{doc.title}</span></div>
                        </Link>
                    )) || <div className="col-span-full py-10 text-center text-[9px] font-black uppercase opacity-30">No documents</div>}
                </div></Card>
            </TabsContent>
            <TabsContent value="assets">
                <Card className="border-none shadow-sm rounded-none bg-white p-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {assignedAssets?.map(asset => (
                        <div key={asset.id} className="p-4 rounded-none ring-1 ring-border/50 bg-muted/5 space-y-2">
                            <div className="aspect-square bg-white rounded-none flex items-center justify-center border border-dashed p-1">
                                {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-none" /> : <Laptop className="size-6 opacity-10" />}
                            </div>
                            <div><p className="font-black text-[10px] uppercase tracking-tighter truncate">{asset.name}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">{asset.category}</p></div>
                        </div>
                    )) || <div className="col-span-full py-10 text-center text-[9px] font-black uppercase opacity-30">No assets assigned</div>}
                </div></Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-none bg-primary/5 text-primary/60 shrink-0"><Icon className="size-4" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1 leading-none">{label}</p>
                <p className="text-[10px] font-black truncate text-foreground/90 uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group">
            <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-none bg-muted/20 shadow-sm", color)}><Icon className="size-4" /></div>
                <Badge variant="outline" className="text-[7px] font-black uppercase bg-muted/20 border-none rounded-none">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black uppercase text-muted-foreground">{title}</p><span className={cn("text-sm font-black", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-1.5 rounded-none" />}
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
            <div className={cn("h-8 w-8 rounded-none flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform", color)}><Icon className="size-4" /></div>
            <div className="space-y-1 flex-1">
                <p className="font-black text-xs uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-4 px-2 text-[7px] font-black uppercase border-none bg-muted/30 tracking-widest rounded-none">{desc}</Badge>
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
