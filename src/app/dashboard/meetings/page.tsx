'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, Timestamp, or } from 'firebase/firestore';
import { 
    Video, Plus, Clock, Users, ExternalLink, Calendar, 
    Trash2, Search, Link as LinkIcon, ShieldCheck, 
    Loader2, CheckCircle2, UserCheck, Timer, Building2, MapPin,
    Eye, BellRing, Info, MoreHorizontal, UserPlus, X, FileText,
    ChevronRight, Filter, ClipboardList, Target, AlertCircle, FileCheck,
    ChevronLeft, ListFilter, CalendarDays
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, isToday, startOfDay, addMinutes, formatDistanceToNow } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MEETING_TYPES = [
  "Daily Stand-up",
  "End-of-Day Review",
  "Team Meeting",
  "Project / Delivery",
  "Client Meeting",
  "Management Meeting",
  "Business Review",
  "HR Discussion",
  "Learning & Development",
  "Planning & Strategy",
  "Policy & Compliance",
  "Partner / Vendor",
  "Other"
];

type Meeting = {
    id: string;
    title: string;
    description: string;
    agendas: string;
    decisionsOutcomes: string;
    minutesOfMeeting?: string;
    date: any;
    link: string;
    type: typeof MEETING_TYPES[number];
    clientId?: string;
    clientName?: string;
    participantIds: string[];
    participantNames: string[];
    attendedIds?: string[];
    createdBy: string;
    createdByName: string;
    createdAt: any;
};

export default function MeetingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const prefilledClientId = searchParams.get('clientId');

    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [typeFilter, setTypeFilter] = React.useState<string>("all");
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [attendeesMeeting, setAttendeesMeeting] = React.useState<Meeting | null>(null);
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });
    const [momText, setMomText] = React.useState("");
    const [isSavingMom, setIsSavingMom] = React.useState(false);

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    
    const canSchedule = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';
    const isExecutive = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: allClients } = useCollection<any>(clientsQuery);

    const meetingsQuery = useMemoFirebase(() => {
        if (!user || !userRole) return null;
        const base = collection(firestore, 'meetings');
        
        if (isExecutive) {
            return query(base, orderBy('date', 'desc'));
        }

        return query(
            base, 
            or(where('participantIds', 'array-contains', user.uid), where('createdBy', '==', user.uid)),
            orderBy('date', 'desc')
        );
    }, [firestore, user, userRole, isExecutive]);

    const { data: meetings, isLoading } = useCollection<Meeting>(meetingsQuery);

    React.useEffect(() => {
        if (prefilledClientId && allClients) {
            const client = allClients.find(c => c.id === prefilledClientId);
            if (client) {
                setMeetingForm(prev => ({ ...prev, clientId: client.id, type: 'Client Meeting' }));
                setIsAddOpen(true);
            }
        }
    }, [prefilledClientId, allClients]);

    const handleCreateMeeting = async () => {
        if (!meetingForm.title || !meetingForm.date || !user || !userData) return;

        const client = allClients?.find(c => c.id === meetingForm.clientId);
        const selectedParticipants = allUsers?.filter(u => meetingForm.participantIds?.includes(u.id)) || [];

        const payload = {
            ...meetingForm,
            date: Timestamp.fromDate(new Date(meetingForm.date!)),
            clientName: client?.companyName || null,
            participantNames: selectedParticipants.map(p => `${p.firstName} ${p.lastName}`),
            createdBy: user.uid,
            createdByName: `${userData.firstName} ${userData.lastName}`,
            createdAt: serverTimestamp(),
            agendas: meetingForm.agendas || 'Standard review.',
            decisionsOutcomes: meetingForm.decisionsOutcomes || 'Pending discussion.',
            attendedIds: []
        };

        await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        toast({ title: 'Meeting Scheduled', description: 'Participants have been notified.' });
        setIsAddOpen(false);
        setMeetingForm({ title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    };

    const handleSaveMom = async () => {
        if (!selectedMeeting || !momText.trim()) return;
        setIsSavingMom(true);
        try {
            await updateDocumentNonBlocking(doc(firestore, 'meetings', selectedMeeting.id), {
                minutesOfMeeting: momText.trim()
            });
            toast({ title: "Minutes Saved" });
            setSelectedMeeting({ ...selectedMeeting, minutesOfMeeting: momText.trim() });
            setMomText("");
        } finally {
            setIsSavingMom(false);
        }
    };

    const now = new Date();
    const filteredMeetings = React.useMemo(() => {
        if (!meetings) return [];
        return meetings.filter(m => {
            const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (m.clientName && m.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const isPast = isBefore(m.date.toDate(), now);
            const matchesStatus = statusFilter === 'all' || 
                                 (statusFilter === 'upcoming' && !isPast) || 
                                 (statusFilter === 'past' && isPast);
                                 
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [meetings, searchQuery, statusFilter, typeFilter, now]);

    const upcomingCount = meetings?.filter(m => isAfter(m.date.toDate(), now)).length || 0;
    const nextMeeting = meetings?.filter(m => isAfter(m.date.toDate(), now)).sort((a,b) => a.date.toDate().getTime() - b.date.toDate().getTime())[0];

    const getStatusInfo = (date: Timestamp) => {
        const d = date.toDate();
        if (isBefore(d, now)) return { label: 'Completed', color: 'bg-emerald-50 text-emerald-600' };
        if (isBefore(d, addMinutes(now, 60))) return { label: 'Scheduled', color: 'bg-blue-50 text-blue-600' };
        return { label: 'Upcoming', color: 'bg-purple-50 text-purple-600' };
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('Client')) return <Video className="size-4 text-emerald-600" />;
        if (type.includes('Project')) return <Calendar className="size-4 text-blue-600" />;
        return <Users className="size-4 text-purple-600" />;
    };

    const getTypeBg = (type: string) => {
        if (type.includes('Client')) return 'bg-emerald-50';
        if (type.includes('Project')) return 'bg-blue-50';
        return 'bg-purple-50';
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="text-left">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meetings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Schedule and manage team or client calls.</p>
                </div>
                {canSchedule && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-6 rounded-lg font-bold bg-[#6D28D9] hover:bg-[#5B21B6] text-white gap-2 shadow-sm">
                                <Plus className="size-4" /> Schedule Meeting
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-2xl border-none shadow-3xl p-0 overflow-hidden">
                            <DialogHeader className="p-10 border-b bg-white text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Schedule Meeting</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Fill in the meeting details below</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] p-10 bg-muted/5">
                                <div className="space-y-8 text-left">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Title</Label>
                                            <Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="e.g., Weekly Sync" className="h-12 rounded-xl font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organizer</Label>
                                            <div className="h-12 bg-muted/30 border border-border flex items-center px-4 font-bold text-sm uppercase text-slate-500 rounded-xl">
                                                {userData?.firstName} {userData?.lastName}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Agenda</Label>
                                        <Textarea value={meetingForm.agendas} onChange={e => setMeetingForm({...meetingForm, agendas: e.target.value})} placeholder="What will be discussed?" className="rounded-xl min-h-[100px]" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Meeting Type</Label>
                                            <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {MEETING_TYPES.map(type => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date & Time</Label><Input type="datetime-local" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="h-12 rounded-xl font-bold" /></div>
                                    </div>
                                    
                                    {meetingForm.type === 'Client Meeting' && (
                                        <div className="space-y-2 animate-fade-in-up">
                                            <Label className="text-[10px] font-black uppercase text-primary">Select Client</Label>
                                            <Select value={meetingForm.clientId} onValueChange={v => setMeetingForm({...meetingForm, clientId: v})}>
                                                <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Which client?" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">{allClients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Link</Label><Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://..." className="h-12 rounded-xl" /></div>
                                    
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Participants</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border/50">
                                                    <Checkbox id={`u-${u.id}`} checked={meetingForm.participantIds?.includes(u.id)} onCheckedChange={c => {
                                                        const current = meetingForm.participantIds || [];
                                                        setMeetingForm({...meetingForm, participantIds: c ? [...current, u.id] : current.filter(id => id !== u.id)});
                                                    }} />
                                                    <Label htmlFor={`u-${u.id}`} className="flex-1 font-bold text-xs uppercase cursor-pointer flex items-center gap-2">
                                                        <Avatar className="size-6">
                                                            <AvatarImage src={u.avatar} />
                                                            <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">{u.firstName[0]}</AvatarFallback>
                                                        </Avatar>
                                                        {u.firstName} {u.lastName}
                                                        <span className="text-[8px] opacity-40 ml-auto">{u.jobTitle}</span>
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-10 border-t bg-white shrink-0">
                                <Button onClick={handleCreateMeeting} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">Schedule Meeting</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Video className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Upcoming Meetings</p>
                    <h3 className="text-3xl font-bold text-slate-900 mt-1">{upcomingCount}</h3>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                        Next: {nextMeeting ? `${isToday(nextMeeting.date.toDate()) ? 'Today' : format(nextMeeting.date.toDate(), 'dd MMM')}, ${format(nextMeeting.date.toDate(), 'p')}` : 'No sessions'}
                    </p>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Total Meetings</p>
                    <h3 className="text-3xl font-bold text-slate-900 mt-1">{meetings?.length || 0}</h3>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium">This Month</p>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><CalendarDays className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">This Month</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{format(new Date(), 'MMMM yyyy')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium">All Meetings</p>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input 
                            placeholder="Search meetings..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-11 bg-white border-slate-200 rounded-xl pl-12 text-sm font-medium" 
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl w-[140px] text-sm font-semibold text-slate-600">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="past">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl w-[140px] text-sm font-semibold text-slate-600">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Types</SelectItem>
                                {MEETING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-slate-200 bg-white">
                            <ListFilter className="size-4 text-slate-600" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-b border-slate-100">
                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 h-14 px-8 tracking-widest">Meeting</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 h-14 tracking-widest">Type</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 h-14 tracking-widest">Date & Time</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 h-14 tracking-widest">Organizer</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 h-14 tracking-widest">Status</TableHead>
                                <TableHead className="text-right px-8 font-bold text-[10px] uppercase text-slate-500 h-14 tracking-widest">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse opacity-20">Loading meetings...</TableCell></TableRow>
                            ) : filteredMeetings.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-medium italic">No meetings found.</TableCell></TableRow>
                            ) : filteredMeetings.map(m => {
                                const status = getStatusInfo(m.date);
                                const organizer = allUsers?.find(u => u.id === m.createdBy);

                                return (
                                    <TableRow key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer group" onClick={() => setSelectedMeeting(m)}>
                                        <TableCell className="py-6 px-8 text-left">
                                            <div className="space-y-1">
                                                <p className="font-bold text-sm text-slate-900 group-hover:text-[#6D28D9] transition-colors">{m.title}</p>
                                                <Badge variant="secondary" className="bg-indigo-50 text-[#6D28D9] text-[9px] font-bold px-2 h-5 rounded-md border-none uppercase">{m.type.split(' ')[0]} Call</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn("size-10 rounded-xl flex items-center justify-center shadow-sm border border-white/50", getTypeBg(m.type))}>
                                                {getTypeIcon(m.type)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-left">
                                                <p className="text-xs font-bold text-slate-700">{format(m.date.toDate(), 'dd MMM yyyy')}</p>
                                                <p className="text-[10px] font-medium text-slate-400 mt-0.5">{format(m.date.toDate(), 'p')}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8 rounded-full border border-white shadow-sm">
                                                    <AvatarImage src={organizer?.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px] font-bold bg-muted">{m.createdByName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs font-bold text-slate-700">{m.createdByName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("rounded-lg font-bold text-[10px] px-3 h-7 border-none", status.color)}>
                                                {status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-8" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-10 hover:bg-slate-100 rounded-xl">
                                                        <MoreHorizontal className="size-5 text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2">
                                                    <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-indigo-50 text-slate-700">
                                                        <Eye className="size-4 text-indigo-600" /> View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setAttendeesMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-indigo-50 text-slate-700">
                                                        <Users className="size-4 text-indigo-600" /> Attendee Hub
                                                    </DropdownMenuItem>
                                                    {m.link && (
                                                        <DropdownMenuItem onClick={() => window.open(m.link, '_blank')} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-emerald-50 text-slate-700">
                                                            <ExternalLink className="size-4 text-emerald-600" /> Join Meeting
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(isExecutive || m.createdBy === user?.uid) && (
                                                        <>
                                                            <DropdownMenuSeparator className="my-2" />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-red-50 text-rose-600">
                                                                        <Trash2 className="size-4" /> Purge Meeting
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="rounded-3xl border-none shadow-3xl">
                                                                    <AlertDialogHeader className="text-left">
                                                                        <AlertDialogTitle className="text-xl font-bold text-slate-900">Delete Meeting?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                                                            This will permanently remove "{m.title}" from the registry. This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter className="mt-8 gap-3">
                                                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))} className="rounded-full font-bold uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700">Confirm Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Attendance Hub Dialog */}
            <Dialog open={!!attendeesMeeting} onOpenChange={o => !o && setAttendeesMeeting(null)}>
                <DialogContent className="rounded-3xl border-none shadow-3xl sm:max-w-md p-0 overflow-hidden flex flex-col">
                    <DialogHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-[#6D28D9] rounded-lg"><Users className="size-5" /></div>
                            Attendee Hub
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-400 mt-1">Verified participant list for tracking attendance.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 max-h-[50vh] bg-slate-50/50">
                        <div className="p-4 space-y-2">
                            {(meetings?.find(m => m.id === attendeesMeeting?.id) || attendeesMeeting)?.participantIds.map((id, i) => {
                                const currentMeeting = meetings?.find(m => m.id === attendeesMeeting?.id) || attendeesMeeting!;
                                const member = allUsers?.find(u => u.id === id);
                                const isHost = currentMeeting.createdBy === user?.uid;
                                const isAttending = currentMeeting.attendedIds?.includes(id);

                                return (
                                    <div key={id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-indigo-200 transition-all">
                                        {isHost && (
                                            <Checkbox 
                                                checked={isAttending} 
                                                onCheckedChange={(checked) => {
                                                    const currentAttended = currentMeeting.attendedIds || [];
                                                    const updated = checked 
                                                        ? [...currentAttended, id] 
                                                        : currentAttended.filter(aid => aid !== id);
                                                    updateDocumentNonBlocking(doc(firestore, 'meetings', currentMeeting.id), {
                                                        attendedIds: updated
                                                    });
                                                }}
                                                className="rounded-lg size-5 border-slate-200 data-[state=checked]:bg-[#6D28D9] data-[state=checked]:border-[#6D28D9]"
                                            />
                                        )}
                                        <Avatar className="size-10 rounded-full border-2 border-white shadow-sm">
                                            <AvatarImage src={member?.avatar} className="object-cover" />
                                            <AvatarFallback className="text-xs font-bold bg-slate-100">{currentMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-bold text-sm text-slate-800 truncate">{currentMeeting.participantNames[i]}</p>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight truncate">{member?.jobTitle || 'Team Member'}</p>
                                        </div>
                                        {id === currentMeeting.createdBy && (
                                            <Badge variant="secondary" className="rounded-md bg-indigo-50 text-[#6D28D9] font-bold text-[8px] uppercase h-5 px-2">Host</Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0">
                        <Button className="w-full h-12 rounded-xl font-bold bg-slate-900 text-white text-sm" onClick={() => setAttendeesMeeting(null)}>Close Hub</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Details Sheet */}
            <Sheet open={!!selectedMeeting} onOpenChange={o => !o && setSelectedMeeting(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-indigo-50 text-[#6D28D9] border-none rounded-md text-[9px] font-bold h-6 uppercase tracking-widest px-3 shadow-sm">
                                {selectedMeeting?.type}
                            </Badge>
                            {selectedMeeting && isBefore(selectedMeeting.date.toDate(), now) && (
                                <Badge className="bg-slate-100 text-slate-500 border-none rounded-md text-[9px] font-bold uppercase px-3 h-6">Archived Session</Badge>
                            )}
                        </div>
                        <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900 leading-tight text-left">{selectedMeeting?.title}</SheetTitle>
                        <p className="text-sm font-medium text-slate-400 mt-2">Briefing Terminal</p>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Time & Date</Label>
                                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="size-11 rounded-xl bg-[#6D28D9] text-white flex items-center justify-center shadow-lg shadow-indigo-200"><Calendar className="size-5"/></div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-900">{selectedMeeting && format(selectedMeeting.date.toDate(), 'PPP')}</p>
                                                <p className="text-[11px] font-bold text-[#6D28D9] uppercase mt-0.5">{selectedMeeting && format(selectedMeeting.date.toDate(), 'p')}</p>
                                            </div>
                                        </div>
                                        {selectedMeeting?.link && !isBefore(selectedMeeting.date.toDate(), now) && (
                                            <Button className="w-full h-11 rounded-xl font-bold bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs gap-2 shadow-lg shadow-indigo-100" onClick={() => window.open(selectedMeeting.link, '_blank')}>
                                                <ExternalLink className="size-4" /> Open Meeting Link
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Organizer</Label>
                                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4">
                                        <Avatar className="size-14 rounded-full border-4 border-slate-50 shadow-sm">
                                            <AvatarFallback className="bg-indigo-50 text-[#6D28D9] font-bold text-lg">{selectedMeeting?.createdByName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-900">{selectedMeeting?.createdByName}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Host Organizer</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[#6D28D9] font-black uppercase text-[10px] tracking-widest">
                                        <ClipboardList className="size-4" /> Meeting Agenda
                                    </div>
                                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"{selectedMeeting?.agendas || 'Standard review.'}"</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Participants</h4>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded-md h-5 px-2">{selectedMeeting?.participantIds.length} Members</Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {selectedMeeting?.participantIds.map((id, i) => (
                                        <div key={id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl group hover:border-indigo-200 transition-all">
                                            <Avatar className="size-8 rounded-full border border-white shadow-sm">
                                                <AvatarFallback className="text-[10px] font-bold uppercase text-slate-700">{selectedMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] font-bold uppercase text-slate-700">{selectedMeeting.participantNames[i]}</span>
                                            {id === selectedMeeting.createdBy && <div className="size-2 rounded-full bg-[#6D28D9] ml-auto" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6 pt-6 border-t border-slate-100 text-left">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-600 font-black uppercase text-[10px] tracking-widest">
                                        <FileCheck className="size-4" /> Meeting Minutes (MOM)
                                    </div>
                                </div>

                                {selectedMeeting?.minutesOfMeeting ? (
                                    <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl shadow-sm relative overflow-hidden group">
                                        <p className="text-sm font-medium text-emerald-900 whitespace-pre-wrap leading-relaxed relative z-10 italic">
                                            "{selectedMeeting.minutesOfMeeting}"
                                        </p>
                                    </div>
                                ) : (
                                    selectedMeeting?.createdBy === user?.uid ? (
                                        <div className="space-y-4 animate-fade-in-up">
                                            <Textarea 
                                                value={momText} 
                                                onChange={e => setMomText(e.target.value)} 
                                                placeholder="Document the outcomes and decisions here..." 
                                                className="rounded-xl min-h-[160px] bg-white border-slate-200 focus-visible:ring-[#6D28D9] font-medium text-sm"
                                            />
                                            <Button 
                                                onClick={handleSaveMom} 
                                                disabled={isSavingMom || !momText.trim()}
                                                className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-100"
                                            >
                                                {isSavingMom ? <Loader2 className="animate-spin size-4 mr-2"/> : <FileCheck className="size-4 mr-2"/>}
                                                Save Minutes
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                                            <Clock className="size-10" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Minutes Pending Update</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}

