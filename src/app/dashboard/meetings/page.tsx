
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, Timestamp, or } from 'firebase/firestore';
import { 
    Video, Plus, Clock, Users, ExternalLink, Calendar, 
    Trash2, Search, Link as LinkIcon, ShieldCheck, 
    Loader2, CheckCircle2, UserCheck, Timer, Building2, MapPin,
    Eye, BellRing, Info, MoreHorizontal, UserPlus, X, FileText,
    ChevronRight, Filter, ClipboardList, Target, AlertCircle, FileCheck
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

type Meeting = {
    id: string;
    title: string;
    description: string;
    agendas: string;
    decisionsOutcomes: string;
    minutesOfMeeting?: string;
    date: any;
    link: string;
    type: 'Internal' | 'Client Meet';
    clientId?: string;
    clientName?: string;
    participantIds: string[];
    participantNames: string[];
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
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Internal', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
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
                setMeetingForm(prev => ({ ...prev, clientId: client.id, type: 'Client Meet' }));
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
            agendas: meetingForm.agendas || 'Standard operational review.',
            decisionsOutcomes: meetingForm.decisionsOutcomes || 'Pending discussion.'
        };

        await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        toast({ title: 'Meeting Scheduled', description: 'Participants have been notified.' });
        setIsAddOpen(false);
        setMeetingForm({ title: '', description: '', agendas: '', decisionsOutcomes: '', link: '', type: 'Internal', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    };

    const handleSaveMom = async () => {
        if (!selectedMeeting || !momText.trim()) return;
        setIsSavingMom(true);
        try {
            await updateDocumentNonBlocking(doc(firestore, 'meetings', selectedMeeting.id), {
                minutesOfMeeting: momText.trim()
            });
            toast({ title: "Minutes Saved", description: "Documentation archived." });
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

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <PageHeader title="Meetings" description="Schedule and manage tactical mission briefings.">
                {canSchedule && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                <Plus className="size-4" /> Schedule Meeting
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-none border-none shadow-3xl p-0 overflow-hidden">
                            <DialogHeader className="p-10 border-b bg-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Schedule Briefing</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">High-fidelity scheduling protocol</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] p-10 bg-muted/5">
                                <div className="space-y-8">
                                    <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-none space-y-3">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <AlertCircle className="size-4" />
                                            <h4 className="text-[10px] font-black uppercase tracking-widest">Protocol Adherence Mandatory</h4>
                                        </div>
                                        <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase opacity-80">
                                            Strict adherence to this protocol is mandatory for all internal discussions. Documentation of agendas and outcomes ensures operational efficiency.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Name</Label>
                                            <Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="Clear, descriptive title..." className="h-12 rounded-none font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organizer</Label>
                                            <div className="h-12 bg-muted/30 border border-border flex items-center px-4 font-black text-sm uppercase text-slate-500">
                                                {userData?.firstName} {userData?.lastName}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Context & Agendas</Label>
                                        <Textarea value={meetingForm.agendas} onChange={e => setMeetingForm({...meetingForm, agendas: e.target.value})} placeholder="Overview of topics to be discussed..." className="rounded-none min-h-[100px]" />
                                    </div>

                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Planned Decisions/Outcomes</Label>
                                        <Textarea value={meetingForm.decisionsOutcomes} onChange={e => setMeetingForm({...meetingForm, decisionsOutcomes: e.target.value})} placeholder="Actionable decisions expected from this session..." className="rounded-none min-h-[80px]" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-muted-foreground">Classification</Label>
                                            <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="Internal">Team Call</SelectItem><SelectItem value="Client Meet">Client Call</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date & Time</Label><Input type="datetime-local" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="h-12 rounded-none font-bold" /></div>
                                    </div>
                                    
                                    {meetingForm.type === 'Client Meet' && (
                                        <div className="space-y-2 animate-fade-in-up text-left">
                                            <Label className="text-[10px] font-black uppercase text-primary">Strategic Account (Client)</Label>
                                            <Select value={meetingForm.clientId} onValueChange={v => setMeetingForm({...meetingForm, clientId: v})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Which client?" /></SelectTrigger>
                                                <SelectContent>{allClients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Video Link (GMeet/Zoom)</Label><Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://meet.google.com/..." className="h-12 rounded-none" /></div>
                                    
                                    <div className="space-y-4 text-left">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Participants (Fleet Invitees)</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                <div key={u.id} className="flex items-center gap-3 p-3 rounded-none bg-white border border-border/50">
                                                    <Checkbox id={`u-${u.id}`} checked={meetingForm.participantIds?.includes(u.id)} onCheckedChange={c => {
                                                        const current = meetingForm.participantIds || [];
                                                        setMeetingForm({...meetingForm, participantIds: c ? [...current, u.id] : current.filter(id => id !== u.id)});
                                                    }} />
                                                    <Label htmlFor={`u-${u.id}`} className="flex-1 font-bold text-xs uppercase cursor-pointer flex items-center gap-2">
                                                        <Avatar className="size-6 rounded-none">
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
                                <Button onClick={handleCreateMeeting} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Authorize Briefing</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-none bg-emerald-50 p-6 flex items-center gap-5 ring-1 ring-border/50 text-left">
                    <div className="p-4 bg-emerald-600 text-white rounded-none shadow-lg"><Video className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 opacity-60">Upcoming Briefings</p><h3 className="text-3xl font-black text-emerald-900">{upcomingCount}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-blue-50 p-6 flex items-center gap-5 ring-1 ring-border/50 text-left">
                    <div className="p-4 bg-blue-600 text-white rounded-none shadow-lg"><Users className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700 opacity-60">Fleet Sync Sessions</p><h3 className="text-3xl font-black text-blue-900">{meetings?.length || 0}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-indigo-50 p-6 flex items-center gap-5 ring-1 ring-border/50 text-left">
                    <div className="p-4 bg-indigo-600 text-white rounded-none shadow-lg"><Calendar className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 opacity-60">Cycle Audit</p><h3 className="text-xl font-black text-indigo-900">{format(new Date(), 'MMMM yyyy')}</h3></div>
                </Card>
            </div>

            <div className="bg-white rounded-none border shadow-sm overflow-hidden ring-1 ring-border/50">
                <div className="p-8 border-b flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-30" />
                        <Input placeholder="Search briefing name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-12 bg-muted/20 border-none ring-1 ring-border/50 rounded-none pl-14 font-bold uppercase text-xs" />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-12 rounded-none bg-muted/20 border-none ring-1 ring-border/50 w-[140px] font-black uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                                <SelectItem value="all">All Cycles</SelectItem>
                                <SelectItem value="upcoming">Active</SelectItem>
                                <SelectItem value="past">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10 border-b">
                            <TableRow><TableHead className="font-black text-[10px] uppercase h-16 px-8 tracking-widest"> Briefing Title & Organizer</TableHead><TableHead className="font-black text-[10px] uppercase h-16 tracking-widest">Countdown / Time</TableHead><TableHead className="font-black text-[10px] uppercase h-16 tracking-widest text-center">Fidelity</TableHead><TableHead className="text-right px-8 font-black text-[10px] uppercase h-16 tracking-widest">Action</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse text-xs font-black uppercase opacity-20 tracking-widest">Synchronizing Tactical Schedule...</TableCell></TableRow>
                            ) : filteredMeetings.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No Briefings Detected</TableCell></TableRow>
                            ) : filteredMeetings.map(m => {
                                const isPast = isBefore(m.date.toDate(), now);
                                const isApproaching = !isPast && isBefore(m.date.toDate(), addMinutes(now, 60));
                                
                                return (
                                    <TableRow 
                                        key={m.id} 
                                        className={cn(
                                            "border-b group transition-colors cursor-pointer",
                                            isPast ? "opacity-60 grayscale-[0.6] bg-muted/5" : "hover:bg-primary/5"
                                        )} 
                                        onClick={() => setSelectedMeeting(m)}
                                    >
                                        <TableCell className="py-8 px-8 text-left">
                                            <div className="flex items-center gap-5">
                                                <div className={cn("p-3 rounded-none shadow-sm", isPast ? "bg-slate-200 text-slate-400" : isApproaching ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-primary/5 text-primary")}>
                                                    <Video className="size-5" />
                                                </div>
                                                <div className="text-left">
                                                    <span className={cn("font-black text-sm uppercase block tracking-tight", isPast && "text-slate-500")}>{m.title}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40">ORG: {m.createdByName}</p>
                                                        {m.type === 'Client Meet' && <Badge className="bg-sky-50 text-sky-700 text-[7px] font-black uppercase rounded-none border-none h-4 px-1.5">{m.clientName}</Badge>}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1.5 text-left">
                                                <p className={cn("text-[10px] font-black uppercase", isPast ? "text-slate-400" : isApproaching ? "text-amber-600" : "text-primary")}>
                                                    {isPast ? "Archive" : `Starts in ${formatDistanceToNow(m.date.toDate())}`}
                                                </p>
                                                <p className="text-xs font-bold uppercase text-slate-500">{format(m.date.toDate(), 'PPP p')}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {m.minutesOfMeeting ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 font-black text-[8px] uppercase rounded-none border-none h-5 px-2 gap-1"><FileCheck className="size-2.5"/> MOM Logged</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] font-black uppercase opacity-20 border-none">Pending Log</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right px-8" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                {!isPast && m.link && <Button variant="outline" size="sm" className="rounded-none h-9 bg-white font-black uppercase text-[9px] border-none ring-1 ring-border/50" asChild><Link href={m.link} target="_blank"><ExternalLink className="size-3 mr-1.5"/> Join</Link></Button>}
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-primary/5 text-primary" onClick={() => setSelectedMeeting(m)}><Eye className="size-4" /></Button>
                                                {(isExecutive || m.createdBy === user?.uid) && (
                                                    <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 rounded-none h-9 w-9" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))}>
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Sheet open={!!selectedMeeting} onOpenChange={o => !o && setSelectedMeeting(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-2">
                                <Badge className={cn("rounded-none font-black text-[9px] h-5 uppercase tracking-widest border-none px-3 shadow-sm", selectedMeeting?.type === 'Client Meet' ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700")}>
                                    {selectedMeeting?.type}
                                </Badge>
                                {selectedMeeting && isBefore(selectedMeeting.date.toDate(), now) && (
                                    <Badge className="bg-slate-900 text-white border-none rounded-none text-[9px] font-black uppercase tracking-widest px-3 h-5">Archive</Badge>
                                )}
                            </div>
                            {!isBefore(selectedMeeting?.date?.toDate() || now, now) && (
                                <p className="text-[10px] font-black uppercase text-primary animate-pulse flex items-center gap-2">
                                    <Timer className="size-3.5" />
                                    Starts in {selectedMeeting && formatDistanceToNow(selectedMeeting.date.toDate())}
                                </p>
                            )}
                        </div>
                        <SheetTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-tight text-left">{selectedMeeting?.title}</SheetTitle>
                        <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest mt-2">Briefing Terminal Log</p>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32">
                            {/* Mission Context Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 text-left">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Time & Space</Label>
                                    <div className="p-4 bg-white ring-1 ring-border rounded-none shadow-sm space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-none bg-primary text-white flex items-center justify-center shadow-lg"><Calendar className="size-5"/></div>
                                            <div className="text-left">
                                                <p className="text-sm font-black uppercase tracking-tight">{selectedMeeting && format(selectedMeeting.date.toDate(), 'PPP')}</p>
                                                <p className="text-[11px] font-black text-primary uppercase">{selectedMeeting && format(selectedMeeting.date.toDate(), 'p')}</p>
                                            </div>
                                        </div>
                                        {selectedMeeting?.link && !isBefore(selectedMeeting.date.toDate(), now) && (
                                            <Button className="w-full h-11 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20" asChild>
                                                <Link href={selectedMeeting.link} target="_blank"><ExternalLink className="size-4" /> Transmit Link</Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 text-left">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Briefing Organizer</Label>
                                    <div className="p-4 bg-white ring-1 ring-border rounded-none shadow-sm flex items-center gap-4">
                                        <Avatar className="size-12 rounded-none border-2 ring-1 ring-border shadow-sm">
                                            <AvatarFallback className="bg-primary/5 text-primary font-black text-sm">{selectedMeeting?.createdByName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <p className="text-sm font-black uppercase tracking-tight text-slate-800">{selectedMeeting?.createdByName}</p>
                                            <Badge variant="outline" className="rounded-none text-[7px] font-black uppercase mt-1">Primary Org</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Agendas & Outcomes */}
                            <div className="space-y-6">
                                <div className="space-y-3 text-left">
                                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em] mb-1">
                                        <ClipboardList className="size-4" /> Context & Mission Agendas
                                    </div>
                                    <div className="p-6 bg-white ring-1 ring-border rounded-none border-l-4 border-primary shadow-sm">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{selectedMeeting?.agendas || 'Standard operational review.'}"</p>
                                    </div>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.2em] mb-1">
                                        <Target className="size-4" /> Critical Decisions & Outcomes
                                    </div>
                                    <div className="p-6 bg-white ring-1 ring-border rounded-none border-l-4 border-indigo-600 shadow-sm">
                                        <p className="text-sm font-black text-indigo-900 leading-relaxed uppercase">{selectedMeeting?.decisionsOutcomes || 'Strategic decisions pending session completion.'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Participants Matrix */}
                            <div className="space-y-4 text-left">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Authorized Personnel</h4>
                                    <Badge className="bg-muted text-muted-foreground text-[8px] font-black uppercase rounded-none h-5 px-2">{selectedMeeting?.participantIds.length} Fleet Members</Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {selectedMeeting?.participantIds.map((id, i) => (
                                        <div key={id} className="flex items-center gap-3 p-3 bg-white ring-1 ring-border rounded-none group hover:bg-slate-50 transition-colors">
                                            <Avatar className="size-8 rounded-none border ring-1 ring-border/50 group-hover:ring-primary/20 transition-all">
                                                <AvatarFallback className="text-[9px] font-black bg-muted">{selectedMeeting.participantNames[i]?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-800">{selectedMeeting.participantNames[i]}</span>
                                            {id === selectedMeeting.createdBy && <div className="size-2 rounded-full bg-primary ml-auto shadow-[0_0_8px_rgba(109,40,217,0.4)]" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Minutes of Meeting (MOM) Sector */}
                            <div className="space-y-6 pt-6 border-t border-dashed border-border/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-600 font-black uppercase text-[10px] tracking-[0.2em]">
                                        <FileCheck className="size-4" /> Minutes of Meeting (MOM)
                                    </div>
                                    {selectedMeeting && isBefore(selectedMeeting.date.toDate(), now) && selectedMeeting.createdBy === user?.uid && !selectedMeeting.minutesOfMeeting && (
                                        <Badge className="bg-rose-100 text-rose-700 animate-pulse border-none rounded-none text-[7px] font-black uppercase px-2 h-4">Action Required</Badge>
                                    )}
                                </div>

                                {selectedMeeting?.minutesOfMeeting ? (
                                    <div className="p-8 bg-emerald-50 ring-1 ring-emerald-200 rounded-none border-l-4 border-emerald-600 shadow-sm relative overflow-hidden group">
                                        <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                                            <ShieldCheck className="size-32" />
                                        </div>
                                        <p className="text-sm font-medium text-emerald-900 whitespace-pre-wrap leading-relaxed relative z-10 uppercase italic">
                                            "{selectedMeeting.minutesOfMeeting}"
                                        </p>
                                    </div>
                                ) : (
                                    selectedMeeting?.createdBy === user?.uid ? (
                                        <div className="space-y-4 animate-fade-in-up text-left">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">As the organizer, please document the final decisions and mission updates from this session.</p>
                                            <Textarea 
                                                value={momText} 
                                                onChange={e => setMomText(e.target.value)} 
                                                placeholder="Log final minutes of meeting..." 
                                                className="rounded-none min-h-[160px] bg-white ring-1 ring-border border-none focus-visible:ring-emerald-500 font-medium"
                                            />
                                            <Button 
                                                onClick={handleSaveMom} 
                                                disabled={isSavingMom || !momText.trim()}
                                                className="w-full h-12 rounded-none bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-600/20"
                                            >
                                                {isSavingMom ? <Loader2 className="animate-spin size-4 mr-2"/> : <Save className="size-4 mr-2"/>}
                                                Archive Final Minutes
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                                            <Clock className="size-10" />
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em]">Final Minutes Pending Organizer Sync</p>
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

function MetricCard({ label, value, icon: Icon, color, bg }: { label: string, value: number, icon: any, color: string, bg: string }) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl text-left">
            <div className="flex items-center gap-4 text-left">
                <div className={cn("p-3 rounded-none shadow-sm transition-transform group-hover:scale-105", bg, color)}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0 text-left">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{label}</p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900 truncate">{value}</h3>
                </div>
            </div>
        </Card>
    );
}

function Save(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
