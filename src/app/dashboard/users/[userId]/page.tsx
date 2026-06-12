
'use client';

import * as React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, differenceInMonths, differenceInDays, addMonths, eachDayOfInterval, isSunday, isToday, startOfDay } from 'date-fns';
import { ShieldCheck, FileText, Clock, Users, Building2, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MapPin, ChevronRight, CalendarClock, FileCheck, Laptop, Network, Edit, SearchSlash } from 'lucide-react';
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

  const allUsersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: allUsers } = useCollection<any>(allUsersQuery);

  const reportingHeads = React.useMemo(() => {
    if (!user?.reportingHeadIds || !allUsers) return [];
    return allUsers.filter((u: any) => user.reportingHeadIds.includes(u.id));
  }, [user?.reportingHeadIds, allUsers]);

  const directReports = React.useMemo(() => {
      if (!user || !allUsers) return [];
      return allUsers.filter((u: any) => u.reportingHeadIds?.includes(user.id));
  }, [user?.id, allUsers]);

  const teamDocRef = useMemoFirebase(() => user?.teamId ? doc(firestore, 'teams', user.teamId) : null, [user?.teamId, firestore]);
  const { data: teamData } = useDoc<any>(teamDocRef);

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

  const handleUpdatePerformance = (newRating: string) => {
    if (!userId || !userDocRef) return;
    updateDocumentNonBlocking(userDocRef, {
        performanceRating: newRating,
        lastReviewDate: serverTimestamp()
    });
    toast({ title: "Performance Updated", description: `Tier recalibrated to ${newRating}.` });
  };

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

  if (isUserLoading || !user) return <div className="p-10 text-center animate-pulse uppercase font-black text-sm">Loading Profile...</div>;

  const isEmployeeType = user.employmentType === 'Employee';
  const leaveBalValue = user.leaveBalance;
  const leaveEntValue = user.totalLeaveEntitlement || (isEmployeeType ? 12 : 0);
  const isLeaveConfigured = leaveBalValue !== undefined && isEmployeeType;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
        <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden p-0">
            <div className="flex flex-col md:flex-row items-stretch">
                <Avatar className="h-[176px] w-32 rounded-none border-r border-border shrink-0 bg-muted">
                    <AvatarImage src={user.avatar} className="object-cover" />
                    <AvatarFallback className="text-4xl font-black rounded-none">{user.firstName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 p-6 space-y-5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tighter leading-none">{user.firstName} {user.lastName}</h2>
                            <p className="text-base font-bold text-muted-foreground uppercase tracking-widest">{user.jobTitle}</p>
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && <Button onClick={handleExportPdf} variant="outline" size="sm" className="rounded-none h-10 px-5 font-black uppercase text-[10px] tracking-widest">Export PDF</Button>}
                            <Button asChild size="sm" className="rounded-none h-10 px-5 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"><Link href="/dashboard/users"><Users className="size-4 mr-2" /> Staff List</Link></Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-5 border-y border-dashed border-border/50">
                        <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${user.id.slice(0, 8).toUpperCase()}`} />
                        <DetailItem icon={CalendarDays} label="Joining Date" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                        <DetailItem icon={Mail} label="Email Address" value={user.email} />
                        <DetailItem icon={Phone} label="Phone Number" value={user.phoneNumber || "N/A"} />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        <DetailItem icon={Users} label="Team" value={user.teamId ? "Assigned" : "Unassigned"} />
                        <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                        <DetailItem icon={Briefcase} label="Employment Type" value={user.employmentType || "Employee"} />
                        <DetailItem icon={Clock} label="System Level" value={user.role} />
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

            <MetricCard 
                icon={CalendarClock} 
                title="Leave Balance" 
                ratio={isEmployeeType ? (isLeaveConfigured ? `${leaveBalValue} / ${leaveEntValue}` : "12 / 12") : "NIL"} 
                progress={isEmployeeType ? (isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 100) : 0} 
                color="text-sky-600" 
            />

            <MetricCard icon={Zap} title="Performance" ratio={user.performanceRating || "Good"} color="text-primary">
                <div className="flex items-center justify-between mt-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60">Review: {user.lastReviewDate ? format(user.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
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
                                    <Select onValueChange={handleUpdatePerformance} defaultValue={user.performanceRating || "Good"}>
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

            <MetricCard icon={FileCheck} title="Payroll Status" ratio={user.payrollAmount ? `₹${user.payrollAmount.toLocaleString()}` : (user.employmentType === 'Intern' ? "Performance Based" : "Audited")} color="text-purple-600" />

            <MetricCard icon={FileBox} title="Documents" ratio={documents?.length || 0} color="text-emerald-600">
                <p className="text-[10px] font-black uppercase text-muted-foreground/60 mt-4">
                    {documents?.[0] ? `Updated: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "Empty Vault"}
                </p>
            </MetricCard>
        </div>

        <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                {["Activity", "Attendance", "Hierarchy", "Documents", "Assets"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-8 py-2.5 font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Recent Activity</h3>
                        <div className="space-y-4">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd')} desc={`Finalized for ${r.employeeDepartment}.`} color="bg-primary/10 text-primary" />
                            )) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                                    <div className="p-4 bg-muted/20 rounded-full"><SearchSlash className="size-10 text-primary/40" /></div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest">Nothing Found</p>
                                        <p className="text-[10px] font-bold uppercase mt-1">No recent activity detected in history.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                    <div className="lg:col-span-4 space-y-3">
                        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Bio Data</h3>
                            <div className="space-y-4">
                                <InfoRow label="Birth" value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : 'N/A'} />
                                <InfoRow label="Gender" value={user.gender || 'N/A'} />
                                <InfoRow label="Origin" value={user.nationality || 'N/A'} />
                                <InfoRow label="Status" value={user.maritalStatus || 'N/A'} />
                                <InfoRow label="Blood" value={user.bloodGroup || 'N/A'} />
                                <div className="pt-2 flex flex-wrap gap-2">
                                    {user.languages?.map((lang: string) => (
                                        <Badge key={lang} variant="secondary" className="text-[9px] font-bold px-3 py-1 uppercase rounded-none">{lang}</Badge>
                                    )) || <span className="text-[10px] opacity-30">No languages</span>}
                                </div>
                            </div>
                        </Card>

                        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-6">
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
                        
                        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Reporting Protocol</h3>
                            <div className="space-y-4">
                                <InfoRow label="Structure" value={user.teamId ? "Tactical Unit" : "Individual Fleet"} />
                                <div className="p-4 bg-muted/20 rounded-none border border-dashed border-border/50">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 mb-4">Direct Command</p>
                                    {reportingHeads.length > 0 ? (
                                        <div className="space-y-3">
                                            {reportingHeads.map(head => (
                                                <Link key={head.id} href={`/dashboard/users/${head.id}`} className="flex items-center gap-4 group">
                                                    <Avatar className="size-12 rounded-none">
                                                        <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                        <AvatarFallback className="font-bold rounded-none">{head.firstName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{head.firstName} {head.lastName}</p>
                                                        <p className="text-[10px] font-bold uppercase text-primary truncate">{head.jobTitle}</p>
                                                    </div>
                                                    <ShieldCheck className="size-5 text-primary" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm font-bold text-muted-foreground uppercase opacity-40">Direct reporting to Admin</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="attendance">
                <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden">
                    {attendanceData && attendanceData.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[10px] font-black px-6 py-5 uppercase tracking-widest">Date</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest">Login</TableHead><TableHead className="text-right px-6 text-[10px] font-black uppercase tracking-widest">Location</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {attendanceData.map((rec, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell className="py-4 px-6 font-black text-[11px] uppercase">{format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="font-mono text-sm font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                        <TableCell className="text-right px-6">{rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-2 rounded-none bg-primary/5 text-primary inline-block"><MapPin className="size-4" /></Link>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                            <div className="p-4 bg-muted/20 rounded-full"><Clock className="size-10 text-primary/40" /></div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">Nothing Found</p>
                                <p className="text-[10px] font-bold uppercase mt-1">No attendance records detected in history.</p>
                            </div>
                        </div>
                    )}
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

                        {/* Target User Section */}
                        <div className="relative flex flex-col items-center w-full">
                            <div className="p-6 bg-primary text-white shadow-xl rounded-none w-64 text-center ring-4 ring-primary/10">
                                <Avatar className="h-[176px] w-32 rounded-none mx-auto mb-4 border-2 border-white/20 shadow-md">
                                    <AvatarImage src={user.avatar} className="object-cover" />
                                    <AvatarFallback className="font-black text-primary bg-white">{user.firstName[0]}</AvatarFallback>
                                </Avatar>
                                <p className="font-black text-base uppercase tracking-tighter mt-1">{user.firstName} {user.lastName}</p>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">{user.jobTitle}</p>
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
                <Card className="border-none shadow-sm rounded-none bg-white p-6">
                    {documents && documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {documents.map((doc: any) => (
                                <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-5 rounded-none bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group">
                                    <div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-none"><FileBox className="size-5" /></div><span className="font-black text-xs uppercase truncate">{doc.title}</span></div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                            <div className="p-4 bg-muted/20 rounded-full"><FileBox className="size-10 text-primary/40" /></div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">Nothing Found</p>
                                <p className="text-[10px] font-bold uppercase mt-1">No documents detected in this user's vault.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
            <TabsContent value="assets">
                <Card className="border-none shadow-sm rounded-none bg-white p-6">
                    {assignedAssets && assignedAssets.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {assignedAssets.map((asset: any) => (
                                <div key={asset.id} className="p-5 rounded-none ring-1 ring-border/50 bg-muted/5 space-y-3">
                                    <div className="aspect-square bg-white rounded-none flex items-center justify-center border border-dashed p-2">
                                        {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-none" /> : <Laptop className="size-8 opacity-10" />}
                                    </div>
                                    <div><p className="font-black text-xs uppercase tracking-tighter truncate">{asset.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{asset.category}</p></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                            <div className="p-4 bg-muted/20 rounded-full"><Laptop className="size-10 text-primary/40" /></div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">Nothing Found</p>
                                <p className="text-[10px] font-bold uppercase mt-1">No assigned assets detected for this member.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-none bg-primary/5 text-primary/60 shrink-0"><Icon className="size-5" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1 leading-none">{label}</p>
                <p className="text-xs font-black truncate text-foreground/90 uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group">
            <div className="flex justify-between items-start">
                <div className={cn("p-2.5 rounded-none bg-muted/20 shadow-sm", color)}><Icon className="size-5" /></div>
                <Badge variant="outline" className="text-[8px] font-black uppercase bg-muted/20 border-none rounded-none px-2 h-4">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2"><p className="text-[11px] font-black uppercase text-muted-foreground">{title}</p><span className={cn("text-base font-black", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-bold text-muted-foreground/60 uppercase">{label}</p><p className={cn("text-sm font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-5 items-start relative group">
            <div className={cn("h-9 w-9 rounded-none flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform", color)}><Icon className="size-5" /></div>
            <div className="space-y-1.5 flex-1">
                <p className="font-black text-sm uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-5 px-2.5 text-[9px] font-black uppercase border-none bg-muted/30 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground/20 group-hover:text-primary transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">{label}</span>
            <span className="text-sm font-black text-foreground/80 uppercase text-right pl-4">{value}</span>
        </div>
    );
}
