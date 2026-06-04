'use client';

import * as React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, isSunday } from 'date-fns';
import { ShieldCheck, FileText, ShieldAlert, Clock, Users, Building2, ExternalLink, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MoreHorizontal, Target, Laptop, MapPin, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
  const { data: branches } = useCollection<any>(branchesQuery);

  const branchName = React.useMemo(() => {
    if (!branches || !user?.branchId) return "Unassigned Sector";
    const b = branches.find((b: any) => b.id === user.branchId);
    return b ? b.name : "Unassigned Sector";
  }, [branches, user?.branchId]);

  const docsQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'vault_assets'), where('ownerId', '==', userId), orderBy('uploadedAt', 'desc')) : null, [userId, firestore]);
  const { data: documents } = useCollection<any>(docsQuery);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  React.useEffect(() => {
    if (!isUserLoading && currentUser && currentUserData) {
        const isSelf = currentUser.uid === userId;
        if (!isSelf && !isAdmin) {
            toast({ variant: 'destructive', title: 'Vertical Block', description: 'Administrative authorization required.' });
            router.push('/dashboard');
        }
    }
  }, [currentUser, currentUserData, userId, isUserLoading, router, toast, isAdmin]);

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const complianceQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'compliance_reports'), where('employeeId', '==', userId), orderBy('timestamp', 'desc')) : null, [firestore, userId]);
  const { data: complianceData } = useCollection<any>(complianceQuery);

  const assetsQuery = useMemoFirebase(() => userId ? query(collection(firestore, "assets"), where("assignedToId", "==", userId)) : null, [userId, firestore]);
  const { data: assignedAssets } = useCollection<any>(assetsQuery);

  React.useEffect(() => {
      const fetchReports = async () => {
          if (!userId) return;
          const q = query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(10));
          const snap = await getDocs(q);
          setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchReports();
  }, [userId, firestore]);

  const stats = React.useMemo(() => {
    const startOfCurrentMonth = startOfMonth(new Date());
    const endOfCurrentMonth = endOfMonth(new Date());
    const days = eachDayOfInterval({ start: startOfCurrentMonth, end: endOfCurrentMonth });
    const workingDaysInMonth = days.filter(d => !isSunday(d)).length;

    if (!attendanceData) return { workHours: "0.0", count: 0, percentage: 0, totalWorkingDays: workingDaysInMonth };
    let totalSec = 0;
    const monthlyAtt = attendanceData.filter(a => a.checkInTime && a.checkInTime.toDate() >= startOfCurrentMonth);

    monthlyAtt.forEach(r => {
        if (r.checkInTime && r.checkOutTime) {
            totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
        }
    });
    return { 
        workHours: (totalSec / 3600).toFixed(1), 
        count: monthlyAtt.length,
        percentage: Math.min(100, Math.round((monthlyAtt.length / workingDaysInMonth) * 100)),
        totalWorkingDays: workingDaysInMonth
    };
  }, [attendanceData]);

  const experience = React.useMemo(() => {
    if (!user?.hireDate) return "N/A";
    const totalDays = differenceInDays(new Date(), new Date(user.hireDate));
    return `${totalDays} d`;
  }, [user]);

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.text(`Audit: ${user.firstName} ${user.lastName}`, 14, 20);
    autoTable(pdfDoc, {
        startY: 30,
        head: [['Metric', 'Value']],
        body: [['Work Hours (MTD)', `${stats.workHours}h`], ['Attendance %', `${stats.percentage}%`], ['Tenure', experience]]
    });
    pdfDoc.save(`Audit_${user.firstName}.pdf`);
  };

  if (isUserLoading || !user) return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Syncing Personnel Data...</div>;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in-up pb-20 space-y-6 font-jakarta">
        <div className="flex flex-col gap-1 mb-2">
            <h1 className="text-2xl font-black tracking-tighter text-foreground/90">
                Personnel Audit: {user.firstName} {user.lastName}
            </h1>
        </div>

        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardContent className="p-6 md:p-8">
                <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                    <Avatar className="h-24 w-24 md:h-28 md:w-28 rounded-full border-4 border-white shadow-xl ring-1 ring-border flex items-center justify-center bg-muted">
                        {user.avatar?.startsWith('http') ? (
                            <AvatarImage src={user.avatar} className="object-cover" />
                        ) : (
                            <AvatarFallback className="text-4xl font-black">{user.avatar || user.firstName?.[0]}</AvatarFallback>
                        )}
                    </Avatar>

                    <div className="flex-1 text-center lg:text-left space-y-4 w-full">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-3 justify-center lg:justify-start">
                                    <h2 className="text-xl md:text-2xl font-black tracking-tighter">{user.firstName} {user.lastName}</h2>
                                    <Badge className="bg-primary/10 text-primary border-none rounded-full px-2 py-0 h-5 text-[8px] font-black uppercase tracking-widest">TACTICAL AUDIT</Badge>
                                </div>
                                <p className="text-sm font-semibold text-muted-foreground">{user.jobTitle}</p>
                                <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">{user.department} Designation</p>
                            </div>
                            <div className="flex gap-2">
                                {isAdmin && <Button onClick={handleExportPdf} className="rounded-xl h-9 px-4 font-black uppercase text-[9px] tracking-widest shadow-md">Export PDF</Button>}
                                <Button variant="outline" asChild className="rounded-xl h-9 px-4 font-black uppercase text-[9px] border-none ring-1 ring-border/50 bg-white">
                                    <Link href="/dashboard/users"><Users className="size-3.5 mr-2" /> All Staff</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-border/50">
                            <DetailItem icon={Mail} label="Email Address" value={user.email} />
                            <DetailItem icon={Phone} label="Phone Line" value={user.phoneNumber || "N/A"} />
                            <DetailItem icon={Building2} label="Work Location" value={branchName} />
                            <DetailItem icon={CalendarDays} label="Joined" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Clock} label="Experience" value={experience} />
                            <DetailItem icon={ShieldCheck} label="System Level" value={user.role} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="Attendance (MTD)" value={`${stats.percentage}%`} sub={`${stats.count}/${stats.totalWorkingDays} Days Active`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
            <MetricCard label="Mission Hours" value={`${stats.workHours}h`} sub="Total Active Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard label="Account Tier" value={user.role === 'CEO/Admin' ? 'Executive' : 'Staff'} sub="Permission Level" icon={ShieldCheck} color="text-orange-600" bg="bg-orange-50" />
            <MetricCard label="Records" value={documents?.length || 0} sub="Vault Assets" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
        </div>

        <Tabs defaultValue="activity" className="space-y-6">
            <TabsList className="bg-transparent border-none gap-8 p-0 h-auto">
                {["Activity", "Attendance", "Documents", "Assets", "Compliance"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 font-black uppercase text-[10px] tracking-[0.2em] bg-transparent">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <Card className="lg:col-span-8 border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Submission History</h3>
                        <div className="space-y-6">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={r.date?.toDate ? format(r.date.toDate(), 'PPP') : 'N/A'} desc={`Assigned to ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                            )) : <div className="py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">No Recent Submissions</div>}
                        </div>
                    </Card>
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="border-none shadow-sm rounded-2xl bg-white p-6 space-y-6">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Employment Details</h3>
                            <div className="space-y-4">
                                <InfoRow label="Designation" value={user.department} />
                                <InfoRow label="Work Location" value={branchName} />
                                <InfoRow label="Work Schedule" value={user.shiftType || 'General Shift'} />
                                <InfoRow label="Experience" value={experience} />
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-border/50">
                    <Table>
                        <TableHeader className="bg-muted/5 border-b">
                            <TableRow>
                                <TableHead className="font-black uppercase text-[9px] py-4 px-6 tracking-widest">Mission Date</TableHead>
                                <TableHead className="font-black uppercase text-[9px] py-4 tracking-widest">Status</TableHead>
                                <TableHead className="font-black uppercase text-[9px] py-4 tracking-widest">Log In</TableHead>
                                <TableHead className="font-black uppercase text-[9px] py-4 tracking-widest">Log Out</TableHead>
                                <TableHead className="text-right px-6 text-[9px] font-black uppercase tracking-widest">Map</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                <TableRow key={i} className="border-border/50">
                                    <TableCell className="py-4 px-6 font-black text-xs uppercase">{format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-full uppercase text-[8px] font-black tracking-widest px-2 border-none",
                                            rec.status === 'present' ? "bg-green-100 text-green-700" :
                                            rec.status === 'late' ? "bg-amber-100 text-amber-700" :
                                            "bg-rose-100 text-rose-700"
                                        )}>
                                            {rec.isOutOfRange ? "REMOTE" : rec.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="text-right px-6">
                                        {rec.locationCheckInLatitude && (
                                            <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-all inline-block">
                                                <MapPin className="size-3.5" />
                                            </Link>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-40 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">Registry Clear</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents && documents.length > 0 ? documents.map(doc => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/10 border border-transparent hover:border-primary/20 hover:bg-white transition-all group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <FileBox className="size-5 text-blue-600" />
                                    <span className="font-black text-xs uppercase tracking-tight truncate max-w-[150px]">{doc.title}</span>
                                </div>
                                <ExternalLink className="size-3.5 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                            </Link>
                        )) : (
                            <div className="col-span-full py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">No Intelligence Assets found</div>
                        )}
                    </div>
                </Card>
            </TabsContent>
            
            <TabsContent value="assets" className="mt-0">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                            <div key={asset.id} className="p-4 rounded-2xl ring-1 ring-border/50 bg-muted/5 space-y-3 hover:shadow-md transition-all">
                                <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden border border-border/50">
                                    {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full" /> : <Briefcase className="size-6 opacity-10" />}
                                </div>
                                <div>
                                    <p className="font-black text-[10px] uppercase tracking-tighter truncate">{asset.name}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">{asset.category}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-3"><Laptop className="size-8" /> No Hardware Units assigned</div>
                        )}
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="compliance" className="mt-0">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                    <div className="space-y-4">
                        {complianceData && complianceData.length > 0 ? complianceData.map((report: any) => (
                            <div key={report.id} className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-4">
                                <ShieldAlert className="size-5 text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-black text-xs text-red-900 uppercase tracking-tight">{report.severity} Alert: {report.reason}</p>
                                    <p className="text-[9px] font-bold text-red-700 uppercase tracking-widest mt-1">Audit Stamped: {report.timestamp?.toDate ? format(report.timestamp.toDate(), 'PP p') : 'N/A'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Integrity Verified: 0 Active Alerts</div>
                        )}
                    </div>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-primary/5 text-primary/60"><Icon className="size-3.5" /></div>
            <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-black truncate max-w-[140px] uppercase">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-[1.25rem] bg-white p-6 space-y-4 ring-1 ring-border/50 hover:shadow-lg transition-all group">
            <div className={cn("p-2 rounded-xl w-fit group-hover:scale-110 transition-transform shadow-sm", bg, color)}><Icon className="size-4" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</p>
                <p className="text-2xl font-black tracking-tighter">{value}</p>
                <p className="text-[9px] font-bold text-muted-foreground/40 mt-2 uppercase tracking-widest">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative">
            <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0 z-10 shadow-sm", color)}><Icon className="size-3" /></div>
            <div className="space-y-1">
                <p className="font-black text-xs uppercase tracking-tight">{title}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{time}</span>
                    <Badge variant="outline" className="h-3 px-1 text-[7px] font-black uppercase border-none bg-muted/20">{desc}</Badge>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-dashed border-border/50 last:border-none">
            <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">{label}</span>
            <span className="text-xs font-black text-foreground/80 uppercase">{value}</span>
        </div>
    );
}
