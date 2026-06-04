
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
import { ShieldCheck, FileText, ShieldAlert, Clock, Users, Building2, ExternalLink, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MoreHorizontal, Target, Laptop, MapPin, CheckCircle2, User as UserIcon } from 'lucide-react';
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
import { Separator } from "@/components/ui/separator";

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
            <h1 className="text-2xl font-black tracking-tighter text-foreground/90 uppercase">
                Personnel Audit
            </h1>
        </div>

        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
            <CardContent className="p-8 lg:p-12">
                <div className="flex flex-col gap-10">
                    {/* Top Identity Block */}
                    <div className="flex items-start gap-10">
                        <Avatar className="h-32 w-32 md:h-44 md:w-44 rounded-3xl border-4 border-white shadow-2xl ring-1 ring-border shrink-0 bg-muted">
                            {user.avatar?.startsWith('http') ? (
                                <AvatarImage src={user.avatar} className="object-cover" />
                            ) : (
                                <AvatarFallback className="text-5xl font-black">{user.avatar || user.firstName?.[0]}</AvatarFallback>
                            )}
                        </Avatar>

                        <div className="flex-1 space-y-3 pt-2">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground leading-none">
                                    {user.firstName} {user.lastName}
                                </h2>
                                <div className="flex gap-2">
                                    {isAdmin && <Button onClick={handleExportPdf} variant="outline" className="rounded-2xl h-10 px-5 font-black uppercase text-[10px] tracking-widest border-none ring-1 ring-border/50 shadow-sm bg-white hover:bg-primary/5 hover:text-primary transition-all">Export PDF</Button>}
                                    <Button asChild className="rounded-2xl h-10 px-5 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                        <Link href="/dashboard/users"><Users className="size-4 mr-2" /> Staff Registry</Link>
                                    </Button>
                                </div>
                            </div>
                            <p className="text-lg md:text-2xl font-bold text-muted-foreground">{user.jobTitle}</p>
                            <Badge className="bg-primary/10 text-primary border-none rounded-full px-3 h-5 text-[8px] font-black uppercase tracking-widest">TACTICAL AUDIT ACTIVE</Badge>
                        </div>
                    </div>

                    {/* Data Row 1 */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-8 border-t border-dashed border-border/50">
                        <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${user.id.slice(0, 8).toUpperCase()}`} />
                        <DetailItem icon={CalendarDays} label="Date of Joining" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                        <DetailItem icon={Mail} label="Email Address" value={user.email} />
                        <DetailItem icon={Phone} label="Phone Line" value={user.phoneNumber || "N/A"} />
                    </div>

                    <Separator className="opacity-50" />

                    {/* Data Row 2 */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        <DetailItem icon={Users} label="Team" value={user.teamId ? "Assigned Fleet" : "General Sector"} />
                        <DetailItem icon={MapPin} label="Work Location" value={branchName} />
                        <DetailItem icon={Briefcase} label="Employment Type" value={user.employmentType || "Employee"} />
                        <DetailItem icon={Clock} label="Account Tier" value={user.role} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="Attendance (MTD)" value={`${stats.percentage}%`} sub={`${stats.count}/${stats.totalWorkingDays} Days Active`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
            <MetricCard label="Mission Hours" value={`${stats.workHours}h`} sub="Total Active Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard label="Integrity" value="Verified" sub="Compliance Status" icon={ShieldCheck} color="text-orange-600" bg="bg-orange-50" />
            <MetricCard label="Intelligence" value={documents?.length || 0} sub="Vault Assets Stored" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
        </div>

        <Tabs defaultValue="activity" className="space-y-6">
            <TabsList className="bg-transparent border-none gap-10 p-0 h-auto">
                {["Activity", "Attendance", "Documents", "Assets", "Compliance"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 font-black uppercase text-[11px] tracking-[0.2em] bg-transparent">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <Card className="lg:col-span-8 border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Mission Log History</h3>
                        <div className="space-y-8">
                            {userReports.length > 0 ? userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={r.date?.toDate ? format(r.date.toDate(), 'PPP') : 'N/A'} desc={`Shift finalized for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                            )) : <div className="py-20 text-center opacity-30 text-[11px] font-black uppercase tracking-widest grayscale flex flex-col items-center gap-4"><FileText className="size-10"/> No Recent Submissions Logged</div>}
                        </div>
                    </Card>
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Employment Details</h3>
                            <div className="space-y-5">
                                <InfoRow label="Designation" value={user.jobTitle} />
                                <InfoRow label="Department" value={user.department} />
                                <InfoRow label="Work Location" value={branchName} />
                                <InfoRow label="Work Schedule" value={user.shiftType || 'General Shift'} />
                                <InfoRow label="Experience" value={experience} />
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                    <Table>
                        <TableHeader className="bg-muted/5 border-b">
                            <TableRow>
                                <TableHead className="font-black uppercase text-[10px] py-6 px-10 tracking-widest">Mission Date</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6 tracking-widest">Status</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6 tracking-widest">Log In</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6 tracking-widest">Log Out</TableHead>
                                <TableHead className="text-right px-10 text-[10px] font-black uppercase tracking-widest">Map Point</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                    <TableCell className="py-6 px-10 font-black text-sm uppercase">{format(rec.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-full uppercase text-[9px] font-black tracking-widest px-3 h-6 border-none",
                                            rec.status === 'present' ? "bg-green-100 text-green-700" :
                                            rec.status === 'late' ? "bg-amber-100 text-amber-700" :
                                            "bg-rose-100 text-rose-700"
                                        )}>
                                            {rec.isOutOfRange ? "REMOTE SIGNAL" : rec.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="font-mono text-sm font-bold text-primary">{rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="text-right px-10">
                                        {rec.locationCheckInLatitude && (
                                            <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" className="p-2.5 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all inline-block shadow-sm">
                                                <MapPin className="size-4" />
                                            </Link>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center opacity-30 text-[11px] font-black uppercase tracking-[0.4em] grayscale"><CalendarClock className="size-10 mx-auto mb-4"/> Registry Clear</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents && documents.length > 0 ? documents.map(doc => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-6 rounded-3xl bg-muted/10 border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group shadow-sm hover:shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileBox className="size-6" /></div>
                                    <span className="font-black text-sm uppercase tracking-tight truncate max-w-[180px]">{doc.title}</span>
                                </div>
                                <ExternalLink className="size-4 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                            </Link>
                        )) : (
                            <div className="col-span-full py-20 text-center opacity-30 text-[11px] font-black uppercase tracking-widest grayscale flex flex-col items-center gap-4"><FileBox className="size-12"/> No Intelligence Assets Provisioned</div>
                        )}
                    </div>
                </Card>
            </TabsContent>
            
            <TabsContent value="assets" className="mt-0">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                            <div key={asset.id} className="p-6 rounded-[2rem] ring-1 ring-border/50 bg-muted/5 space-y-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                                <div className="aspect-square bg-white rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-border/50 p-2">
                                    {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full rounded-xl" /> : <Laptop className="size-10 opacity-10" />}
                                </div>
                                <div>
                                    <p className="font-black text-xs uppercase tracking-tighter truncate">{asset.name}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{asset.category}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-20 text-center opacity-30 text-[11px] font-black uppercase tracking-widest grayscale flex flex-col items-center gap-4"><Laptop className="size-12" /> No Hardware Units Registered</div>
                        )}
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="compliance" className="mt-0">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                    <div className="space-y-6">
                        {complianceData && complianceData.length > 0 ? complianceData.map((report: any) => (
                            <div key={report.id} className="p-6 rounded-3xl bg-red-50/50 border-2 border-dashed border-red-100 flex items-start gap-6 hover:bg-red-50 transition-colors">
                                <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20"><ShieldAlert className="size-6" /></div>
                                <div>
                                    <p className="font-black text-sm text-red-900 uppercase tracking-tight">{report.severity} Priority Protocol Violation</p>
                                    <p className="text-xs font-medium text-red-800/70 mt-1 leading-relaxed">Reason: {report.reason}</p>
                                    <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-4 flex items-center gap-2"><Clock className="size-3"/> Audit Stamped: {report.timestamp?.toDate ? format(report.timestamp.toDate(), 'PPP p') : 'N/A'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center opacity-30 text-[11px] font-black uppercase tracking-widest grayscale flex flex-col items-center gap-4"><CheckCircle2 className="size-12 text-emerald-600"/> Vertical Integrity Verified: 0 Alerts</div>
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
        <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-2xl bg-primary/5 text-primary/60 shrink-0 shadow-sm"><Icon className="size-5" /></div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1 leading-none">{label}</p>
                <p className="text-sm font-black truncate text-foreground/90 uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-5 ring-1 ring-border/50 hover:shadow-2xl transition-all group duration-500">
            <div className={cn("p-3 rounded-2xl w-fit group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-sm", bg, color)}><Icon className="size-5" /></div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 leading-none">{label}</p>
                <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/40 mt-3 uppercase tracking-widest leading-none">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-6 items-start relative group">
            <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3", color)}><Icon className="size-5" /></div>
            <div className="space-y-1.5 flex-1">
                <p className="font-black text-sm uppercase tracking-tight text-foreground/90">{title}</p>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1.5"><Clock className="size-3"/> {time}</span>
                    <Badge variant="outline" className="h-5 px-3 text-[8px] font-black uppercase border-none bg-muted/30 tracking-widest">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-dashed border-border/50 last:border-none">
            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">{label}</span>
            <span className="text-xs font-black text-foreground/80 uppercase text-right pl-4">{value}</span>
        </div>
    );
}
