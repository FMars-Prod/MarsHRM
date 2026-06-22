
'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, or } from 'firebase/firestore';
import { format, isAfter, isBefore, addMinutes, differenceInMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BellRing, Video, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeetingReminder() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const notifiedIds = React.useRef(new Set<string>());

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
                    title: `Meeting in ${slot} Minutes`,
                    description: `${m.title} starts at ${format(meetingDate, 'p')}.`,
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

    const interval = setInterval(checkMeetings, 30000); // Check every 30s
    checkMeetings();
    return () => clearInterval(interval);
  }, [upcomingMeetings, toast]);

  return null;
}
