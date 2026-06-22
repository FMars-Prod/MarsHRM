
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, Timestamp, or } from 'firebase/firestore';
import { 
    Video, Plus, Clock, Users, ExternalLink, Calendar, 
    Trash2, Search, Link as LinkIcon, ShieldCheck, 
    Loader2, CheckCircle2, UserCheck, Timer, Building2, MapPin,
    Eye, BellRing, Info, MoreHorizontal, UserPlus, X
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, isToday, startOfDay, addMinutes } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Meeting = {
    id: string;
    title: string;
    description: string;
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
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', link: '', type: 'Internal', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    
    // Authorization: Admin, CEO, and TL can schedule
    const canSchedule = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';
    
    // Visibility: Admin and CEO see all. Others see only their meetings.
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

        // For TL and Members: only meetings where they are participants or creators
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
            createdAt: serverTimestamp()
        };

        await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        toast({ title: 'Meeting Scheduled', description: 'Participants have been notified.' });
        setIsAddOpen(false);
        setMeetingForm({ title: '', description: '', link: '', type: 'Internal', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    };

    const handleManualNudge = (m: Meeting) => {
        toast({ title: "Reminders Sent", description: `Manual notification dispatched to ${m.participantIds.length} participants.` });
    };

    const filteredMeetings = meetings?.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const upcomingCount = meetings?.filter(m => isAfter(m.date.toDate(), new Date())).length || 0;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <PageHeader title="Meetings" description="Schedule and manage team or client calls.">
                {canSchedule && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                <Plus className="size-4" /> Schedule Meeting
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl rounded-none border-none shadow-3xl p-0 overflow-hidden">
                            <DialogHeader className="p-10 border-b bg-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">New Meeting</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Set up a video call or internal discussion</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] p-10 bg-muted/5">
                                <div className="space-y-8">
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Meeting Title</Label><Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="e.g., Weekly Sync" className="h-12 rounded-none" /></div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                                            <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="Internal">Team Call</SelectItem><SelectItem value="Client Meet">Client Call</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date & Time</Label><Input type="datetime-local" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="h-12 rounded-none" /></div>
                                    </div>
                                    {meetingForm.type === 'Client Meet' && (
                                        <div className="space-y-2 animate-fade-in-up">
                                            <Label className="text-[10px] font-black uppercase text-primary">Select Client</Label>
                                            <Select value={meetingForm.clientId} onValueChange={v => setMeetingForm({...meetingForm, clientId: v})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Which client?" /></SelectTrigger>
                                                <SelectContent>{allClients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Meeting Link (Google Meet / Zoom)</Label><Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://meet.google.com/..." className="h-12 rounded-none" /></div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">People Attending</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                <div key={u.id} className="flex items-center gap-3 p-3 rounded-none bg-white border border-border/50">
                                                    <Checkbox id={`u-${u.id}`} checked={meetingForm.participantIds?.includes(u.id)} onCheckedChange={c => {
                                                        const current = meetingForm.participantIds || [];
                                                        setMeetingForm({...meetingForm, participantIds: c ? [...current, u.id] : current.filter(id => id !== u.id)});
                                                    }} />
                                                    <Label htmlFor={`u-${u.id}`} className="flex-1 font-bold text-xs uppercase cursor-pointer">{u.firstName} {u.lastName}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-10 border-t bg-white">
                                <Button onClick={handleCreateMeeting} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Confirm Meeting</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-none bg-emerald-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-emerald-600 text-white rounded-none shadow-lg"><Video className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 opacity-60">Upcoming Calls</p><h3 className="text-3xl font-black text-emerald-900">{upcomingCount}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-blue-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-blue-600 text-white rounded-none shadow-lg"><Users className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700 opacity-60">Total Meetings</p><h3 className="text-3xl font-black text-blue-900">{meetings?.length || 0}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-indigo-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-indigo-600 text-white rounded-none shadow-lg"><Calendar className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 opacity-60">This Month</p><h3 className="text-xl font-black text-indigo-900">{format(new Date(), 'MMMM yyyy')}</h3></div>
                </Card>
            </div>

            <div className="bg-white rounded-none border shadow-sm overflow-hidden ring-1 ring-border/50">
                <div className="p-8 border-b"><Input placeholder="Search meetings..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-12 bg-muted/20 border-none ring-1 ring-border/50 rounded-none pl-6" /></div>
                <Table>
                    <TableHeader className="bg-muted/10 border-b">
                        <TableRow><TableHead className="font-black text-[10px] uppercase h-16 px-8">Meeting</TableHead><TableHead className="font-black text-[10px] uppercase h-16">Meeting Type</TableHead><TableHead className="font-black text-[10px] uppercase h-16">Time</TableHead><TableHead className="text-right px-8 font-black text-[10px] uppercase h-16">Action</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse text-xs font-black uppercase opacity-20">Syncing Schedule...</TableCell></TableRow>
                        ) : filteredMeetings.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No meetings found.</TableCell></TableRow>
                        ) : filteredMeetings.map(m => (
                            <TableRow key={m.id} className="border-b group hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedMeeting(m)}>
                                <TableCell className="py-8 px-8"><div className="flex items-center gap-5"><div className="p-3 bg-primary/5 text-primary rounded-none"><Video className="size-5" /></div><div><span className="font-black text-sm uppercase block">{m.title}</span><p className="text-[10px] font-bold text-muted-foreground uppercase">By: {m.createdByName}</p></div></div></TableCell>
                                <TableCell><div className="flex flex-col gap-1.5">{m.type === 'Client Meet' ? <Badge className="bg-sky-100 text-sky-700 border-none w-fit text-[8px] font-black uppercase rounded-none">{m.clientName}</Badge> : <Badge className="bg-purple-100 text-purple-700 border-none w-fit text-[8px] font-black uppercase rounded-none">TEAM CALL</Badge>}</div></TableCell>
                                <TableCell><div className="space-y-1"><p className="text-xs font-bold uppercase">{format(m.date.toDate(), 'PPP')}</p><p className="text-[10px] font-black text-primary uppercase">{format(m.date.toDate(), 'p')}</p></div></TableCell>
                                <TableCell className="text-right px-8" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-end gap-2">
                                        {m.link && <Button variant="outline" size="sm" className="rounded-none h-9 bg-white font-bold uppercase text-[9px]" asChild><Link href={m.link} target="_blank"><ExternalLink className="size-3 mr-1.5"/> Join</Link></Button>}
                                        {m.createdBy === user?.uid && (
                                            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5" onClick={() => handleManualNudge(m)}>
                                                <BellRing className="size-4" />
                                            </Button>
                                        )}
                                        {isExecutive && <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))}><Trash2 className="size-4" /></Button>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={!!selectedMeeting} onOpenChange={o => !o && setSelectedMeeting(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-md p-0 overflow-hidden flex flex-col">
                    <SheetHeader className="p-8 border-b bg-white shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <Badge className={cn("rounded-none font-black text-[9px] h-5 uppercase tracking-widest border-none px-2", selectedMeeting?.type === 'Client Meet' ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700")}>
                                {selectedMeeting?.type}
                            </Badge>
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedMeeting(null)}><X className="size-5"/></Button>
                        </div>
                        <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-primary leading-tight">{selectedMeeting?.title}</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="flex-1 bg-muted/5">
                        <div className="p-8 space-y-10 pb-20">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Time & Link</Label>
                                <div className="p-6 bg-white border border-border/50 shadow-sm rounded-none space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-none bg-primary/5 flex items-center justify-center text-primary"><Calendar className="size-5"/></div>
                                        <div><p className="text-sm font-bold uppercase">{selectedMeeting && format(selectedMeeting.date.toDate(), 'PPPP')}</p><p className="text-xs font-black text-primary uppercase">{selectedMeeting && format(selectedMeeting.date.toDate(), 'p')}</p></div>
                                    </div>
                                    <Separator className="opacity-50" />
                                    {selectedMeeting?.link && (
                                        <Button className="w-full h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2" asChild>
                                            <Link href={selectedMeeting.link} target="_blank"><ExternalLink className="size-4" /> Join Video Call</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {selectedMeeting?.type === 'Client Meet' && (
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Linked Client</Label>
                                    <div className="flex items-center gap-4 p-5 bg-sky-50/50 border border-sky-100 rounded-none">
                                        <Building2 className="size-5 text-sky-600" />
                                        <p className="text-sm font-black uppercase text-sky-900">{selectedMeeting.clientName}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">People Attending</Label>
                                <div className="space-y-3">
                                    {selectedMeeting?.participantNames.map((name, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 bg-white border border-border/50 rounded-none">
                                            <Avatar className="size-8 rounded-none ring-1 ring-border"><AvatarFallback className="text-[10px] font-black bg-muted">{name[0]}</AvatarFallback></Avatar>
                                            <span className="text-xs font-bold uppercase tracking-tight">{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organizer</Label>
                                <p className="text-sm font-black text-primary uppercase">{selectedMeeting?.createdByName}</p>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}
