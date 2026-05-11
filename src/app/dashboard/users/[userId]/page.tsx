'use client';

import * as React from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, startOfMonth } from 'date-fns';
import { Grid, ShieldCheck, Calendar as CalendarIcon, FileText, ShieldAlert, Briefcase, Download, Save, ExternalLink, Clock, Users, MapPin, CalendarDays } from 'lucide-react';
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
import Link from "next/link";

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
    if (!attendanceData) return { workHours: 0, lateDays: 0, leaves: 0, reports: 0 };
    let totalSec = 0;
    let late = 0;
    attendanceData.forEach(r => {
        if (r.checkInTime instanceof Timestamp && r.checkOutTime instanceof Timestamp) {
            totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate());
        }
        if (r.status === 'late') late++;
    });
    return { 
        workHours: (totalSec / 3600).toFixed(1), 
        lateDays: late, 
        leaves: attendanceData.filter(a => a.status === 'on_leave').length, 
        reports: userReports.length 
    };
  }, [attendanceData, userReports]);

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
        body: [
            ['Work Hours', `${stats.workHours}h`], 
            ['Late Logs', stats.lateDays], 
            ['Leaves', stats.leaves], 
            ['Total Reports', stats.reports]
        ],
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });
    pdfDoc.save(`Audit_${user.firstName}_${user.lastName}.pdf`);
  };

  React.useEffect(() => { if (user?.signatureUrl) setManualSignatureUrl(user.signatureUrl); }, [user]);

  if (isUserLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Syncing Satellite Profile...</div>;
  if (!user) return notFound();

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up pb-20">
      {/* Instagram Header Style */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 px-6 py-10">
        <div className="relative group">
          <div className="size-24 md:size-36 rounded-full ring-4 ring-primary/20 ring-offset-4 overflow-hidden bg-muted flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-105">
              {user.avatar ? <span className="text-6xl md:text-8xl">{user.avatar}</span> : <AvatarFallback className="text-4xl">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <h2 className="text-2xl font-light tracking-tight text-foreground/90">{user.firstName} {user.lastName}</h2>
            <div className="flex gap-2">
              {isAdmin && (
                <Button onClick={handleExportPdf} size="sm" variant="outline" className="h-8 rounded-lg font-bold text-[11px] px-4 bg-white/50 backdrop-blur-sm">
                  Audit Log PDF
                </Button>
              )}
              {teamData && (
                <Badge variant="secondary" className="rounded-lg px-3 text-[10px] uppercase font-black tracking-widest bg-muted/50 border-none">
                  <Users className="size-3 mr-1.5 opacity-50" /> {teamData.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-8 md:gap-12 py-1">
            <div className="text-center md:text-left">
              <p className="font-black text-lg">{stats.reports}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Reports</p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-black text-lg">{stats.workHours}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Hours</p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-black text-lg">{stats.lateDays}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Late Ops</p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-black text-lg">{stats.leaves}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Leaves</p>
            </div>
          </div>

          <div className="text-center md:text-left space-y-1">
            <p className="font-bold text-sm">{user.jobTitle}</p>
            <p className="text-sm text-muted-foreground">{user.department} Department</p>
            {user.hireDate && (
                <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1 pt-2">
                    <CalendarDays className="size-3" /> Joined {format(new Date(user.hireDate), 'MMMM yyyy')}
                </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full justify-center bg-transparent border-none rounded-none h-14 space-x-12">
            <TabsTrigger value="calendar" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                <Grid className="size-4"/> Ops Grid
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                <FileText className="size-4"/> Intelligence
            </TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                <ShieldAlert className="size-4"/> Alerts
            </TabsTrigger>
            <TabsTrigger value="identity" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                <ShieldCheck className="size-4"/> Identity
            </TabsTrigger>
        </TabsList>

        <div className="pt-4 px-4 md:px-0">
            <TabsContent value="calendar" className="mt-0">
                <Card className="border-none rounded-3xl overflow-hidden shadow-sm bg-white/30 backdrop-blur-sm">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Fleet Verification Calendar</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col md:flex-row gap-8 items-center justify-center">
                        <Calendar 
                            mode="single" 
                            month={currentMonth} 
                            onMonthChange={setCurrentMonth} 
                            className="rounded-2xl border p-4 shadow-inner bg-white/50" 
                            modifiers={modifiers} 
                            modifiersClassNames={{
                                present: 'bg-green-500/20 text-green-700 font-black',
                                late: 'bg-yellow-500/20 text-yellow-700 font-black',
                                on_leave: 'bg-blue-500/20 text-blue-700 font-black',
                                report: 'after:content-["•"] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:text-primary after:font-black',
                                sunday: 'opacity-20 bg-muted/20',
                            }} 
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="reports" className="mt-0">
                <Card className="border-none rounded-3xl shadow-sm bg-white/30 backdrop-blur-sm">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-[10px] font-black uppercase opacity-60">Tactical Shift Intelligence</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[450px]">
                            <div className="divide-y divide-border/30">
                                {userReports.length > 0 ? userReports.map(r => (
                                    <div key={r.id} className="p-5 flex items-center justify-between hover:bg-muted/20 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                <Clock className="size-5"/>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{format(r.date.toDate(), 'PPP')}</p>
                                                <Badge variant="outline" className="text-[8px] uppercase font-black tracking-widest mt-0.5">{r.reportType} LOG</Badge>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild className="rounded-full text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href="/dashboard/reports">View Details <ExternalLink className="size-3 ml-1.5"/></Link>
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                                        <FileText className="size-12" />
                                        <p className="text-[10px] font-black uppercase">No Intelligence Records</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="compliance" className="mt-0">
                <Card className="border-none rounded-3xl shadow-sm bg-white/30 backdrop-blur-sm">
                    <CardHeader className="bg-red-500/5 border-b">
                        <CardTitle className="text-[10px] font-black uppercase text-red-600/60">Fleet Protocol Discrepancies</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            {complianceData && complianceData.length > 0 ? complianceData.map(c => (
                                <div key={c.id} className="p-6 border-b border-border/30 last:border-none">
                                    <Badge className={cn("rounded-full text-[8px] font-black uppercase mb-3", c.severity === 'Critical' ? 'bg-red-600' : 'bg-blue-500')}>
                                        {c.severity} ALERT
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mb-1 font-medium">Filed by {c.filedByName} • {format(c.timestamp.toDate(), 'PP p')}</p>
                                    <p className="text-sm font-medium italic text-foreground/80 leading-relaxed">"{c.reason}"</p>
                                </div>
                            )) : (
                                <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                                    <ShieldCheck className="size-12" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Operating within parameters</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="identity" className="mt-0">
                <Card className="border-none rounded-3xl shadow-inner bg-secondary/10">
                    <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
                        <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-primary/60">Identity Asset Repository</h3>
                        <div className="w-full max-w-sm space-y-8">
                            {user.signatureUrl ? (
                                <div className="p-8 bg-white/80 rounded-3xl border-2 border-dashed border-primary/20 relative shadow-sm group">
                                    <img src={user.signatureUrl} alt="Signature" className="h-24 object-contain grayscale invert mix-blend-multiply opacity-70 w-full" />
                                    <div className="absolute top-2 right-2">
                                        <Badge className="bg-green-100 text-green-700 text-[8px] uppercase font-black border-none">Verified</Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="aspect-video bg-white/40 rounded-3xl border-2 border-dashed border-muted/50 flex flex-col items-center justify-center opacity-40">
                                    <MapPin className="size-8 mb-2 opacity-50" />
                                    <p className="text-[10px] font-black uppercase">Identity asset missing</p>
                                </div>
                            )}
                            {isAdmin && (
                                <div className="flex gap-2 p-1 bg-white rounded-2xl ring-1 ring-border shadow-sm">
                                    <Input 
                                        value={manualSignatureUrl} 
                                        onChange={e => setManualSignatureUrl(e.target.value)} 
                                        placeholder="Synchronize Asset URL..." 
                                        className="h-12 border-none focus-visible:ring-0 shadow-none text-xs" 
                                    />
                                    <Button size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleManualSignatureSave}>
                                        <Save className="size-5" />
                                    </Button>
                                </div>
                            )}
                            <p className="text-[9px] text-muted-foreground italic max-w-xs mx-auto">
                                Identity assets are cross-referenced during strategic shift certifications.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
