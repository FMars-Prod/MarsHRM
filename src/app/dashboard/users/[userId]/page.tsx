
'use client';

import * as React from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useMemoFirebase, useCollection, useDoc, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { collection, doc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays, differenceInSeconds } from 'date-fns';
import { Grid, ClipboardList, ShieldCheck, MapPin, Camera, CheckCircle2, Clock, Calendar, Coffee, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

type AttendanceRecord = {
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave';
};

type Report = {
    date: Timestamp;
    reportType: string;
};

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userId } = use(params);
  const [isUploading, setIsUploading] = React.useState(false);

  const userDocRef = useMemoFirebase(() => doc(firestore, 'users', userId), [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<any>(userDocRef);

  const attendanceQuery = useMemoFirebase(() => query(
    collection(firestore, `users/${userId}/attendances`),
    orderBy('checkInTime', 'desc'),
    limit(20)
  ), [firestore, userId]);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const reportsQuery = useMemoFirebase(() => query(
    collection(firestore, `users/${userId}/reports`),
    orderBy('date', 'desc'),
    limit(12)
  ), [firestore, userId]);
  const { data: reportsData } = useCollection<Report>(reportsQuery);

  const stats = React.useMemo(() => {
    if (!attendanceData) return { workHours: 0, lateDays: 0, leaves: 0 };
    let totalSec = 0;
    let late = 0;
    attendanceData.forEach(r => {
        if (r.checkInTime && r.checkOutTime) totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate());
        if (r.status === 'late') late++;
    });
    return { workHours: (totalSec / 3600).toFixed(1), lateDays: late, leaves: attendanceData.filter(a => a.status === 'on_leave').length };
  }, [attendanceData]);

  const handleSignatureUpload = async (file: File) => {
    setIsUploading(true);
    try {
        const sigRef = ref(storage, `signatures/${userId}/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(sigRef, file);
        const url = await getDownloadURL(snap.ref);
        updateDocumentNonBlocking(userDocRef, { signatureUrl: url, signatureStatus: 'pending' });
        toast({ title: "Signature Uploaded", description: "Awaiting executive approval." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Upload Failed", description: e.message });
    } finally {
        setIsUploading(false);
    }
  };

  const approveSignature = () => {
      updateDocumentNonBlocking(userDocRef, { signatureStatus: 'approved' });
      toast({ title: "Signature Approved" });
  };

  if (isUserLoading) return <div className="p-10 text-center animate-pulse">Loading Identity...</div>;
  if (!user) return notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 px-4">
        <div className="relative group">
            <div className="size-24 md:size-32 rounded-full ring-2 ring-primary ring-offset-4 overflow-hidden bg-muted flex items-center justify-center">
                {user.avatar ? <span className="text-5xl">{user.avatar}</span> : <AvatarFallback className="text-2xl">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>}
            </div>
        </div>
        
        <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
                <h2 className="text-xl font-bold tracking-tight">{user.firstName} {user.lastName}</h2>
                <div className="flex gap-2">
                    <Badge variant="secondary" className="rounded-full px-4">{user.jobTitle}</Badge>
                    {user.isWfhAllowed && <Badge className="bg-blue-100 text-blue-700 border-none rounded-full">WFH Enabled</Badge>}
                </div>
            </div>

            <div className="flex justify-center md:justify-start gap-8 md:gap-12">
                <div className="text-center md:text-left"><p className="font-black text-lg">{stats.workHours}</p><p className="text-xs text-muted-foreground uppercase font-bold">Hours</p></div>
                <div className="text-center md:text-left"><p className="font-black text-lg">{stats.lateDays}</p><p className="text-xs text-muted-foreground uppercase font-bold">Late</p></div>
                <div className="text-center md:text-left"><p className="font-black text-lg">{stats.leaves}</p><p className="text-xs text-muted-foreground uppercase font-bold">Leaves</p></div>
            </div>

            <div className="space-y-1">
                <p className="font-bold text-sm">{user.department} Department</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"Strategic deployment active since {user.hireDate ? format(new Date(user.hireDate), 'MMM yyyy') : 'N/A'}"</p>
            </div>
        </div>
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="w-full justify-center bg-transparent border-t border-b rounded-none h-12">
            <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-8 flex gap-2"><Grid className="size-4"/> Activity</TabsTrigger>
            <TabsTrigger value="identity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-8 flex gap-2"><ShieldCheck className="size-4"/> Signature</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {reportsData && reportsData.length > 0 ? reportsData.map((r, i) => (
                    <div key={i} className="aspect-square bg-muted/30 relative group overflow-hidden cursor-pointer hover:opacity-90 transition-all">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <FileText className="size-8 text-primary/20 mb-2" />
                            <p className="text-[10px] font-black uppercase text-primary/60">{r.reportType}</p>
                            <p className="text-[9px] font-bold text-muted-foreground">{format(r.date.toDate(), 'MMM d')}</p>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-[10px] font-black uppercase tracking-widest">View Submission</p>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                        <p className="text-sm font-bold uppercase tracking-widest opacity-50">No historical activity found.</p>
                    </div>
                )}
            </div>
        </TabsContent>

        <TabsContent value="identity" className="pt-6">
            <Card className="border-none ring-1 ring-border/50 bg-secondary/10 overflow-hidden">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-black uppercase text-xs tracking-widest text-primary">Digital Identity Verification</h3>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">Upload a high-fidelity image of your signature for automated procedural signing.</p>
                    </div>

                    {user.signatureUrl ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-primary/20 relative group">
                                <Image src={user.signatureUrl} alt="Signature" width={300} height={150} className="object-contain grayscale invert mix-blend-multiply" />
                                <div className="absolute top-2 right-2">
                                    {user.signatureStatus === 'approved' ? (
                                        <Badge className="bg-green-100 text-green-700 border-none rounded-full gap-1.5"><CheckCircle2 className="size-3"/> Approved</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 rounded-full gap-1.5"><Clock className="size-3"/> Pending Approval</Badge>
                                    )}
                                </div>
                            </div>
                            {user.signatureStatus !== 'approved' && (
                                <Button variant="outline" size="sm" className="rounded-full text-[10px] font-black uppercase" onClick={approveSignature}>Approve Signature</Button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="size-48 bg-white rounded-2xl border-2 border-dashed border-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Camera className="size-8 opacity-20" />
                                <p className="text-[10px] font-bold uppercase tracking-tighter">No Signature Found</p>
                            </div>
                            <div className="relative">
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploading} />
                                <Button disabled={isUploading} className="rounded-full h-11 px-8 font-black uppercase text-[10px] tracking-widest">
                                    {isUploading ? "Uploading..." : "Upload Identity Image"}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
