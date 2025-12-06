
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cake, PartyPopper, PlusCircle, Calendar as CalendarIcon, HelpCircle, Users, Gift, Award, MoreVertical, Edit, Trash2, Briefcase, Building, Home, Milestone, Trophy, Ship, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, arrayUnion, arrayRemove, orderBy, query, deleteDoc } from "firebase/firestore";
import { Textarea } from "@/components/ui/textarea";
import { format, parse, startOfToday, isSameDay } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { WithId } from "@/firebase/firestore/use-collection";

type IconName = 'Cake' | 'PartyPopper' | 'Users' | 'Gift' | 'Award' | 'Briefcase' | 'Building' | 'Home' | 'Milestone' | 'Trophy';

const iconComponents: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {
    Cake, PartyPopper, Users, Gift, Award, Briefcase, Building, Home, Milestone, Trophy
};

const colorOptions = [
    { id: 'primary', value: 'hsl(var(--primary))', className: 'bg-primary' },
    { id: 'accent', value: 'hsl(var(--accent))', className: 'bg-accent' },
    { id: 'chart-1', value: 'hsl(var(--chart-1))', className: 'bg-chart-1' },
    { id: 'chart-2', value: 'hsl(var(--chart-2))', className: 'bg-chart-2' },
    { id: 'chart-3', value: 'hsl(var(--chart-3))', className: 'bg-chart-3' },
    { id: 'chart-4', value: 'hsl(var(--chart-4))', className: 'bg-chart-4' },
    { id: 'chart-5', value: 'hsl(var(--chart-5))', className: 'bg-chart-5' },
    { id: 'destructive', value: 'hsl(var(--destructive))', className: 'bg-destructive' },
    { id: 'green-500', value: '#10B981', className: 'bg-green-500' },
    { id: 'blue-500', value: '#3B82F6', className: 'bg-blue-500' },
];

type EventItem = { 
  name: string; 
  event: string;
  date: any;
  likes: number; 
  likedBy: string[]; 
  icon: IconName; 
  color: string; 
  time?: string 
};

type EventItemWithId = WithId<EventItem>;

export default function EventsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const eventsQuery = useMemoFirebase(
      () => query(collection(firestore, "events"), orderBy("date", "desc")),
      [firestore]
  );
  const { data: events, isLoading } = useCollection<EventItem>(eventsQuery);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventItemWithId | null>(null);

  const [newEventName, setNewEventName] = React.useState("");
  const [newEventType, setNewEventType] = React.useState("");
  const [otherEventType, setOtherEventType] = React.useState("");
  const [newEventIcon, setNewEventIcon] = React.useState<IconName>('PartyPopper');
  const [newEventColor, setNewEventColor] = React.useState<string>('hsl(var(--primary))');
  const [newEventTime, setNewEventTime] = React.useState("");
  
  const [date, setDate] = React.useState<Date>();

  const handleLike = (id: string) => {
    if (!user) return;
    const eventRef = doc(firestore, 'events', id);
    const event = events?.find(e => e.id === id);
    const liked = event?.likedBy.includes(user.uid);

    updateDocumentNonBlocking(eventRef, {
        likes: liked ? event.likes -1 : event.likes + 1,
        likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  };
  
  const resetForm = () => {
    setNewEventName("");
    setNewEventType("");
    setOtherEventType("");
    setNewEventIcon('PartyPopper');
    setNewEventColor('hsl(var(--primary))');
    setNewEventTime("");
    setDate(undefined);
    setEditingEvent(null);
    setIsDialogOpen(false);
  }

  const handleCreateOrUpdateEvent = () => {
    const eventType = newEventType === "Other" ? otherEventType : newEventType;
    if (!newEventName || !eventType || !date) {
        toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please fill out all required fields: name, event type, and full date.",
        });
        return;
    }

    const eventPayload = {
        name: newEventName,
        event: eventType,
        date: date,
        icon: newEventIcon,
        color: newEventColor,
        time: newEventTime || undefined,
    };
    
    if (editingEvent) {
      const eventRef = doc(firestore, 'events', editingEvent.id);
      updateDocumentNonBlocking(eventRef, eventPayload);
      toast({ title: "Event Updated", description: "The event has been successfully updated." });
    } else {
      const newEventPayload = {
          ...eventPayload,
          id: `evt-${Date.now()}`,
          likes: 0,
          likedBy: [],
      }
      const eventRef = doc(firestore, 'events', newEventPayload.id);
      addDocumentNonBlocking(collection(firestore, 'events'), newEventPayload);
      toast({ title: "Event Created", description: "The new event has been added to the calendar." });
    }
    
    resetForm();
  }
  
  const handleOpenEditDialog = (event: EventItemWithId) => {
    setEditingEvent(event);
    setNewEventName(event.name);
    
    const isPredefinedType = ["Birthday", "Work Anniversary"].includes(event.event);
    setNewEventType(isPredefinedType ? event.event : "Other");
    if (!isPredefinedType) {
      setOtherEventType(event.event);
    }
    
    const eventDate = event.date.toDate();
    setDate(eventDate);
    
    setNewEventTime(event.time || "");
    setNewEventIcon(event.icon);
    setNewEventColor(event.color);
    setIsDialogOpen(true);
  }

  const handleDeleteEvent = (eventId: string) => {
      deleteDocumentNonBlocking(doc(firestore, 'events', eventId));
      toast({ title: "Event Deleted", description: "The event has been removed." });
  }


  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || HelpCircle;
    return <IconComponent {...props} />;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return format(date, "MMMM do");
  }

  return (
    <>
      <PageHeader
        title="Events"
        description="Celebrate birthdays and work anniversaries with your colleagues."
      >
        {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    resetForm();
                }
                setIsDialogOpen(isOpen);
            }}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2" />
                        Create Event
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                      <DialogTitle>{editingEvent ? 'Edit Event' : 'Create a New Event'}</DialogTitle>
                      <DialogDescription>
                          {editingEvent ? 'Update the details of the event.' : 'Add a birthday, work anniversary, or other event to the calendar.'}
                      </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[70vh] -mx-6">
                    <div className="grid gap-4 py-4 px-6">
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
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "col-span-3 justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        disabled={(date) => date < startOfToday() && !isSameDay(date, startOfToday())}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="time" className="text-right">Time (Optional)</Label>
                            <Input id="time" type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className="col-span-3" />
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
                            <div className="col-span-3 grid grid-cols-5 gap-2">
                                {colorOptions.map(color => (
                                    <Button
                                        key={color.id}
                                        variant="outline"
                                        size="icon"
                                        className={cn("h-8 w-8", newEventColor === color.value && "ring-2 ring-primary")}
                                        onClick={() => setNewEventColor(color.value)}
                                    >
                                        <div className={cn("h-5 w-5 rounded-sm", color.className)} style={{backgroundColor: newEventColor !== color.value ? color.value : undefined}} />
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="px-6 pb-4 pt-2 border-t">
                      <Button variant="outline" onClick={resetForm}>Cancel</Button>
                      <Button onClick={handleCreateOrUpdateEvent}>{editingEvent ? 'Save Changes' : 'Create Event'}</Button>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
      </PageHeader>
       {isLoading ? (
        <p>Loading events...</p>
      ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events?.map((event) => (
          <Card key={event.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{backgroundColor: event.color + '1A'}}>
                    {renderIcon(event.icon, {className: "h-5 w-5", style: { color: event.color }})}
                  </div>
                  {event.name}
                </CardTitle>
                {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(event)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteEvent(event.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                )}
              </div>
              <CardDescription>
                  {event.event}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground">
                <CalendarIcon className="inline-block mr-2 h-4 w-4" />
                {formatDate(event.date)} {event.time && `at ${event.time}`}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant={event.likedBy.includes(user?.uid || '') ? "secondary" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => handleLike(event.id)}
              >
                <Heart
                  className={cn("mr-2 h-4 w-4", event.likedBy.includes(user?.uid || '') && "text-red-500 fill-red-500")}
                />
                <span>{event.likes}</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      )}
    </>
  );
}

    