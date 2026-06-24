'use client';

import * as React from 'react';
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    DollarSign, TrendingUp, Activity, 
    Target, Download, 
    ArrowUpRight, ArrowDownRight,
    Globe, Wallet,
    ChevronRight,
    CheckCircle2, Clock,
    Package, Loader2,
    TrendingDown as TrendingDownIcon,
    Mic, ExternalLink
} from "lucide-react";
import { 
    Area, AreaChart, ResponsiveContainer, 
    XAxis, YAxis, Tooltip
} from 'recharts';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

// --- DATA TYPES ---
type PaymentInstallment = {
    id: string;
    amount: string;
    amountReceived?: string;
    status: string;
    dueDate?: string;
};

type Client = {
    id: string;
    companyName: string;
    projectTotalCost: number;
    payments: PaymentInstallment[];
    serviceType: string;
    assignedTeamId: string;
    status: string;
    createdAt: any;
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

    // Real Platform Data Streams
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

    const marketingQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions')), [firestore]);
    const { data: marketing, isLoading: marketingLoading } = useCollection<MarketingSession>(marketingQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<Team>(teamsQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<UserData>(usersQuery);

    // --- FINANCIAL CALCULATIONS ---
    const stats = React.useMemo(() => {
        let totalRevenue = 0;
        let totalPipeline = 0;
        let workforceCost = 0;
        
        let productData: Record<string, { revenue: number, pipeline: number, count: number }> = {
            "Cognithorz": { revenue: 0, pipeline: 0, count: 0 },
            "FortuMars": { revenue: 0, pipeline: 0, count: 0 },
            "Black Ticket": { revenue: 0, pipeline: 0, count: 0 },
            "Campus Connect": { revenue: 0, pipeline: 0, count: 0 },
            "Other": { revenue: 0, pipeline: 0, count: 0 }
        };

        // Lead status funnel tracking
        let leadFunnel = { leads: 0, prospects: 0, active: 0, won: 0 };

        clients?.forEach(c => {
            let clientRevenue = 0;
            let clientPipeline = 0;

            (c.payments || []).forEach(p => {
                const received = parseFloat(p.amountReceived || '0') || 0;
                const total = parseFloat(p.amount) || 0;
                clientRevenue += received;
                if (p.status !== 'Paid') {
                    clientPipeline += (total - received);
                }
            });

            totalRevenue += clientRevenue;
            totalPipeline += clientPipeline;

            // Product Classification
            const name = c.companyName.toLowerCase();
            let key = "Other";
            if (name.includes('black ticket')) key = "Black Ticket";
            else if (name.includes('campus connect')) key = "Campus Connect";
            else if (name.includes('fortumars')) key = "FortuMars";
            else if (name.includes('cognithorz')) key = "Cognithorz";
            
            productData[key].revenue += clientRevenue;
            productData[key].pipeline += clientPipeline;
            productData[key].count += 1;

            // Funnel aggregation
            if (c.status === 'Lead') leadFunnel.leads++;
            else if (c.status === 'Prospect') leadFunnel.prospects++;
            else if (c.status === 'Active') leadFunnel.active++;
            
            // Assume "Won" is any client with at least one paid installment
            if ((c.payments || []).some(p => p.status === 'Paid')) leadFunnel.won++;
        });

        // Workforce Costing
        users?.forEach(u => { workforceCost += (u.payrollAmount || 0); });

        // Marketing Analysis
        let marketingBudget = 0;
        let marketingSpent = 0;
        marketing?.forEach(s => {
            if (s.type === 'topup') marketingBudget += (s.topupAmount || 0);
            else marketingSpent += (s.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0);
        });

        const netProfit = totalRevenue - workforceCost - marketingSpent;

        return { 
            totalRevenue, 
            totalPipeline, 
            workforceCost,
            netProfit,
            margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
            productData, 
            marketingBudget, 
            marketingSpent,
            marketingBalance: marketingBudget - marketingSpent,
            leadFunnel
        };
    }, [clients, marketing, users]);

    if (clientsLoading || marketingLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary opacity-20">
                    <Loader2 className="size-12 animate-spin" />
                    <p className="font-black uppercase text-xs tracking-[0.3em]">Syncing Ledger...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in-up pb-20 font-jakarta text-slate-900 max-w-[1600px] mx-auto">
            {/* Header Terminal */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-1">
                <div className="space-y-0.5">
                    <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-slate-900">Financial Ledger</h1>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Real-time Platform Audit • {format(new Date(), 'MMMM yyyy')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white ring-1 ring-border/50 p-1 rounded-none shadow-sm h-9">
                        <Button variant="ghost" size="sm" className="h-7 rounded-none px-4 text-[9px] font-black uppercase bg-slate-50 shadow-inner">This Month</Button>
                        <Button variant="ghost" size="sm" className="h-7 rounded-none px-4 text-[9px] font-black uppercase text-slate-400">Quarterly Audit</Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 rounded-none border-none ring-1 ring-border/50 bg-white font-black text-[9px] uppercase tracking-widest gap-2">
                        <Download className="size-3" /> Export Ledger
                    </Button>
                </div>
            </div>

            {/* Row 1: KPI Matrix (iOS Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    title="Revenue" 
                    value={`₹${(stats.totalRevenue / 100000).toFixed(2)}L`} 
                    trend="+22.4%" 
                    up={true} 
                    icon={DollarSign}
                    color="text-primary"
                    bg="bg-primary/5"
                />
                <KPICard 
                    title="Expenses" 
                    value={`₹${(stats.workforceCost / 100000).toFixed(2)}L`} 
                    trend="+7.8%" 
                    up={false} 
                    icon={TrendingDownIcon}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <KPICard 
                    title="Net Profit" 
                    value={`₹${(stats.netProfit / 100000).toFixed(2)}L`} 
                    trend="+18.7%" 
                    up={true} 
                    icon={TrendingUp}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <KPICard 
                    title="Profit Margin" 
                    value={`${stats.margin.toFixed(1)}%`} 
                    trend="+2.1pp" 
                    up={true} 
                    icon={Target}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
            </div>

            {/* Row 2: Marketing, Projects & Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Marketing Budget */}
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Marketing Budget Overview</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Ad performance & balance</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Total Budget</p><p className="text-xl font-black">₹{(stats.marketingBudget / 100000).toFixed(2)}L</p></div>
                                <div className="text-right"><p className="text-[9px] font-bold text-muted-foreground uppercase">Spent to Date</p><p className="text-xl font-black text-rose-600">₹{(stats.marketingSpent / 100000).toFixed(2)}L</p></div>
                            </div>
                            <Progress value={(stats.marketingSpent / (stats.marketingBudget || 1)) * 100} className="h-2 rounded-none bg-muted" indicatorClassName="bg-primary" />
                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                <span>Utilization: {Math.round((stats.marketingSpent / (stats.marketingBudget || 1)) * 100)}%</span>
                                <span>Target: &lt;₹5.00L</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 p-4 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-none">
                        <p className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Remaining Balance</p>
                        <p className="text-2xl font-black text-emerald-900">₹{(stats.marketingBalance / 100000).toFixed(2)}L</p>
                    </div>
                </Card>

                {/* Client Project Value */}
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6 flex flex-col justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Client Project Value</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{(stats.totalRevenue / 100000).toFixed(2)}L</p>
                        <Badge className="bg-primary text-white rounded-none font-black text-[8px] h-4 uppercase tracking-widest border-none px-2">{(clients || []).length} ACTIVE PROJECTS</Badge>
                    </div>
                    <div className="h-24 w-full opacity-10 flex items-center justify-center">
                        <Globe className="size-20" />
                    </div>
                    <div className="pt-4 border-t border-dashed space-y-3">
                        <div className="flex justify-between items-center">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Global Portfolio</p>
                            <p className="text-[9px] font-black uppercase text-primary">Review Locations</p>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Geo-Spatial Reach: All Hubs Active</p>
                    </div>
                </Card>

                {/* Pipeline Velocity */}
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pipeline Velocity</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{(stats.totalPipeline / 100000).toFixed(2)}L</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Pending Conversion Value</p>
                        </div>
                        <div className="space-y-3">
                            <FunnelStep label="Proposal" value={stats.leadFunnel.leads} percentage={100} color="bg-primary/20" />
                            <FunnelStep label="Negotiation" value={stats.leadFunnel.prospects} percentage={65} color="bg-primary/40" />
                            <FunnelStep label="Closing" value={stats.leadFunnel.won} percentage={24} color="bg-primary" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Row 3: Product Audit & Detailed Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Product Performance Matrix */}
                <Card className="lg:col-span-8 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-xl overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-5 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Package className="size-4" /> Proprietary Product Performance
                            </CardTitle>
                            <CardDescription className="text-[8px] font-bold uppercase tracking-tight opacity-40">Talent-to-Revenue Audit mapping</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="font-black text-[8px] uppercase py-3 px-6 tracking-widest">Product Line</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Money Got</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">In Pipeline</TableHead>
                                    <TableHead className="text-right px-6 font-black text-[8px] uppercase py-3">Performance</TableHead>
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
                                                <div className="flex justify-between w-24 text-[7px] font-black uppercase">
                                                    <span>Efficiency</span>
                                                    <span className="text-primary">85%</span>
                                                </div>
                                                <div className="h-1 w-24 bg-muted/20 overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: '85%' }} />
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Upcoming Pipeline Milestones */}
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-5">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Clock className="size-4" /> Pipeline Milestones
                        </CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1 max-h-[400px]">
                        <div className="divide-y divide-border/50">
                            {clients?.flatMap(c => (c.payments || []).map(p => ({ ...p, clientName: c.companyName })))
                                .filter(p => p && p.status !== 'Paid')
                                .slice(0, 10)
                                .map((p, i) => (
                                <div key={i} className="p-4 hover:bg-white transition-all flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-primary truncate max-w-[150px]">{p.clientName}</p>
                                        <p className="text-[10px] font-bold tabular-nums">₹{(parseFloat(p.amount) / 1000).toFixed(1)}K Due</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Target Date</p>
                                        <p className="text-[9px] font-black uppercase">{p.dueDate || 'N/A'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            </div>

            <footer className="pt-8 flex items-center justify-between text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.4em] border-t border-dashed">
                <p>© 2026 MARSHRM</p>
                <p>BY FORTUMARS</p>
            </footer>
        </div>
    );
}

function KPICard({ title, value, trend, up, icon: Icon, color, bg }: any) {
    return (
        <Card className="bg-white/50 border-none ring-1 ring-border/50 rounded-none p-5 space-y-4 shadow-sm group hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
                <div className={cn("p-2.5 rounded-none shadow-sm group-hover:scale-105 transition-transform", bg, color)}>
                    <Icon className="size-4" />
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-black", up ? "text-emerald-600" : "text-rose-600")}>
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {trend}
                </div>
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">{title}</p>
                <h3 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">{value}</h3>
            </div>
            <div className="h-8 w-full opacity-20">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[{v:10}, {v:20}, {v:15}, {v:30}, {v:25}, {v:40}]}>
                        <Area type="monotone" dataKey="v" stroke={up ? "#10b981" : "#f43f5e"} fill={up ? "#10b981" : "#f43f5e"} fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

function FunnelStep({ label, value, percentage, color }: any) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-900">{value} Leads</span>
            </div>
            <div className="h-6 flex items-center relative">
                <div 
                    className={cn("h-full rounded-none transition-all duration-1000 shadow-sm border-r-2 border-white/50", color)} 
                    style={{ width: `${percentage}%` }}
                />
                <span className="absolute right-2 text-[8px] font-black text-white">{percentage}%</span>
            </div>
        </div>
    );
}
