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
import { PartyPopper, Cake, Gift, Users, Award, CalendarClock, ChevronRight, Sparkles } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore";
import { startOfToday, endOfDay, format, addDays } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const { user } = useUser();

  const todayStart = React.useMemo(() => startOfToday(), []);
  const todayEnd = React.useMemo(() => endOfDay(todayStart), [todayStart]);
  
  const todaysEventsQuery = useMemoFirebase(() => 
    user ? query(
        collection(firestore, "events"), 
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "asc")
    ) : null, [firestore, todayStart, todayEnd, user]);
  
  const upcomingEventsQuery = useMemoFirebase(() => {
    if (!user) return null;
    const tomorrow = addDays(todayStart, 1);
    const thirtyDaysFromNow = addDays(todayStart, 30);
    return query(
        collection(firestore, "events"), 
        where("date", ">=", tomorrow),
        where("date", "<=", thirtyDaysFromNow),
        orderBy("date", "asc")
    );
  }, [firestore, todayStart, user]);
  
  const { data: todaysEvents, isLoading: todaysLoading } = useCollection<EventItem>(todaysEventsQuery);
  const { data: upcomingEvents, isLoading: upcomingLoading } = useCollection<EventItem>(upcomingEventsQuery);

  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || PartyPopper;
    return <IconComponent {...props} />;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    return format(timestamp.toDate(), "MMM do");
  }

  const EventListItem = ({ item, isToday }: { item: EventItem; isToday?: boolean }) => (
     <div key={item.id} className={cn(
        "group flex items-center justify-between p-2.5 rounded-none transition-all duration-200",
        isToday ? "bg-primary/5" : "hover:bg-muted/30"
     )}>
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-none" style={{ backgroundColor: item.color + '1A' }}>
                {renderIcon(item.icon, { className: "size-3.5", style: { color: item.color } })}
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-xs uppercase tracking-tight">{item.name}</span>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">
                    {item.event} {isToday ? "Today!" : `on ${formatDate(item.date)}`}
                </p>
            </div>
        </div>
        {!isToday && <span className="text-[8px] font-black uppercase text-muted-foreground opacity-40">{formatDate(item.date)}</span>}
        {isToday && <Sparkles className="size-3 text-primary animate-pulse" />}
      </div>
  );

  return (
    <Card className="h-full flex flex-col animate-fade-in-up border-none shadow-sm rounded-none bg-white overflow-hidden">
      <CardHeader className="p-6 pb-2">
        <div className="flex items-center justify-between">
            <div className="space-y-0.5">
                <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                    <PartyPopper className="size-4" /> Company Events
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Birthdays & anniversaries</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2 flex-1">
         {todaysLoading || upcomingLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="h-10 rounded-none bg-muted animate-pulse" />))}</div>
        ) : (
          <ScrollArea className="h-full pr-3 -mr-3">
            <div className="space-y-4">
              {todaysEvents && todaysEvents.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-accent uppercase tracking-widest">Today</span>
                  {todaysEvents.map((item) => <EventListItem key={item.id} item={item} isToday />)}
                </div>
              )}
              {upcomingEvents && upcomingEvents.length > 0 && (
                 <div className="space-y-2">
                    <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest">Upcoming</span>
                    {upcomingEvents.slice(0, 5).map((item) => <EventListItem key={item.id} item={item} />)}
                </div>
              )}
              {(!todaysEvents?.length && !upcomingEvents?.length) && (
                 <div className="flex flex-col items-center justify-center text-center py-10 opacity-20">
                    <CalendarClock className="size-8 mb-2" />
                    <p className="font-black uppercase text-[9px] tracking-widest">No events</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter className="p-6 pt-0 mt-auto">
        <Button variant="outline" className="w-full rounded-none h-9 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50" asChild>
          <Link href="/dashboard/events">View All <ChevronRight className="size-3 ml-1.5 opacity-50" /></Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
