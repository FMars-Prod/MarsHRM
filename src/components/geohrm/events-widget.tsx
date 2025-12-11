
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PartyPopper, HelpCircle, Gift, Users, Award, Cake } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore";
import { startOfToday, endOfDay, format } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type IconName = 'Cake' | 'PartyPopper' | 'Users' | 'Gift' | 'Award';

const iconComponents: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {
    Cake, PartyPopper, Users, Gift, Award
};

type EventItem = { 
  name: string; 
  event: string;
  date: Timestamp;
  icon: IconName;
  color: string;
};

export function EventsWidget() {
  const firestore = useFirestore();

  const eventsQuery = useMemoFirebase(() => {
    const todayStart = startOfToday();
    const todayEnd = endOfDay(todayStart);
    return query(
        collection(firestore, "events"), 
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "asc")
    );
  }, [firestore]);
  
  const { data: events, isLoading } = useCollection<EventItem>(eventsQuery);

  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || HelpCircle;
    return <IconComponent {...props} />;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    return format(timestamp.toDate(), "MMMM do");
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <PartyPopper className="size-5" />
          Today's Events
        </CardTitle>
        <CardDescription>Birthdays and work anniversaries.</CardDescription>
      </CardHeader>
      <CardContent>
         {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                 <div className="space-y-2">
                    <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
                    <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
                 </div>
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="p-3 rounded-full" style={{ backgroundColor: item.color + '1A' }}>
                  {renderIcon(item.icon, { className: "size-5", style: { color: item.color } })}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">{item.name}</span>
                  <p className="text-sm text-muted-foreground">
                    {item.event} on {formatDate(item.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
            <PartyPopper className="size-8 mb-2" />
            <p>No events scheduled for today.</p>
          </div>
        )}
        <Button variant="outline" className="w-full mt-4" asChild>
          <Link href="/dashboard/events">View All Events</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

