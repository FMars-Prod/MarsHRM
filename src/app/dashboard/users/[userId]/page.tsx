'use client';

import * as React from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, updateDocumentNonBlocking, useStorage, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, startOfMonth } from 'date-fns';
import { Grid, ShieldCheck, Calendar as CalendarIcon, FileText, ShieldAlert, Briefcase, Download, Save, ExternalLink, Clock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type AttendanceRecord = {
  id: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  status: 'present' | 'late' | 'absent' | 'on_leave';
};

type Report = { id: string; date: Timestamp; reportType: string; };
type ComplianceReport = { id: string; severity: string; reason: string; timestamp: Timestamp; filedByName: string; };

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(new Date()));
  const [manualSignatureUrl, setManualSignatureUrl] = React.useState("");
  const [userReports, setUserReports] = React.useState<any[]>([]);

  const userDocRef = useMemoFirebase(() => (userId ? doc(firestore, 'users', userId) : null), [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<any>(userDocRef);

  const teamDocRef = useMemoFirebase(() => user?.teamId ? doc(firestore, "teams", user.teamId) : null, [user, firestore]);
  const { data: teamData } = useDoc<any>(teamDocRef);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const complianceQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'compliance_reports'), where('employeeId', '==', userId), orderBy('timestamp', 'desc')) : null, [firestore, userId]);
  const { data: complianceData } = useCollection<ComplianceReport>(complianceQuery);

  React.useEffect(() => {
      const fetchReports = async () => {
          if (!userId) return;
          const q = query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(30));
          const snap = await getDocs(q);
          setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchReports();
  }, [userId, firestore]);

  const stats = React.useMemo(() => {
    if (!attendanceData) return { workHours: 0, lateDays: 0, leaves: 0, compliance: 0 };
    let totalSec = 0;
    let late = 0;
    attendanceData.forEach(r => {
        if (r.checkInTime instanceof Timestamp && r.checkOutTime instanceof Timestamp) {
            totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate());
        }
        if (r.status === 'late') late++;
    });
    return { workHours: (totalSec / 3600).toFixed(1), lateDays: late, leaves: attendanceData.filter(a => a.status === 'on_leave').length, compliance: complianceData?.length || 0 };
  }, [attendanceData, complianceData]);

  const modifiers = React.useMemo(() => {
    const mods: Record<string, any> = { present: [], late: [], absent: [], on_leave: [], report: [], sunday: { dayOfWeek: [0] } };
    attendanceData?.forEach(event => { if (event.checkInTime instanceof Timestamp && mods[event.status]) mods[event.status].push(event.checkInTime.toDate()); });
    userReports.forEach(report => { if (report.date instanceof Timestamp) mods.report.push(report.date.toDate()); });
    return mods;
  }, [attendanceData, userReports]);

  const handleManualSignatureSave = () => {
    if (!userDocRef || !manualSignatureUrl) return;
    updateDocumentNonBlocking(userDocRef, { signatureUrl: manualSignatureUrl, signatureStatus: 'approved' });
    toast({ title: "Asset URL Synchronized" });
  };

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(16);
    pdfDoc.text(`Performance Audit: ${user.firstName} ${user.lastName}`, 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Designation: ${user.jobTitle} | Department: ${user.department}`, 14, 28);
    autoTable(pdfDoc, {
        startY: 35,
        head: [['Metric', 'Value']],
        body: [['Work Hours', `${stats.workHours}h`], ['Late Logs', stats.lateDays], ['Leaves', stats.leaves], ['Compliance Alerts', stats.compliance]],
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });
    pdfDoc.save(`Audit_${user.firstName}_${user.lastName}.pdf`);
  };

  React.useEffect(() => { if (user?.signatureUrl) setManualSignatureUrl(user.signatureUrl); }, [user]);

  if (isUserLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Syncing Satellite Profile...</div>;
  if (!user) return notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20">
      <div className="flex flex-col md:flex-row items-center gap-8 px-6 pt-6">
        <div className="size-20 md:size-24 rounded-full ring-2 ring-primary ring-offset-4 overflow-hidden bg-muted flex items-center justify-center shadow-lg">
            {user.avatar ? <span className="text-5xl">{user.avatar}</span> : <AvatarFallback className="text-2xl">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>}
        </div>
        <div className="flex-1 flex flex-col items-center md:items-start gap-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
                <h2 className="text-2xl font-black tracking-tighter">{user.firstName} {user.lastName}</h2>
                <div className="flex gap-1.5">
                    <Badge variant="secondary" className="rounded-full px-3 text-[9px] uppercase font-black tracking-widest">{user.jobTitle}</Badge>
                    {teamData && <Badge className="bg-primary/10 text-primary border-none rounded-full px-3 text-[9px] uppercase font-black tracking-widest"><Users className="size-3 mr-1"/> {teamData.name}</Badge>}
                </div>
            </div>
            <div className="flex justify-center md:justify-start gap-8 md:gap-12 w-full max-w-sm border-t border-b py-3 md:border-none md:p-0">
                <div className="text-center"><p className="font-black text-xl">{stats.workHours}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Hours</p></div>
                <div className="text-center"><p className="font-black text-xl">{stats.lateDays}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Late Ops</p></div>
                <div className="text-center"><p className="font-black text-xl">{stats.leaves}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Leaves</p></div>
                <div className="text-center"><p className="font-black text-xl text-red-600">{stats.compliance}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Alerts</p></div>
            </div>
            {isAdmin && <Button onClick={handleExportPdf} size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest"><Download className="size-3 mr-2"/> Download Audit PDF</Button>}
        </div>
      </div>
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full justify-center bg-transparent border-t border-b rounded-none h-14">
            <TabsTrigger value="calendar" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><CalendarIcon className="size-4"/> Ops Log</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><FileText className="size-4"/> Intelligence</TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><ShieldAlert className="size-4"/> Alerts</TabsTrigger>
            <TabsTrigger value="identity" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><ShieldCheck className="size-4"/> Identity</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="p-4"><Card className="border-none rounded-3xl overflow-hidden shadow-sm bg-white/50"><CardHeader className="bg-muted/10 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest">Shift Verification Grid</CardTitle></CardHeader>
                <CardContent className="p-4 flex flex-col md:flex-row gap-8 items-center justify-center">
                    <Calendar mode="single" month={currentMonth} onMonthChange={setCurrentMonth} className="rounded-2xl border p-4 shadow-inner" modifiers={modifiers} modifiersClassNames={{
                        present: 'bg-green-500/20 text-green-700 font-black',
                        late: 'bg-yellow-500/20 text-yellow-700 font-black',
                        on_leave: 'bg-blue-500/20 text-blue-700 font-black',
                        report: 'after:content-["•"] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:text-primary after:font-black',
                        sunday: 'opacity-20 bg-muted/20',
                    }} />
                </CardContent></Card></TabsContent>
        <TabsContent value="reports" className="p-4">
            <Card className="border-none rounded-3xl shadow-sm bg-white/50">
                <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-sm font-black uppercase">Tactical Shift History</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-border/50">
                            {userReports.length > 0 ? userReports.map(r => (
                                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary"><Clock className="size-4"/></div>
                                        <div>
                                            <p className="font-bold text-sm">{format(r.date.toDate(), 'PPP')}</p>
                                            <Badge variant="outline" className="text-[8px] uppercase font-black">{r.reportType}</Badge>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" asChild className="rounded-full text-[9px] font-black uppercase">
                                        <Link href="/dashboard/reports">View Detailed Log <ExternalLink className="size-3 ml-1.5"/></Link>
                                    </Button>
                                </div>
                            )) : <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase">No Intelligence Records Found</div>}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="compliance" className="p-4"><Card className="border-none rounded-3xl shadow-sm bg-white/50"><CardHeader className="bg-red-500/5 border-b"><CardTitle className="text-sm font-black uppercase text-red-600">Protocol Alerts</CardTitle></CardHeader>
                <CardContent className="p-0"><ScrollArea className="h-[300px]">{complianceData && complianceData.length > 0 ? complianceData.map(c => (
                    <div key={c.id} className="p-6 border-b border-border/50">
                        <Badge className={cn("rounded-full text-[8px] font-black uppercase mb-2", c.severity === 'Critical' ? 'bg-red-600' : 'bg-blue-500')}>{c.severity} ALERT</Badge>
                        <p className="text-xs text-muted-foreground mb-1">Filed by {c.filedByName} • {format(c.timestamp.toDate(), 'PP p')}</p>
                        <p className="text-sm font-medium italic">"{c.reason}"</p>
                    </div>)) : <div className="py-20 text-center opacity-30 text-[10px] font-black">Fleet is operating within parameters.</div>}
                </ScrollArea></CardContent></Card></TabsContent>
        <TabsContent value="identity" className="pt-6 px-4">
            <Card className="border-none rounded-3xl shadow-inner bg-secondary/10">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <h3 className="font-black uppercase text-xs tracking-widest text-primary">Identity Asset Hub</h3>
                    <div className="w-full max-w-sm space-y-6">
                        {user.signatureUrl ? (<div className="p-6 bg-white rounded-3xl border-2 border-dashed relative shadow-sm"><img src={user.signatureUrl} alt="Signature" className="h-20 object-contain grayscale invert mix-blend-multiply opacity-70 w-full" /></div>) : (<div className="aspect-video bg-white rounded-3xl border-2 border-dashed flex flex-col items-center justify-center opacity-50"><p className="text-[10px] font-black uppercase">No Identity Asset</p></div>)}
                        <div className="flex gap-2"><Input value={manualSignatureUrl} onChange={e => setManualSignatureUrl(e.target.value)} placeholder="Sync direct image URL..." className="h-12 rounded-xl" /><Button size="icon" className="h-12 w-12 rounded-xl" onClick={handleManualSignatureSave}><Save className="size-5" /></Button></div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
