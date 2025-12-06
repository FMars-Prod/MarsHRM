
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { events as eventData } from "@/lib/data";
import { Cake, Heart, PartyPopper, PlusCircle, Calendar as CalendarIcon, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { Textarea } from "@/components/ui/textarea";

type EventItem = (typeof eventData)[0] & { likes: number; liked: boolean };

export default function EventsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const [events, setEvents] = React.useState<EventItem[]>(
    eventData.map((e) => ({ ...e, likes: Math.floor(Math.random() * 25), liked: false }))
  );
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newEventName, setNewEventName] = React.useState("");
  const [newEventDate, setNewEventDate] = React.useState<Date | undefined>();
  const [newEventType, setNewEventType] = React.useState("");
  const [otherEventType, setOtherEventType] = React.useState("");

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

  const handleCreateEvent = () => {
    const eventType = newEventType === "Other" ? otherEventType : newEventType;
    if (!newEventName || !eventType || !newEventDate) {
        // In a real app, you'd show a toast or form validation message
        console.error("All fields are required");
        return;
    }

    const newEvent: EventItem = {
        id: `evt-${Date.now()}`,
        name: newEventName,
        event: eventType,
        date: format(newEventDate, "MMMM do"),
        likes: 0,
        liked: false,
    };

    setEvents(prev => [newEvent, ...prev]);

    // Reset form and close dialog
    setNewEventName("");
    setNewEventDate(undefined);
    setNewEventType("");
    setOtherEventType("");
    setIsDialogOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Events"
        description="Celebrate birthdays and work anniversaries with your colleagues."
      >
        {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2" />
                        Create Event
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Event</DialogTitle>
                        <DialogDescription>
                            Add a birthday, work anniversary, or other event to the calendar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Person's Name</Label>
                            <Input id="name" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className="col-span-3" placeholder="e.g., John Doe" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">Event Type</Label>
                            <Select onValueChange={setNewEventType} value={newEventType}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select an event type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Birthday">Birthday</SelectItem>
                                    <SelectItem value="Work Anniversary">Work Anniversary</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newEventType === 'Other' && (
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="other-type" className="text-right pt-2">Custom Type</Label>
                                <Textarea id="other-type" value={otherEventType} onChange={(e) => setOtherEventType(e.target.value)} className="col-span-3" placeholder="e.g., Project Launch" />
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal col-span-3",
                                            !newEventDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {newEventDate ? format(newEventDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={newEventDate}
                                        onSelect={setNewEventDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateEvent}>Create Event</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {event.event === "Birthday" ? (
                  <Cake className="text-pink-500" />
                ) : event.event === "Work Anniversary" ? (
                  <PartyPopper className="text-yellow-500" />
                ) : (
                  <HelpCircle className="text-blue-500" />
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
