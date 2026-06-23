
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, collectionGroup, where } from 'firebase/firestore';
import { 
    Briefcase, Activity, Target, Users, 
    PieChart as PieChartIcon, CheckCircle2, 
    Clock, ExternalLink, ChevronRight, 
    Layers, UserCheck, Timer, Box
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type Project = {
    id: string;
    name: string;
    team: string;
    type: 'Client Project' | 'In-House/R&D' | 'CSR';
    phase: string;
    leader: string;
    completion: number;
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
    const firestore = useFirestore();
    const [allReports, setAllReports] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

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
        
        // 1. Map Client Projects from real Client data
        clients?.forEach(client => {
            const team = teams?.find(t => t.id === client.assignedTeamId);
            const leader = users?.find(u => u.id === client.handlingEmployeeId);
            
            // Find completion from latest technical reports for this client
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
                type: 'Client Project',
                phase: client.status === 'Active' ? 'Execution' : 'Initiation',
                leader: leader ? `${leader.firstName} ${leader.lastName}` : 'TBD',
                completion: Number(avgCompletion)
            });
        });

        // 2. Map In-House / CSR from Technical Reports
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
                        type: p.type === 'In House' ? 'In-House/R&D' : 'CSR',
                        phase: 'Development',
                        leader: r.employeeName || 'System',
                        completion: Number(p.statusPercent)
                    });
                }
            });
        });

        return matrix;
    }, [clients, teams, users, allReports]);

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
            { name: 'CSR Initiatives', value: csr, color: '#22C55E' },
            { name: 'Upcoming', value: 0, color: '#F59E0B' }
        ];
    }, [projectMatrix]);

    return (
        <div className="space-y-8 animate-fade-in-up font-jakarta pb-20">
            <PageHeader title="Project Portfolio" description="Detailed operational status of active and upcoming technical missions." />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Portfolio Breakdown */}
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
                            <p className="text-xs font-bold opacity-80 uppercase leading-relaxed">Fleet operation is running at peak capacity for current mission cycle.</p>
                        </div>
                        <Button variant="outline" className="w-full h-11 rounded-none border-white/20 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest relative z-10">
                            Audit Performance
                        </Button>
                    </Card>
                </div>

                {/* Right: Main Status Table */}
                <div className="lg:col-span-8 bg-white border-none shadow-xl ring-1 ring-border/50 rounded-none overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-8 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Layers className="size-4" /> Project Status Grid
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Real-time mission execution monitor</CardDescription>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] uppercase tracking-widest px-3 h-6">Live Pulse</Badge>
                    </CardHeader>
                    <div className="flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black text-[9px] uppercase h-14 px-8 tracking-widest">Project Name</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Type</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-center">Completion</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-right px-8">Lead</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Scanning Fleet Status...</TableCell></TableRow>
                                ) : projectMatrix.map(project => (
                                    <TableRow key={project.id} className="border-b group hover:bg-slate-50 transition-colors">
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
                                        <TableCell className="min-w-[140px] px-6">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-[9px] font-black uppercase">
                                                    <span className="text-muted-foreground/40">{project.phase}</span>
                                                    <span className="text-primary">{project.completion}%</span>
                                                </div>
                                                <Progress value={project.completion} className="h-1.5 rounded-none bg-muted/30" indicatorClassName="bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-slate-800">{project.leader}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Mission Lead</p>
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

            {/* Member Activity Feed */}
            <Card className="border-none shadow-xl ring-1 ring-border/50 rounded-none overflow-hidden bg-white">
                <CardHeader className="p-8 border-b bg-muted/5 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Activity className="size-4" /> Member Activity Feed
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Real-time development log from tactical reports</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="font-black text-[9px] uppercase h-14 px-8 tracking-widest">Fleet Member</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Project Assignment</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest">Active Development (Page/Module)</TableHead>
                                    <TableHead className="font-black text-[9px] uppercase h-14 tracking-widest text-right px-8">Submission Date</TableHead>
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
        </div>
    );
}

function MetricStat({ label, val, color }: any) {
    return (
        <div className="text-center">
            <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-tighter">{label}</p>
            <p className={cn("text-xs font-black", color)}>{val}</p>
        </div>
    );
}
