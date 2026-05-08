
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, differenceInSeconds } from 'date-fns';
import { User, UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, Download, AlertTriangle, Share2, FileText, Phone, Building2, Utensils, LogIn } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string;
  avatar?: string;
};

export default function MonitorPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = React.useState<Date>(new Date());
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    outOfRange: [] as UserData[],
    lunchOut: [] as UserData[],
    noLunch: [] as UserData[],
    isLoading: true,
  });

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<UserData>(usersQuery);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
      if (!users || !firestore) return;
      setSummary(prev => ({ ...prev, isLoading: true }));
      try {
        const start = startOfDay(date);
        const end = endOfDay(date);
        const attSnap = await getDocs(query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', start), where('checkInTime', '<=', end)));
        const attMap = new Map();
        attSnap.docs.forEach(d => attMap.set(d.data().employeeId, d.data()));

        const present: UserData[] = [], late: UserData[] = [], outOfRange: UserData[] = [], lunchOut: UserData[] = [], noLunch: UserData[] = [], absent: UserData[] = [];

        users.forEach(u => {
            const att = attMap.get(u.id);
            if (att) {
                if (att.isOutOfRange) outOfRange.push(u);
                else if (att.status === 'late') late.push(u);
                else present.push(u);

                if (att.locationLunchOutLatitude && !att.locationLunchInLatitude) lunchOut.push(u);
                if (!att.locationLunchOutLatitude) noLunch.push(u);
            } else absent.push(u);
        });

        setSummary({ late, absent, onLeave: [], present, outOfRange, lunchOut, noLunch, isLoading: false });
      } catch (e) {
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };
    fetchMonitorData();
  }, [users, date, firestore]);

  const MonitorCard = ({ title, users, icon: Icon, color, nudgeType }: any) => (
    <Sheet>
        <SheetTrigger asChild>
            <Card className="cursor-pointer hover:bg-muted/50 transition-all border-none ring-1 ring-border/50">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", color)}><Icon className="size-5" /></div>
                        <span className="text-sm font-bold uppercase tracking-tight">{title}</span>
                    </div>
                    <span className="text-xl font-black">{users.length}</span>
                </CardHeader>
            </Card>
        </SheetTrigger>
        <SheetContent>
            <SheetHeader><SheetTitle>{title} ({users.length})</SheetTitle></SheetHeader>
            <ScrollArea className="h-full mt-4">
                <div className="space-y-3">
                    {users.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted">
                            <div className="flex items-center gap-3">
                                <Avatar className="size-8"><AvatarFallback>{u.firstName?.[0]}</AvatarFallback></Avatar>
                                <div><p className="text-xs font-bold">{u.firstName} {u.lastName}</p><p className="text-[10px] text-muted-foreground">{u.jobTitle}</p></div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => window.open(`https://wa.me/${u.phoneNumber?.replace(/\D/g,'')}?text=Shift Alert: Please check your status.`, '_blank')}>
                                <Phone className="size-4 text-green-600" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Real-Time Oversight" description="Tactical monitor with WhatsApp nudge integration.">
        <Popover>
            <PopoverTrigger asChild><Button variant="outline" className="rounded-full"><CalendarIcon className="size-4 mr-2" /> {format(date, 'PP')}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
        </Popover>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MonitorCard title="Present" users={summary.present} icon={UserCheck} color="bg-green-100 text-green-700" />
        <MonitorCard title="Late" users={summary.late} icon={UserX} color="bg-yellow-100 text-yellow-700" />
        <MonitorCard title="Out of Range" users={summary.outOfRange} icon={AlertTriangle} color="bg-orange-100 text-orange-700" />
        <MonitorCard title="Absent" users={summary.absent} icon={UserRoundX} color="bg-red-100 text-red-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MonitorCard title="L-OUT (Active)" users={summary.lunchOut} icon={Utensils} color="bg-blue-100 text-blue-700" />
        <MonitorCard title="No Lunch Logged" users={summary.noLunch} icon={LogIn} color="bg-slate-100 text-slate-700" />
      </div>
    </div>
  );
}
