
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { events as eventData } from "@/lib/data";
import { Cake, Heart, PartyPopper, PlusCircle, Calendar as CalendarIcon, HelpCircle, Users, Gift, Award, MoreVertical, Edit, Trash2, Anchor, AppWindow, Armchair, Baby, BadgeCheck, Banana, BarChart, Beer, Bike, Bomb, Bone, Book, Bot, Box, Brain, Briefcase, Brush, Bug, Building, Bus, Camera, CandlestickChart, Car, Carrot, Castle, Cat, Check, ChefHat, Cherry, Church, Citrus, Clipboard, Cloud, Code, Cog, Coins, Compass, Computer, Cone, Construction, Contact, Contrast, Cookie, Copy, Crown, CupSoda, Currency, Database, Diamond, Dice5, Dna, Dog, DollarSign, Donut, DoorClosed, DraftingCompass, Dribbble, Dumbbell, Ear, Egg, Euro, Eye, Factory, Fan, Feather, FerrisWheel, Figma, File, Film, Filter, Fingerprint, FireExtinguisher, Flag, Flame, Flashlight, FlaskConical, Flower, Folder, Football, Forklift, Framer, Gamepad2, Gauge, Gavel, Gem, Ghost, GitBranch, GitCommit, GitFork, GitMerge, GitPullRequest, Github, Gitlab, GlassWater, Glasses, Globe, Grab, GraduationCap, Grape, Grid, Hammer, Hand, HardHat, Hash, Haze, Heading, Headphones, HeartPulse, Heater, Hexagon, Highlighter, History, Home, Hop, Hourglass, IceCream, Image as ImageIcon, Inbox, Indent, IndianRupee, Infinity, Info, InspectionPanel, Instagram, Italic, IterationCcw, IterationCw, JapaneseYen, Joystick, Kanban, Key, Keyboard, Lamp, Landmark, Laptop, Lasso, Laugh, Layers, Layout, Leaf, Library, LifeBuoy, Lightbulb, Link, Linkedin, List, Locate, Lock, LogIn, LogOut, Luggage, Magnet, Mail, Map, Martini, Medal, Megaphone, Menu, MessageCircle, MessageSquare, Mic, Microscope, Microwave, Milestone, Milk, Minus, Monitor, Moon, Mouse, Move, Music, Navigation, Network, Newspaper, Nut, Orbit, Package, Paintbrush, Palette, Paperclip, ParkingCircle, Pause, PcCase, Pen, Pencil, Percent, PersonStanding, Phone, PieChart, Pilcrow, Pin, Plane, Plug, Pocket, Podcast, Pointer, PoundSterling, Power, Presentation, Printer, Projector, Puzzle, Quote, Radio, Recycle, Redo, Regex, RemoveFormatting, Repeat, Reply, Rocket, Rows, Rss, Ruler, RussianRuble, Sailboat, Save, Scale, Scan, School, Scissors, ScreenShare, Scroll, Search, Send, SeparatorHorizontal, Server, Share, Shield, Ship, ShoppingBag, ShoppingCart, Shovel, ShowerHead, Sigma, Signal, Siren, Sketch, Skull, Slack, Slice, Sliders, Smartphone, Smile, Snowflake, SortAsc, SortDesc, Speaker, Spline, Sprout, Square, Star, SteeringWheel, Stethoscope, Sticker, StickyNote, Strikethrough, Subscript, Sun, Superscript, SwissFranc, SwitchCamera, Sword, Swords, Syringe, Table, Tablet, Tag, Target, Tent, Terminal, TestTube, Text, ThumbsDown, ThumbsUp, Ticket, Timer, ToyBrick, Train, Trash, TreePine, Trophy, Truck, Tv, Twitter, Underline, UnfoldHorizontal, UnfoldVertical, Unlink, Upload, Usb, Video, View, Voicemail, Volume, Wallet, Wand, Watch, Waves, Webcam, Webhook, Weight, Wheat, Wifi, Wind, Wine, Wrench, Youtube, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { Textarea } from "@/components/ui/textarea";
import { format, getYear, getMonth, getDate, parse } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";


type IconName = 'Cake' | 'PartyPopper' | 'Users' | 'Gift' | 'Award' | 'HelpCircle' | 'Anchor' | 'AppWindow' | 'Armchair' | 'Baby' | 'BadgeCheck' | 'Banana' | 'BarChart' | 'Beer' | 'Bike' | 'Bomb' | 'Bone' | 'Book' | 'Bot' | 'Box' | 'Brain' | 'Briefcase' | 'Brush' | 'Bug' | 'Building' | 'Bus' | 'Camera' | 'CandlestickChart' | 'Car' | 'Carrot' | 'Castle' | 'Cat' | 'Check' | 'ChefHat' | 'Cherry' | 'Church' | 'Citrus' | 'Clipboard' | 'Cloud' | 'Code' | 'Cog' | 'Coins' | 'Compass' | 'Computer' | 'Cone' | 'Construction' | 'Contact' | 'Contrast' | 'Cookie' | 'Copy' | 'Crown' | 'CupSoda' | 'Currency' | 'Database' | 'Diamond' | 'Dice5' | 'Dna' | 'Dog' | 'DollarSign' | 'Donut' | 'DoorClosed' | 'DraftingCompass' | 'Dribbble' | 'Dumbbell' | 'Ear' | 'Egg' | 'Euro' | 'Eye' | 'Factory' | 'Fan' | 'Feather' | 'FerrisWheel' | 'Figma' | 'File' | 'Film' | 'Filter' | 'Fingerprint' | 'FireExtinguisher' | 'Flag' | 'Flame' | 'Flashlight' | 'FlaskConical' | 'Flower' | 'Folder' | 'Football' | 'Forklift' | 'Framer' | 'Gamepad2' | 'Gauge' | 'Gavel' | 'Gem' | 'Ghost' | 'GitBranch' | 'GitCommit' | 'GitFork' | 'GitMerge' | 'GitPullRequest' | 'Github' | 'Gitlab' | 'GlassWater' | 'Glasses' | 'Globe' | 'Grab' | 'GraduationCap' | 'Grape' | 'Grid' | 'Hammer' | 'Hand' | 'HardHat' | 'Hash' | 'Haze' | 'Heading' | 'Headphones' | 'HeartPulse' | 'Heater' | 'Hexagon' | 'Highlighter' | 'History' | 'Home' | 'Hop' | 'Hourglass' | 'IceCream' | 'ImageIcon' | 'Inbox' | 'Indent' | 'IndianRupee' | 'Infinity' | 'Info' | 'InspectionPanel' | 'Instagram' | 'Italic' | 'IterationCcw' | 'IterationCw' | 'JapaneseYen' | 'Joystick' | 'Kanban' | 'Key' | 'Keyboard' | 'Lamp' | 'Landmark' | 'Laptop' | 'Lasso' | 'Laugh' | 'Layers' | 'Layout' | 'Leaf' | 'Library' | 'LifeBuoy' | 'Lightbulb' | 'Link' | 'Linkedin' | 'List' | 'Locate' | 'Lock' | 'LogIn' | 'LogOut' | 'Luggage' | 'Magnet' | 'Mail' | 'Map' | 'Martini' | 'Medal' | 'Megaphone' | 'Menu' | 'MessageCircle' | 'MessageSquare' | 'Mic' | 'Microscope' | 'Microwave' | 'Milestone' | 'Milk' | 'Minus' | 'Monitor' | 'Moon' | 'Mouse' | 'Move' | 'Music' | 'Navigation' | 'Network' | 'Newspaper' | 'Nut' | 'Orbit' | 'Package' | 'Paintbrush' | 'Palette' | 'Paperclip' | 'ParkingCircle' | 'Pause' | 'PcCase' | 'Pen' | 'Pencil' | 'Percent' | 'PersonStanding' | 'Phone' | 'PieChart' | 'Pilcrow' | 'Pin' | 'Plane' | 'Plug' | 'Pocket' | 'Podcast' | 'Pointer' | 'PoundSterling' | 'Power' | 'Presentation' | 'Printer' | 'Projector' | 'Puzzle' | 'Quote' | 'Radio' | 'Recycle' | 'Redo' | 'Regex' | 'RemoveFormatting' | 'Repeat' | 'Reply' | 'Rocket' | 'Rows' | 'Rss' | 'Ruler' | 'RussianRuble' | 'Sailboat' | 'Save' | 'Scale' | 'Scan' | 'School' | 'Scissors' | 'ScreenShare' | 'Scroll' | 'Search' | 'Send' | 'SeparatorHorizontal' | 'Server' | 'Share' | 'Shield' | 'Ship' | 'ShoppingBag' | 'ShoppingCart' | 'Shovel' | 'ShowerHead' | 'Sigma' | 'Signal' | 'Siren' | 'Sketch' | 'Skull' | 'Slack' | 'Slice' | 'Sliders' | 'Smartphone' | 'Smile' | 'Snowflake' | 'SortAsc' | 'SortDesc' | 'Speaker' | 'Spline' | 'Sprout' | 'Square' | 'Star' | 'SteeringWheel' | 'Stethoscope' | 'Sticker' | 'StickyNote' | 'Strikethrough' | 'Subscript' | 'Sun' | 'Superscript' | 'SwissFranc' | 'SwitchCamera' | 'Sword' | 'Swords' | 'Syringe' | 'Table' | 'Tablet' | 'Tag' | 'Target' | 'Tent' | 'Terminal' | 'TestTube' | 'Text' | 'ThumbsDown' | 'ThumbsUp' | 'Ticket' | 'Timer' | 'ToyBrick' | 'Train' | 'Trash' | 'TreePine' | 'Trophy' | 'Truck' | 'Tv' | 'Twitter' | 'Underline' | 'UnfoldHorizontal' | 'UnfoldVertical' | 'Unlink' | 'Upload' | 'Usb' | 'Video' | 'View' | 'Voicemail' | 'Volume' | 'Wallet' | 'Wand' | 'Watch' | 'Waves' | 'Webcam' | 'Webhook' | 'Weight' | 'Wheat' | 'Wifi' | 'Wind' | 'Wine' | 'Wrench' | 'Youtube' | 'Zap';

const iconComponents: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {
    Cake, PartyPopper, Users, Gift, Award, HelpCircle, Anchor, AppWindow, Armchair, Baby, BadgeCheck, Banana, BarChart, Beer, Bike, Bomb, Bone, Book, Bot, Box, Brain, Briefcase, Brush, Bug, Building, Bus, Camera, CandlestickChart, Car, Carrot, Castle, Cat, Check, ChefHat, Cherry, Church, Citrus, Clipboard, Cloud, Code, Cog, Coins, Compass, Computer, Cone, Construction, Contact, Contrast, Cookie, Copy, Crown, CupSoda, Currency, Database, Diamond, Dice5, Dna, Dog, DollarSign, Donut, DoorClosed, DraftingCompass, Dribbble, Dumbbell, Ear, Egg, Euro, Eye, Factory, Fan, Feather, FerrisWheel, Figma, File, Film, Filter, Fingerprint, FireExtinguisher, Flag, Flame, Flashlight, FlaskConical, Flower, Folder, Football, Forklift, Framer, Gamepad2, Gauge, Gavel, Gem, Ghost, GitBranch, GitCommit, GitFork, GitMerge, GitPullRequest, Github, Gitlab, GlassWater, Glasses, Globe, Grab, GraduationCap, Grape, Grid, Hammer, Hand, HardHat, Hash, Haze, Heading, Headphones, HeartPulse, Heater, Hexagon, Highlighter, History, Home, Hop, Hourglass, IceCream, ImageIcon, Inbox, Indent, IndianRupee, Infinity, Info, InspectionPanel, Instagram, Italic, IterationCcw, IterationCw, JapaneseYen, Joystick, Kanban, Key, Keyboard, Lamp, Landmark, Laptop, Lasso, Laugh, Layers, Layout, Leaf, Library, LifeBuoy, Lightbulb, Link, Linkedin, List, Locate, Lock, LogIn, LogOut, Luggage, Magnet, Mail, Map, Martini, Medal, Megaphone, Menu, MessageCircle, MessageSquare, Mic, Microscope, Microwave, Milestone, Milk, Minus, Monitor, Moon, Mouse, Move, Music, Navigation, Network, Newspaper, Nut, Orbit, Package, Paintbrush, Palette, Paperclip, ParkingCircle, Pause, PcCase, Pen, Pencil, Percent, PersonStanding, Phone, PieChart, Pilcrow, Pin, Plane, Plug, Pocket, Podcast, Pointer, PoundSterling, Power, Presentation, Printer, Projector, Puzzle, Quote, Radio, Recycle, Redo, Regex, RemoveFormatting, Repeat, Reply, Rocket, Rows, Rss, Ruler, RussianRuble, Sailboat, Save, Scale, Scan, School, Scissors, ScreenShare, Scroll, Search, Send, SeparatorHorizontal, Server, Share, Shield, Ship, ShoppingBag, ShoppingCart, Shovel, ShowerHead, Sigma, Signal, Siren, Sketch, Skull, Slack, Slice, Sliders, Smartphone, Smile, Snowflake, SortAsc, SortDesc, Speaker, Spline, Sprout, Square, Star, SteeringWheel, Stethoscope, Sticker, StickyNote, Strikethrough, Subscript, Sun, Superscript, SwissFranc, SwitchCamera, Sword, Swords, Syringe, Table, Tablet, Tag, Target, Tent, Terminal, TestTube, Text, ThumbsDown, ThumbsUp, Ticket, Timer, ToyBrick, Train, Trash, TreePine, Trophy, Truck, Tv, Twitter, Underline, UnfoldHorizontal, UnfoldVertical, Unlink, Upload, Usb, Video, View, Voicemail, Volume, Wallet, Wand, Watch, Waves, Webcam, Webhook, Weight, Wheat, Wifi, Wind, Wine, Wrench, Youtube, Zap,
};

const colorOptions = [
    { id: 'primary', value: 'hsl(var(--primary))', className: 'bg-primary' },
    { id: 'chart-1', value: 'hsl(var(--chart-1))', className: 'bg-chart-1' },
    { id: 'chart-2', value: 'hsl(var(--chart-2))', className: 'bg-chart-2' },
    { id: 'chart-3', value: 'hsl(var(--chart-3))', className: 'bg-chart-3' },
    { id: 'chart-4', value: 'hsl(var(--chart-4))', className: 'bg-chart-4' },
    { id: 'chart-5', value: 'hsl(var(--chart-5))', className: 'bg-chart-5' },
];

type EventItem = { 
  id: string; 
  name: string; 
  event: string;
  date: string;
  likes: number; 
  liked: boolean; 
  icon: IconName; 
  color: string; 
  time?: string 
};


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
    eventData.map((e) => ({ ...e, id: `evt-${Math.random()}`, likes: Math.floor(Math.random() * 25), liked: false, icon: e.event === "Birthday" ? 'Cake' : 'PartyPopper', color: 'hsl(var(--primary))', time: e.event === 'Birthday' ? '12:00 PM' : undefined }))
  );
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventItem | null>(null);

  const [newEventName, setNewEventName] = React.useState("");
  const [newEventType, setNewEventType] = React.useState("");
  const [otherEventType, setOtherEventType] = React.useState("");
  const [newEventIcon, setNewEventIcon] = React.useState<IconName>('HelpCircle');
  const [newEventColor, setNewEventColor] = React.useState<string>('hsl(var(--primary))');
  const [newEventTime, setNewEventTime] = React.useState("");
  const [date, setDate] = React.useState<Date>();


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
  
  const resetForm = () => {
    setNewEventName("");
    setNewEventType("");
    setOtherEventType("");
    setNewEventIcon('HelpCircle');
    setNewEventColor('hsl(var(--primary))');
    setNewEventTime("");
    setDate(undefined);
    setEditingEvent(null);
    setIsDialogOpen(false);
  }

  const handleCreateOrUpdateEvent = () => {
    const eventType = newEventType === "Other" ? otherEventType : newEventType;
    if (!newEventName || !eventType || !date) {
        console.error("All fields are required");
        return;
    }

    const eventPayload: EventItem = {
        id: editingEvent ? editingEvent.id : `evt-${Date.now()}`,
        name: newEventName,
        event: eventType,
        date: format(date, "MMMM do"),
        likes: editingEvent ? editingEvent.likes : 0,
        liked: editingEvent ? editingEvent.liked : false,
        icon: newEventIcon,
        color: newEventColor,
        time: newEventTime || undefined,
    };
    
    if (editingEvent) {
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? eventPayload : e));
    } else {
      setEvents(prev => [eventPayload, ...prev]);
    }
    
    resetForm();
  }
  
  const handleOpenEditDialog = (event: EventItem) => {
    setEditingEvent(event);
    setNewEventName(event.name);
    
    const isPredefinedType = ["Birthday", "Work Anniversary"].includes(event.event);
    setNewEventType(isPredefinedType ? event.event : "Other");
    if (!isPredefinedType) {
      setOtherEventType(event.event);
    }
    
    const eventDate = parse(event.date + " " + new Date().getFullYear(), "MMMM do yyyy", new Date());
    setDate(eventDate);
    
    setNewEventTime(event.time || "");
    setNewEventIcon(event.icon);
    setNewEventColor(event.color);
    setIsDialogOpen(true);
  }

  const handleDeleteEvent = (eventId: string) => {
      setEvents(prev => prev.filter(e => e.id !== eventId));
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingEvent ? 'Edit Event' : 'Create a New Event'}</DialogTitle>
                        <DialogDescription>
                            {editingEvent ? 'Update the details of the event.' : 'Add a birthday, work anniversary, or other event to the calendar.'}
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
                                        !date && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                                    <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
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
                            <div className="col-span-3 grid grid-cols-6 gap-2">
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
                        <Button variant="outline" onClick={resetForm}>Cancel</Button>
                        <Button onClick={handleCreateOrUpdateEvent}>{editingEvent ? 'Save Changes' : 'Create Event'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
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
                {event.date} {event.time && `at ${event.time}`}
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
