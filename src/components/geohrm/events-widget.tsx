
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

  const isLoading = todaysLoading || upcomingLoading;

  const EventListItem = ({ item, isToday }: { item: EventItem; isToday?: boolean }) => (
     <div key={item.id} className={cn(
        "group flex items-center justify-between p-3 rounded-2xl transition-all duration-300 hover:shadow-md border border-transparent hover:border-border/50",
        isToday ? "bg-primary/5 hover:bg-primary/10" : "bg-white hover:bg-muted/30"
     )}>
        <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: item.color + '1A' }}>
                {renderIcon(item.icon, { className: "size-4", style: { color: item.color } })}
            </div>
            <div className="flex flex-col">
                <span className="font-black text-xs uppercase tracking-tight text-foreground/80">{item.name}</span>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {item.event} {isToday ? "Today!" : `on ${formatDate(item.date)}`}
                </p>
            </div>
        </div>
        {!isToday && (
            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-2 py-0 border-none bg-muted/20">
                {formatDate(item.date)}
            </Badge>
        )}
        {isToday && (
            <Sparkles className="size-3 text-primary animate-pulse" />
        )}
      </div>
  );

  return (
    <Card className="h-full flex flex-col animate-fade-in-up border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden font-open-sans" style={{ animationDelay: '600ms' }}>
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                    <PartyPopper className="size-5" /> Fleet Celebrations
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Birthdays & anniversaries</CardDescription>
            </div>
            {todaysEvents && todaysEvents.length > 0 && (
                <Badge className="bg-accent text-white font-black text-[9px] rounded-full px-2.5 py-0.5 animate-bounce">
                    CELEBRATING
                </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 flex-1">
         {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                 <div className="space-y-2">
                    <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
                    <div className="h-2 w-32 rounded-md bg-muted animate-pulse" />
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="h-full pr-4 -mr-4">
            <div className="space-y-6">
              {todaysEvents && todaysEvents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black text-accent tracking-[0.2em] uppercase">Today's Spotlight</span>
                    <Separator className="flex-1 opacity-20" />
                  </div>
                  {todaysEvents.map((item) => <EventListItem key={item.id} item={item} isToday />)}
                </div>
              )}

              {upcomingEvents && upcomingEvents.length > 0 && (
                 <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black text-muted-foreground/50 tracking-[0.2em] uppercase">Upcoming Fleet Events</span>
                        <Separator className="flex-1 opacity-20" />
                    </div>
                    {upcomingEvents.slice(0, 5).map((item) => <EventListItem key={item.id} item={item} />)}
                </div>
              )}
              
              {(!todaysEvents || todaysEvents.length === 0) && (!upcomingEvents || upcomingEvents.length === 0) && (
                 <div className="flex flex-col items-center justify-center text-center py-16 opacity-30 grayscale">
                    <CalendarClock className="size-12 mb-4" />
                    <p className="font-black uppercase text-[10px] tracking-[0.3em]">No Upcoming Events</p>
                    <p className="text-[10px] font-bold uppercase mt-1">Calendar sector clear</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter className="p-8 pt-0 mt-auto">
        <Button variant="outline" className="w-full rounded-full h-11 font-black uppercase text-[9px] tracking-widest bg-white/50 border-none ring-1 ring-border/50 shadow-sm transition-all hover:shadow-md" asChild>
          <Link href="/dashboard/events">
            Open Calendar <ChevronRight className="size-3 ml-2 opacity-50" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

