"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, PlusCircle, MoreHorizontal, Trash2, Megaphone, 
  PartyPopper, Cake, Users, Gift, Award, HelpCircle,
  Briefcase, Building, Home, Milestone, Trophy, Heart,
  ChevronRight, CalendarDays, Sparkles, Clock, Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  useUser, useFirestore, useMemoFirebase, useCollection, 
  addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking,
  updateDocumentNonBlocking
} from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, orderBy, query, where, arrayRemove, arrayUnion } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getYear, getMonth, getDate, getDaysInMonth } from "date-fns";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

// --- TYPES ---
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
    { id: 'green-500', value: '#10B981', className: 'bg-green-500' },
    { id: 'blue-500', value: '#3B82F6', className: 'bg-blue-500' },
];

type Announcement = { 
  title: string;
  content: string;
  publishDate: any; 
  authorId: string;
};

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

type AnnouncementWithStatus = WithId<Announcement> & { status: "Read" | "Unread" };
type EventItemWithId = WithId<EventItem>;

export default function FeedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<string>(searchParams.get("tab") || "announcements");

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  // --- ANNOUNCEMENTS DATA ---
  const announcementsQuery = useMemoFirebase(
    () => query(collection(firestore, "announcements"), orderBy("publishDate", "desc")),
    [firestore]
  );
  const { data: announcements, isLoading: isAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);
  
  const readAnnouncementsQuery = useMemoFirebase(
    () => user ? collection(firestore, `users/${user.uid}/readAnnouncements`) : null,
    [user, firestore]
  );
  const { data: readAnnouncements } = useCollection<{id: string}>(readAnnouncementsQuery);

  const [announcementStatus, setAnnouncementStatus] = React.useState<Record<string, "Read" | "Unread">>({});
  
  React.useEffect(() => {
      if (announcements && readAnnouncements) {
        const readIds = new Set(readAnnouncements.map(a => a.id));
        const newStatus: Record<string, "Read" | "Unread"> = {};
        announcements.forEach(ann => {
            newStatus[ann.id] = readIds.has(ann.id) ? "Read" : "Unread";
        });
        setAnnouncementStatus(newStatus);
      }
  }, [announcements, readAnnouncements]);

  // --- EVENTS DATA ---
  const eventsQuery = useMemoFirebase(
      () => user ? query(collection(firestore, "events"), orderBy("date", "desc")) : null,
      [firestore, user]
  );
  const { data: events, isLoading: isEventsLoading } = useCollection<EventItem>(eventsQuery);

  // --- STATE ---
  const [selectedAnnouncement, setSelectedAnnouncement] = React.useState<AnnouncementWithStatus | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventItemWithId | null>(null);

  // Combined Form States
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [newPersonName, setNewPersonName] = React.useState("");
  const [newEventType, setNewEventType] = React.useState("");
  const [otherEventType, setOtherEventType] = React.useState("");
  const [newEventIcon, setNewEventIcon] = React.useState<IconName>('PartyPopper');
  const [newEventColor, setNewEventColor] = React.useState<string>('hsl(var(--primary))');
  const [newEventTime, setNewEventTime] = React.useState("");
  const [day, setDay] = React.useState<string>();
  const [month, setMonth] = React.useState<string>();
  const [year, setYear] = React.useState<string>();

  const resetForm = () => {
    setNewTitle("");
    setNewContent("");
    setNewPersonName("");
    setNewEventType("");
    setOtherEventType("");
    setNewEventIcon('PartyPopper');
    setNewEventColor('hsl(var(--primary))');
    setNewEventTime("");
    setDay(undefined);
    setMonth(undefined);
    setYear(undefined);
    setEditingEvent(null);
    setIsCreateDialogOpen(false);
  };

  const handleMarkAsRead = (id: string) => {
    if (!user) return;
    const readDocRef = doc(firestore, `users/${user.uid}/readAnnouncements`, id);
    setDocumentNonBlocking(readDocRef, { id, readAt: serverTimestamp() }, { merge: true });
    setAnnouncementStatus((prev) => ({ ...prev, [id]: "Read" }));
  };

  const handleCreateAnnouncement = () => {
    if (!newTitle || !newContent || !user) {
      toast({ variant: "destructive", title: "Missing fields" });
      return;
    }
    const payload = {
      title: newTitle,
      content: newContent,
      publishDate: serverTimestamp(),
      authorId: user.uid
    };
    addDocumentNonBlocking(collection(firestore, 'announcements'), payload);
    toast({ title: "Update Published" });
    resetForm();
  };

  const handleCreateOrUpdateEvent = () => {
    const eventType = newEventType === "Other" ? otherEventType : newEventType;
    if (!newPersonName || !eventType || !day || !month || !year) {
        toast({ variant: "destructive", title: "Missing Information" });
        return;
    }
    const eventDate = new Date(parseInt(year), parseInt(month), parseInt(day));
    const payload: any = {
        name: newPersonName,
        event: eventType,
        date: eventDate,
        icon: newEventIcon,
        color: newEventColor,
    };
    if (newEventTime) payload.time = newEventTime;
    
    if (editingEvent) {
      updateDocumentNonBlocking(doc(firestore, 'events', editingEvent.id), payload);
      toast({ title: "Celebration Updated" });
    } else {
      addDocumentNonBlocking(collection(firestore, 'events'), {
          ...payload,
          likes: 0,
          likedBy: [],
      });
      toast({ title: "Celebration Added" });
    }
    resetForm();
  };

  const handleLikeEvent = (id: string) => {
    if (!user) return;
    const event = events?.find(e => e.id === id);
    if (!event) return;
    const liked = event.likedBy.includes(user.uid);
    updateDocumentNonBlocking(doc(firestore, 'events', id), {
        likes: liked ? event.likes - 1 : event.likes + 1,
        likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  };

  const yearsOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);
  const monthsOptions = Array.from({ length: 12 }, (_, i) => ({ value: i, name: format(new Date(0, i), 'MMMM') }));
  const daysInMonth = (year && month) ? getDaysInMonth(new Date(parseInt(year), parseInt(month))) : 31;
  const daysOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const allAnnouncements: AnnouncementWithStatus[] = (announcements || []).map((ann) => ({
    ...ann,
    status: announcementStatus[ann.id] || "Unread",
  }));

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "MMMM do, yyyy");
  }

  const renderIcon = (iconName: IconName, props: React.SVGProps<SVGSVGElement>) => {
    const IconComponent = iconComponents[iconName] || HelpCircle;
    return <IconComponent {...props} />;
  }

  return (
    <>
      <PageHeader
        title="Company Feed"
        description="Stay synchronized with the latest news and team celebrations."
      >
        {isAdmin && (
           <Dialog open={isCreateDialogOpen} onOpenChange={(o) => !o ? resetForm() : setIsCreateDialogOpen(o)}>
            <DialogTrigger asChild>
              <Button className="rounded-full shadow-lg h-11 px-6">
                <PlusCircle className="mr-2 size-4" />
                Post to Feed
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-3xl">
              <DialogHeader className="p-8 border-b bg-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">New Post</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Share an update or celebrate a milestone</DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue={activeTab} className="flex-1">
                <TabsList className="grid w-full grid-cols-2 h-12 rounded-none bg-muted/20 border-b">
                  <TabsTrigger value="announcements" className="rounded-none font-bold uppercase text-[10px] tracking-widest">Update</TabsTrigger>
                  <TabsTrigger value="events" className="rounded-none font-bold uppercase text-[10px] tracking-widest">Celebration</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="max-h-[60vh] p-8">
                  <TabsContent value="announcements" className="space-y-6 mt-0">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Title</Label>
                      <Input placeholder="e.g., Office Picnic" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Message</Label>
                      <Textarea placeholder="Details..." value={newContent} onChange={(e) => setNewContent(e.target.value)} className="rounded-2xl min-h-[120px]" />
                    </div>
                    <Button onClick={handleCreateAnnouncement} className="w-full h-12 rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/20">Publish Update</Button>
                  </TabsContent>

                  <TabsContent value="events" className="space-y-6 mt-0">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Person's Name</Label>
                      <Input value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} placeholder="e.g., John Doe" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Category</Label>
                      <Select onValueChange={setNewEventType} value={newEventType}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent><SelectItem value="Birthday">Birthday</SelectItem><SelectItem value="Work Anniversary">Work Anniversary</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {newEventType === 'Other' && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Details</Label>
                            <Input value={otherEventType} onChange={(e) => setOtherEventType(e.target.value)} placeholder="e.g., Project Success" className="h-11 rounded-xl" />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Date</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Select onValueChange={setYear} value={year}><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{yearsOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setMonth} value={month} disabled={!year}><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{monthsOptions.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setDay} value={day} disabled={!month}><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{daysOptions.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Visual Icon</Label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(iconComponents) as IconName[]).map(iconName => (
                                <Button key={iconName} variant="outline" size="icon" className={cn("h-9 w-9 rounded-xl", newEventIcon === iconName && "ring-2 ring-primary")} onClick={() => setNewEventIcon(iconName)} type="button">{renderIcon(iconName, { className: "size-4" })}</Button>
                            ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Color</Label>
                        <div className="flex flex-wrap gap-2">
                            {colorOptions.map(color => (
                                <button key={color.id} type="button" className={cn("size-6 rounded-full border-2", newEventColor === color.value ? "border-primary scale-110 shadow-sm" : "border-transparent")} style={{ backgroundColor: color.value }} onClick={() => setNewEventColor(color.value)} />
                            ))}
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleCreateOrUpdateEvent} className="w-full h-12 rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/20">Post Celebration</Button>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 bg-white/50 backdrop-blur-md rounded-2xl p-1 shadow-sm ring-1 ring-border/50 max-w-md mx-auto mb-8">
            <TabsTrigger value="announcements" className="rounded-xl font-black uppercase text-[10px] tracking-widest flex gap-2">
              <Megaphone className="size-3.5" /> Updates
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-xl font-black uppercase text-[10px] tracking-widest flex gap-2">
              <PartyPopper className="size-3.5" /> Celebrations
            </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="animate-fade-in-up mt-0">
          <div className="border rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-border/50">
            <Table>
              <TableHeader className="bg-muted/10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 px-10">Title</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[9px] py-6">Publish Date</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[9px] py-6">Status</TableHead>
                  <TableHead className="text-right font-black uppercase tracking-widest text-[9px] py-6 px-10">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAnnouncementsLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20">Scanning Updates...</TableCell></TableRow>
                ) : allAnnouncements.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-30">No news in feed.</TableCell></TableRow>
                ) : (
                  allAnnouncements.map((ann) => (
                    <TableRow key={ann.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                      <TableCell className="py-6 px-10">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-xl", ann.status === 'Unread' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                            <Megaphone className="size-4" />
                          </div>
                          <span className={cn("font-black text-sm uppercase", ann.status === 'Unread' ? "text-primary" : "text-slate-700")}>{ann.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{formatDate(ann.publishDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("rounded-none text-[8px] font-black uppercase px-2 h-5 border-none", ann.status === 'Read' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 animate-pulse')}>
                          {ann.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-10">
                        <div className="flex justify-end gap-2">
                           <Button variant="outline" size="sm" className="rounded-full h-9 px-4 font-bold uppercase text-[9px] tracking-widest bg-white shadow-sm ring-1 ring-border/50 border-none" onClick={() => { setSelectedAnnouncement(ann); if (ann.status === 'Unread') handleMarkAsRead(ann.id); }}>
                             <Eye className="size-3 mr-1.5" /> Read
                           </Button>
                           {isAdmin && (
                             <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-destructive hover:bg-red-50" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'announcements', ann.id))}>
                               <Trash2 className="size-4" />
                             </Button>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="events" className="animate-fade-in-up mt-0">
          {isEventsLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-[2.5rem] bg-muted animate-pulse" />)}</div>
          ) : events?.length === 0 ? (
            <div className="py-40 text-center opacity-30 flex flex-col items-center justify-center gap-6">
                <PartyPopper className="size-20" />
                <p className="font-black uppercase text-xs tracking-[0.3em]">No celebrations found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events?.map((event) => (
                <Card key={event.id} className="group border-none ring-1 ring-border/50 shadow-xl rounded-[2.5rem] bg-white overflow-hidden transition-all hover:scale-[1.02] duration-500">
                  <CardHeader className="p-10 pb-4 flex flex-row items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="p-4 rounded-3xl shadow-sm transition-transform group-hover:rotate-12" style={{ backgroundColor: event.color + '1A', color: event.color }}>
                        {renderIcon(event.icon, { className: "size-6" })}
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter">{event.name}</CardTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{event.event}</p>
                      </div>
                    </div>
                    {isAdmin && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full h-10 w-10"><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2">
                                <DropdownMenuItem className="rounded-xl font-bold uppercase text-[10px] py-3 gap-3" onClick={() => { setEditingEvent(event); setNewPersonName(event.name); setNewEventType(event.event); setDay(getDate(event.date.toDate()).toString()); setMonth(getMonth(event.date.toDate()).toString()); setYear(getYear(event.date.toDate()).toString()); setIsCreateDialogOpen(true); }}>
                                    <Edit className="size-4" /> Edit Event
                                </DropdownMenuItem>
                                <DropdownMenuItem className="rounded-xl font-bold uppercase text-[10px] py-3 gap-3 text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'events', event.id))}>
                                    <Trash2 className="size-4" /> Delete Event
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                  </CardHeader>
                  <CardContent className="px-10 pb-4">
                     <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                        <CalendarDays className="size-4 text-primary/40" />
                        <span className="text-xs font-black uppercase tracking-tight">{formatDate(event.date)} {event.time && `at ${event.time}`}</span>
                     </div>
                  </CardContent>
                  <Separator className="opacity-50" />
                  <CardFooter className="p-6 bg-muted/5 flex items-center justify-between">
                    <Button variant={event.likedBy.includes(user?.uid || '') ? "secondary" : "ghost"} size="sm" className="rounded-full h-10 px-6 gap-2 transition-all hover:scale-110 active:scale-95" onClick={() => handleLikeEvent(event.id)}>
                      <Heart className={cn("size-4 transition-colors", event.likedBy.includes(user?.uid || '') ? "fill-red-500 text-red-500" : "text-slate-400")} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{event.likes}</span>
                    </Button>
                    <div className="flex -space-x-2">
                        {event.likedBy.slice(0, 3).map((uid, i) => (
                            <Avatar key={i} className="size-7 border-2 border-white ring-1 ring-border/50">
                                <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">U</AvatarFallback>
                            </Avatar>
                        ))}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedAnnouncement} onOpenChange={o => !o && setSelectedAnnouncement(null)}>
        <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-lg p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
            <SheetHeader className="p-10 border-b bg-white shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-primary/10 text-primary rounded-none border-none font-black text-[9px] h-5 uppercase tracking-widest px-3">Company Update</Badge>
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-40 ml-auto">
                  <Clock className="size-3" />
                  {selectedAnnouncement && formatDate(selectedAnnouncement.publishDate)}
                </div>
              </div>
              <SheetTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-tight">{selectedAnnouncement?.title}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="p-10 space-y-8 pb-32">
                <div className="p-8 bg-white ring-1 ring-border shadow-sm rounded-none border-l-8 border-primary">
                  <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedAnnouncement?.content}
                  </p>
                </div>
              </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}