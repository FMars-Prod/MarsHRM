
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
import { ShieldCheck, FileText, Clock, Users, Building2, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MapPin, ChevronRight, CalendarClock, FileCheck, Laptop, Network, Edit, SearchSlash, ExternalLink } from 'lucide-react';
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
    if (!branches || !user?.branchId) return "Unassigned Sector";
    const b = branches.find((b: any) => b.id === user.branchId);
    return b ? b.name : "Unassigned Sector";
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
        {/* identity Hub Portal */}
        <Card className="border-none shadow-2xl rounded-none bg-white overflow-hidden p-0 ring-1 ring-border/50">
            <div className="flex flex-col lg:flex-row items-stretch">
                {/* Avatar Vertical Terminal */}
                <div className="relative shrink-0 lg:border-r border-dashed border-border/50 bg-muted/5 p-8 lg:p-10 flex flex-col items-center justify-center">
                    <Avatar className="size-40 sm:size-48 rounded-none ring-8 ring-white shadow-2xl transition-transform duration-500 hover:scale-105">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="text-5xl font-black rounded-none bg-primary/10 text-primary">{user.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <Badge className="bg-green-500 text-white rounded-none font-black text-[10px] px-4 py-1 uppercase tracking-widest shadow-md">
                           Operational Status: Active
                        </Badge>
                        <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Verified Registry Profile</p>
                    </div>
                </div>

                {/* Identity Information Matrix */}
                <div className="flex-1 p-8 lg:p-10 space-y-10 flex flex-col justify-center">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="space-y-1.5">
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none">{user.firstName} {user.lastName}</h2>
                            <p className="text-lg font-bold text-muted-foreground uppercase tracking-widest">{user.jobTitle}</p>
                        </div>
                        <div className="flex gap-3">
                            {isAdmin && <Button onClick={handleExportPdf} variant="outline" size="sm" className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm hover:shadow-md transition-all">Export Mission Audit</Button>}
                            <Button asChild size="sm" className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"><Link href="/dashboard/users"><Users className="size-4 mr-2" /> Global Roster</Link></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12 pt-8 border-t border-dashed border-border/50">
                        <DetailItem icon={ShieldCheck} label="Operational ID" value={`MR-${user.id.slice(0, 8).toUpperCase()}`} />
                        <DetailItem icon={CalendarDays} label="Commissioned" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                        <DetailItem icon={Mail} label="Comms Vector" value={user.email} />
                        <DetailItem icon={Phone} label="Contact Signal" value={user.phoneNumber || "N/A"} />
                        <DetailItem icon={MapPin} label="Work Sector" value={branchName} />
                        <DetailItem icon={Building2} label="Department" value={user.department} />
                    </div>
                </div>
            </div>
        </Card>

        {/* Tactical Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
             <MetricCard icon={UserCheck} title="Attendance Hub" ratio={`${attendanceStats.present + attendanceStats.late} / ${attendanceStats.totalWorkingDays}`} progress={attendanceStats.percentage} color="text-green-600">
                <div className="grid grid-cols-4 gap-1 mt-4">
                    <MetricStat label="Pres" val={attendanceStats.present} />
                    <MetricStat label="Late" val={attendanceStats.late} color="text-amber-500" />
                    <MetricStat label="Abs" val={attendanceStats.absent} color="text-rose-500" />
                    <MetricStat label="Rem" val={attendanceStats.remaining} color="text-sky-500" />
                </div>
            </MetricCard>

            <MetricCard 
                icon={CalendarClock} 
                title="Leave Entitlement" 
                ratio={isEmployeeType ? (isLeaveConfigured ? `${leaveBalValue} / ${leaveEntValue}` : "12 / 12") : "NIL"} 
                progress={isEmployeeType ? (isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 100) : 0} 
                color="text-sky-600" 
            />

            <MetricCard icon={Zap} title="Performance Tier" ratio={user.performanceRating || "Good"} color="text-primary">
                <div className="flex items-center justify-between mt-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tight">Sync: {user.lastReviewDate ? format(user.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending Audit'}</p>
                    {isAdmin && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 hover:bg-primary/5 rounded-none">
                                    <Edit className="size-3 text-primary" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-none sm:max-w-sm border-none shadow-2xl">
                                <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Recalibrate Rating</DialogTitle></DialogHeader>
                                <div className="py-6 space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Performance Tier</Label>
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

            <MetricCard icon={FileCheck} title="Ledger Status" ratio={user.payrollAmount ? `₹${user.payrollAmount.toLocaleString()}` : (user.employmentType === 'Intern' ? "Performance Based" : "Audited")} color="text-purple-600" />

            <MetricCard icon={FileBox} title="Digital Vault" ratio={documents?.length || 0} color="text-emerald-600">
                <p className="text-[10px] font-black uppercase text-muted-foreground/60 mt-4">
                    {documents?.[0] ? `Latest: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "Sector Clear"}
                </p>
            </MetricCard>
        </div>

        {/* Data Feed Module */}
        <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                {["Activity", "Attendance", "Hierarchy", "Documents", "Assets"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-10 py-3 font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white p-8 space-y-8">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Mission Intelligence Feed</h3>
                        <div className="space-y-6">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd, yyyy')} desc={`Finalized for ${r.employeeDepartment}.`} color="bg-primary/10 text-primary" />
                            )) : (
                                <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                    <div className="p-5 bg-muted/20 rounded-full"><SearchSlash className="size-12 text-primary/40" /></div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-widest">Nothing Found</p>
                                        <p className="text-[11px] font-bold uppercase mt-1">No tactical reports detected in history.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                    <div className="lg:col-span-4 space-y-3">
                        <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Personnel Bio-Data</h3>
                            <div className="space-y-4">
                                <InfoRow label="Birth Directive" value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : 'N/A'} />
                                <InfoRow label="Gender Profile" value={user.gender || 'N/A'} />
                                <InfoRow label="Nationality Vector" value={user.nationality || 'N/A'} />
                                <InfoRow label="Marital Protocol" value={user.maritalStatus || 'N/A'} />
                                <InfoRow label="Blood Type" value={user.bloodGroup || 'N/A'} />
                                <div className="pt-4 flex flex-wrap gap-2">
                                    {user.languages?.map((lang: string) => (
                                        <Badge key={lang} variant="secondary" className="text-[10px] font-bold px-3 py-1 uppercase rounded-none">{lang}</Badge>
                                    )) || <span className="text-[10px] opacity-30">No communications registered</span>}
                                </div>
                            </div>
                        </Card>

                        <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Fleet Assets</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Mission Units</span>
                                    <Badge className="bg-primary/10 text-primary rounded-none font-black text-[10px]">{assignedAssets?.length || 0}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Vault Content</span>
                                    <Badge className="bg-emerald-500/10 text-emerald-600 rounded-none font-black text-[10px]">{documents?.length || 0}</Badge>
                                </div>
                            </div>
                        </Card>
                        
                        <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Command Hierarchy</h3>
                            <div className="space-y-6">
                                <InfoRow label="Operational Matrix" value={user.teamId ? "Tactical Division" : "Individual Fleet"} />
                                <div className="p-5 bg-muted/20 rounded-none border border-dashed border-border/50">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-5">Command Vector</p>
                                    {reportingHeads.length > 0 ? (
                                        <div className="space-y-4">
                                            {reportingHeads.map(head => (
                                                <Link key={head.id} href={`/dashboard/users/${head.id}`} className="flex items-center gap-5 group">
                                                    <Avatar className="size-12 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                                        <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                        <AvatarFallback className="font-bold rounded-none">{head.firstName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-black text-sm uppercase truncate group-hover:text-primary transition-colors">{head.firstName} {head.lastName}</p>
                                                        <p className="text-[10px] font-black uppercase text-primary truncate tracking-tight">{head.jobTitle}</p>
                                                    </div>
                                                    <ShieldCheck className="size-5 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm font-bold text-muted-foreground uppercase opacity-40 italic">Direct reporting to Admin</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="attendance">
                <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden min-h-[400px]">
                    {attendanceData && attendanceData.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/5"><TableRow><TableHead className="text-[11px] font-black px-8 py-5 uppercase tracking-widest">Shift Date</TableHead><TableHead className="text-[11px] font-black uppercase tracking-widest py-5">Login Matrix</TableHead><TableHead className="text-right px-8 text-[11px] font-black uppercase tracking-widest py-5">Geolocation</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {attendanceData.map((rec, i) => (
                                    <TableRow key={i} className="border-border/50 hover:bg-primary/5 transition-colors">
                                        <TableCell className="py-5 px-8 font-black text-sm uppercase">{format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="font-mono text-sm font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                        <TableCell className="text-right px-8">{rec.locationCheckInLatitude && <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-2.5 rounded-none bg-primary/5 text-primary inline-block shadow-sm transition-transform hover:scale-110"><MapPin className="size-4" /></Link>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                            <div className="p-5 bg-muted/20 rounded-full"><Clock className="size-12 text-primary/40" /></div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest">Sector Clear</p>
                                <p className="text-[11px] font-bold uppercase mt-1">No attendance signals detected.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
            <TabsContent value="hierarchy">
                <Card className="border-none shadow-sm rounded-none bg-white p-10 overflow-x-auto min-h-[600px]">
                    <div className="flex flex-col items-center space-y-16 py-10 min-w-fit">
                        {/* Managers Section (Upward) */}
                        <div className="flex flex-col items-center space-y-6 w-full">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">Strategic Command Line</h4>
                            <div className="flex flex-wrap justify-center gap-12 w-full">
                                {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                    <div key={head.id} className="flex flex-col items-center">
                                         <Link href={`/dashboard/users/${head.id}`} className="p-6 bg-muted/20 border-2 border-dashed border-border/50 rounded-none w-56 text-center group hover:border-primary/40 transition-all cursor-pointer shadow-sm">
                                            <Avatar className="size-16 rounded-none mx-auto mb-4 shadow-md border border-white">
                                                <AvatarImage src={head.avatar} className="object-cover" />
                                                <AvatarFallback className="font-black text-lg">{head.firstName[0]}</AvatarFallback>
                                            </Avatar>
                                            <p className="font-black text-sm uppercase tracking-tight truncate">{head.firstName} {head.lastName}</p>
                                            <p className="text-[10px] font-black text-primary uppercase truncate tracking-tight mt-1">{head.jobTitle}</p>
                                         </Link>
                                         <div className="w-px h-10 bg-border" />
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center">
                                        <Badge variant="outline" className="rounded-none font-black text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-10 px-6">Top Tier Command</Badge>
                                        <div className="w-px h-10 bg-border" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Target User Section */}
                        <div className="relative flex flex-col items-center w-full">
                            <div className="p-10 bg-primary text-white shadow-2xl rounded-none w-72 text-center ring-8 ring-primary/10 transition-transform hover:scale-105 duration-500">
                                <Avatar className="size-40 rounded-none mx-auto mb-6 border-4 border-white/20 shadow-xl">
                                    <AvatarImage src={user.avatar} className="object-cover" />
                                    <AvatarFallback className="font-black text-4xl text-primary bg-white">{user.firstName[0]}</AvatarFallback>
                                </Avatar>
                                <p className="font-black text-xl uppercase tracking-tighter leading-none">{user.firstName} {user.lastName}</p>
                                <p className="text-[11px] font-bold text-white/70 uppercase tracking-[0.2em] mt-3">{user.jobTitle}</p>
                            </div>
                            {directReports.length > 0 && <div className="w-px h-16 bg-border" />}
                        </div>

                        {/* Direct Reports Section (Downward) */}
                        {directReports.length > 0 && (
                            <div className="flex flex-col items-center space-y-6 w-full">
                                <div className="h-px bg-border w-1/2 max-w-[500px]" />
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-6">Division Distribution</h4>
                                <div className="flex flex-wrap justify-center gap-12 w-full pt-6">
                                    {directReports.map((report: any) => (
                                        <div key={report.id} className="flex flex-col items-center">
                                            <div className="w-px h-6 bg-border mb-0" />
                                            <Link href={`/dashboard/users/${report.id}`} className="p-6 bg-white ring-1 ring-border/50 shadow-xl rounded-none w-56 text-center group hover:ring-primary/40 transition-all cursor-pointer">
                                                <Avatar className="size-16 rounded-none mx-auto mb-4 border border-muted shadow-sm">
                                                    <AvatarImage src={report.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="font-black text-lg">{report.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <p className="font-black text-sm uppercase tracking-tight truncate group-hover:text-primary transition-colors">{report.firstName} {report.lastName}</p>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase truncate tracking-tight mt-1">{report.jobTitle}</p>
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
                <Card className="border-none shadow-sm rounded-none bg-white p-10">
                    {documents && documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {documents.map((doc: any) => (
                                <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-6 rounded-none bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group shadow-sm">
                                    <div className="flex items-center gap-5">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-none shadow-sm"><FileBox className="size-6" /></div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs uppercase truncate block">{doc.title}</span>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{format(doc.uploadedAt.toDate(), 'dd MMM yy')}</span>
                                        </div>
                                    </div>
                                    <ExternalLink className="size-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                            <div className="p-5 bg-muted/20 rounded-full"><FileBox className="size-12 text-primary/40" /></div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest">Nothing Found</p>
                                <p className="text-[11px] font-bold uppercase mt-1">No tactical documents detected.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
            <TabsContent value="assets">
                <Card className="border-none shadow-sm rounded-none bg-white p-10">
                    {assignedAssets && assignedAssets.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
                            {assignedAssets.map((asset: any) => (
                                <div key={asset.id} className="p-8 rounded-none ring-1 ring-border/50 bg-muted/5 space-y-5 shadow-sm hover:shadow-md transition-all">
                                    <div className="aspect-square bg-white rounded-none flex items-center justify-center border-2 border-dashed border-border/50 p-4">
                                        {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-none" /> : <Laptop className="size-12 opacity-10" />}
                                    </div>
                                    <div><p className="font-black text-base uppercase tracking-tighter truncate">{asset.name}</p><p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">{asset.category}</p></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                            <div className="p-5 bg-muted/20 rounded-full"><Laptop className="size-12 text-primary/40" /></div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest">Nothing Found</p>
                                <p className="text-[11px] font-bold uppercase mt-1">No assigned mission assets detected.</p>
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
        <div className="flex items-start gap-5">
            <div className="p-3 rounded-none bg-primary/5 text-primary/60 shrink-0 shadow-sm border border-primary/10"><Icon className="size-6" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 leading-none">{label}</p>
                <p className="text-sm font-black truncate text-foreground/90 uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-2xl rounded-none bg-white p-8 space-y-6 ring-1 ring-border/50 group hover:shadow-primary/5 transition-all">
            <div className="flex justify-between items-start">
                <div className={cn("p-4 rounded-none shadow-md", color, "bg-muted/10")}><Icon className="size-6" /></div>
                <Badge variant="outline" className="text-[10px] font-black uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div>
                <div className="flex items-center justify-between mb-3.5"><p className="text-[12px] font-black uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-xl font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-sm font-black", color)}>{val}</p></div>;
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-8 items-start relative group">
            <div className={cn("h-12 w-12 rounded-none flex items-center justify-center shrink-0 z-10 shadow-lg transition-transform group-hover:scale-110", color)}><Icon className="size-6" /></div>
            <div className="space-y-2 flex-1 pt-1">
                <p className="font-black text-lg uppercase tracking-tight text-foreground/90 leading-none">{title}</p>
                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">{time}</span>
                    <Badge variant="outline" className="h-6 px-4 text-[10px] font-black uppercase border-none bg-muted/40 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-6 text-muted-foreground/20 group-hover:text-primary transition-all self-center" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-dashed border-border/50 last:border-none group">
            <span className="text-[11px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">{label}</span>
            <span className="text-base font-black text-foreground/80 uppercase text-right pl-6 truncate">{value}</span>
        </div>
    );
}
