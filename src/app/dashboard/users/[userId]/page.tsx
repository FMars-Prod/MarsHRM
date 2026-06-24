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
import { CheckCircle2, FileText, Clock, Users, Building2, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MapPin, ChevronRight, CalendarClock, FileCheck, Laptop, Network, Edit, SearchSlash, ExternalLink, Mic, PhoneCall, Target, CheckCircle, Brain, Trash2, FileDown, ShieldAlert, Coffee } from 'lucide-react';
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

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  
  const [userReports, setUserReports] = React.useState<any[]>([]);
  const [isReportsLoading, setIsReportsLoading] = React.useState(false);
  const [selectedReportForReview, setSelectedReportForReview] = React.useState<any | null>(null);

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

  const complianceQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'compliance_reports'), where('employeeId', '==', userId)) : null, [userId, firestore]);
  const { data: complianceIssues } = useCollection<any>(complianceQuery);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isExecutive = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD';

  React.useEffect(() => {
    if (!isUserLoading && currentUser && currentUserData) {
        const isSelf = currentUser.uid === userId;
        if (!isSelf && !isExecutive) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'Administrative authorization required.' });
            router.push('/dashboard');
        }
    }
  }, [currentUser, currentUserData, userId, isUserLoading, router, toast, isExecutive]);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);

  const branchName = React.useMemo(() => {
    if (!branches || !user?.branchId) return "No Office Assigned";
    const b = branches.find((b: any) => b.id === user.branchId);
    return b ? b.name : "No Office Assigned";
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
    toast({ title: "Performance Updated", description: `Rating set to ${newRating}.` });
  };

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

  const handleDeleteReport = (report: any) => {
    if (!isExecutive) return;
    const reportRef = doc(firestore, `users/${report.employeeId}/reports`, report.id);
    deleteDocumentNonBlocking(reportRef);
    toast({ title: "Report Deleted" });
    setSelectedReportForReview(null);
    setUserReports(prev => prev.filter(r => r.id !== report.id));
  };

  React.useEffect(() => {
      const fetchReports = async () => {
          if (!userId) return;
          setIsReportsLoading(true);
          try {
              const q = query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(10));
              const snap = await getDocs(q);
              setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } finally {
              setIsReportsLoading(false);
          }
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
  const hasComplianceIssue = (complianceIssues?.length || 0) > 0;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up pb-10 space-y-4 font-jakarta">
        {/* identity Hub Portal */}
        <Card className="border-none shadow-2xl rounded-none bg-white overflow-hidden p-0 ring-1 ring-border/50">
            <div className="flex flex-col lg:flex-row items-stretch">
                {/* Avatar Vertical Terminal */}
                <div className="relative shrink-0 lg:border-r border-dashed border-border/50 bg-muted/5 p-8 lg:p-10 flex flex-col items-center justify-center">
                    <div className="relative">
                        <Avatar className="size-40 sm:size-48 rounded-none ring-8 ring-white shadow-2xl transition-transform duration-500 hover:scale-105">
                            <AvatarImage src={user.avatar} className="object-cover" />
                            <AvatarFallback className="text-5xl font-black rounded-none bg-primary/10 text-primary">{user.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        {isExecutive && hasComplianceIssue && (
                            <div className="absolute -top-4 -right-4 bg-red-600 rounded-full size-12 flex items-center justify-center border-4 border-white shadow-2xl animate-pulse">
                                <span className="text-white font-black text-xl">{complianceIssues?.length || 0}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <Badge className="bg-green-500 text-white rounded-none font-black text-[10px] px-4 py-1 uppercase tracking-widest shadow-md">
                           Status: Active
                        </Badge>
                        {isExecutive && hasComplianceIssue && (
                            <Badge className="bg-red-600 text-white animate-pulse rounded-none font-black text-[10px] px-4 py-1 uppercase tracking-widest shadow-lg border-none">
                                {complianceIssues?.length} PROTOCOL VIOLATIONS
                            </Badge>
                        )}
                        <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Verified Profile</p>
                    </div>
                </div>

                {/* Identity Information Matrix */}
                <div className="flex-1 p-8 lg:p-10 space-y-10 flex flex-col justify-center">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 text-left">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-4">
                                <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none uppercase">{user.firstName} {user.lastName}</h2>
                                {isExecutive && hasComplianceIssue && (
                                    <Badge className="bg-red-600 text-white animate-pulse rounded-none font-black text-xs h-8 px-3 border-none flex gap-2 items-center">
                                        <ShieldAlert className="size-4" /> {complianceIssues?.length || 0} VIOLATIONS
                                    </Badge>
                                )}
                            </div>
                            <p className="text-lg font-bold text-muted-foreground uppercase tracking-widest">{user.jobTitle}</p>
                        </div>
                        <div className="flex gap-3">
                            {isExecutive && <Button onClick={handleExportPdf} variant="outline" size="sm" className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm hover:shadow-md transition-all">Export Report</Button>}
                            <Button asChild size="sm" className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"><Link href="/dashboard/users"><Users className="size-4 mr-2" /> Employee List</Link></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12 pt-8 border-t border-dashed border-border/50 text-left">
                        <DetailItem icon={CheckCircle2} label="Employee ID" value={`MR-${user.id.slice(0, 8).toUpperCase()}`} />
                        <DetailItem icon={CalendarDays} label="Joined Date" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                        <DetailItem icon={Mail} label="Email Address" value={user.email} />
                        <DetailItem icon={Phone} label="Phone Number" value={user.phoneNumber || "N/A"} />
                        <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                        <DetailItem icon={Building2} label="Department" value={user.department} />
                    </div>
                </div>
            </div>
        </Card>

        {/* Tactical Performance Metrics */}
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
                ratio={isEmployeeType ? (isLeaveConfigured ? `${leaveBalValue} / ${leaveEntValue}` : "12 / 12") : "0 / 0"} 
                progress={isEmployeeType ? (isLeaveConfigured ? (leaveBalValue/leaveEntValue)*100 : 100) : 0} 
                color="text-sky-600" 
            />

            <MetricCard icon={Zap} title="Performance" ratio={user.performanceRating || "Good"} color="text-primary">
                <div className="flex items-center justify-between mt-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tight">Last Review: {user.lastReviewDate ? format(user.lastReviewDate.toDate(), 'dd MMM yy') : 'Pending'}</p>
                    {isExecutive && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 hover:bg-primary/5 rounded-none">
                                    <Edit className="size-3 text-primary" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-none sm:max-w-sm border-none shadow-2xl">
                                <DialogHeader className="text-left"><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Update Rating</DialogTitle></DialogHeader>
                                <div className="py-6 space-y-4 text-left">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Rating</Label>
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
                    {documents?.[0] ? `Latest: ${format(documents[0].uploadedAt.toDate(), 'dd MMM yy')}` : "No documents"}
                </p>
            </MetricCard>
        </div>

        {/* Data Feed Module */}
        <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="w-full justify-start bg-white/50 backdrop-blur-sm rounded-none p-1.5 h-auto gap-2">
                {["Activity", "Attendance", "Hierarchy", "Documents", "Assets", "Bio Data"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white px-10 py-3 font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-3">
                    <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-8">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 text-left">Activity History</h3>
                        <div className="space-y-6">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'MMM dd, yyyy')} desc={`Finalized for ${r.employeeDepartment}.`} color="bg-primary/10 text-primary" onClick={() => setSelectedReportForReview(r)} />
                            )) : (
                                <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center space-y-5">
                                    <div className="p-5 bg-muted/20 rounded-full"><SearchSlash className="size-12 text-primary/40" /></div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-widest">Nothing Found</p>
                                        <p className="text-[11px] font-bold uppercase mt-1">No reports found.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </TabsContent>
            <TabsContent value="attendance">
                <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden min-h-[400px]">
                    {attendanceData && attendanceData.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/5">
                                <TableRow>
                                    <TableHead className="text-[11px] font-black px-8 py-5 uppercase tracking-widest">Date</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-widest py-5">Status</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-widest py-5">Clock In</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-widest py-5 text-center">Total Break</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-widest py-5">Clock Out</TableHead>
                                    <TableHead className="text-right px-8 text-[11px] font-black uppercase tracking-widest py-5">Verification</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceData.map((rec, i) => (
                                    <TableRow key={i} className="border-border/50 hover:bg-primary/5 transition-colors">
                                        <TableCell className="py-5 px-8 font-black text-sm uppercase">
                                            {format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "rounded-none font-black text-[9px] uppercase border-none h-6 px-3 shadow-sm",
                                                rec.status === 'present' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {rec.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm font-bold text-primary">
                                            {rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                <Coffee className="size-3 opacity-30" />
                                                {rec.totalBreakDuration ? formatSecondsToHours(rec.totalBreakDuration) : '0m'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm font-bold text-slate-900">
                                            {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                        </TableCell>
                                        <TableCell className="text-right px-8">
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
                                <p className="text-sm font-black uppercase tracking-widest">No Records</p>
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
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">Managers</h4>
                            <div className="flex flex-wrap justify-center gap-12 w-full">
                                {reportingHeads.length > 0 ? reportingHeads.map((head: any) => (
                                    <div key={head.id} className="flex flex-col items-center">
                                         <Link href={`/dashboard/users/${head.id}`} className="p-6 bg-muted/20 border-2 border-dashed border-border/50 rounded-none w-56 text-center group hover:border-primary/40 transition-all cursor-pointer shadow-sm">
                                            <Avatar className="size-16 rounded-none mx-auto mb-4 shadow-md border border-white">
                                                <AvatarImage src={head.avatar} className="object-cover rounded-none" />
                                                <AvatarFallback className="font-black text-lg">{head.firstName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <p className="font-black text-sm uppercase tracking-tight truncate">{head.firstName} {head.lastName}</p>
                                            <p className="text-[10px] font-black text-primary uppercase truncate tracking-tight mt-1">{head.jobTitle}</p>
                                         </Link>
                                         <div className="w-px h-10 bg-border" />
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center">
                                        <Badge variant="outline" className="rounded-none font-black text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-10 px-6">Direct Admin Report</Badge>
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
                                    <AvatarFallback className="font-black text-4xl text-primary bg-white">{user.firstName?.[0]}</AvatarFallback>
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
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-6">Direct Reports</h4>
                                <div className="flex flex-wrap justify-center gap-12 w-full pt-6">
                                    {directReports.map((report: any) => (
                                        <div key={report.id} className="flex flex-col items-center">
                                            <div className="w-px h-6 bg-border mb-0" />
                                            <Link href={`/dashboard/users/${report.id}`} className="p-6 bg-white ring-1 ring-border/50 shadow-xl rounded-none w-56 text-center group hover:ring-primary/40 transition-all cursor-pointer">
                                                <Avatar className="size-16 rounded-none mx-auto mb-4 border border-muted shadow-sm">
                                                    <AvatarImage src={report.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="font-black text-lg">{report.firstName?.[0]}</AvatarFallback>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
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
                                <p className="text-[11px] font-bold uppercase mt-1">No documents detected.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
            <TabsContent value="assets">
                <Card className="border-none shadow-sm rounded-none bg-white p-10">
                    {assignedAssets && assignedAssets.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10 text-left">
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
                                <p className="text-[11px] font-bold uppercase mt-1">No assigned assets detected.</p>
                            </div>
                        </div>
                    )}
                </Card>
            </TabsContent>
            <TabsContent value="bio data">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 text-left">Mission Bio Data</h3>
                        <div className="space-y-4">
                            <InfoRow label="Date of Birth" value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : 'N/A'} />
                            <InfoRow label="Gender" value={user.gender || 'N/A'} />
                            <InfoRow label="Nationality" value={user.nationality || 'N/A'} />
                            <InfoRow label="Marital Status" value={user.maritalStatus || 'N/A'} />
                            <InfoRow label="Blood Group" value={user.bloodGroup || 'N/A'} />
                            <div className="pt-4 flex flex-wrap gap-2">
                                {user.languages?.map((lang: string) => (
                                    <Badge key={lang} variant="secondary" className="text-[10px] font-bold px-3 py-1 uppercase rounded-none">{lang}</Badge>
                                )) || <span className="text-[10px] opacity-30">No languages registered</span>}
                            </div>
                        </div>
                    </Card>
                    <Card className="border-none shadow-sm rounded-none bg-white p-8 space-y-6">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 text-left">Employment Context</h3>
                        <div className="space-y-4">
                            <InfoRow label="Employment Type" value={user.employmentType || 'Intern'} />
                            <InfoRow label="Shift Profile" value={user.shiftType || 'General Shift'} />
                            <InfoRow label="Role Tier" value={user.role || 'Member'} />
                            <InfoRow label="Office Bound" value={user.isWfhAllowed ? "Remote Allowed" : "Branch Primary"} />
                        </div>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>

        {/* Report Review Dialog */}
        <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
            <DialogContent className="max-w-3xl rounded-3xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center shrink-0 text-left">
                    <div className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Mission Audit Log</DialogTitle>
                        <p className="text-xs font-bold text-muted-foreground">{selectedReportForReview && formatIST(selectedReportForReview.date)} • Shift: {selectedReportForReview?.logInTime || '--'} - {selectedReportForReview?.logOutTime || '--'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary" onClick={() => handleDownloadPdfReport(selectedReportForReview)}><FileDown className="size-3 mr-1.5" /> Download Audit</Button>
                        {isExecutive && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest"><Trash2 className="size-3 mr-1.5"/> Delete</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl">
                                    <AlertDialogHeader className="text-left">
                                        <AlertDialogTitle>Purge Report Record?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently remove this tactical submission from the identity log.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteReport(selectedReportForReview)} className="rounded-full font-bold uppercase text-[10px] bg-red-600">Confirm Purge</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-8">{selectedReportForReview?.reportType}</Badge>
                    </div>
                </DialogHeader>
                <ScrollArea className="flex-1 bg-secondary/10">
                    <div className="p-8 space-y-8 pb-20 text-left">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Personnel</p><p className="font-bold text-lg uppercase">{selectedReportForReview?.employeeName}</p></div>
                            <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sector</p><p className="font-bold text-lg uppercase">{selectedReportForReview?.employeeDepartment}</p></div>
                        </div>
                        <Separator />
                        {(selectedReportForReview?.reportType === 'Business' || selectedReportForReview?.reportType === 'Digital Marketing') && <BusinessAuditDetail report={selectedReportForReview} />}
                        {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetail report={selectedReportForReview} />}
                        {selectedReportForReview?.reportType === 'Technical' && <TechnicalAuditDetail report={selectedReportForReview} />}
                        
                        <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm">
                            <CardHeader className="bg-muted/10 py-3 text-left">
                                <CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Target className="size-4"/> Planning (T+1)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-left"><p className="text-[9px] font-bold text-muted-foreground uppercase">Target Meets</p><p className="font-black">{selectedReportForReview?.meetingsTomorrow || 0}</p></div>
                                    <div className="text-left"><p className="text-[9px] font-bold text-muted-foreground uppercase">Priority Trigger</p><p className={cn("font-black", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-green-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div>
                                </div>
                                <div className="p-4 bg-muted/10 border-l-4 border-primary text-left">
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
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle} • {selectedReportForReview?.employeeDepartment}</p>
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

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-5">
            <div className="p-3 rounded-none bg-primary/5 text-primary/60 shrink-0 shadow-sm border border-primary/10"><Icon className="size-6" /></div>
            <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 leading-none">{label}</p>
                <p className="text-sm font-black text-foreground/90 uppercase tracking-tight break-all">{value}</p>
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
            <div className="text-left">
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

function TimelineItem({ icon: Icon, title, time, desc, color, onClick }: any) {
    return (
        <div className="flex gap-8 items-start relative group cursor-pointer" onClick={onClick}>
            <div className={cn("h-12 w-12 rounded-none flex items-center justify-center shrink-0 z-10 shadow-lg transition-transform group-hover:scale-110", color)}><Icon className="size-6" /></div>
            <div className="space-y-2 flex-1 pt-1 text-left">
                <p className="font-black text-lg uppercase tracking-tight text-foreground/90 leading-none group-hover:text-primary transition-colors">{title}</p>
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
        <div className="flex items-center justify-between py-4 border-b border-dashed border-border/50 last:border-none group gap-4">
            <span className="text-[11px] font-black uppercase text-muted-foreground/40 tracking-[0.2em] shrink-0">{label}</span>
            <span className="text-base font-black text-foreground/80 uppercase text-right leading-tight">{value}</span>
        </div>
    );
}
