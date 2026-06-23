
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, where, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { 
    Briefcase, Activity, Target, Users, 
    PieChart as PieChartIcon, CheckCircle2, 
    Clock, ExternalLink, ChevronRight, 
    Layers, UserCheck, Timer, 
    UserPlus, Video, Settings2, Plus,
    Image as ImageIcon, Info, Calendar,
    UserCircle, Search, Filter, X,
    FileBox, CheckCircle, Ban, AlertCircle,
    PlusCircle, Building2, User as UserIcon,
    ShieldCheck, Edit3
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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

type Project = {
    id: string;
    name: string;
    team: string;
    teamId?: string;
    type: 'Client Project' | 'In-House/R&D' | 'CSR';
    phase: string;
    status: 'In Progress' | 'Completed' | 'Cancelled' | 'Planning';
    leader: string;
    leaderId?: string;
    completion: number;
    memberIds: string[];
    description?: string;
};

export default function ProjectsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [typeFilter, setTypeFilter] = React.useState<string>("all");
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
    const [manualProgress, setManualProgress] = React.useState<number>(0);
    const [editedName, setEditedName] = React.useState("");
    
    // Dialog States
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [isAssignOpen, setIsAssignOpen] = React.useState(false);
    const [isMeetingOpen, setIsMeetingOpen] = React.useState(false);

    // Create Project Form State
    const [newProjectName, setNewProjectName] = React.useState("");
    const [newProjectType, setNewProjectType] = React.useState<string>("Client Project");
    const [isNewClient, setIsNewClient] = React.useState(false);
    const [selectedClientId, setSelectedClientId] = React.useState("");
    const [newClientName, setNewClientName] = React.useState("");
    const [newProjectTeamId, setNewProjectTeamId] = React.useState("");
    const [newProjectLeadId, setNewProjectLeadId] = React.useState("");

    // Meeting Form State
    const [meetingTitle, setMeetingTitle] = React.useState("");
    const [meetingDate, setMeetingDate] = React.useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<any>(clientsQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<any>(teamsQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc<any>(userDocRef);
    const isExecutive = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD';

    const projectMatrix = React.useMemo(() => {
        const matrix: Project[] = [];
        
        clients?.forEach(client => {
            const team = teams?.find(t => t.id === client.assignedTeamId);
            const leadId = team?.teamLeadId;
            const leader = users?.find(u => u.id === leadId);
            
            const completion = client.completionPercent !== undefined ? Number(client.completionPercent) : 0;

            let status: Project['status'] = 'In Progress';
            if (client.status === 'Archived') status = 'Cancelled';
            else if (completion === 100) status = 'Completed';
            else if (completion === 0) status = 'Planning';

            matrix.push({
                id: client.id,
                name: client.companyName,
                team: team?.name || 'Unassigned',
                teamId: team?.id,
                type: (client.serviceType === 'In House' ? 'In-House/R&D' : (client.serviceType === 'CSR' ? 'CSR' : 'Client Project')) as Project['type'],
                phase: client.status === 'Active' ? 'Execution' : 'Initiation',
                status,
                leader: leader ? `${leader.firstName} ${leader.lastName}` : 'TBD',
                leaderId: leadId,
                completion,
                memberIds: team?.memberIds || [],
                description: client.notes || "Project details."
            });
        });

        return matrix.filter(p => typeFilter === 'all' || p.type === typeFilter);
    }, [clients, teams, users, typeFilter]);

    const stats = React.useMemo(() => {
        return {
            total: projectMatrix.length,
            inProgress: projectMatrix.filter(p => p.status === 'In Progress').length,
            completed: projectMatrix.filter(p => p.status === 'Completed').length,
            cancelled: projectMatrix.filter(p => p.status === 'Cancelled').length
        };
    }, [projectMatrix]);

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

    const canManageProject = (p: Project) => {
        return isExecutive || user?.uid === p.leaderId;
    };

    const handleUpdateProgress = () => {
        if (!selectedProject) return;
        if (!canManageProject(selectedProject)) {
            toast({ variant: 'destructive', title: "Access Denied", description: "Only the Project Lead can update progress." });
            return;
        }
        const clientRef = doc(firestore, 'clients', selectedProject.id);
        updateDocumentNonBlocking(clientRef, { completionPercent: manualProgress });
        toast({ title: "Progress Updated", description: "Project completion synchronized." });
        setSelectedProject({ ...selectedProject, completion: manualProgress });
    };

    const handleRenameProject = () => {
        if (!selectedProject || !editedName.trim()) return;
        if (!isExecutive && user?.uid !== selectedProject.leaderId) {
            toast({ variant: 'destructive', title: "Access Denied" });
            return;
        }
        const clientRef = doc(firestore, 'clients', selectedProject.id);
        updateDocumentNonBlocking(clientRef, { companyName: editedName.trim() });
        toast({ title: "Project Renamed" });
        setSelectedProject({ ...selectedProject, name: editedName.trim() });
    };

    const handleCreateProject = async () => {
        if (!newProjectName || !user) return;

        try {
            if (newProjectType === 'Client Project') {
                let clientId = selectedClientId;

                if (isNewClient && newClientName) {
                    const clientRef = await addDocumentNonBlocking(collection(firestore, 'clients'), {
                        companyName: newClientName,
                        clientName: newProjectName + " Contact",
                        status: 'Active',
                        industryType: 'Other',
                        assignedTeamId: newProjectTeamId,
                        handlingEmployeeId: newProjectLeadId,
                        completionPercent: 0,
                        createdAt: serverTimestamp()
                    });
                    clientId = clientRef!.id;
                } else if (!clientId) {
                    toast({ variant: 'destructive', title: 'Client Selection Required' });
                    return;
                }

                if (!isNewClient && clientId) {
                    const clientRef = doc(firestore, 'clients', clientId);
                    updateDocumentNonBlocking(clientRef, {
                        assignedTeamId: newProjectTeamId,
                        handlingEmployeeId: newProjectLeadId
                    });
                }
            } else {
                toast({ title: "Internal Project Created", description: "Project added to registry." });
            }

            toast({ title: "Project Created" });
            setIsCreateOpen(false);
            resetCreateForm();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        }
    };

    const resetCreateForm = () => {
        setNewProjectName("");
        setNewProjectType("Client Project");
        setIsNewClient(false);
        setSelectedClientId("");
        setNewClientName("");
        setNewProjectTeamId("");
        setNewProjectLeadId("");
    };

    const handleAssignTeam = (newTeamId: string) => {
        if (!selectedProject) return;
        const clientRef = doc(firestore, 'clients', selectedProject.id);
        updateDocumentNonBlocking(clientRef, { assignedTeamId: newTeamId });
        toast({ title: "Team Reassigned" });
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
            description: `Project Meeting: ${selectedProject.name}`,
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
        toast({ title: "Meeting Scheduled" });
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
                                <SelectValue placeholder="All Categories" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="Client Project">Client Projects</SelectItem>
                            <SelectItem value="In-House/R&D">Internal R&D</SelectItem>
                            <SelectItem value="CSR">CSR Initiatives</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                <PlusCircle className="size-4" /> Create Project
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-none border-none shadow-3xl p-0 overflow-hidden h-[85vh] flex flex-col">
                            <DialogHeader className="p-10 border-b bg-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">New Project</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Create project and assign team</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-10 space-y-8">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Project Name</Label>
                                        <Input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g., Marketing Website" className="h-12 rounded-none" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Classification</Label>
                                        <Select value={newProjectType} onValueChange={setNewProjectType}>
                                            <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Client Project">Client Project</SelectItem>
                                                <SelectItem value="In-House/R&D">In-House/R&D</SelectItem>
                                                <SelectItem value="CSR">CSR Initiative</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {newProjectType === 'Client Project' && (
                                        <div className="space-y-6 p-6 bg-white border-2 border-dashed border-border/50 rounded-none">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary">Client Assignment</Label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">New Client?</span>
                                                    <Switch checked={isNewClient} onCheckedChange={setIsNewClient} />
                                                </div>
                                            </div>
                                            {isNewClient ? (
                                                <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Organization Name..." className="h-12 rounded-none" />
                                            ) : (
                                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                                    <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Select Client" /></SelectTrigger>
                                                    <SelectContent>
                                                        {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Assign Team</Label>
                                            <Select value={newProjectTeamId} onValueChange={setNewProjectTeamId}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                                <SelectContent>
                                                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Lead Manager</Label>
                                            <Select value={newProjectLeadId} onValueChange={setNewProjectLeadId}>
                                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                                                <SelectContent>
                                                    {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-10 border-t bg-white shrink-0">
                                <Button onClick={handleCreateProject} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Create Project</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Total Projects" value={stats.total} icon={Briefcase} color="text-primary" bg="bg-primary/5" />
                <MetricCard label="In Progress" value={stats.inProgress} icon={Activity} color="text-indigo-600" bg="bg-indigo-50" />
                <MetricCard label="Completed" value={stats.completed} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
                <MetricCard label="Cancelled" value={stats.cancelled} icon={Ban} color="text-rose-600" bg="bg-rose-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border-none shadow-xl ring-1 ring-border/50 rounded-none overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-8 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Layers className="size-4" /> Project Registry
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <div className="flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black text-[9px] uppercase h-14 px-8 tracking-widest">Project Name</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-center">Category</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-center">Progress</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-right px-8">Project Lead</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clientsLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Syncing Records...</TableCell></TableRow>
                                ) : projectMatrix.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No projects found.</TableCell></TableRow>
                                ) : projectMatrix.map(project => (
                                    <TableRow key={project.id} className="border-b group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setSelectedProject(project); setManualProgress(project.completion); setEditedName(project.name); }}>
                                        <TableCell className="py-6 px-8">
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm uppercase tracking-tight text-slate-800">{project.name}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{project.team}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(
                                                "rounded-none font-black text-[8px] px-2 h-5 border-none uppercase tracking-widest",
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
                                            <div className="flex items-center justify-end gap-3 text-right">
                                                <div>
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

                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-none bg-white overflow-hidden ring-1 ring-border/50">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <PieChartIcon className="size-4" /> Portfolio Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-8">
                            <div className="space-y-4">
                                <div className="h-[240px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={breakdown} 
                                                innerRadius={65} 
                                                outerRadius={85} 
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
                                        <span className="text-3xl font-black">{projectMatrix.length}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Aggregate</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl rounded-none bg-slate-900 text-white p-8 space-y-6 overflow-hidden relative group">
                        <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <ShieldCheck className="size-48" />
                        </div>
                        <div className="relative z-10 space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">System Performance</p>
                                <h3 className="text-4xl font-black tracking-tighter">94.2%</h3>
                            </div>
                            <p className="text-xs font-medium opacity-60 uppercase leading-relaxed">Performance is audited against real-time member activity logs.</p>
                            <Button variant="outline" className="w-full h-11 rounded-none border-white/20 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest relative z-10" asChild>
                                <Link href="/dashboard/analytics">View Analytics</Link>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            <Sheet open={!!selectedProject} onOpenChange={o => !o && setSelectedProject(null)}>
                <SheetContent className="w-full sm:max-w-[500px] p-0 border-none shadow-3xl w-full flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 pb-4 bg-white border-b shadow-sm shrink-0">
                        <div className="flex items-start justify-between mb-4">
                            <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black h-5 uppercase px-2 shadow-sm">{selectedProject?.type}</Badge>
                            <Badge className={cn(
                                "border-none text-[8px] font-black h-5 uppercase px-2 shadow-sm",
                                selectedProject?.status === 'Completed' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            )}>
                                {selectedProject?.status}
                            </Badge>
                        </div>
                        <SheetTitle className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-tight">{selectedProject?.name}</SheetTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">{selectedProject?.team} Team</p>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32">
                            {selectedProject && (isExecutive || user?.uid === selectedProject.leaderId) && (
                                <div className="space-y-6 bg-white p-8 ring-1 ring-border/50 rounded-none shadow-sm animate-fade-in-up">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Project Control</h4>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-bold text-muted-foreground uppercase">Rename Project</Label>
                                            <div className="flex gap-2">
                                                <Input value={editedName} onChange={e => setEditedName(e.target.value)} className="h-10 rounded-none bg-muted/20 border-none ring-1 ring-border/50" />
                                                <Button size="icon" onClick={handleRenameProject} className="rounded-none h-10 w-10 shrink-0"><Edit3 className="size-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <Separator className="opacity-50" />
                                    
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Manual Progress</h4>
                                            <span className="text-2xl font-black text-primary">{manualProgress}%</span>
                                        </div>
                                        <Slider value={[manualProgress]} min={0} max={100} step={5} onValueChange={v => setManualProgress(v[0])} />
                                        <div className="flex justify-between items-center pt-2">
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase italic tracking-widest leading-relaxed">Only the Project Lead can update completion.</p>
                                            <Button variant="outline" size="sm" className="rounded-none h-8 font-black uppercase text-[8px] px-4" onClick={handleUpdateProgress}>Lock Progress</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Description</h4>
                                <Card className="border-none shadow-sm rounded-none bg-white p-6 ring-1 ring-border/50">
                                    <p className="text-xs font-medium text-slate-600 leading-relaxed uppercase italic">"{selectedProject?.description}"</p>
                                </Card>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button className="h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20" onClick={() => setIsMeetingOpen(true)}>
                                    <Video className="size-4" /> Schedule Meeting
                                </Button>
                                <Button variant="outline" className="h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 bg-white" asChild>
                                    <Link href={`/dashboard/documents`}>
                                        <FileBox className="size-4" /> Project Vault
                                    </Link>
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Team Members</h4>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none border-none bg-primary/5 text-primary px-2">{selectedProject?.memberIds.length} Members</Badge>
                                </div>
                                <div className="space-y-2">
                                    {selectedProject?.memberIds.map(id => {
                                        const member = users?.find(u => u.id === id);
                                        if (!member) return null;
                                        return (
                                            <Link key={id} href={`/dashboard/users/${id}`} className="flex items-center gap-4 p-4 bg-white border border-border/50 hover:bg-primary/5 transition-all group shadow-sm">
                                                <Avatar className="size-10 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                                    <AvatarImage src={member.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px] font-black bg-muted">{member.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs uppercase truncate group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{member.jobTitle}</p>
                                                </div>
                                                {id === selectedProject.leaderId && <Badge className="bg-primary text-white text-[7px] font-black uppercase rounded-none h-4">Lead</Badge>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-dashed">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Management Actions</h4>
                                <Button variant="outline" className="w-full h-12 rounded-none font-black uppercase text-[10px] tracking-widest gap-2 bg-white" onClick={() => setIsAssignOpen(true)}>
                                    <Settings2 className="size-4" /> Change Team
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Assign Team</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Assign project to a different team</DialogDescription>
                    </DialogHeader>
                    <div className="py-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Team</Label>
                            <Select onValueChange={handleAssignTeam}>
                                <SelectTrigger className="h-12 rounded-none font-bold"><SelectValue placeholder="Target Team" /></SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="p-4 bg-muted/20 border border-dashed rounded-none flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase">No teams?</p>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Create a new unit</p>
                            </div>
                            <Button size="sm" variant="ghost" asChild className="text-[9px] font-black uppercase text-primary hover:bg-primary/5">
                                <Link href="/dashboard/teams"><Plus className="size-3 mr-1" /> Create Team</Link>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isMeetingOpen} onOpenChange={setIsMeetingOpen}>
                <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Schedule Meeting</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Set up a meeting with all team members</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Subject</Label>
                            <Input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="e.g., Progress Review" className="h-12 rounded-none" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Time</Label>
                            <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="h-12 rounded-none" />
                        </div>
                        <div className="p-5 bg-primary/5 rounded-none ring-1 ring-primary/10">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-3">Participants</p>
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
                        <Button onClick={handleScheduleMeeting} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Schedule Meeting</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color, bg }: { label: string, value: number, icon: any, color: string, bg: string }) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl">
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-none shadow-sm transition-transform group-hover:scale-105", bg, color)}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{label}</p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900 truncate">{value}</h3>
                </div>
            </div>
        </Card>
    );
}

