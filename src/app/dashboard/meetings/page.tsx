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
    ChevronLeft, ListFilter, CalendarDays, Copy, PenLine, FileEdit, MessageSquareText,
    History, Repeat, AlertTriangle, Check, Mail, ListTodo, PlusCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, isToday, startOfDay, addMinutes, formatDistanceToNow, addDays, addWeeks, endOfMonth } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
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
    status: 'active' | 'cancelled';
    cancellationReason?: string;
    durationMinutes: number;
    location?: string;
    reminder?: string;
    notificationType?: string;
};

export default function MeetingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const prefilledClientId = searchParams.get('clientId');

    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isParticipantSheetOpen, setIsParticipantSheetOpen] = React.useState(false);
    const [participantSearch, setParticipantSearch] = React.useState("");
    
    const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [typeFilter, setTypeFilter] = React.useState<string>("all");
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), durationMinutes: 60, location: '', reminder: '30 minutes before', notificationType: 'Email and In-App'
    });

    // Cancellation State
    const [cancellingMeeting, setCancellingMeeting] = React.useState<Meeting | null>(null);
    const [cancelReason, setCancelReason] = React.useState("");

    // Duplication State
    const [duplicatingMeeting, setDuplicationMeeting] = React.useState<Meeting | null>(null);
    const [newDupTitle, setNewDupTitle] = React.useState("");
    const [newDupDate, setNewDupDate] = React.useState("");
    const [newDupParticipantIds, setNewDupParticipantIds] = React.useState<string[]>([]);
    const [dupOptions, setDupOptions] = React.useState({
        samePeople: true,
        sameTitle: true,
        sameDate: false,
        recurrence: 'once' as 'once' | 'daily' | 'weekly' | 'month-end'
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
            attendedIds: editingMeeting ? editingMeeting.attendedIds || [] : [],
            status: 'active',
            durationMinutes: Number(meetingForm.durationMinutes) || 60,
            location: meetingForm.location || '',
            reminder: meetingForm.reminder || '30 minutes before',
            notificationType: meetingForm.notificationType || 'Email and In-App'
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
        setMeetingForm({ title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Team Meeting', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), durationMinutes: 60, location: '', reminder: '30 minutes before', notificationType: 'Email and In-App' });
    };

    const handleDuplicateFinal = async () => {
        if (!duplicatingMeeting || !user) return;

        const baseDate = dupOptions.sameDate ? duplicatingMeeting.date.toDate() : (newDupDate ? new Date(newDupDate) : addMinutes(new Date(), 60));
        const datesToCreate = [];

        if (dupOptions.recurrence === 'once') {
            datesToCreate.push(baseDate);
        } else if (dupOptions.recurrence === 'daily') {
            for (let i = 0; i < 5; i++) datesToCreate.push(addDays(baseDate, i));
        } else if (dupOptions.recurrence === 'weekly') {
            for (let i = 0; i < 4; i++) datesToCreate.push(addWeeks(baseDate, i));
        } else if (dupOptions.recurrence === 'month-end') {
            datesToCreate.push(endOfMonth(baseDate));
        }

        const participants = dupOptions.samePeople ? duplicatingMeeting.participantIds : newDupParticipantIds;
        const participantNames = dupOptions.samePeople 
            ? duplicatingMeeting.participantNames 
            : allUsers?.filter(u => newDupParticipantIds.includes(u.id)).map(p => `${p.firstName} ${p.lastName}`) || [];

        for (const targetDate of datesToCreate) {
            const payload = {
                ...duplicatingMeeting,
                title: dupOptions.sameTitle ? duplicatingMeeting.title : (newDupTitle || duplicatingMeeting.title),
                date: Timestamp.fromDate(targetDate),
                createdAt: serverTimestamp(),
                createdBy: user.uid,
                createdByName: userData ? `${userData.firstName} ${userData.lastName}` : 'System',
                attendedIds: [],
                minutesOfMeeting: "",
                status: 'active',
                participantIds: participants,
                participantNames: participantNames
            };
            delete (payload as any).id;
            await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        }

        toast({ title: "Meeting Duplicated", description: `${datesToCreate.length} meetings added.` });
        setDuplicationMeeting(null);
    };

    const handleCancelMeeting = async () => {
        if (!cancellingMeeting || !cancelReason.trim()) return;
        await updateDocumentNonBlocking(doc(firestore, 'meetings', cancellingMeeting.id), {
            status: 'cancelled',
            cancellationReason: cancelReason.trim(),
            lastUpdated: serverTimestamp()
        });
        toast({ title: "Meeting Cancelled", description: "Reason broadcasted to participants." });
        setCancellingMeeting(null);
        setCancelReason("");
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
                toast({ title: "Notes Saved", description: "Meeting record updated." });
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
                                 (statusFilter === 'upcoming' && !isPast && m.status !== 'cancelled') || 
                                 (statusFilter === 'past' && isPast);
                                 
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [meetings, searchQuery, statusFilter, typeFilter, now]);

    const totalDuration = React.useMemo(() => {
        return filteredMeetings.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    }, [filteredMeetings]);

    const upcomingCount = meetings?.filter(m => isAfter(m.date.toDate(), now) && m.status !== 'cancelled').length || 0;
    const nextMeeting = meetings?.filter(m => isAfter(m.date.toDate(), now) && m.status !== 'cancelled').sort((a,b) => a.date.toDate().getTime() - b.date.toDate().getTime())[0];

    const getStatusInfo = (date: Timestamp, mStatus?: string) => {
        if (mStatus === 'cancelled') return { label: 'Cancelled', color: 'bg-rose-50 text-rose-600' };
        const d = date.toDate();
        if (isBefore(d, now)) return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700' };
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
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta max-w-7xl mx-auto px-4 text-left">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                <div className="text-left">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none uppercase">Meetings</h1>
                    <p className="text-sm text-muted-foreground mt-1.5 uppercase font-black text-[10px] tracking-widest opacity-60">Manage operational briefs and strategic debriefs.</p>
                </div>
                {canSchedule && (
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) setEditingMeeting(null); setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-6 rounded-lg font-bold bg-[#6D28D9] hover:bg-[#5B21B6] text-white gap-2 shadow-sm uppercase text-[10px] tracking-widest">
                                <Plus className="size-4" /> New Meeting
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-2xl border-none shadow-3xl p-0 overflow-hidden flex flex-col h-[90vh] text-left">
                            <DialogHeader className="p-8 border-b bg-white shrink-0 text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 text-left">Schedule Meeting</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60 text-left">Create and schedule a new internal meeting</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5 text-left">
                                <div className="p-8 space-y-10 text-left">
                                    <div className="space-y-6 text-left">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary text-left">Meeting Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Title *</Label>
                                                <Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="August Business Goals Setting Meeting" className="h-12 rounded-xl font-bold" required />
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Type *</Label>
                                                <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {MEETING_TYPES.map(type => (
                                                            <SelectItem key={type} value={type} className="uppercase font-bold text-[10px]">{type}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-left">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Purpose / Agenda *</Label>
                                            <div className="relative">
                                                <Textarea value={meetingForm.agendas} onChange={e => setMeetingForm({...meetingForm, agendas: e.target.value})} placeholder="Define August business goals, revenue targets, team responsibilities..." className="rounded-xl min-h-[120px] text-sm" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date *</Label>
                                                <div className="relative">
                                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                                    <Input type="date" value={meetingForm.date?.split('T')[0]} onChange={e => setMeetingForm({...meetingForm, date: `${e.target.value}T${meetingForm.date?.split('T')[1] || '09:00'}`})} className="h-12 rounded-xl font-bold pl-10" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Start Time *</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                                    <Input type="time" value={meetingForm.date?.split('T')[1]} onChange={e => setMeetingForm({...meetingForm, date: `${meetingForm.date?.split('T')[0] || format(new Date(), 'yyyy-MM-dd')}T${e.target.value}`})} className="h-12 rounded-xl font-bold pl-10" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Duration *</Label>
                                                <Select value={meetingForm.durationMinutes?.toString()} onValueChange={v => setMeetingForm({...meetingForm, durationMinutes: Number(v)})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold uppercase text-[10px]"><SelectValue placeholder="Select" /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="30">30 minutes</SelectItem>
                                                        <SelectItem value="60">60 minutes</SelectItem>
                                                        <SelectItem value="90">90 minutes</SelectItem>
                                                        <SelectItem value="120">120 minutes</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Link (Teams / Meet / Zoom)</Label>
                                                <div className="relative">
                                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary opacity-60" />
                                                    <Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://meet.google.com/abc-defg-hij" className="h-12 rounded-xl font-medium pl-10 text-primary" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Location (Optional)</Label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                                    <Input value={meetingForm.location} onChange={e => setMeetingForm({...meetingForm, location: e.target.value})} placeholder="Add physical location" className="h-12 rounded-xl font-bold pl-10" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-rose-600 tracking-widest">Organizer *</Label>
                                                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-left">
                                                    <Avatar className="size-10">
                                                        <AvatarImage src={userData?.avatar} />
                                                        <AvatarFallback className="bg-primary/10 text-primary font-black">{userData?.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <p className="text-sm font-black uppercase truncate">{userData?.firstName} {userData?.lastName}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{userData?.jobTitle}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-black uppercase text-rose-600 tracking-widest text-left">Add Participants *</Label>
                                                <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-left">
                                                    <div className="flex -space-x-2">
                                                        {meetingForm.participantIds?.slice(0, 5).map(id => {
                                                            const u = allUsers?.find((user: any) => user.id === id);
                                                            return (
                                                                <Avatar key={id} className="size-8 rounded-full border-2 border-white ring-1 ring-border/50">
                                                                    <AvatarImage src={u?.avatar} />
                                                                    <AvatarFallback className="bg-primary text-white text-[8px] font-black uppercase">{u?.firstName?.[0]}{u?.lastName?.[0]}</AvatarFallback>
                                                                </Avatar>
                                                            );
                                                        })}
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-primary font-black uppercase text-[8px] tracking-widest hover:bg-primary/5" onClick={() => setIsParticipantSheetOpen(true)}>
                                                        + Add More
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-white shrink-0 flex justify-end gap-3 text-left">
                                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</Button>
                                <Button onClick={handleCreateOrUpdateMeeting} className="h-12 px-10 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-[10px] bg-[#6D28D9] hover:bg-[#5B21B6]">
                                    Schedule Meeting
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left ring-1 ring-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Video className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Upcoming Meetings</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{upcomingCount}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60 truncate">
                        Next: {nextMeeting ? format(nextMeeting.date.toDate(), 'p, dd MMM') : 'None'}
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
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><History className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Total Duration</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-1 uppercase truncate">{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60">Current Filter Set</p>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl bg-white p-6 relative group text-left ring-1 ring-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Repeat className="size-5" /></div>
                        <ChevronRight className="size-4 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Recurring</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">
                        {meetings?.filter(m => m.title.includes('Recurring')).length || 0}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tight opacity-60">Active Patterns</p>
                </Card>
            </div>

            <div className="space-y-4 text-left">
                <div className="flex flex-col md:flex-row gap-3 items-center text-left">
                    <div className="relative flex-1 w-full text-left group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Search meetings, participants, or organizers" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-11 bg-white border-slate-200 rounded-xl pl-12 text-sm font-semibold uppercase tracking-tight placeholder:opacity-40" 
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto text-left">
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
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden ring-1 ring-border/50 text-left">
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
                                <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20 tracking-[0.4em]">Loading Database...</TableCell></TableRow>
                            ) : filteredMeetings.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-bold italic uppercase text-[10px] tracking-widest opacity-30">No records found.</TableCell></TableRow>
                            ) : filteredMeetings.map(m => {
                                const status = getStatusInfo(m.date, m.status);
                                const isPast = isBefore(m.date.toDate(), now);
                                const organizer = allUsers?.find(u => u.id === m.createdBy);
                                const canManage = isCEO || m.createdBy === user?.uid;

                                return (
                                    <TableRow key={m.id} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer group", m.status === 'cancelled' && "opacity-50")} onClick={() => setSelectedMeeting(m)}>
                                        <TableCell className="py-6 px-8 text-left">
                                            <div className="space-y-1 text-left">
                                                <p className="font-black text-[13px] text-slate-900 uppercase tracking-tight group-hover:text-primary transition-colors text-left">{m.title}</p>
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
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40 mt-1">{format(m.date.toDate(), 'p')} • {m.durationMinutes || 60}m</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <div className="flex items-center gap-3 text-left">
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
                                                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-none shadow-3xl p-2 bg-white/95 backdrop-blur-xl text-left">
                                                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-3 py-2 text-left">Manage</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight text-left">
                                                        <Eye className="size-4 text-primary" /> Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight text-left">
                                                        <Users className="size-4 text-primary" /> Attendance
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator className="my-2 bg-slate-100" />

                                                    {!isPast && m.status !== 'cancelled' ? (
                                                        <>
                                                            {m.link && (
                                                                <DropdownMenuItem onClick={() => window.open(m.link, '_blank')} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-emerald-50 text-emerald-700 uppercase tracking-tight text-left">
                                                                    <ExternalLink className="size-4" /> Join Call
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => { setEditingMeeting(m); setMeetingForm({...m, date: format(m.date.toDate(), "yyyy-MM-dd'T'HH:mm")}); setIsAddOpen(true); }} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight text-left">
                                                                <PenLine className="size-4 text-primary" /> Edit Meeting
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : isPast && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-amber-50 text-amber-800 uppercase tracking-tight text-left">
                                                                <MessageSquareText className="size-4" /> Meeting Notes
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setSelectedMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-indigo-50 text-indigo-800 uppercase tracking-tight text-left">
                                                                <Target className="size-4" /> Decisions & Outcomes
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    <DropdownMenuItem onClick={() => { setDuplicationMeeting(m); setNewDupTitle(m.title); setNewDupDate(format(m.date.toDate(), "yyyy-MM-dd'T'HH:mm")); setNewDupParticipantIds(m.participantIds); }} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-primary/5 text-slate-700 uppercase tracking-tight text-left">
                                                        <Copy className="size-4 text-primary" /> Duplicate Meeting
                                                    </DropdownMenuItem>

                                                    {canManage && (
                                                        <>
                                                            <DropdownMenuSeparator className="my-2 bg-slate-100" />
                                                            {m.status === 'active' ? (
                                                                <DropdownMenuItem onClick={() => setCancellingMeeting(m)} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-red-50 text-rose-600 uppercase tracking-tight text-left">
                                                                    <X className="size-4" /> Cancel Meeting
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="rounded-xl font-bold text-xs gap-3 py-3 px-3 hover:bg-red-50 text-rose-600 text-left">
                                                                            <Trash2 className="size-4" /> Delete Meeting
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent className="rounded-2xl border-none shadow-3xl text-left">
                                                                        <AlertDialogHeader className="text-left">
                                                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary text-left">Purge Record?</AlertDialogTitle>
                                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-left">This will permanently remove the briefing from the mission log. This action is irreversible.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter className="mt-8 gap-3 text-left">
                                                                            <AlertDialogCancel className="rounded-full h-11 px-6 font-bold uppercase text-[10px]">Back</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))} className="rounded-full h-11 px-6 font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700">Confirm Purge</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
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

            {/* Cancel Meeting Dialog */}
            <Dialog open={!!cancellingMeeting} onOpenChange={o => !o && setCancellingMeeting(null)}>
                <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-none shadow-3xl text-left">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-rose-600 flex items-center gap-2 text-left">
                            <AlertTriangle className="size-5" /> Cancel Meeting
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60 text-left">
                            Provide a reason for cancellation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reason</Label>
                        <Textarea 
                            value={cancelReason} 
                            onChange={e => setCancelReason(e.target.value)} 
                            placeholder="e.g., Re-scheduled, Technical issues..." 
                            className="rounded-xl min-h-[100px] border-none ring-1 ring-border"
                        />
                    </div>
                    <DialogFooter className="text-left">
                        <Button variant="outline" className="rounded-full h-11 px-8 font-black uppercase text-[10px]" onClick={() => setCancellingMeeting(null)}>Go Back</Button>
                        <Button disabled={!cancelReason.trim()} className="rounded-full h-11 px-8 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px]" onClick={handleCancelMeeting}>Confirm Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Duplicate Meeting Dialog */}
            <Dialog open={!!duplicatingMeeting} onOpenChange={o => !o && setDuplicationMeeting(null)}>
                <DialogContent className="rounded-[2rem] sm:max-w-xl p-0 border-none shadow-3xl text-left overflow-hidden flex flex-col h-[85vh]">
                    <DialogHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2 text-left">
                            <Repeat className="size-5" /> Duplicate Meeting
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60 text-left">
                            Configure duplication options
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-muted/5 text-left">
                        <div className="p-8 space-y-8 text-left">
                            <div className="space-y-6 text-left">
                                <div className="space-y-4 text-left">
                                    <div className="flex items-center justify-between p-4 bg-white border border-border/50 rounded-xl shadow-sm text-left">
                                        <Label className="text-[11px] font-black uppercase tracking-tight">Same Title?</Label>
                                        <Checkbox checked={dupOptions.sameTitle} onCheckedChange={v => setDupOptions({...dupOptions, sameTitle: !!v})} />
                                    </div>
                                    {!dupOptions.sameTitle && (
                                        <div className="space-y-2 animate-fade-in-up text-left">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">New Title</Label>
                                            <Input value={newDupTitle} onChange={e => setNewDupTitle(e.target.value)} placeholder="Enter new title..." className="h-11 rounded-xl bg-white" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 text-left">
                                    <div className="flex items-center justify-between p-4 bg-white border border-border/50 rounded-xl shadow-sm text-left">
                                        <Label className="text-[11px] font-black uppercase tracking-tight">Keep Original Time?</Label>
                                        <Checkbox checked={dupOptions.sameDate} onCheckedChange={v => setDupOptions({...dupOptions, sameDate: !!v})} />
                                    </div>
                                    {!dupOptions.sameDate && (
                                        <div className="space-y-2 animate-fade-in-up text-left">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">New Date & Time</Label>
                                            <Input type="datetime-local" value={newDupDate} onChange={e => setNewDupDate(e.target.value)} className="h-11 rounded-xl bg-white" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 text-left">
                                    <div className="flex items-center justify-between p-4 bg-white border border-border/50 rounded-xl shadow-sm text-left">
                                        <Label className="text-[11px] font-black uppercase tracking-tight">Same Participants?</Label>
                                        <Checkbox checked={dupOptions.samePeople} onCheckedChange={v => setDupOptions({...dupOptions, samePeople: !!v})} />
                                    </div>
                                    {!dupOptions.samePeople && (
                                        <div className="space-y-4 animate-fade-in-up text-left">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Select New Participants</Label>
                                            <div className="grid grid-cols-1 gap-2 text-left">
                                                {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border/50 hover:border-primary/20 transition-all cursor-pointer text-left">
                                                        <Checkbox id={`dup-u-${u.id}`} checked={newDupParticipantIds.includes(u.id)} onCheckedChange={c => {
                                                            setNewDupParticipantIds(prev => c ? [...prev, u.id] : prev.filter(id => id !== u.id));
                                                        }} className="rounded-md" />
                                                        <Label htmlFor={`dup-u-${u.id}`} className="flex-1 font-bold text-[11px] uppercase cursor-pointer flex items-center gap-3 text-left">
                                                            <Avatar className="size-8 rounded-full">
                                                                <AvatarImage src={u.avatar} className="object-cover" />
                                                                <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">{u.firstName[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col text-left">
                                                                <span className="leading-none">{u.firstName} {u.lastName}</span>
                                                                <span className="text-[8px] opacity-40 mt-1">{u.jobTitle}</span>
                                                            </div>
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator className="opacity-50" />

                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Repeat Pattern</Label>
                                <Select value={dupOptions.recurrence} onValueChange={(v: any) => setDupOptions({...dupOptions, recurrence: v})}>
                                    <SelectTrigger className="h-11 rounded-xl font-bold uppercase text-[10px] bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="once" className="text-[10px] font-black uppercase">One Time</SelectItem>
                                        <SelectItem value="daily" className="text-[10px] font-black uppercase">Daily (5 Days)</SelectItem>
                                        <SelectItem value="weekly" className="text-[10px] font-black uppercase">Weekly (4 Weeks)</SelectItem>
                                        <SelectItem value="month-end" className="text-[10px] font-black uppercase">Month End</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0 text-left">
                        <Button className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-xl" onClick={handleDuplicateFinal}>Create Clones</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Participant Selection Sheet */}
            <Sheet open={isParticipantSheetOpen} onOpenChange={setIsParticipantSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0 border-none shadow-3xl flex flex-col bg-white">
                    <SheetHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 text-left">Add Participants</SheetTitle>
                        <SheetDescription className="text-xs font-bold uppercase tracking-widest opacity-60 text-left">Select personnel for this mission briefing</SheetDescription>
                    </SheetHeader>
                    <div className="p-6 border-b bg-muted/5 text-left">
                        <div className="relative text-left">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <Input 
                                placeholder="Search by name or title..." 
                                className="pl-12 h-12 rounded-xl border-none ring-1 ring-border bg-white font-bold"
                                value={participantSearch}
                                onChange={e => setParticipantSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 bg-muted/5 text-left">
                        <div className="p-8 space-y-2 text-left">
                            {allUsers?.filter(u => {
                                const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
                                return fullName.includes(participantSearch.toLowerCase()) || (u.jobTitle || '').toLowerCase().includes(participantSearch.toLowerCase());
                            }).map(u => {
                                const isSelected = meetingForm.participantIds?.includes(u.id);
                                return (
                                    <div 
                                        key={u.id} 
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl transition-all border cursor-pointer",
                                            isSelected ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white border-transparent hover:border-slate-200"
                                        )}
                                        onClick={() => {
                                            const current = meetingForm.participantIds || [];
                                            if (current.includes(u.id)) {
                                                setMeetingForm({ ...meetingForm, participantIds: current.filter(id => id !== u.id) });
                                            } else {
                                                setMeetingForm({ ...meetingForm, participantIds: [...current, u.id] });
                                            }
                                        }}
                                    >
                                        <Checkbox checked={isSelected} className="rounded-md" />
                                        <Avatar className="size-12 rounded-full border-2 border-white shadow-sm ring-1 ring-border/50">
                                            <AvatarImage src={u.avatar} className="object-cover" />
                                            <AvatarFallback className="font-black bg-muted">{u.firstName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-black text-sm uppercase tracking-tight text-slate-900 leading-none">{u.firstName} {u.lastName}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{u.jobTitle}</p>
                                        </div>
                                        {isSelected && <CheckCircle2 className="size-5 text-primary" />}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0 text-left">
                        <Button className="w-full h-14 rounded-xl font-black uppercase tracking-widest shadow-2xl" onClick={() => setIsParticipantSheetOpen(false)}>Done</Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Details & Summary Terminal */}
            <Sheet open={!!selectedMeeting} onOpenChange={o => !o && setSelectedMeeting(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col bg-[#F8FAFC] text-left">
                    <SheetHeader className="p-10 border-b bg-white shrink-0 text-left shadow-sm">
                        <div className="flex items-center justify-between mb-4 text-left">
                            <Badge className="bg-primary text-white border-none rounded-none text-[8px] font-black h-5 uppercase tracking-widest px-3 shadow-md text-left">
                                {selectedMeeting?.type}
                            </Badge>
                            {selectedMeeting && selectedMeeting.status === 'cancelled' ? (
                                <Badge className="bg-rose-50 text-rose-700 border-none rounded-none text-[8px] font-black uppercase tracking-widest h-5 px-3">Cancelled</Badge>
                            ) : selectedMeeting && isBefore(selectedMeeting.date.toDate(), now) && (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[8px] font-black uppercase tracking-widest h-5 px-3">Completed</Badge>
                            )}
                        </div>
                        <SheetTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none text-left">Meeting Summary</SheetTitle>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1 bg-muted/5 text-left">
                        <div className="p-10 space-y-12 pb-32 text-left">
                            {selectedMeeting?.status === 'cancelled' && (
                                <Card className="p-6 bg-rose-50 border-2 border-rose-200 rounded-none shadow-lg animate-pulse text-left">
                                    <div className="flex items-center gap-3 text-rose-700 font-black uppercase text-[10px] mb-2 tracking-widest text-left">
                                        <AlertTriangle className="size-4" /> Cancellation Reason
                                    </div>
                                    <p className="text-sm font-bold text-rose-900 uppercase italic">"{selectedMeeting.cancellationReason || "No reason provided."}"</p>
                                </Card>
                            )}

                            <div className="space-y-4 text-left">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight text-left">{selectedMeeting?.title}</h2>
                                <div className="p-6 bg-white ring-1 ring-border rounded-none shadow-sm flex items-center gap-6 text-left">
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="size-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center"><Calendar className="size-5"/></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground text-left">Date</p>
                                            <p className="text-xs font-bold uppercase text-left">{selectedMeeting && format(selectedMeeting.date.toDate(), 'dd MMM yyyy')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="size-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center"><Clock className="size-5"/></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground text-left">Time</p>
                                            <p className="text-xs font-bold uppercase text-left">{selectedMeeting && format(selectedMeeting.date.toDate(), 'p')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="size-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center"><Timer className="size-5"/></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground text-left">Duration</p>
                                            <p className="text-xs font-bold uppercase text-left">{selectedMeeting?.durationMinutes || 60} minutes</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 text-left">
                                <div className="flex items-center justify-between border-b border-primary/20 pb-3 text-left">
                                    <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 text-left">
                                        <Users className="size-4" /> Attendance
                                    </h4>
                                    <span className="text-[10px] font-black text-muted-foreground/60">{selectedMeeting?.attendedIds?.length || 0} / {selectedMeeting?.participantIds.length}</span>
                                </div>
                                <div className="space-y-3 text-left">
                                    {selectedMeeting?.participantIds.map((id, i) => {
                                        const member = allUsers?.find(u => u.id === id);
                                        const isHost = selectedMeeting.createdBy === user?.uid;
                                        const isPresent = selectedMeeting.attendedIds?.includes(id);

                                        return (
                                            <div key={id} className="flex items-center gap-4 p-4 bg-white ring-1 ring-border rounded-none group hover:shadow-md transition-all text-left">
                                                {isHost && (
                                                    <Checkbox 
                                                        checked={isPresent} 
                                                        onCheckedChange={(checked) => {
                                                            const currentAttended = selectedMeeting.attendedIds || [];
                                                            const updated = checked ? [...currentAttended, id] : currentAttended.filter(aid => aid !== id);
                                                            updateDocumentNonBlocking(doc(firestore, 'meetings', selectedMeeting.id), { attendedIds: updated });
                                                            setSelectedMeeting({ ...selectedMeeting, attendedIds: updated });
                                                        }}
                                                        className="rounded-md size-5"
                                                    />
                                                )}
                                                <Avatar className="size-10 rounded-full border-2 border-white shadow-sm ring-1 ring-border/50">
                                                    <AvatarImage src={member?.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px] font-black uppercase text-slate-700">{selectedMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="font-black text-sm text-slate-800 truncate uppercase tracking-tight text-left">{selectedMeeting.participantNames[i]}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate text-left">{member?.jobTitle || 'Team Member'}</p>
                                                </div>
                                                <Badge variant="outline" className={cn("rounded-none text-[8px] font-black uppercase h-5 border-none", isPresent ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>
                                                    {isPresent ? "Present" : "Absent"}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-6 text-left">
                                <div className="flex items-center justify-between border-b border-primary/20 pb-3 text-left">
                                    <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 text-left">
                                        <Target className="size-4" /> Decisions / Outcomes
                                    </h4>
                                </div>
                                <div className="space-y-4 text-left">
                                    {selectedMeeting?.decisionsOutcomes && selectedMeeting.decisionsOutcomes !== 'Pending discussion.' ? (
                                        <div className="space-y-3 text-left">
                                            {selectedMeeting.decisionsOutcomes.split('\n').map((decision, idx) => (
                                                <div key={idx} className="flex items-start gap-3 group text-left">
                                                    <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                                                    <p className="text-sm font-medium text-slate-700 leading-relaxed flex-1 text-left">{decision}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 border-2 border-dashed border-border rounded-none text-center opacity-40 text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-left">No decisions logged yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 text-left">
                                <Label className="text-[10px] font-black uppercase text-slate-900 tracking-widest text-left">Additional Remarks (Optional)</Label>
                                <Textarea 
                                    value={momText} 
                                    onChange={e => setMomText(e.target.value)} 
                                    placeholder="Add any additional remarks..." 
                                    className="rounded-none min-h-[100px] bg-white border-2 border-dashed focus-visible:ring-primary text-sm italic"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-dashed text-left">
                                <Button variant="outline" className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest bg-white" onClick={() => setSelectedMeeting(null)}>Close</Button>
                                <Button onClick={handleSaveNotes} disabled={isSavingNotes} className="rounded-xl h-12 px-10 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 bg-[#6D28D9] hover:bg-[#5B21B6]">
                                    Save Remarks
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function getStatusInfo(date: Timestamp, mStatus?: string) {
    if (mStatus === 'cancelled') return { label: 'Cancelled', color: 'bg-rose-50 text-rose-600' };
    const d = date.toDate();
    const now = new Date();
    if (isBefore(d, now)) return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700' };
    if (isBefore(d, addMinutes(now, 60))) return { label: 'Scheduled', color: 'bg-blue-50 text-blue-600' };
    return { label: 'Upcoming', color: 'bg-purple-50 text-purple-700' };
}

function getTypeIcon(type: string) {
    if (type.includes('Client')) return <Video className="size-4 text-emerald-600" />;
    if (type.includes('Project')) return <Calendar className="size-4 text-blue-600" />;
    return <Users className="size-4 text-purple-600" />;
}

function getTypeBg(type: string) {
    if (type.includes('Client')) return 'bg-emerald-50';
    if (type.includes('Project')) return 'bg-blue-50';
    return 'bg-purple-50';
}
