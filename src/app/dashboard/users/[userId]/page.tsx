
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
  const { data: documents } = useCollection(docsQuery);

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
  const { data: assignedAssets } = useCollection(assetsQuery);

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
    return `${totalDays} day`;
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
    <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8 font-jakarta">
        <div className="flex flex-col gap-1 mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{format(new Date(), 'EEEE, MMMM dd')}</p>
            <h1 className="text-4xl font-black tracking-tighter">
                Personnel Audit, {user.firstName} ,
            </h1>
        </div>

        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
            <CardContent className="p-8 md:p-10">
                <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start">
                    <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white shadow-xl ring-1 ring-border flex items-center justify-center bg-muted">
                        {user.avatar?.startsWith('http') ? (
                            <AvatarImage src={user.avatar} className="object-cover" />
                        ) : (
                            <AvatarFallback className="text-6xl">{user.avatar || user.firstName?.[0]}</AvatarFallback>
                        )}
                    </Avatar>

                    <div className="flex-1 text-center lg:text-left space-y-6 w-full">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 justify-center lg:justify-start">
                                    <h2 className="text-3xl font-black tracking-tighter">{user.firstName} {user.lastName}</h2>
                                    <Badge className="bg-primary/10 text-primary border-none rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest">TACTICAL AUDIT</Badge>
                                </div>
                                <p className="text-lg font-medium text-muted-foreground">{user.jobTitle}</p>
                                <p className="text-xs font-black uppercase text-primary/60 tracking-widest">{user.department} Unit</p>
                            </div>
                            <div className="flex gap-3">
                                {isAdmin && <Button onClick={handleExportPdf} className="rounded-2xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10">Generate Audit PDF</Button>}
                                <Button variant="outline" asChild className="rounded-2xl h-10 px-6 font-black uppercase text-[10px] border-none ring-1 ring-border/50 bg-white">
                                    <Link href="/dashboard/users"><Users className="size-3.5 mr-2" /> Back to Roster</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-dashed border-border/50">
                            <DetailItem icon={Mail} label="Email Address" value={user.email} />
                            <DetailItem icon={Phone} label="Phone Line" value={user.phoneNumber || "N/A"} />
                            <DetailItem icon={Building2} label="Operational Sector" value={branchName} />
                            <DetailItem icon={CalendarDays} label="Commenced" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Clock} label="Fleet Tenure" value={experience} />
                            <DetailItem icon={ShieldCheck} label="System Tier" value={user.role} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard label="Attendance (MTD)" value={`${stats.percentage}%`} sub={`${stats.count}/${stats.totalWorkingDays} Days Stamped`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
            <MetricCard label="Mission Hours" value={`${stats.workHours}h`} sub="Net Active Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard label="Account Authority" value={user.role === 'CEO/Admin' ? 'Executive' : user.role === 'HR Manager' ? 'Admin' : 'Tactical'} sub="System Permission" icon={ShieldCheck} color="text-orange-600" bg="bg-orange-50" />
            <MetricCard label="Intelligence Assets" value={documents?.length || 0} sub="Vault Records" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
        </div>

        <Tabs defaultValue="activity" className="space-y-8">
            <TabsList className="bg-transparent border-none gap-8 p-0 h-auto">
                {["Activity", "Attendance", "Documents", "Assets", "Compliance"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-5 font-black uppercase text-[11px] tracking-[0.25em] bg-transparent">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-7 border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Shift Implementation History</h3>
                        <div className="space-y-10 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                            {userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={r.date?.toDate ? format(r.date.toDate(), 'PPP') : 'N/A'} desc={`Submitted for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                            ))}
                            {userReports.length === 0 && <div className="py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">No Recent Activity</div>}
                        </div>
                    </Card>
                    <div className="lg:col-span-5 space-y-8">
                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10 space-y-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Sector Info</h3>
                            <div className="space-y-5">
                                <InfoRow label="Assigned Sector" value={branchName} />
                                <InfoRow label="Shift Type" value={user.shiftType || 'General'} />
                                <InfoRow label="Hire Date" value={user.hireDate ? format(new Date(user.hireDate), 'PPP') : 'N/A'} />
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/10 border-b">
                            <TableRow>
                                <TableHead className="font-black uppercase text-[10px] py-6 px-10">Mission Date</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6">Signal Status</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6">Log In</TableHead>
                                <TableHead className="font-black uppercase text-[10px] py-6">Log Out</TableHead>
                                <TableHead className="text-right px-10 text-[10px] font-black uppercase">Verification</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceData && attendanceData.length > 0 ? attendanceData.map((rec, i) => (
                                <TableRow key={i} className="border-border/50">
                                    <TableCell className="py-6 px-10 font-black text-sm">{format(rec.checkInTime?.toDate() || new Date(), 'PPP')}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-full uppercase text-[9px] font-black tracking-widest px-3 border-none",
                                            rec.status === 'present' ? "bg-green-100 text-green-700" :
                                            rec.status === 'late' ? "bg-amber-100 text-amber-700" :
                                            "bg-rose-100 text-rose-700"
                                        )}>
                                            {rec.isOutOfRange ? "REMOTE" : rec.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell className="text-right px-10">
                                        {rec.locationCheckInLatitude && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-primary/5 text-primary" asChild>
                                                <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                    <MapPin className="size-3.5" />
                                                </Link>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-64 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">No records found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {documents && documents.length > 0 ? documents.map(doc => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white transition-all group shadow-sm hover:shadow-xl">
                                <div className="flex items-center gap-5">
                                    <FileBox className="size-6 text-blue-600" />
                                    <div>
                                        <p className="font-black text-sm">{doc.title}</p>
                                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Linked on {doc.uploadedAt?.toDate ? format(doc.uploadedAt.toDate(), 'dd MMM yyyy') : 'N/A'}</p>
                                    </div>
                                </div>
                                <ExternalLink className="size-4 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                            </Link>
                        )) : (
                            <div className="col-span-full py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">No Intelligence Assets provisioned</div>
                        )}
                    </div>
                </Card>
            </TabsContent>
            
            <TabsContent value="assets" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                            <div key={asset.id} className="p-8 rounded-[2rem] ring-1 ring-border/50 bg-muted/10 space-y-6 hover:shadow-xl transition-all duration-500">
                                <div className="aspect-square bg-muted rounded-3xl flex items-center justify-center overflow-hidden">
                                    {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="object-cover w-full h-full" /> : <Briefcase className="size-10 opacity-10" />}
                                </div>
                                <div>
                                    <p className="font-black text-sm uppercase tracking-tight truncate">{asset.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{asset.category}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">No Hardware Units assigned</div>
                        )}
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="compliance" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-10">
                    <div className="space-y-6">
                        {complianceData && complianceData.length > 0 ? complianceData.map((report: any) => (
                            <div key={report.id} className="p-6 rounded-[2rem] bg-red-50 border border-red-100 flex items-start gap-5">
                                <ShieldAlert className="size-6 text-red-600 mt-1" />
                                <div>
                                    <p className="font-black text-sm text-red-900">{report.severity} Alert: {report.reason}</p>
                                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mt-1">Filed on {report.timestamp?.toDate ? format(report.timestamp.toDate(), 'PP p') : 'N/A'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">Fleet Integrity Verified - No Alerts</div>
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
            <div className="p-2.5 rounded-xl bg-primary/5 text-primary/60"><Icon className="size-4" /></div>
            <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-black truncate max-w-[150px]">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 space-y-5 ring-1 ring-border/50 hover:shadow-2xl transition-all group">
            <div className={cn("p-3 rounded-2xl w-fit group-hover:scale-110 transition-transform shadow-sm", bg, color)}><Icon className="size-5" /></div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</p>
                <p className="text-3xl font-black tracking-tighter">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/40 mt-1.5 uppercase tracking-widest">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-6 items-start relative">
            <div className={cn("h-8 w-8 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-sm", color)}><Icon className="size-4" /></div>
            <div className="space-y-1 pt-0.5">
                <p className="font-black text-sm uppercase tracking-tight">{title}</p>
                <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">{time}</p>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed mt-2 italic">"{desc}"</p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-dashed border-border/50 last:border-none">
            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">{label}</span>
            <span className="text-sm font-black text-foreground/80">{value}</span>
        </div>
    );
}
