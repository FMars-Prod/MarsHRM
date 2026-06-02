
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
import { Grid, ShieldCheck, FileText, ShieldAlert, Clock, Users, Building2, ExternalLink, CalendarDays, FileBox, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from "next/link";

type AttendanceRecord = {
  id: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'out_of_range';
  totalBreakDuration?: number;
};

type ComplianceReport = { id: string; severity: string; reason: string; timestamp: Timestamp; filedByName: string; };

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(new Date()));
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
        const isLeadership = currentUserData.role === 'HR Manager' || currentUserData.role === 'CEO/Admin';
        
        if (!isSelf && !isLeadership) {
            toast({ variant: 'destructive', title: 'Vertical Block', description: 'Administrative authorization required to view personnel records.' });
            router.push('/dashboard');
        }
    }
  }, [currentUser, currentUserData, userId, isUserLoading, router, toast]);

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const complianceQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'compliance_reports'), where('employeeId', '==', userId), orderBy('timestamp', 'desc')) : null, [firestore, userId]);
  const { data: complianceData } = useCollection<ComplianceReport>(complianceQuery);

  React.useEffect(() => {
      const fetchReports = async () => {
          if (!userId) return;
          try {
            const q = query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(30));
            const snap = await getDocs(q);
            setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) {
            console.error("Report fetch failed:", e);
          }
      };
      fetchReports();
  }, [userId, firestore]);

  const stats = React.useMemo(() => {
    if (!attendanceData) return { workHours: "0.0", lateDays: 0, leaves: 0, reports: 0 };
    let totalSec = 0;
    let late = 0;
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);

    attendanceData.forEach(r => {
        const checkIn = r.checkInTime instanceof Timestamp ? r.checkInTime.toDate() : null;
        if (checkIn && checkIn >= startOfCurrentMonth) {
            if (r.checkOutTime instanceof Timestamp) {
                totalSec += differenceInSeconds(r.checkOutTime.toDate(), checkIn) - (r.totalBreakDuration || 0);
            }
            if (r.status === 'late') late++;
        }
    });
    return { 
        workHours: (totalSec / 3600).toFixed(1), 
        lateDays: late, 
        leaves: attendanceData.filter(a => {
            const checkIn = a.checkInTime instanceof Timestamp ? a.checkInTime.toDate() : null;
            return a.status === 'on_leave' && checkIn && checkIn >= startOfCurrentMonth;
        }).length, 
        reports: userReports.length 
    };
  }, [attendanceData, userReports]);

  const tenure = React.useMemo(() => {
    if (!user?.hireDate) return "N/A";
    const start = new Date(user.hireDate);
    const now = new Date();
    const totalDays = differenceInDays(now, start);
    return `${totalDays} day`;
  }, [user]);

  const modifiers = React.useMemo(() => {
    const mods: Record<string, any> = { present: [], late: [], absent: [], on_leave: [], out_of_range: [], report: [], sunday: { dayOfWeek: [0] } };
    attendanceData?.forEach(event => { if (event.checkInTime instanceof Timestamp && mods[event.status]) mods[event.status].push(event.checkInTime.toDate()); });
    userReports.forEach(report => { if (report.date instanceof Timestamp) mods.report.push(report.date.toDate()); });
    return mods;
  }, [attendanceData, userReports]);

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(16);
    pdfDoc.text(`Performance Audit: ${user.firstName} ${user.lastName}`, 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Designation: ${user.jobTitle} | Department: ${user.department}`, 14, 28);
    autoTable(pdfDoc, {
        startY: 35,
        head: [['Metric', 'Value']],
        body: [
            ['Work Hours (Month)', `${stats.workHours}h`], 
            ['Late Logs (Month)', stats.lateDays], 
            ['Leaves (Month)', stats.leaves], 
            ['Total Reports (Recent)', stats.reports],
            ['Documents Submitted', documents?.length || 0],
            ['Employment Status', user.employmentType || 'Employee']
        ],
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });
    pdfDoc.save(`Audit_${user.firstName}_${user.lastName}.pdf`);
  };

  if (isUserLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Syncing Satellite Profile...</div>;
  if (!user) return notFound();

  const isAvatarUrl = user.avatar && user.avatar.startsWith('http');

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up pb-20 space-y-8">
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden font-open-sans">
          <CardContent className="p-10">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16">
                  <div className="relative group">
                    <Avatar className="size-32 md:size-44 rounded-full ring-8 ring-primary/5 ring-offset-0 overflow-hidden bg-muted flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-105">
                        {user.avatar ? (
                            isAvatarUrl ? (
                                <AvatarImage src={user.avatar} className="object-cover" />
                            ) : (
                                <span className="text-7xl md:text-8xl">{user.avatar}</span>
                            )
                        ) : (
                            <AvatarFallback className="text-4xl">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                        )}
                    </Avatar>
                  </div>

                  <div className="flex-1 space-y-8 text-center md:text-left w-full">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <h1 className="text-3xl font-black tracking-tighter text-foreground">{user.firstName} {user.lastName}</h1>
                            <Badge className="bg-primary/10 text-primary border-none rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest">Tactical Audit</Badge>
                        </div>
                        <p className="text-xl font-medium text-muted-foreground">{user.jobTitle}</p>
                        <p className="text-xs font-semibold text-primary/60 uppercase tracking-widest">{user.department} Division</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                        <DetailItem icon={Mail} label="Email" value={user.email} />
                        <DetailItem icon={Phone} label="Phone" value={user.phoneNumber || "Not Provisioned"} />
                        <DetailItem icon={Building2} label="Branch" value={branchName} />
                        <DetailItem icon={CalendarDays} label="Joined" value={user.hireDate ? format(new Date(user.hireDate), 'dd MMM yyyy') : 'N/A'} />
                        <DetailItem icon={Briefcase} label="Status" value={user.employmentType || "Employee"} />
                        <DetailItem icon={Clock} label="Tenure" value={tenure} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        {isAdmin && (
                            <Button onClick={handleExportPdf} className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                                Generate Audit Log PDF
                            </Button>
                        )}
                        <Button variant="outline" asChild className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-white/50 border-none ring-1 ring-border/50">
                            <Link href="/dashboard/users"><Users className="size-3.5 mr-2" /> Back to Roster</Link>
                        </Button>
                    </div>
                  </div>
              </div>
          </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
              <Tabs defaultValue="calendar" className="w-full">
                <TabsList className="w-full justify-start bg-transparent border-none rounded-none h-14 space-x-8 mb-4">
                    <TabsTrigger value="calendar" className="rounded-none h-full data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none text-muted-foreground data-[state=active]:text-primary">
                        <Grid className="size-4"/> Ops Grid
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="rounded-none h-full data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none text-muted-foreground data-[state=active]:text-primary">
                        <FileText className="size-4"/> Intelligence
                    </TabsTrigger>
                    <TabsTrigger value="docs" className="rounded-none h-full data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none text-muted-foreground data-[state=active]:text-primary">
                        <FileBox className="size-4"/> Vault
                    </TabsTrigger>
                </TabsList>

                <div className="pt-2">
                    <TabsContent value="calendar" className="mt-0">
                        <Card className="border-none rounded-[2.5rem] overflow-hidden shadow-sm bg-white">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Verification Calendar</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 pt-0 flex flex-col md:flex-row gap-12 items-center justify-center">
                                <Calendar 
                                    mode="single" 
                                    month={currentMonth} 
                                    onMonthChange={setCurrentMonth} 
                                    className="rounded-2xl border p-4 shadow-inner bg-muted/10" 
                                    modifiers={modifiers} 
                                    modifiersClassNames={{
                                        present: 'bg-green-500/20 text-green-700 font-black',
                                        late: 'bg-yellow-500/20 text-yellow-700 font-black',
                                        on_leave: 'bg-blue-500/20 text-blue-700 font-black',
                                        out_of_range: 'bg-orange-500/20 text-orange-700 font-black',
                                        report: 'after:content-["•"] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:text-primary after:font-black',
                                        sunday: 'opacity-20 bg-muted/20',
                                    }} 
                                />
                                <div className="space-y-4 w-full max-w-[200px]">
                                    <h4 className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest border-b pb-2">Legend</h4>
                                    <LegendItem color="bg-green-500" label="Present" />
                                    <LegendItem color="bg-yellow-500" label="Late Log" />
                                    <LegendItem color="bg-blue-500" label="On Leave" />
                                    <LegendItem color="bg-orange-500" label="Out of Range" />
                                    <LegendItem color="bg-primary" label="Reported" />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="reports" className="mt-0">
                        <Card className="border-none rounded-[2.5rem] shadow-sm bg-white overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b">
                                <CardTitle className="text-lg font-black uppercase tracking-tighter">Tactical Shift Intelligence</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase">Recent submissions for audit</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[500px]">
                                    <div className="divide-y divide-border/50">
                                        {userReports.length > 0 ? userReports.map(r => (
                                            <div key={r.id} className="p-6 flex items-center justify-between hover:bg-primary/5 transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                        <Clock className="size-5"/>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{format(r.date.toDate(), 'PPP')}</p>
                                                        <Badge variant="outline" className="text-[8px] uppercase font-black tracking-widest mt-1">{r.reportType} LOG</Badge>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" asChild className="rounded-full text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link href="/dashboard/reports">View Details <ExternalLink className="size-3 ml-1.5"/></Link>
                                                </Button>
                                            </div>
                                        )) : (
                                            <div className="py-32 text-center flex flex-col items-center gap-3 opacity-30">
                                                <FileText className="size-12" />
                                                <p className="text-[10px] font-black uppercase">No Intelligence Records</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="docs" className="mt-0">
                        <Card className="border-none rounded-[2.5rem] shadow-sm bg-white overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b">
                                <CardTitle className="text-lg font-black uppercase tracking-tighter">Digital Asset Repository</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase">Personnel document vault</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[400px]">
                                    <div className="divide-y divide-border/50">
                                        {documents && documents.length > 0 ? documents.map(d => (
                                            <div key={d.id} className="p-6 hover:bg-blue-50/50 transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-blue-500/5 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                        <FileBox className="size-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{d.title}</p>
                                                        <p className="text-[8px] uppercase font-black tracking-widest text-muted-foreground">Linked {format(d.uploadedAt.toDate(), 'PPP')}</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" asChild className="rounded-full font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link href={d.link} target="_blank">Access Link <ExternalLink className="size-3 ml-1.5"/></Link>
                                                </Button>
                                            </div>
                                        )) : (
                                            <div className="py-32 text-center flex flex-col items-center gap-3 opacity-30">
                                                <FileBox className="size-12" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Digital Assets</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
              </Tabs>
          </div>

          <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                  <CardHeader className="p-8 border-b bg-muted/10">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Clock className="size-4" /> MTD Performance
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Net Work Hours</p>
                          <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black tracking-tighter text-foreground">{stats.workHours}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">HRS</span>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                          <StatMini label="Lates" value={stats.lateDays} color="text-amber-600" />
                          <StatMini label="Leaves" value={stats.leaves} color="text-blue-600" />
                          <StatMini label="Reports" value={stats.reports} color="text-primary" />
                          <StatMini label="Docs" value={documents?.length || 0} color="text-indigo-600" />
                      </div>
                  </CardContent>
              </Card>

              {complianceData && complianceData.length > 0 && (
                  <Card className="border-none shadow-xl rounded-[2rem] bg-red-50/50 border-2 border-red-100 overflow-hidden">
                      <CardHeader className="p-8 pb-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                              <ShieldAlert className="size-4" /> Compliance Audit
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 pt-0 space-y-4">
                          {complianceData.map(c => (
                              <div key={c.id} className="p-4 bg-white rounded-2xl border border-red-100 space-y-2">
                                  <div className="flex justify-between items-center">
                                      <Badge variant="destructive" className="text-[8px] font-black uppercase px-2 py-0">{c.severity}</Badge>
                                      <span className="text-[8px] font-bold text-muted-foreground">{format(c.timestamp.toDate(), 'PP')}</span>
                                  </div>
                                  <p className="text-[11px] font-medium leading-relaxed italic">"{c.reason}"</p>
                                  <p className="text-[9px] font-black text-red-800 uppercase tracking-tighter">— Filed by {c.filedByName}</p>
                              </div>
                          ))}
                      </CardContent>
                  </Card>
              )}
          </div>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/5 text-primary/60 mt-0.5"><Icon className="size-3.5" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-bold text-foreground/80 truncate max-w-[120px]">{value}</p>
            </div>
        </div>
    );
}

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className={cn("size-2 rounded-full", color)} />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</span>
        </div>
    );
}

function StatMini({ label, value, color }: { label: string, value: string | number, color: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">{label}</p>
            <p className={cn("text-xl font-black tracking-tighter", color)}>{value}</p>
        </div>
    );
}
