
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { events as eventData } from "@/lib/data";
import { Cake, Heart, PartyPopper } from "lucide-react";

type EventItem = (typeof eventData)[0] & { likes: number; liked: boolean };

export default function EventsPage() {
  const [events, setEvents] = React.useState<EventItem[]>(
    eventData.map((e) => ({ ...e, likes: Math.floor(Math.random() * 25), liked: false }))
  );

  const handleLike = (id: string) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) => {
        if (event.id === id) {
          return {
            ...event,
            likes: event.liked ? event.likes - 1 : event.likes + 1,
            liked: !event.liked,
          };
        }
        return event;
      })
    );
  };

  return (
    <>
      <PageHeader
        title="Upcoming Events"
        description="Celebrate birthdays and work anniversaries with your colleagues."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {event.event === "Birthday" ? (
                  <Cake className="text-pink-500" />
                ) : (
                  <PartyPopper className="text-yellow-500" />
                )}
                {event.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground">
                {event.event} on {event.date}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant={event.liked ? "secondary" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => handleLike(event.id)}
              >
                <Heart
                  className={`mr-2 h-4 w-4 ${
                    event.liked ? "text-red-500 fill-red-500" : ""
                  }`}
                />
                <span>{event.likes}</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
