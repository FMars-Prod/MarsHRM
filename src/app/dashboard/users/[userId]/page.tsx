
'use client';

import * as React from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, updateDocumentNonBlocking, useStorage, useUser } from '@/firebase';
import { collection, query, doc, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, startOfToday, isSameDay, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Grid, ShieldCheck, MapPin, Camera, CheckCircle2, Clock, Calendar as CalendarIcon, FileText, ShieldAlert, Briefcase, Info, AlertTriangle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const storage = useStorage();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  
  const [isUploading, setIsUploading] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(new Date()));

  const userDocRef = useMemoFirebase(() => (userId ? doc(firestore, 'users', userId) : null), [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<any>(userDocRef);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const attendanceQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/attendances`), orderBy('checkInTime', 'desc')) : null, [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const reportsQuery = useMemoFirebase(() => userId ? query(collection(firestore, `users/${userId}/reports`), orderBy('date', 'desc'), limit(30)) : null, [firestore, userId]);
  const { data: reportsData } = useCollection<Report>(reportsQuery);

  const complianceQuery = useMemoFirebase(() => userId ? query(collection(firestore, 'compliance_reports'), where('employeeId', '==', userId), orderBy('timestamp', 'desc')) : null, [firestore, userId]);
  const { data: complianceData } = useCollection<ComplianceReport>(complianceQuery);

  const stats = React.useMemo(() => {
    if (!attendanceData) return { workHours: 0, lateDays: 0, leaves: 0, compliance: 0 };
    let totalSec = 0;
    let late = 0;
    attendanceData.forEach(r => {
        if (r.checkInTime && r.checkOutTime) totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate());
        if (r.status === 'late') late++;
    });
    return { workHours: (totalSec / 3600).toFixed(1), lateDays: late, leaves: attendanceData.filter(a => a.status === 'on_leave').length, compliance: complianceData?.length || 0 };
  }, [attendanceData, complianceData]);

  const modifiers = React.useMemo(() => {
    const mods: Record<string, any> = { present: [], late: [], absent: [], on_leave: [], report: [], sunday: { dayOfWeek: [0] } };
    attendanceData?.forEach(event => { if (event.checkInTime && mods[event.status]) mods[event.status].push(event.checkInTime.toDate()); });
    reportsData?.forEach(report => { if (report.date) mods.report.push(report.date.toDate()); });
    return mods;
  }, [attendanceData, reportsData]);

  const handleSignatureUpload = async (file: File) => {
    if (!userId) return;
    setIsUploading(true);
    try {
        const sigRef = ref(storage, `signatures/${userId}/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(sigRef, file);
        const url = await getDownloadURL(snap.ref);
        updateDocumentNonBlocking(userDocRef!, { signatureUrl: url, signatureStatus: 'pending' });
        toast({ title: "Asset Uploaded", description: "Awaiting leadership audit." });
    } catch (e: any) { toast({ variant: 'destructive', title: "Bucket Error", description: "Initialize Storage in console." }); } finally { setIsUploading(false); }
  };

  if (isUserLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Syncing Satellite Profile...</div>;
  if (!user) return notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20">
      <div className="flex flex-col md:flex-row items-center gap-8 px-6 pt-6">
        <div className="size-20 md:size-24 rounded-full ring-2 ring-primary ring-offset-4 overflow-hidden bg-muted flex items-center justify-center shadow-lg">
            {user.avatar ? <span className="text-5xl">{user.avatar}</span> : <AvatarFallback className="text-2xl">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>}
        </div>
        <div className="flex-1 flex flex-col items-center md:items-start gap-4">
            <div className="flex flex-col md:flex-row items-center gap-3"><h2 className="text-2xl font-black tracking-tighter">{user.firstName} {user.lastName}</h2><div className="flex gap-1.5"><Badge variant="secondary" className="rounded-full px-3 text-[9px] uppercase font-black tracking-widest">{user.jobTitle}</Badge>{user.isWfhAllowed && <Badge className="bg-blue-100 text-blue-700 border-none rounded-full text-[9px] uppercase font-black tracking-widest">WFH Authorized</Badge>}</div></div>
            <div className="flex justify-center md:justify-start gap-8 md:gap-12 w-full max-w-sm border-t border-b py-3 md:border-none md:p-0">
                <div className="text-center"><p className="font-black text-xl">{stats.workHours}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Hours</p></div>
                <div className="text-center"><p className="font-black text-xl">{stats.lateDays}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Late Ops</p></div>
                <div className="text-center"><p className="font-black text-xl">{stats.leaves}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Leaves</p></div>
                <div className="text-center"><p className="font-black text-xl text-red-600">{stats.compliance}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Alerts</p></div>
            </div>
            <div className="text-center md:text-left space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm font-bold"><Briefcase className="size-4 text-primary" /><span>{user.department} Department</span></div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest"><CalendarIcon className="size-3" /><span>Member Since: {user.hireDate ? format(new Date(user.hireDate), 'MMM yyyy') : 'N/A'}</span></div>
            </div>
        </div>
      </div>
      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="w-full justify-center bg-transparent border-t border-b rounded-none h-14">
            <TabsTrigger value="grid" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><Grid className="size-4"/> Feed</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><CalendarIcon className="size-4"/> Ops Log</TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><ShieldAlert className="size-4"/> Alerts</TabsTrigger>
            <TabsTrigger value="identity" className="rounded-none px-6 flex gap-2 font-black uppercase text-[10px] tracking-widest"><ShieldCheck className="size-4"/> Identity</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="pt-1"><div className="grid grid-cols-3 gap-1">
                {reportsData && reportsData.length > 0 ? reportsData.map((r, i) => (
                    <div key={i} className="aspect-square bg-secondary/10 relative group overflow-hidden cursor-pointer hover:opacity-90 border border-background">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center"><FileText className="size-8 text-primary/10 mb-2" /><p className="text-[9px] font-black uppercase text-primary/60">{r.reportType} Strat</p><p className="text-[8px] font-bold text-muted-foreground">{format(r.date.toDate(), 'MMM d')}</p></div>
                    </div>
                )) : <div className="col-span-full py-20 text-center opacity-30 text-[10px] font-black uppercase">No report history.</div>}
            </div></TabsContent>
        <TabsContent value="calendar" className="p-4"><Card className="border-none rounded-3xl overflow-hidden shadow-sm bg-white/50"><CardHeader className="bg-muted/10 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest">Ops Verification Grid</CardTitle></CardHeader>
                <CardContent className="p-4 flex flex-col md:flex-row gap-8 items-center justify-center">
                    <Calendar mode="single" month={currentMonth} onMonthChange={setCurrentMonth} className="rounded-2xl border p-4 shadow-inner" modifiers={modifiers} modifiersClassNames={{
                        present: 'bg-green-500/20 text-green-700 font-black',
                        late: 'bg-yellow-500/20 text-yellow-700 font-black',
                        on_leave: 'bg-blue-500/20 text-blue-700 font-black',
                        report: 'after:content-["•"] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:text-primary after:font-black',
                        sunday: 'opacity-20 bg-muted/20',
                    }} />
                    <div className="space-y-4 w-full max-w-xs">
                        <div className="grid gap-2">{['Present', 'Late', 'On Leave'].map(s => (<div key={s} className="flex justify-between p-3 rounded-xl border text-[10px] font-black uppercase">{s}<div className={cn("size-2 rounded-full", s==='Present' ? 'bg-green-500' : s==='Late' ? 'bg-yellow-500' : 'bg-blue-500')} /></div>))}</div>
                    </div>
                </CardContent></Card></TabsContent>
        <TabsContent value="compliance" className="p-4"><Card className="border-none rounded-3xl shadow-sm bg-white/50"><CardHeader className="bg-red-500/5 border-b"><CardTitle className="text-sm font-black uppercase text-red-600">Protocol Alerts</CardTitle></CardHeader>
                <CardContent className="p-0"><ScrollArea className="h-[300px]">{complianceData && complianceData.length > 0 ? complianceData.map(c => (
                    <div key={c.id} className="p-6 border-b border-border/50 hover:bg-muted/10">
                        <Badge className={cn("rounded-full text-[8px] font-black uppercase mb-2", c.severity === 'Critical' ? 'bg-red-600' : 'bg-blue-500')}>{c.severity} ALERT</Badge>
                        <p className="text-xs text-muted-foreground mb-1">Filed by {c.filedByName} • {format(c.timestamp.toDate(), 'PP p')}</p>
                        <p className="text-sm font-medium italic">"{c.reason}"</p>
                    </div>)) : <div className="py-20 text-center opacity-30 text-[10px] font-black">All standards maintained.</div>}
                </ScrollArea></CardContent></Card></TabsContent>
        <TabsContent value="identity" className="pt-6 px-4"><Card className="border-none rounded-3xl shadow-inner bg-secondary/10"><CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <h3 className="font-black uppercase text-xs tracking-widest text-primary">Identity Asset Verification</h3>
                    {user.signatureUrl ? (
                        <div className="space-y-6 w-full max-w-sm"><div className="p-6 bg-white rounded-3xl border-2 border-dashed border-primary/20 relative shadow-sm"><Image src={user.signatureUrl} alt="Signature" width={400} height={200} className="object-contain grayscale invert mix-blend-multiply opacity-70" /><div className="absolute top-4 right-4">{user.signatureStatus === 'approved' ? <Badge className="bg-green-100 text-green-700 uppercase text-[8px] font-black">Verified</Badge> : <Badge variant="outline" className="bg-yellow-50 text-yellow-700 uppercase text-[8px] font-black">Pending Audit</Badge>}</div></div>
                            {user.signatureStatus !== 'approved' && isAdmin && <Button className="w-full rounded-full h-12 font-black uppercase" onClick={() => updateDocumentNonBlocking(userDocRef!, { signatureStatus: 'approved' })}>Confirm Integrity</Button>}
                        </div>) : (<div className="w-full max-w-sm space-y-6"><div className="aspect-video bg-white rounded-3xl border-2 border-dashed flex flex-col items-center justify-center opacity-50"><Camera className="size-10 mb-2"/><p className="text-[10px] font-black uppercase">Identity Slot Empty</p></div><div className="relative"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploading} /><Button disabled={isUploading} className="w-full rounded-full h-12 font-black uppercase">{isUploading ? 'Transmitting...' : 'Upload Asset'}</Button></div></div>)}
                </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
