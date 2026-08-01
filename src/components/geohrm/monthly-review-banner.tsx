'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CalendarClock, Video, Target, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { format, isSameDay, startOfMonth } from 'date-fns';

export function MonthlyReviewBanner() {
    const [shouldShow, setShouldShow] = React.useState(false);

    React.useEffect(() => {
        // Trigger only on the 1st of the month
        const today = new Date();
        if (today.getDate() === 1) {
            setShouldShow(true);
        }
    }, []);

    if (!shouldShow) return null;

    return (
        <Alert className="mb-6 animate-fade-in-up bg-primary/10 border-primary/30 rounded-none ring-2 ring-primary/20 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 p-1 bg-primary text-white text-[7px] font-black uppercase tracking-[0.2em] shadow-sm">
                Protocol: Monthly Sync
            </div>
            <CalendarClock className="h-5 w-5 text-primary" />
            <AlertTitle className="font-black text-primary uppercase tracking-widest text-sm mb-2">Monthly Review Initiation</AlertTitle>
            <AlertDescription className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 leading-relaxed uppercase">
                        Today marks the start of the {format(new Date(), 'MMMM')} performance audit. 
                        Please join the mandatory sync to review mission objectives.
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight italic">
                        After the meeting, use the portal below to finalize your performance stamping.
                    </p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <Button asChild size="sm" variant="outline" className="rounded-none h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-white border-2 border-primary/20 text-primary hover:bg-primary/5">
                        <Link href="https://meet.google.com/new" target="_blank">
                            <Video className="size-3.5 mr-2" /> Join Meeting
                        </Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-none h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                        <Link href="/dashboard/monthly-review">
                            <Target className="size-3.5 mr-2" /> Review Performance <ArrowRight className="size-3 ml-2" />
                        </Link>
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
