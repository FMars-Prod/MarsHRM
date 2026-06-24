
'use client';

import * as React from 'react';
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    DollarSign, TrendingUp, TrendingDown, Activity, 
    PieChart as PieChartIcon, Target, Search, 
    Filter, LayoutGrid, ArrowUpRight, ArrowDownRight,
    Map as MapIcon, Wallet, Briefcase, Globe,
    ChevronRight, MoreHorizontal, MousePointer2,
    CheckCircle2, Clock, Zap, Building2, Users,
    Package, BarChart3, AlertCircle, Loader2
} from "lucide-react";
import { 
    Area, AreaChart, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
    Bar, BarChart, CartesianGrid
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

// --- DATA TYPES ---
type PaymentInstallment = {
    amount: string;
    amountReceived?: string;
    status: string;
};

type Client = {
    id: string;
    companyName: string;
    projectTotalCost: number;
    payments: PaymentInstallment[];
    serviceType: string;
    assignedTeamId: string;
};

type MarketingSession = {
    type: 'spend' | 'topup';
    topupAmount?: number;
    adSpends?: { amount: number }[];
};

type Team = {
    id: string;
    name: string;
    memberIds: string[];
};

type UserData = {
    id: string;
    payrollAmount?: number;
};

export default function FinancePage() {
    const firestore = useFirestore();

    // Data Fetching
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

    const marketingQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions')), [firestore]);
    const { data: marketing, isLoading: marketingLoading } = useCollection<MarketingSession>(marketingQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<Team>(teamsQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<UserData>(usersQuery);

    // Dynamic Calculations
    const stats = React.useMemo(() => {
        let totalRevenue = 0;
        let totalPipeline = 0;
        let productData: Record<string, { revenue: number, pipeline: number }> = {
            "Cognithorz": { revenue: 0, pipeline: 0 },
            "FortuMars": { revenue: 0, pipeline: 0 },
            "Black Ticket": { revenue: 0, pipeline: 0 },
            "Campus Connect": { revenue: 0, pipeline: 0 },
            "Other": { revenue: 0, pipeline: 0 }
        };

        clients?.forEach(c => {
            let clientRevenue = 0;
            let clientPipeline = 0;

            c.payments?.forEach(p => {
                const received = parseFloat(p.amountReceived || '0') || 0;
                const total = parseFloat(p.amount) || 0;
                clientRevenue += received;
                if (p.status !== 'Paid') {
                    clientPipeline += (total - received);
                }
            });

            totalRevenue += clientRevenue;
            totalPipeline += clientPipeline;

            // Map to product types based on name or serviceType
            const name = c.companyName.toLowerCase();
            let key = "Other";
            if (name.includes('black ticket')) key = "Black Ticket";
            else if (name.includes('campus connect')) key = "Campus Connect";
            else if (name.includes('fortumars')) key = "FortuMars";
            else if (name.includes('cognithorz')) key = "Cognithorz";
            
            productData[key].revenue += clientRevenue;
            productData[key].pipeline += clientPipeline;
        });

        // Marketing logic
        let marketingBudget = 0;
        let marketingSpent = 0;
        marketing?.forEach(s => {
            if (s.type === 'topup') marketingBudget += (s.topupAmount || 0);
            else marketingSpent += (s.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0);
        });

        return { 
            totalRevenue, 
            totalPipeline, 
            productData, 
            marketingBudget, 
            marketingSpent,
            marketingBalance: marketingBudget - marketingSpent
        };
    }, [clients, marketing]);

    const teamPerformance = React.useMemo(() => {
        if (!teams || !users || !clients) return [];

        return teams.map(t => {
            const teamRevenue = clients
                .filter(c => c.assignedTeamId === t.id)
                .reduce((acc, c) => {
                    return acc + (c.payments?.reduce((pa, p) => pa + (parseFloat(p.amountReceived || '0') || 0), 0) || 0);
                }, 0);

            const teamCost = t.memberIds.reduce((acc, mid) => {
                const user = users.find(u => u.id === mid);
                return acc + (user?.payrollAmount || 0);
            }, 0);

            return {
                name: t.name,
                revenue: teamRevenue,
                cost: teamCost,
                progress: teamCost > 0 ? Math.min(100, Math.round((teamRevenue / (teamCost * 3)) * 100)) : 0
            };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [teams, users, clients]);

    if (clientsLoading || marketingLoading) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary opacity-20">
                    <Loader2 className="size-12 animate-spin" />
                    <p className="font-black uppercase text-xs tracking-[0.3em]">Syncing Ledger...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up pb-20 font-jakarta text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Financial Ledger</h1>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Real-time Platform Audit</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white ring-1 ring-border/50 p-1 rounded-none shadow-sm">
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase bg-slate-50 shadow-inner">All Time</Button>
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase text-slate-400">Target View</Button>
                    </div>
                </div>
            </div>

            {/* Compact KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    title="Money Received" 
                    value={`₹${(stats.totalRevenue / 100000).toFixed(2)}L`} 
                    icon={DollarSign}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    sub="Total Collections"
                />
                <KPICard 
                    title="Planned Money" 
                    value={`₹${(stats.totalPipeline / 100000).toFixed(2)}L`} 
                    icon={Clock}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    sub="Future Revenue"
                />
                <KPICard 
                    title="Marketing Budget" 
                    value={`₹${(stats.marketingBalance / 1000).toFixed(1)}K`} 
                    icon={Zap}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    sub="Available Funds"
                />
                <KPICard 
                    title="Active Missions" 
                    value={clients?.length || 0} 
                    icon={Package}
                    color="text-primary"
                    bg="bg-primary/5"
                    sub="Project Portfolio"
                />
            </div>

            {/* Product & Pipeline Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-5">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Package className="size-4" /> Proprietary Product Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="font-black text-[8px] uppercase py-3 px-6 tracking-widest">Product Line</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Money Got</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">In Pipeline</TableHead>
                                    <TableHead className="text-right px-6 font-black text-[8px] uppercase py-3">Pulse</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(stats.productData).map(([name, data]) => (
                                    <TableRow key={name} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                        <TableCell className="py-4 px-6 font-black text-xs uppercase tracking-tight">{name}</TableCell>
                                        <TableCell className="text-center font-bold text-emerald-600">₹{(data.revenue / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-center font-bold text-amber-600">₹{(data.pipeline / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-right px-6">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[8px] font-black uppercase text-muted-foreground/40">Market Share</span>
                                                <Progress value={(data.revenue / stats.totalRevenue) * 100} className="h-1 w-16 rounded-none" indicatorClassName="bg-primary" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Marketing Budget Control</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{(stats.marketingBalance / 100000).toFixed(2)}L</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Funds Consumed</p>
                                <p className="text-xs font-black">₹{(stats.marketingSpent / 1000).toFixed(1)}K</p>
                            </div>
                            <Progress value={(stats.marketingSpent / stats.marketingBudget) * 100} className="h-1.5 rounded-none bg-muted" indicatorClassName="bg-rose-500" />
                            <div className="flex justify-between text-[8px] font-black uppercase opacity-40">
                                <span>Used: {Math.round((stats.marketingSpent / stats.marketingBudget) * 100)}%</span>
                                <span>Cap: ₹{(stats.marketingBudget / 100000).toFixed(1)}L</span>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-dashed mt-6">
                        <Button variant="outline" className="w-full rounded-none h-10 font-black uppercase text-[9px] tracking-widest bg-white" asChild>
                            <Link href="/dashboard/marketing">Review Ad Performance <ChevronRight className="size-3 ml-1.5 opacity-40"/></Link>
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Workforce ROI Matrix */}
            <Card className="bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-xl overflow-hidden">
                <CardHeader className="bg-muted/5 border-b p-5 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Users className="size-4" /> Workforce Revenue Matrix
                        </CardTitle>
                        <CardDescription className="text-[8px] font-bold uppercase tracking-tight opacity-40">Talent-to-Revenue Efficiency Mapping</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 rounded-none border-none ring-1 ring-border/50 bg-white font-black text-[8px] uppercase tracking-widest shadow-sm">Export Audit</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/10">
                            <TableRow>
                                <TableHead className="font-black text-[8px] uppercase py-4 px-8 tracking-widest">Team Identity</TableHead>
                                <TableHead className="font-black text-[8px] uppercase py-4 text-center">Money Generated</TableHead>
                                <TableHead className="font-black text-[8px] uppercase py-4 text-center">Operation Cost</TableHead>
                                <TableHead className="text-right px-8 font-black text-[8px] uppercase py-4">Profit Pulse</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamPerformance.map((team, i) => (
                                <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                    <TableCell className="py-5 px-8 font-black text-xs uppercase tracking-tight">{team.name}</TableCell>
                                    <TableCell className="text-center font-bold text-emerald-600">₹{(team.revenue / 1000).toFixed(1)}K</TableCell>
                                    <TableCell className="text-center font-bold text-slate-500 opacity-60">₹{(team.cost / 1000).toFixed(1)}K</TableCell>
                                    <TableCell className="text-right px-8">
                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className="flex justify-between w-24 text-[7px] font-black uppercase tracking-tighter">
                                                <span>Efficiency</span>
                                                <span className="text-primary">{team.progress}%</span>
                                            </div>
                                            <Progress value={team.progress} className="h-1 w-24 rounded-none bg-muted/20" indicatorClassName="bg-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <footer className="pt-10 flex items-center justify-between text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.4em] border-t border-dashed">
                <p>© 2026 MARSHRM</p>
                <p>BY FORTUMARS</p>
            </footer>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, bg, sub }: any) {
    return (
        <Card className="bg-white/50 border-none ring-1 ring-border/50 rounded-none p-5 space-y-4 shadow-sm group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
                <div className={cn("p-2.5 rounded-none shadow-sm group-hover:scale-105 transition-transform", bg, color)}>
                    <Icon className="size-4" />
                </div>
                <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">{title}</p>
                    <h3 className="text-xl font-black tracking-tighter text-slate-900 leading-none">{value}</h3>
                </div>
            </div>
            <div className="pt-3 border-t border-dashed border-border/50">
                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">{sub}</p>
            </div>
        </Card>
    );
}
