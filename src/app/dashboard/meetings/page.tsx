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
    ChevronLeft, ListFilter, CalendarDays, Copy, PenLine, FileEdit, MessageSquareText
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [typeFilter, setTypeFilter] = React.useState<string>("all");
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [attendeesMeeting, setAttendeesMeeting] = React.useState<Meeting | null>(null);
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });
    const [momText, setMomText] = React.useState("");
    const [decisionsText, setDecisionsText] = React.useState("");
    const [isSavingNotes, setIsSavingNotes] = React.useState(false);

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    
    const canSchedule = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';
    const isExecutive = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';
    const isCEO = userRole === 'CEO/Admin' || userRole === 'CEO/MD';

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

    const handleCreateOrUpdateMeeting = async () => {
        if (!meetingForm.title || !meetingForm.date || !user || !userData) return;

        const client = allClients?.find(c => c.id === meetingForm.clientId);
        const selectedParticipants = allUsers?.filter(u => meetingForm.participantIds?.includes(u.id)) || [];

        const payload = {
            ...meetingForm,
            date: Timestamp.fromDate(new Date(meetingForm.date!)),
            clientName: client?.companyName || null,
            participantNames: selectedParticipants.map(p => `${p.firstName} ${p.lastName}`),
            createdBy: editingMeeting ? editingMeeting.createdBy : user.uid,
            createdByName: editingMeeting ? editingMeeting.createdByName : `${userData.firstName} ${userData.lastName}`,
            createdAt: editingMeeting ? editingMeeting.createdAt : serverTimestamp(),
            agendas: meetingForm.agendas || 'Standard review.',
            decisionsOutcomes: meetingForm.decisionsOutcomes || 'Pending discussion.',
            attendedIds: editingMeeting ? editingMeeting.attendedIds || [] : []
        };

        if (editingMeeting) {
            await updateDocumentNonBlocking(doc(firestore, 'meetings', editingMeeting.id), payload);
            toast({ title: 'Meeting Updated' });
        } else {
            await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
            toast({ title: 'Meeting Scheduled' });
        }
        
        setIsAddOpen(false);
        setEditingMeeting(null);
        setMeetingForm({ title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    };

    const handleDuplicateMeeting = (m: Meeting) => {
        const payload = {
            ...m,
            title: `${m.title} (Copy)`,
            date: Timestamp.fromDate(addMinutes(new Date(), 60)), // Default to 1 hour from now
            createdAt: serverTimestamp(),
            createdBy: user?.uid,
            createdByName: userData ? `${userData.firstName} ${userData.lastName}` : 'System',
            attendedIds: [],
            minutesOfMeeting: ""
        };
        delete (payload as any).id;
        addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        toast({ title: "Meeting Duplicated", description: "New draft added to schedule." });
    };

    const handleSaveNotes = async () => {
        if (!selectedMeeting) return;
        setIsSavingNotes(true);
        try {
            const updates: any = {};
            if (momText.trim()) updates.minutesOfMeeting = momText.trim();
            if (decisionsText.trim()) updates.decisionsOutcomes = decisionsText.trim();

            if (Object.keys(updates).length > 0) {
                await updateDocumentNonBlocking(doc(firestore, 'meetings', selectedMeeting.id), updates);
                toast({ title: "Protocol Saved", description: "Meeting record updated." });
                setSelectedMeeting({ ...selectedMeeting, ...updates });
                setMomText("");
                setDecisionsText("");
            }
        } finally {
            setIsSavingNotes(false);
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Meetings</h1>
                    <p className="text-sm text-muted-foreground mt-1.5 uppercase font-black text-[10px] tracking-widest opacity-60">Manage team and client briefings.</p>
                </div>
                {canSchedule && (
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) setEditingMeeting(null); setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-6 rounded-lg font-bold bg-[#6D28D9] hover:bg-[#5B21B6] text-white gap-2 shadow-sm uppercase text-[10px] tracking-widest">
                                <Plus className="size-4" /> New Meeting
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-2xl border-none shadow-3xl p-0 overflow-hidden">
                            <DialogHeader className="p-10 border-b bg-white text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">
                                    {editingMeeting ? "Update Briefing" : "New Meeting"}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Mission parameters setup</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] p-10 bg-muted/5">
                                <div className="space-y-8 text-left">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Title</Label>
                                            <Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="e.g., Weekly Sync" className="h-12 rounded-xl font-bold uppercase text-xs" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organizer</Label>
                                            <div className="h-12 bg-muted/30 border border-border flex items-center px-4 font-bold text-xs uppercase text-slate-500 rounded-xl">
                                                {editingMeeting ? editingMeeting.createdByName : `${userData?.firstName} ${userData?.lastName}`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Topics / Agenda</Label>
                                        <Textarea value={meetingForm.agendas} onChange={e => setMeetingForm({...meetingForm, agendas: e.target.value})} placeholder="Primary discussion objectives..." className="rounded-xl min-h-[100px] text-sm" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                                            <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                <SelectTrigger className="h-12 rounded-xl font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {MEETING_TYPES.map(type => (
                                                        <SelectItem key={type} value={type} className="uppercase font-bold text-[10px]">{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date & Time</Label><Input type="datetime-local" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="h-12 rounded-xl font-bold" /></div>
                                    </div>
                                    
                                    {meetingForm.type === 'Client Meeting' && (
                                        <div className="space-y-2 animate-fade-in-up">
                                            <Label className="text-[10px] font-black uppercase text-primary">Target Client</Label>
                                            <Select value={meetingForm.clientId} onValueChange={v => setMeetingForm({...meetingForm, clientId: v})}>
                                                <SelectTrigger className="h-12 rounded-xl font-bold uppercase text-[10px]"><SelectValue placeholder="Which client?" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">{allClients?.map(c => <SelectItem key={c.id} value={c.id} className="uppercase font-bold text-[10px]">{c.companyName}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Link</Label><Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://..." className="h-12 rounded-xl" /></div>
                                    
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Participants Hub</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border/50 hover:border-primary/20 transition-colors">
                                                    <Checkbox id={`u-${u.id}`} checked={meetingForm.participantIds?.includes(u.id)} onCheckedChange={c => {
                                                        const current = meetingForm.participantIds || [];
                                                        setMeetingForm({...meetingForm, participantIds: c ? [...current, u.id] : current.filter(id => id !== u.id)});
                                                    }} className="rounded-md" />
                                                    <Label htmlFor={`u-${u.id}`} className="flex-1 font-bold text-[11px] uppercase cursor-pointer flex items-center gap-3">
                                                        <Avatar className="size-8 rounded-full">
                                                            <AvatarImage src={u.avatar} className="object-cover" />
                                                            <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">{u.firstName[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="leading-none">{u.firstName} {u.lastName}</span>
                                                            <span className="text-[8px] opacity-40 mt-1">{u.jobTitle}</span>
                                                        </div>
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-10 border-t bg-white shrink-0">
                                <Button onClick={handleCreateOrUpdateMeeting} className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 text-xs">
                                    {editingMeeting ? "Finalize Changes" : "Finalize Mission Briefing"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Tactical Stat Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left ring-1 ring-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Video className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Upcoming Briefings</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{upcomingCount}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60">
                        Next: {nextMeeting ? `${isToday(nextMeeting.date.toDate()) ? 'Today' : format(nextMeeting.date.toDate(), 'dd MMM')}, ${format(nextMeeting.date.toDate(), 'p')}` : 'None Scheduled'}
                    </p>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left ring-1 ring-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Total Missions</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{meetings?.length || 0}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60">Master Registry</p>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left ring-1 ring-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><CalendarDays className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Cycle Activity</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-1 uppercase truncate">{format(new Date(), 'MMMM yyyy')}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60">Active Mission Cycle</p>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                    <div className="relative flex-1 w-full text-left group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Search briefing titles..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-11 bg-white border-slate-200 rounded-xl pl-12 text-sm font-semibold uppercase tracking-tight placeholder:opacity-40" 
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl w-[140px] text-[10px] font-black uppercase tracking-widest text-slate-600">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all" className="text-[10px] font-black uppercase">All Status</SelectItem>
                                <SelectItem value="upcoming" className="text-[10px] font-black uppercase text-primary">Upcoming</SelectItem>
                                <SelectItem value="past" className="text-[10px] font-black uppercase text-emerald-600">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl w-[140px] text-[10px] font-black uppercase tracking-widest text-slate-600">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all" className="text-[10px] font-black uppercase">All Types</SelectItem>
                                {MEETING_TYPES.map(t => <SelectItem key={t} value={t} className="text-[10px] font-black uppercase">{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-slate-200 bg-white">
                            <ListFilter className="size-4 text-slate-600" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden ring-1 ring-border/50">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-b border-slate-100">
                                <TableHead className="font-black text-[9px] uppercase text-slate-500 h-14 px-8 tracking-[0.2em]">Briefing Identity</TableHead>
                                <TableHead className="font-black text-[9px] uppercase text-slate-500 h-14 tracking-[0.2em]">Class</TableHead>
                                <TableHead className="font-black text-[9px] uppercase text-slate-500 h-14 tracking-[0.2em]">Range</TableHead>
                                <TableHead className="font-black text-[9px] uppercase text-slate-500 h-14 tracking-[0.2em]">Host</TableHead>
                                <TableHead className="font-black text-[9px] uppercase text-slate-500 h-14 tracking-[0.2em]">Status</TableHead>
                                <TableHead className="text-right px-8 font-black text-[9px] uppercase text-slate-500 h-14 tracking-[0.2em]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20 tracking-[0.4em]">Scanning Database...</TableCell></TableRow>
                            ) : filteredMeetings.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-bold italic uppercase text-[10px] tracking-widest opacity-30">No matching records found.</TableCell></TableRow>
                            ) : filteredMeetings.map(m => {
                                const status = getStatusInfo(m.date);
                                const isPast = isBefore(m.date.toDate(), now);
                                const organizer = allUsers?.find(u => u.id === m.createdBy);
                                const canDelete = isCEO || m.createdBy === user?.uid;

                                return (
                                    <TableRow key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer group" onClick={() => setSelectedMeeting(m)}>
                                        <TableCell className="py-6 px-8 text-left">
                                            <div className="space-y-1">
                                                <p className="font-black text-[13px] text-slate-900 uppercase tracking-tight group-hover:text-primary transition-colors">{m.title}</p>
                                                <Badge variant="secondary" className="bg-primary/5 text-primary text-[8px] font-black px-2 h-5 rounded-none border-none uppercase tracking-widest">{m.type}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn("size-10 rounded-xl flex items-center justify-center shadow-sm border border-white/50", getTypeBg(m.type))}>
                                                {getTypeIcon(m.type)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <div className="text-left">
                                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{format(m.date.toDate(), 'dd MMM yyyy')}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40 mt-1">{format(m.date.toDate(), 'p')}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8 rounded-full border-2 border-white shadow-sm ring-1 ring-border/50">
                                                    <AvatarImage src={organizer?.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[9px] font-black bg-muted uppercase">{m.createdByName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{m.createdByName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("rounded-none font-black text-[8px] px-3 h-7 border-none uppercase tracking-widest shadow-sm", status.color)}>
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
                                                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-none shadow-3xl p-2 bg-white/95 backdrop-blur-xl">
                                                    <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight">
                                                        <Eye className="size-4 text-primary" /> View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setAttendeesMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight">
                                                        <Users className="size-4 text-primary" /> Attendance
                                                    </DropdownMenuItem>

                                                    {/* Contextual Menus Based on Status */}
                                                    {!isPast ? (
                                                        <>
                                                            {m.link && (
                                                                <DropdownMenuItem onClick={() => window.open(m.link, '_blank')} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-emerald-50 text-emerald-700 uppercase tracking-tight">
                                                                    <ExternalLink className="size-4" /> Join Meeting
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => { setEditingMeeting(m); setMeetingForm({...m, date: format(m.date.toDate(), "yyyy-MM-dd'T'HH:mm")}); setIsAddOpen(true); }} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight">
                                                                <PenLine className="size-4 text-primary" /> Edit Meeting
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-amber-50 text-amber-800 uppercase tracking-tight">
                                                                <MessageSquareText className="size-4" /> Meeting Remarks
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-indigo-50 text-indigo-800 uppercase tracking-tight">
                                                                <Target className="size-4" /> Decisions & Outcomes
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    <DropdownMenuItem onClick={() => handleDuplicateMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight">
                                                        <Copy className="size-4 text-primary" /> Duplicate Meeting
                                                    </DropdownMenuItem>

                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator className="my-2 bg-slate-100" />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-red-50 text-rose-600 uppercase tracking-tight">
                                                                        <Trash2 className="size-4" /> {isPast ? "Delete Meeting" : "Cancel Meeting"}
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="rounded-3xl border-none shadow-3xl">
                                                                    <AlertDialogHeader className="text-left">
                                                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">{isPast ? "Delete Log?" : "Cancel Meeting?"}</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-sm font-medium leading-relaxed opacity-60">
                                                                            This action will permanently remove the record for "{m.title}" from the organizational registry.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter className="mt-8 gap-3">
                                                                        <AlertDialogCancel className="rounded-full font-black uppercase text-[10px] h-11 px-8">Abort</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))} className="rounded-full font-black uppercase text-[10px] h-11 px-8 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Confirm</AlertDialogAction>
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

            {/* Attendees Terminal */}
            <Dialog open={!!attendeesMeeting} onOpenChange={o => !o && setAttendeesMeeting(null)}>
                <DialogContent className="rounded-3xl border-none shadow-3xl sm:max-w-md p-0 overflow-hidden flex flex-col h-[70vh]">
                    <DialogHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-3">
                            <div className="p-2 bg-primary/5 text-primary rounded-lg shadow-sm"><Users className="size-5" /></div>
                            Attendance Hub
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Verified Personnel Presence</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-muted/5">
                        <div className="p-6 space-y-2">
                            {(meetings?.find(m => m.id === attendeesMeeting?.id) || attendeesMeeting)?.participantIds.map((id, i) => {
                                const currentMeeting = meetings?.find(m => m.id === attendeesMeeting?.id) || attendeesMeeting!;
                                const member = allUsers?.find(u => u.id === id);
                                const isHost = currentMeeting.createdBy === user?.uid;
                                const isAttending = currentMeeting.attendedIds?.includes(id);

                                return (
                                    <div key={id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:ring-2 ring-primary/10 transition-all">
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
                                                className="rounded-md size-5"
                                            />
                                        )}
                                        <Avatar className="size-10 rounded-full border-2 border-white shadow-sm ring-1 ring-border/50">
                                            <AvatarImage src={member?.avatar} className="object-cover" />
                                            <AvatarFallback className="text-[10px] font-black bg-muted uppercase">{currentMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-black text-sm text-slate-800 truncate uppercase tracking-tight">{currentMeeting.participantNames[i]}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{member?.jobTitle || 'Fleet Personnel'}</p>
                                        </div>
                                        {id === currentMeeting.createdBy && (
                                            <Badge className="rounded-none bg-primary text-white font-black text-[7px] uppercase tracking-widest h-4 px-2">Host</Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0">
                        <Button className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl" onClick={() => setAttendeesMeeting(null)}>Close Terminal</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Details Terminal */}
            <Sheet open={!!selectedMeeting} onOpenChange={o => !o && setSelectedMeeting(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-10 border-b bg-white shrink-0 text-left shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-primary text-white border-none rounded-none text-[8px] font-black h-5 uppercase tracking-widest px-3 shadow-md">
                                {selectedMeeting?.type}
                            </Badge>
                            {selectedMeeting && isBefore(selectedMeeting.date.toDate(), now) && (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[8px] font-black uppercase tracking-widest h-5 px-3">Mission Concluded</Badge>
                            )}
                        </div>
                        <SheetTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none text-left">{selectedMeeting?.title}</SheetTitle>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mt-3">Registry Briefing</p>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-10 space-y-12 pb-32 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Active Time</Label>
                                    <div className="p-6 bg-white border-2 border-dashed border-border rounded-none shadow-sm space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-none bg-primary text-white flex items-center justify-center shadow-lg"><Calendar className="size-6"/></div>
                                            <div className="text-left">
                                                <p className="text-sm font-black text-slate-900 uppercase">{selectedMeeting && format(selectedMeeting.date.toDate(), 'PPP')}</p>
                                                <p className="text-[11px] font-black text-primary uppercase mt-1 opacity-60">{selectedMeeting && format(selectedMeeting.date.toDate(), 'p')}</p>
                                            </div>
                                        </div>
                                        {selectedMeeting?.link && !isBefore(selectedMeeting.date.toDate(), now) && (
                                            <Button className="w-full h-12 rounded-none font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" onClick={() => window.open(selectedMeeting.link, '_blank')}>
                                                <ExternalLink className="size-4 mr-2" /> Start Call
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Mission Host</Label>
                                    <div className="p-6 bg-white ring-1 ring-border rounded-none shadow-sm flex items-center gap-4">
                                        <Avatar className="size-14 rounded-none border-4 border-muted shadow-md">
                                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xl uppercase">{selectedMeeting?.createdByName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <p className="text-base font-black text-slate-900 uppercase leading-none">{selectedMeeting?.createdByName}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-2 tracking-widest">Auth. Representative</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ClipboardList className="size-4" /> Discussion Points
                                    </h4>
                                    <div className="p-8 bg-white ring-1 ring-border shadow-sm rounded-none border-l-8 border-primary">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{selectedMeeting?.agendas || 'Standard operational review.'}"</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Deployment List</h4>
                                    <Badge variant="outline" className="bg-muted/30 text-muted-foreground text-[9px] font-black uppercase rounded-none h-6 px-3">{selectedMeeting?.participantIds.length} Personnel</Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedMeeting?.participantIds.map((id, i) => (
                                        <div key={id} className="flex items-center gap-4 p-4 bg-white ring-1 ring-border rounded-none group hover:ring-primary/40 transition-all">
                                            <Avatar className="size-8 rounded-none border-2 border-white shadow-sm ring-1 ring-border/50">
                                                <AvatarFallback className="text-[10px] font-black uppercase text-slate-700">{selectedMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] font-black uppercase text-slate-700 tracking-tight truncate">{selectedMeeting.participantNames[i]}</span>
                                            {selectedMeeting.attendedIds?.includes(id) && <CheckCircle2 className="size-3 text-emerald-600 ml-auto" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Retrospective Data Management */}
                            <div className="space-y-8 pt-8 border-t-4 border-double border-border/50">
                                <div className="space-y-6 text-left">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                        <FileCheck className="size-4" /> Post-Mission Terminal
                                    </h4>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Meeting Remarks</Label>
                                        {selectedMeeting?.minutesOfMeeting ? (
                                            <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-none shadow-sm italic text-emerald-900 text-sm whitespace-pre-wrap">
                                                "{selectedMeeting.minutesOfMeeting}"
                                            </div>
                                        ) : (
                                            selectedMeeting?.createdBy === user?.uid && (
                                                <Textarea 
                                                    value={momText} 
                                                    onChange={e => setMomText(e.target.value)} 
                                                    placeholder="Stamping mission remarks..." 
                                                    className="rounded-none min-h-[120px] bg-white border-2 border-dashed focus-visible:ring-primary"
                                                />
                                            )
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Decisions & Outcomes</Label>
                                        {selectedMeeting?.decisionsOutcomes && selectedMeeting.decisionsOutcomes !== 'Pending discussion.' ? (
                                            <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-none shadow-sm font-bold text-indigo-900 text-sm whitespace-pre-wrap uppercase tracking-tight">
                                                {selectedMeeting.decisionsOutcomes}
                                            </div>
                                        ) : (
                                            selectedMeeting?.createdBy === user?.uid && (
                                                <Textarea 
                                                    value={decisionsText} 
                                                    onChange={e => setDecisionsText(e.target.value)} 
                                                    placeholder="Finalizing mission directives..." 
                                                    className="rounded-none min-h-[120px] bg-white border-2 border-dashed focus-visible:ring-primary"
                                                />
                                            )
                                        )}
                                    </div>

                                    {selectedMeeting?.createdBy === user?.uid && (!selectedMeeting?.minutesOfMeeting || (selectedMeeting?.decisionsOutcomes === 'Pending discussion.')) && (
                                        <Button 
                                            onClick={handleSaveNotes} 
                                            disabled={isSavingNotes || (!momText.trim() && !decisionsText.trim())}
                                            className="w-full h-14 rounded-none font-black uppercase text-xs tracking-widest shadow-2xl"
                                        >
                                            {isSavingNotes ? <Loader2 className="animate-spin size-4 mr-2"/> : <FileCheck className="size-4 mr-2"/>}
                                            Lock Mission Records
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}
