'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CalendarClock, Video, Target, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

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
        <Alert className="mb-4 animate-fade-in-up bg-primary/10 border-primary/30 rounded-none ring-1 ring-primary/20 shadow-xl overflow-hidden relative">
            <CalendarClock className="h-5 w-5 text-primary" />
            <AlertTitle className="font-black text-primary uppercase tracking-widest text-sm mb-1">Monthly Review</AlertTitle>
            <AlertDescription className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 leading-relaxed uppercase">
                        It's review day for {format(new Date(), 'MMMM')}. Please join the meeting to talk about your progress.
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                        Update your performance rating once the meeting is over.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button asChild size="sm" variant="outline" className="rounded-none h-9 px-4 font-black uppercase text-[9px] tracking-widest bg-white border-primary/20 text-primary hover:bg-primary/5">
                        <Link href="https://meet.google.com/new" target="_blank">
                            <Video className="size-3.5 mr-2" /> Join Meeting
                        </Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-none h-9 px-4 font-black uppercase text-[9px] tracking-widest shadow-lg shadow-primary/20">
                        <Link href="/dashboard/monthly-review">
                            <Target className="size-3.5 mr-2" /> Select Performance <ArrowRight className="size-3 ml-2" />
                        </Link>
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
