'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, isAfter, isBefore, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { Video, Clock, CheckCircle2, Activity, Timer } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Dashboard component that displays the status of the current or next meeting.
 * Features an "iOS-inspired" mild tone and real-time status transitions.
 */
export function MeetingStatusBanner() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [now, setNow] = React.useState(new Date());

    // Update internal clock frequently for smooth transitions
    React.useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(interval);
    }, []);

    const meetingsQuery = useMemoFirebase(() => {
        if (!user) return null;
        const start = startOfDay(new Date());
        const end = endOfDay(new Date());
        return query(
            collection(firestore, 'meetings'),
            where('participantIds', 'array-contains', user.uid),
            where('date', '>=', Timestamp.fromDate(start)),
            where('date', '<=', Timestamp.fromDate(end)),
            orderBy('date', 'asc')
        );
    }, [user, firestore]);

    const { data: todaysMeetings } = useCollection<any>(meetingsQuery);

    const activeMeeting = React.useMemo(() => {
        if (!todaysMeetings) return null;

        for (const m of todaysMeetings) {
            const meetingDate = m.date.toDate();
            const meetingEnd = addMinutes(meetingDate, 60); // Standard assumed 1hr duration
            const diff = differenceInMinutes(meetingDate, now);

            // 1. Ongoing: Meeting started and hasn't reached the 1hr mark yet
            if (isBefore(meetingDate, now) && isAfter(meetingEnd, now)) {
                return { ...m, status: 'ongoing' };
            }
            // 2. Upcoming: Starts within the next 30 minutes
            if (diff > 0 && diff <= 30) {
                return { ...m, status: 'upcoming', diff };
            }
            // 3. Recently Over: Show "Meeting Over" for 10 minutes after expected end
            if (isAfter(now, meetingEnd) && isBefore(now, addMinutes(meetingEnd, 10))) {
                return { ...m, status: 'completed' };
            }
        }
        return null;
    }, [todaysMeetings, now]);

    if (!activeMeeting) return null;

    const config = {
        ongoing: {
            bg: "bg-emerald-50 border-emerald-200 ring-emerald-50 shadow-emerald-500/5",
            text: "text-emerald-900",
            icon: <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />,
            label: "Meeting Ongoing",
            desc: "The session is currently active. Join now to participate.",
            btn: "bg-emerald-600 hover:bg-emerald-700 text-white"
        },
        upcoming: {
            bg: "bg-indigo-50 border-indigo-200 ring-indigo-50 shadow-indigo-500/5",
            text: "text-indigo-900",
            icon: <Timer className="h-4 w-4 text-indigo-600" />,
            label: "Upcoming Meeting",
            desc: `Starts in ${activeMeeting.diff} minutes. Prepare for briefing.`,
            btn: "bg-indigo-600 hover:bg-indigo-700 text-white"
        },
        completed: {
            bg: "bg-slate-50 border-slate-300 ring-slate-50 opacity-80",
            text: "text-slate-700",
            icon: <CheckCircle2 className="h-4 w-4 text-slate-500" />,
            label: "Meeting Over",
            desc: "The session has concluded successfully.",
            btn: null
        }
    }[activeMeeting.status as 'ongoing' | 'upcoming' | 'completed'];

    return (
        <Alert className={cn("mb-4 animate-fade-in-up rounded-none ring-1 shadow-md transition-all duration-500", config.bg)}>
            {config.icon}
            <AlertTitle className={cn("font-black uppercase tracking-widest text-[10px] mb-1", config.text)}>
                {config.label}
            </AlertTitle>
            <AlertDescription className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-0.5 text-left">
                    <p className={cn("text-sm font-black uppercase tracking-tight", config.text)}>
                        {activeMeeting.title}
                    </p>
                    <p className={cn("text-[10px] font-bold uppercase opacity-60", config.text)}>
                        {config.desc}
                    </p>
                </div>
                {activeMeeting.link && activeMeeting.status !== 'completed' && (
                    <Button 
                        size="sm" 
                        className={cn("rounded-none h-8 px-6 font-black uppercase text-[9px] tracking-widest shadow-lg transition-transform active:scale-95", config.btn)}
                        onClick={() => window.open(activeMeeting.link, '_blank')}
                    >
                        <Video className="size-3 mr-2" /> Join Session
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
}
