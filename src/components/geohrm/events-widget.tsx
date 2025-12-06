"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cake, PartyPopper } from "lucide-react";
import { events } from "@/lib/data";

export function EventsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <PartyPopper className="size-5" />
          Upcoming Events
        </CardTitle>
        <CardDescription>Birthdays and work anniversaries.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((item) => (
            <div key={item.id} className="flex items-center gap-4">
              <div className="bg-secondary p-3 rounded-full">
                <Cake className="size-5 text-secondary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">{item.name}</span>
                <p className="text-sm text-muted-foreground">
                  {item.event} on {item.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
