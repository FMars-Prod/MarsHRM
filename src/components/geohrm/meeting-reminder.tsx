
'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, or, and, getDocs } from 'firebase/firestore';
import { format, isAfter, isBefore, addMinutes, differenceInMinutes, endOfMonth, subDays, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BellRing, Video, Clock, AlertTriangle, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

export function MeetingReminder() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const notifiedIds = React.useRef(new Set<string>());
  const monthEndNotified = React.useRef(false);

  const meetingsQuery = useMemoFirebase(() => {
    if (!user) return null;
    const now = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return query(
      collection(firestore, 'meetings'),
      where('participantIds', 'array-contains', user.uid),
      where('date', '>=', Timestamp.fromDate(now)),
      where('date', '<=', Timestamp.fromDate(endOfToday)),
      orderBy('date', 'asc')
    );
  }, [user, firestore]);

  const { data: upcomingMeetings } = useCollection<any>(meetingsQuery);

  const playReminderSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
    } catch (e) {
      console.warn("Sound play failed", e);
    }
  };

  const checkMonthEndMeeting = React.useCallback(async () => {
      const now = new Date();
      const monthEnd = endOfMonth(now);
      const diff = differenceInMinutes(monthEnd, now);
      
      // If within 3 days of month end
      if (diff <= 4320 && !monthEndNotified.current) {
          const q = query(
              collection(firestore, 'meetings'),
              where('date', '>=', Timestamp.fromDate(subDays(monthEnd, 2))),
              where('date', '<=', Timestamp.fromDate(monthEnd))
          );
          const snap = await getDocs(q);
          const hasSync = snap.docs.some(d => {
              const t = d.data().title.toLowerCase();
              return t.includes('sync') || t.includes('review') || t.includes('monthly');
          });

          if (!hasSync) {
              monthEndNotified.current = true;
              toast({
                  title: "Month-End Alert",
                  description: "Tactical sync required. No monthly review briefing detected in the roster.",
                  variant: "destructive",
              });
          }
      }
  }, [firestore, toast]);

  React.useEffect(() => {
    const checkMeetings = () => {
      if (!upcomingMeetings) return;

      const now = new Date();
      upcomingMeetings.forEach((m: any) => {
        const meetingDate = m.date.toDate();
        const diff = differenceInMinutes(meetingDate, now);
        
        // Reminder slots: 30 mins, 10 mins
        const slots = [30, 10];
        
        slots.forEach(slot => {
            const reminderKey = `${m.id}-${slot}`;
            if (diff <= slot && diff > (slot - 1) && !notifiedIds.current.has(reminderKey)) {
                notifiedIds.current.add(reminderKey);
                playReminderSound();
                toast({
                    title: `Starts in ${slot}m`,
                    description: `${m.title} @ ${format(meetingDate, 'p')}.`,
                    action: m.link ? (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase rounded-none border-primary text-primary" onClick={() => window.open(m.link, '_blank')}>
                            Join Now
                        </Button>
                    ) : undefined
                });
            }
        });
      });
    };

    const interval = setInterval(() => {
        checkMeetings();
        checkMonthEndMeeting();
    }, 30000); // Check every 30s
    checkMeetings();
    checkMonthEndMeeting();
    return () => clearInterval(interval);
  }, [upcomingMeetings, toast, checkMonthEndMeeting]);

  return null;
}
