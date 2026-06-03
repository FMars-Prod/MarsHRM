'use client';

import * as React from 'react';
import { use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, startOfMonth, differenceInDays } from 'date-fns';
import { ShieldCheck, FileText, ShieldAlert, Clock, Users, Building2, ExternalLink, CalendarDays, FileBox, Mail, Phone, UserCheck, Zap, Briefcase, Download, MoreHorizontal, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type AttendanceRecord = {
  id: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'out_of_range';
  totalBreakDuration?: number;
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

  const docsQuery = useMemoFirebase(() => userId ? collection(firestore, `users/${userId}/documents`) : null, [userId, firestore]);
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
    if (!attendanceData) return { workHours: "0.0", count: 0, percentage: 0 };
    let totalSec = 0;
    const startOfCurrentMonth = startOfMonth(new Date());
    const monthlyAtt = attendanceData.filter(a => a.checkInTime?.toDate() >= startOfCurrentMonth);

    monthlyAtt.forEach(r => {
        if (r.checkInTime && r.checkOutTime) {
            totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
        }
    });
    return { 
        workHours: (totalSec / 3600).toFixed(1), 
        count: monthlyAtt.length,
        percentage: Math.min(100, Math.round((monthlyAtt.length / 22) * 100))
    };
  }, [attendanceData]);

  const tenure = React.useMemo(() => {
    if (!user?.hireDate) return "N/A";
    return `${differenceInDays(new Date(), new Date(user.hireDate))} day`;
  }, [user]);

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.text(`Audit: ${user.firstName} ${user.lastName}`, 14, 20);
    autoTable(pdfDoc, {
        startY: 30,
        head: [['Metric', 'Value']],
        body: [['Work Hours (MTD)', `${stats.workHours}h`], ['Attendance %', `${stats.percentage}%`], ['Tenure', tenure]]
    });
    pdfDoc.save(`Audit_${user.firstName}.pdf`);
  };

  if (isUserLoading || !user) return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Syncing Personnel Data...</div>;

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8 font-open-sans">
        {/* Bento Header */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden ring-1 ring-border/50">
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
                                {isAdmin && <Button onClick={handleExportPdf} className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest">Generate Audit PDF</Button>}
                                <Button variant="outline" asChild className="rounded-xl h-10 px-6 font-black uppercase text-[10px] border-none ring-1 ring-border/50 bg-white">
                                    <Link href="/dashboard/users"><Users className="size-3.5 mr-2" /> Back to Roster</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-dashed border-border/50">
                            <DetailItem icon={Mail} label="Email Address" value={user.email} />
                            <DetailItem icon={Phone} label="Phone Line" value={user.phoneNumber || "N/A"} />
                            <DetailItem icon={Building2} label="Operational Sector" value={branchName} />
                            <DetailItem icon={CalendarDays} label="Commenced" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                            <DetailItem icon={Clock} label="Fleet Tenure" value={tenure} />
                            <DetailItem icon={ShieldCheck} label="System Tier" value={user.role} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Audit Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard label="Attendance (MTD)" value={`${stats.percentage}%`} sub={`${stats.count} Days Stamped`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
            <MetricCard label="Mission Hours" value={`${stats.workHours}h`} sub="Net Active Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard label="Intelligence Assets" value={documents?.length || 0} sub="Vault Records" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
            <MetricCard label="Compliance Logs" value={complianceData?.length || 0} sub="Executive Alerts" icon={ShieldAlert} color="text-red-600" bg="bg-red-50" />
        </div>

        <Tabs defaultValue="activity" className="space-y-8">
            <TabsList className="bg-transparent border-none gap-8 p-0 h-auto">
                {["Activity", "Documents", "Assets", "Compliance"].map(tab => (
                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-4 font-black uppercase text-[10px] tracking-widest bg-transparent">
                        {tab}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-7 border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Shift Implementation History</h3>
                        <div className="space-y-8 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                            {userReports.map(r => (
                                <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Report`} time={format(r.date.toDate(), 'PPP')} desc={`Submitted for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                            ))}
                            {userReports.length === 0 && <div className="py-20 text-center opacity-30 text-xs font-black uppercase">No Recent Activity</div>}
                        </div>
                    </Card>
                    <div className="lg:col-span-5 space-y-8">
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Sector Info</h3>
                            <div className="space-y-4">
                                <InfoRow label="Assigned Sector" value={branchName} />
                                <InfoRow label="Shift Type" value={user.shiftType || 'General'} />
                                <InfoRow label="Hire Date" value={user.hireDate ? format(new Date(user.hireDate), 'PPP') : 'N/A'} />
                            </div>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents?.map(doc => (
                            <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white transition-all group">
                                <div className="flex items-center gap-4">
                                    <FileBox className="size-5 text-blue-600" />
                                    <div>
                                        <p className="font-bold text-xs">{doc.title}</p>
                                        <p className="text-[8px] font-black uppercase text-muted-foreground">Linked on {format(doc.uploadedAt.toDate(), 'dd MMM yyyy')}</p>
                                    </div>
                                </div>
                                <ExternalLink className="size-3.5 opacity-0 group-hover:opacity-100" />
                            </Link>
                        ))}
                    </div>
                </Card>
            </TabsContent>
            
            <TabsContent value="assets" className="mt-0">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {assignedAssets?.map(asset => (
                            <div key={asset.id} className="p-6 rounded-3xl ring-1 ring-border/50 bg-muted/10 space-y-4">
                                <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center overflow-hidden">
                                    {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full" /> : <Briefcase className="size-8 opacity-10" />}
                                </div>
                                <div>
                                    <p className="font-black text-xs uppercase">{asset.name}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">{asset.category}</p>
                                </div>
                            </div>
                        ))}
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
            <div className="p-2 rounded-lg bg-primary/5 text-primary/60"><Icon className="size-3.5" /></div>
            <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-bold truncate max-w-[150px]">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 ring-1 ring-border/50 hover:shadow-md transition-all group">
            <div className={cn("p-2.5 rounded-xl w-fit group-hover:scale-110 transition-transform", bg, color)}><Icon className="size-4" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                <p className="text-2xl font-black tracking-tighter">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative">
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10", color)}><Icon className="size-3.5" /></div>
            <div className="space-y-0.5 pt-0.5">
                <p className="font-bold text-xs">{title}</p>
                <p className="text-[9px] font-black uppercase text-muted-foreground/40">{time}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{desc}</p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border last:border-none">
            <span className="text-[10px] font-black uppercase text-muted-foreground/60">{label}</span>
            <span className="text-xs font-bold">{value}</span>
        </div>
    );
}
