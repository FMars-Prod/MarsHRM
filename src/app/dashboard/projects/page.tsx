
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDocs, collectionGroup, where, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { 
    Briefcase, Activity, Target, Users, 
    PieChart as PieChartIcon, CheckCircle2, 
    Clock, ExternalLink, ChevronRight, 
    Layers, UserCheck, Timer, Box,
    UserPlus, Video, Settings2, Plus,
    Image as ImageIcon, Info, Calendar,
    UserCircle, Search, Filter, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type Project = {
    id: string;
    name: string;
    team: string;
    teamId?: string;
    type: 'Client Project' | 'In-House/R&D' | 'CSR';
    phase: string;
    leader: string;
    leaderId?: string;
    completion: number;
    memberIds: string[];
    description?: string;
};

type ActivityFeed = {
    id: string;
    member: string;
    memberId: string;
    assignment: string;
    task: string;
    date: Date;
};

export default function ProjectsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [allReports, setAllReports] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [typeFilter, setTypeFilter] = React.useState<string>("all");
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
    const [isAssignOpen, setIsAssignOpen] = React.useState(false);
    const [isMeetingOpen, setIsMeetingOpen] = React.useState(false);

    // Meeting Form State
    const [meetingTitle, setMeetingTitle] = React.useState("");
    const [meetingDate, setMeetingDate] = React.useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients } = useCollection<any>(clientsQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<any>(teamsQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    React.useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            try {
                const q = query(collectionGroup(firestore, 'reports'), orderBy('date', 'desc'));
                const snap = await getDocs(q);
                setAllReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Audit error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReports();
    }, [firestore]);

    const projectMatrix = React.useMemo(() => {
        const matrix: Project[] = [];
        
        clients?.forEach(client => {
            const team = teams?.find(t => t.id === client.assignedTeamId);
            const leader = users?.find(u => u.id === client.handlingEmployeeId);
            
            const relevantReports = allReports.filter(r => 
                r.reportType === 'Technical' && 
                r.technicalProjects?.some((p: any) => p.projectName === client.companyName)
            );
            const avgCompletion = relevantReports.length > 0 
                ? relevantReports[0].technicalProjects.find((p: any) => p.projectName === client.companyName)?.statusPercent || 0
                : 0;

            matrix.push({
                id: client.id,
                name: client.companyName,
                team: team?.name || 'Unassigned',
                teamId: team?.id,
                type: 'Client Project',
                phase: client.status === 'Active' ? 'Execution' : 'Initiation',
                leader: leader ? `${leader.firstName} ${leader.lastName}` : 'TBD',
                leaderId: leader?.id,
                completion: Number(avgCompletion),
                memberIds: team?.memberIds || [],
                description: client.notes || "Standard client engagement mission."
            });
        });

        const internalProjects = new Set<string>();
        allReports.forEach(r => {
            r.technicalProjects?.forEach((p: any) => {
                if (p.type !== 'Client' && !internalProjects.has(p.projectName)) {
                    internalProjects.add(p.projectName);
                    const team = teams?.find(t => t.memberIds.includes(r.employeeId));
                    matrix.push({
                        id: `internal-${p.projectName}`,
                        name: p.projectName,
                        team: team?.name || 'Internal R&D',
                        teamId: team?.id,
                        type: p.type === 'In House' ? 'In-House/R&D' : 'CSR',
                        phase: 'Development',
                        leader: r.employeeName || 'System',
                        leaderId: r.employeeId,
                        completion: Number(p.statusPercent),
                        memberIds: team?.memberIds || [r.employeeId],
                        description: "Internal developmental sprint."
                    });
                }
            });
        });

        return matrix.filter(p => typeFilter === 'all' || p.type === typeFilter);
    }, [clients, teams, users, allReports, typeFilter]);

    const activityFeed = React.useMemo(() => {
        const feed: ActivityFeed[] = [];
        allReports.forEach(r => {
            r.technicalProjects?.forEach((p: any) => {
                feed.push({
                    id: `${r.id}-${p.projectName}`,
                    member: r.employeeName,
                    memberId: r.employeeId,
                    assignment: p.projectName,
                    task: p.description,
                    date: r.date?.toDate() || new Date()
                });
            });
        });
        return feed.slice(0, 15);
    }, [allReports]);

    const breakdown = React.useMemo(() => {
        const active = projectMatrix.filter(p => p.type === 'Client Project').length;
        const rAndD = projectMatrix.filter(p => p.type === 'In-House/R&D').length;
        const csr = projectMatrix.filter(p => p.type === 'CSR').length;
        return [
            { name: 'Client Projects', value: active, color: '#6D28D9' },
            { name: 'In-House/R&D', value: rAndD, color: '#3B82F6' },
            { name: 'CSR Initiatives', value: csr, color: '#22C55E' }
        ];
    }, [projectMatrix]);

    const handleAssignTeam = (newTeamId: string) => {
        if (!selectedProject || selectedProject.type !== 'Client Project') return;
        const clientRef = doc(firestore, 'clients', selectedProject.id);
        updateDocumentNonBlocking(clientRef, { assignedTeamId: newTeamId });
        toast({ title: "Assignment Updated", description: "Project has been allocated to a new team." });
        setIsAssignOpen(false);
        setSelectedProject(null);
    };

    const handleScheduleMeeting = async () => {
        if (!selectedProject || !meetingTitle || !user) return;

        const projectTeam = teams?.find(t => t.id === selectedProject.teamId);
        const participantIds = projectTeam?.memberIds || [selectedProject.leaderId].filter(Boolean);
        const participantNames = users?.filter(u => participantIds.includes(u.id)).map(u => `${u.firstName} ${u.lastName}`) || [];

        const payload = {
            title: meetingTitle,
            description: `Project Synchronization: ${selectedProject.name}`,
            date: Timestamp.fromDate(new Date(meetingDate)),
            link: "https://meet.google.com/new",
            type: selectedProject.type === 'Client Project' ? 'Client Meet' : 'Internal',
            clientId: selectedProject.type === 'Client Project' ? selectedProject.id : null,
            clientName: selectedProject.type === 'Client Project' ? selectedProject.name : null,
            participantIds,
            participantNames,
            createdBy: user.uid,
            createdByName: user.displayName || 'System',
            createdAt: serverTimestamp()
        };

        await addDocumentNonBlocking(collection(firestore, 'meetings'), payload);
        toast({ title: "Meeting Scheduled", description: "Team members notified." });
        setIsMeetingOpen(false);
        setMeetingTitle("");
    };

    return (
        <div className="space-y-8 animate-fade-in-up font-jakarta pb-20">
            <PageHeader title="Project Portfolio" description="Operational status of all active missions.">
                <div className="flex gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[180px] h-11 rounded-none bg-white border-none ring-1 ring-border/50">
                            <div className="flex items-center gap-2">
                                <Filter className="size-3.5 opacity-50" />
                                <SelectValue placeholder="All Projects" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                            <SelectItem value="all">All Projects</SelectItem>
                            <SelectItem value="Client Project">Client Projects</SelectItem>
                            <SelectItem value="In-House/R&D">Internal R&D</SelectItem>
                            <SelectItem value="CSR">CSR Initiatives</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-none bg-white overflow-hidden ring-1 ring-border/50">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Box className="size-4" /> Portfolio Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                {breakdown.map((item, i) => (
                                    <div key={i} className="p-4 bg-muted/20 border border-transparent hover:border-border/50 transition-all rounded-none">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground mb-1">{item.name}</p>
                                        <p className="text-2xl font-black tabular-nums">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Resource Distribution</p>
                                <div className="h-[200px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={breakdown} 
                                                innerRadius={60} 
                                                outerRadius={80} 
                                                paddingAngle={5} 
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {breakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-black">{projectMatrix.length}</span>
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl rounded-none bg-primary text-white p-8 space-y-4 overflow-hidden relative group">
                        <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Target className="size-48" />
                        </div>
                        <div className="relative z-10 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">System Efficiency</p>
                            <h3 className="text-4xl font-black tracking-tighter">94.2%</h3>
                            <p className="text-xs font-bold opacity-80 uppercase leading-relaxed">Operation is running at peak capacity for current mission cycle.</p>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-8 bg-white border-none shadow-xl ring-1 ring-border/50 rounded-none overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-8 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Layers className="size-4" /> Project Status Grid
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Real-time progress monitor</CardDescription>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] uppercase tracking-widest px-3 h-6">Live Pulse</Badge>
                    </CardHeader>
                    <div className="flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black text-[9px] uppercase h-14 px-8 tracking-widest">Project Name</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Type</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-center">Progress</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-right px-8">Project Lead</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Scanning Records...</TableCell></TableRow>
                                ) : projectMatrix.map(project => (
                                    <TableRow key={project.id} className="border-b group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedProject(project)}>
                                        <TableCell className="py-6 px-8">
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm uppercase tracking-tight text-slate-800">{project.name}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{project.team}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "rounded-none font-black text-[8px] px-2 h-4 border-none uppercase tracking-widest",
                                                project.type === 'Client Project' ? "bg-purple-100 text-purple-700" :
                                                project.type === 'In-House/R&D' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                            )}>
                                                {project.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="min-w-[140px] px-6 text-center">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-[9px] font-black uppercase">
                                                    <span className="text-muted-foreground/40">{project.phase}</span>
                                                    <span className="text-primary">{project.completion}%</span>
                                                </div>
                                                <Progress value={project.completion} className="h-1.5 rounded-none bg-muted/30" indicatorClassName="bg-primary" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-slate-800">{project.leader}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Lead</p>
                                                </div>
                                                <div className="size-8 rounded-none bg-muted/20 flex items-center justify-center text-[10px] font-black text-muted-foreground border">
                                                    {project.leader[0]}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-xl ring-1 ring-border/50 rounded-none overflow-hidden bg-white">
                <CardHeader className="p-8 border-b bg-muted/5 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Activity className="size-4" /> Member Activity Feed
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Real-time development log from daily reports</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="font-black text-[9px] uppercase h-14 px-8 tracking-widest">Team Member</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Assignment</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Current Module</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-right px-8">Submitted</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activityFeed.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No activity logs found.</TableCell></TableRow>
                                ) : activityFeed.map(feed => (
                                    <TableRow key={feed.id} className="border-b hover:bg-slate-50 transition-colors">
                                        <TableCell className="py-6 px-8">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-none bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">
                                                    {feed.member[0]}
                                                </div>
                                                <span className="font-black text-xs uppercase text-slate-800">{feed.member}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="rounded-none font-black text-[8px] px-2 h-5 border-primary/20 text-primary bg-primary/5 uppercase tracking-widest">
                                                {feed.assignment}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-xs font-medium text-slate-600 line-clamp-1 italic uppercase tracking-tight">"{feed.task}"</p>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{format(feed.date, 'MMM dd, p')}</span>
                                                <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-1">
                                                    <CheckCircle2 className="size-2 text-emerald-500" /> E-Signed
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Sheet open={!!selectedProject} onOpenChange={o => !o && setSelectedProject(null)}>
                <SheetContent className="w-full sm:max-w-[500px] p-0 border-none shadow-3xl flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 pb-4 bg-white border-b shadow-sm shrink-0">
                        <div className="flex items-start justify-between mb-4">
                            <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black h-5 uppercase px-2 shadow-sm">{selectedProject?.type}</Badge>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black h-5 uppercase px-2 shadow-sm">{selectedProject?.phase}</Badge>
                        </div>
                        <SheetTitle className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-tight">{selectedProject?.name}</SheetTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">{selectedProject?.team} Division</p>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Project Overview</h4>
                                <Card className="border-none shadow-sm rounded-none bg-white p-6 ring-1 ring-border/50">
                                    <p className="text-xs font-medium text-slate-600 leading-relaxed uppercase italic">"{selectedProject?.description}"</p>
                                    <div className="mt-6 flex justify-between items-end">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Completion</p>
                                            <p className="text-3xl font-black text-primary tracking-tighter">{selectedProject?.completion}%</p>
                                        </div>
                                        <div className="w-48">
                                            <Progress value={selectedProject?.completion} className="h-1.5 rounded-none bg-muted/30" indicatorClassName="bg-primary" />
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Project Team</h4>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none border-none bg-primary/5 text-primary px-2">{selectedProject?.memberIds.length} Members</Badge>
                                </div>
                                <div className="space-y-2">
                                    {selectedProject?.memberIds.map(id => {
                                        const member = users?.find(u => u.id === id);
                                        if (!member) return null;
                                        return (
                                            <Link key={id} href={`/dashboard/users/${id}`} className="flex items-center gap-4 p-4 bg-white border border-border/50 hover:bg-primary/5 transition-all group">
                                                <Avatar className="size-10 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                                    <AvatarImage src={member.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px] font-black bg-muted">{member.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs uppercase truncate group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{member.jobTitle}</p>
                                                </div>
                                                {id === selectedProject.leaderId && <Badge className="bg-primary text-white text-[7px] font-black uppercase rounded-none h-4">Project Lead</Badge>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 pt-6 border-t border-dashed">
                                <Button className="h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20" onClick={() => setIsMeetingOpen(true)}>
                                    <Video className="size-4" /> Schedule Team Meeting
                                </Button>
                                {selectedProject?.type === 'Client Project' && (
                                    <Button variant="outline" className="h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 bg-white" onClick={() => setIsAssignOpen(true)}>
                                        <Settings2 className="size-4" /> Change Team Assignment
                                    </Button>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* Team Assignment Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Assign to Team</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Redirect project management to a different unit</DialogDescription>
                    </DialogHeader>
                    <div className="py-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Unit</Label>
                            <Select onValueChange={handleAssignTeam}>
                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Select Fleet Unit" /></SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="p-4 bg-muted/20 border border-dashed rounded-none flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase">Team not found?</p>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Initialize a new division</p>
                            </div>
                            <Button size="sm" variant="ghost" asChild className="text-[9px] font-black uppercase text-primary hover:bg-primary/5">
                                <Link href="/dashboard/teams"><Plus className="size-3 mr-1" /> Create Team</Link>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Meeting Schedule Dialog */}
            <Dialog open={isMeetingOpen} onOpenChange={setIsMeetingOpen}>
                <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Schedule Team Meet</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Synchronize all assigned project members</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Subject</Label>
                            <Input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="e.g., Progress Audit" className="h-12 rounded-none" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Scheduled Time</Label>
                            <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="h-12 rounded-none" />
                        </div>
                        <div className="p-5 bg-primary/5 rounded-none ring-1 ring-primary/10">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-3">Auto-Selected Participants</p>
                            <div className="flex -space-x-2">
                                {selectedProject?.memberIds.slice(0, 5).map(id => (
                                    <Avatar key={id} className="size-8 rounded-none border-2 border-white ring-1 ring-border/50">
                                        <AvatarFallback className="text-[8px] font-black">{users?.find(u => u.id === id)?.firstName?.[0]}</AvatarFallback>
                                    </Avatar>
                                ))}
                                {(selectedProject?.memberIds.length || 0) > 5 && (
                                    <div className="size-8 rounded-none bg-muted flex items-center justify-center text-[8px] font-black border-2 border-white">+{(selectedProject?.memberIds.length || 0) - 5}</div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleScheduleMeeting} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Confirm Meeting</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
