
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { events as eventData } from "@/lib/data";
import { Cake, Heart, PartyPopper, PlusCircle, Calendar as CalendarIcon, HelpCircle, Users, Gift, Award } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";


type IconName = 'Cake' | 'PartyPopper' | 'Users' | 'Gift' | 'Award' | 'HelpCircle';

const iconComponents: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {
    Cake,
    PartyPopper,
    Users,
    Gift,
    Award,
    HelpCircle,
};

const colorOptions = [
    { id: 'primary', value: 'hsl(var(--primary))', className: 'bg-primary' },
    { id: 'accent', value: 'hsl(var(--accent))', className: 'bg-chart-2' },
    { id: 'chart-2', value: 'hsl(var(--chart-2))', className: 'bg-chart-2' },
    { id: 'chart-3', value: 'hsl(var(--chart-3))', className: 'bg-chart-3' },
    { id: 'chart-5', value: 'hsl(var(--chart-5))', className: 'bg-chart-5' },
];

type EventItem = (typeof eventData)[0] & { likes: number; liked: boolean; icon: IconName; color: string; time?: string };

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
    eventData.map((e) => ({ ...e, likes: Math.floor(Math.random() * 25), liked: false, icon: e.event === "Birthday" ? 'Cake' : 'PartyPopper', color: 'hsl(var(--primary))', time: e.event === 'Birthday' ? '12:00 PM' : undefined }))
  );
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newEventName, setNewEventName] = React.useState("");
  const [newEventDate, setNewEventDate] = React.useState<Date | undefined>();
  const [newEventType, setNewEventType] = React.useState("");
  const [otherEventType, setOtherEventType] = React.useState("");
  const [newEventIcon, setNewEventIcon] = React.useState<IconName>('HelpCircle');
  const [newEventColor, setNewEventColor] = React.useState<string>('hsl(var(--primary))');
  const [newEventTime, setNewEventTime] = React.useState("");


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
        icon: newEventIcon,
        color: newEventColor,
        time: newEventTime || undefined,
    };

    setEvents(prev => [newEvent, ...prev]);

    // Reset form and close dialog
    setNewEventName("");
    setNewEventDate(undefined);
    setNewEventType("");
    setOtherEventType("");
    setNewEventIcon('HelpCircle');
    setNewEventColor('hsl(var(--primary))');
    setNewEventTime("");
    setIsDialogOpen(false);
  }

  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || HelpCircle;
    return <IconComponent {...props} />;
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
                <DialogContent className="sm:max-w-md">
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
                                    variant={"outline"}
                                    className={cn(
                                      "col-span-3 justify-start text-left font-normal",
                                      !newEventDate && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newEventDate ? format(newEventDate, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                                  <Calendar
                                    mode="single"
                                    selected={newEventDate}
                                    onSelect={setNewEventDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="time" className="text-right">Time (Optional)</Label>
                            <Input id="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className="col-span-3" placeholder="e.g., 2:00 PM" />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">Icon</Label>
                            <div className="col-span-3 grid grid-cols-5 gap-2">
                                {Object.keys(iconComponents).map(iconKey => {
                                    const iconName = iconKey as IconName;
                                    return (
                                        <Button 
                                            key={iconName}
                                            variant="outline"
                                            size="icon"
                                            className={cn("h-8 w-8", newEventIcon === iconName && "ring-2 ring-primary")}
                                            onClick={() => setNewEventIcon(iconName)}
                                        >
                                            {renderIcon(iconName, { className: "h-5 w-5" })}
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>
                         <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">Color</Label>
                            <div className="col-span-3 flex gap-2">
                                {colorOptions.map(color => (
                                    <Button
                                        key={color.id}
                                        variant="outline"
                                        size="icon"
                                        className={cn("h-8 w-8", newEventColor === color.value && "ring-2 ring-primary")}
                                        onClick={() => setNewEventColor(color.value)}
                                    >
                                        <div className={cn("h-5 w-5 rounded-sm", color.className)} />
                                    </Button>
                                ))}
                            </div>
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
                {renderIcon(event.icon, {className: "h-6 w-6", style: { color: event.color }})}
                {event.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground">
                {event.event} on {event.date} {event.time && `at ${event.time}`}
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

    