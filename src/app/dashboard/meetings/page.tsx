'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { 
    Video, Plus, Clock, Users, ExternalLink, Calendar, 
    Trash2, Search, Link as LinkIcon, ShieldCheck, 
    Loader2, CheckCircle2, UserCheck, Timer, Building2, MapPin
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, isToday, startOfDay } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
    const [meetingForm, setMeetingForm] = React.useState<Partial<Meeting>>({
        title: '', description: '', link: '', type: 'Internal', clientId: '', participantIds: [], date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isLeadership = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: allClients } = useCollection<any>(clientsQuery);

    const meetingsQuery = useMemoFirebase(() => query(collection(firestore, 'meetings'), orderBy('date', 'desc')), [firestore]);
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

    const filteredMeetings = meetings?.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const upcomingCount = meetings?.filter(m => isAfter(m.date.toDate(), new Date())).length || 0;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <PageHeader title="Mission Meetings" description="Centralized tactical engagement and mission coordination hub.">
                {isLeadership && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                <Plus className="size-4" /> Schedule Mission
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl rounded-none border-none shadow-3xl p-0 overflow-hidden">
                            <DialogHeader className="p-10 border-b bg-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Mission Briefing</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Schedule an internal or client engagement</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] p-10 bg-muted/5">
                                <div className="space-y-8">
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Meeting Title</Label><Input value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="e.g., Weekly Technical Sprint" className="h-12 rounded-none" /></div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                                            <Select value={meetingForm.type} onValueChange={v => setMeetingForm({...meetingForm, type: v as any})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="Internal">Internal Fleet</SelectItem><SelectItem value="Client Meet">Client Briefing</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date & Time</Label><Input type="datetime-local" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="h-12 rounded-none" /></div>
                                    </div>
                                    {meetingForm.type === 'Client Meet' && (
                                        <div className="space-y-2 animate-fade-in-up">
                                            <Label className="text-[10px] font-black uppercase text-primary">Target Client</Label>
                                            <Select value={meetingForm.clientId} onValueChange={v => setMeetingForm({...meetingForm, clientId: v})}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Select Client Account" /></SelectTrigger>
                                                <SelectContent>{allClients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Mission Link (G-Meet/Zoom)</Label><Input value={meetingForm.link} onChange={e => setMeetingForm({...meetingForm, link: e.target.value})} placeholder="https://meet.google.com/..." className="h-12 rounded-none" /></div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Fleet Participants</Label>
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
                                <Button onClick={handleCreateMeeting} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Authorize Mission</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-none bg-emerald-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-emerald-600 text-white rounded-none shadow-lg"><Video className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 opacity-60">Upcoming Meets</p><h3 className="text-3xl font-black text-emerald-900">{upcomingCount}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-blue-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-blue-600 text-white rounded-none shadow-lg"><Users className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700 opacity-60">Fleet Engaged</p><h3 className="text-3xl font-black text-blue-900">{meetings?.length || 0}</h3></div>
                </Card>
                <Card className="border-none shadow-sm rounded-none bg-indigo-50 p-6 flex items-center gap-5 ring-1 ring-border/50">
                    <div className="p-4 bg-indigo-600 text-white rounded-none shadow-lg"><Calendar className="size-6" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 opacity-60">Tactical Window</p><h3 className="text-xl font-black text-indigo-900">{format(new Date(), 'MMM yyyy')}</h3></div>
                </Card>
            </div>

            <div className="bg-white rounded-none border shadow-sm overflow-hidden ring-1 ring-border/50">
                <div className="p-8 border-b"><Input placeholder="Search mission engagements..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-12 bg-muted/20 border-none ring-1 ring-border/50 rounded-none pl-6" /></div>
                <Table>
                    <TableHeader className="bg-muted/10 border-b">
                        <TableRow><TableHead className="font-black text-[10px] uppercase h-16 px-8">Engagement</TableHead><TableHead className="font-black text-[10px] uppercase h-16">Intelligence Type</TableHead><TableHead className="font-black text-[10px] uppercase h-16">Mission Timeline</TableHead><TableHead className="text-right px-8 font-black text-[10px] uppercase h-16">Action</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse text-xs font-black uppercase opacity-20">Scanning Engagements...</TableCell></TableRow>
                        ) : filteredMeetings.map(m => (
                            <TableRow key={m.id} className="border-b group hover:bg-slate-50/50">
                                <TableCell className="py-8 px-8"><div className="flex items-center gap-5"><div className="p-3 bg-primary/5 text-primary rounded-none"><Video className="size-5" /></div><div><span className="font-black text-sm uppercase block">{m.title}</span><p className="text-[10px] font-bold text-muted-foreground uppercase">{m.createdByName}</p></div></div></TableCell>
                                <TableCell><div className="flex flex-col gap-1.5">{m.type === 'Client Meet' ? <Badge className="bg-sky-100 text-sky-700 border-none w-fit text-[8px] font-black uppercase rounded-none">{m.clientName}</Badge> : <Badge className="bg-purple-100 text-purple-700 border-none w-fit text-[8px] font-black uppercase rounded-none">INTERNAL FLEET</Badge>}</div></TableCell>
                                <TableCell><div className="space-y-1"><p className="text-xs font-bold uppercase">{format(m.date.toDate(), 'PPP')}</p><p className="text-[10px] font-black text-primary uppercase">{format(m.date.toDate(), 'p')}</p></div></TableCell>
                                <TableCell className="text-right px-8"><div className="flex justify-end gap-2">{m.link && <Button variant="outline" size="sm" className="rounded-none h-9 bg-white font-bold uppercase text-[9px]" asChild><Link href={m.link} target="_blank"><ExternalLink className="size-3 mr-1.5"/> Join Meet</Link></Button>}{isLeadership && <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'meetings', m.id))}><Trash2 className="size-4" /></Button>}</div></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
