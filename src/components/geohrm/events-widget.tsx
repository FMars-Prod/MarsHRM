
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { PartyPopper, HelpCircle, Gift, Users, Award, Cake, CalendarClock } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore";
import { startOfToday, endOfDay, format, addDays } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";

type IconName = 'Cake' | 'PartyPopper' | 'Users' | 'Gift' | 'Award';

const iconComponents: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {
    Cake, PartyPopper, Users, Gift, Award
};

type EventItem = { 
  id: string;
  name: string; 
  event: string;
  date: Timestamp;
  icon: IconName;
  color: string;
};

export function EventsWidget() {
  const firestore = useFirestore();

  const todayStart = React.useMemo(() => startOfToday(), []);
  const todayEnd = React.useMemo(() => endOfDay(todayStart), [todayStart]);
  
  const todaysEventsQuery = useMemoFirebase(() => 
    query(
        collection(firestore, "events"), 
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "asc")
    ), [firestore, todayStart, todayEnd]);
  
  const upcomingEventsQuery = useMemoFirebase(() => {
    const tomorrow = addDays(todayStart, 1);
    const thirtyDaysFromNow = addDays(todayStart, 30);
    return query(
        collection(firestore, "events"), 
        where("date", ">=", tomorrow),
        where("date", "<=", thirtyDaysFromNow),
        orderBy("date", "asc")
    );
  }, [firestore, todayStart]);
  
  const { data: todaysEvents, isLoading: todaysLoading } = useCollection<EventItem>(todaysEventsQuery);
  const { data: upcomingEvents, isLoading: upcomingLoading } = useCollection<EventItem>(upcomingEventsQuery);

  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || HelpCircle;
    return <IconComponent {...props} />;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    return format(timestamp.toDate(), "MMMM do");
  }

  const isLoading = todaysLoading || upcomingLoading;

  const EventListItem = ({ item }: { item: EventItem }) => (
     <div key={item.id} className="flex items-center gap-4 group transition-all duration-300 hover:translate-x-1">
        <div className="p-2.5 rounded-full transition-colors" style={{ backgroundColor: item.color + '1A' }}>
          {renderIcon(item.icon, { className: "size-4", style: { color: item.color } })}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{item.name}</span>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {item.event} on {formatDate(item.date)}
          </p>
        </div>
      </div>
  );

  return (
    <Card className="h-full flex flex-col animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '500ms' }}>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <PartyPopper className="size-5" />
          Company Events
        </CardTitle>
        <CardDescription>Birthdays and anniversaries.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
         {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                 <div className="space-y-2">
                    <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
                    <div className="h-3 w-32 rounded-md bg-muted animate-pulse" />
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {todaysEvents && todaysEvents.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-[10px] uppercase tracking-wider text-primary/80">Today's Events</h4>
                {todaysEvents.map((item) => <EventListItem key={item.id} item={item} />)}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4 bg-white/30 rounded-lg">
                <p className="text-xs">No events today.</p>
              </div>
            )}
            
            {(todaysEvents && todaysEvents.length > 0 && upcomingEvents && upcomingEvents.length > 0) && <Separator className="bg-primary/10" />}

            {upcomingEvents && upcomingEvents.length > 0 && (
                 <div className="space-y-4">
                    <h4 className="font-semibold text-[10px] uppercase tracking-wider flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-3" /> Upcoming</h4>
                    {upcomingEvents.slice(0, 3).map((item) => <EventListItem key={item.id} item={item} />)}
                </div>
            )}
            
            {(!todaysEvents || todaysEvents.length === 0) && (!upcomingEvents || upcomingEvents.length === 0) && !isLoading && (
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                    <PartyPopper className="size-8 mb-2 opacity-50" />
                    <p className="text-sm">No events scheduled soon.</p>
                </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full bg-white/50" asChild>
          <Link href="/dashboard/events">View All Events</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
