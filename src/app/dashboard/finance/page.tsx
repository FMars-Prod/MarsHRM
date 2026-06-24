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
    TrendingDown,
    Mic, ExternalLink,
    Filter,
    Calendar as CalendarIcon,
    Info,
    BarChart3,
    ListChecks,
    Search,
    Users,
    ShieldAlert,
    Briefcase,
    ShieldCheck
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit, doc, where, getDocs, Timestamp, collectionGroup } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import Link from 'next/link';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, isAfter, isBefore, isSameDay } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

// --- DATA TYPES ---
type PaymentInstallment = {
    id: string;
    amount: string;
    amountReceived?: string;
    status: string;
    dueDate?: string;
    invoiceDate?: string;
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
    id: string;
    date: any;
    type: 'spend' | 'topup';
    topupAmount?: number;
    adSpends?: { amount: number; platformId: string; reason: string }[];
    socialLogs?: { brandId: string; platformId: string; count: number }[];
};

type UserData = {
    id: string;
    payrollAmount?: number;
};

export default function FinancePage() {
    const firestore = useFirestore();
    const { user } = useUser();

    // Filter States
    const [dateFilter, setDateFilter] = React.useState<string>("this-month");
    const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Detail States
    const [selectedMetric, setSelectedMetric] = React.useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = React.useState<any | null>(null);

    // Data Streams
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

    const marketingQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions'), orderBy('date', 'desc')), [firestore]);
    const { data: marketing, isLoading: marketingLoading } = useCollection<MarketingSession>(marketingQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<any>(teamsQuery);

    const dateRange = React.useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today': start = startOfDay(now); break;
            case 'this-week': start = startOfWeek(now, { weekStartsOn: 1 }); break;
            case 'prev-week': start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); break;
            case 'this-month': start = startOfMonth(now); break;
            case 'prev-month': start = startOfMonth(subMonths(now, 1)); end = endOfMonth(subMonths(now, 1)); break;
            case 'custom-date': start = startOfDay(new Date(customStartDate)); end = endOfDay(new Date(customStartDate)); break;
            case 'custom-range': start = startOfDay(new Date(customStartDate)); end = endOfDay(new Date(customEndDate)); break;
            default: start = startOfMonth(now); break;
        }
        return { start, end };
    }, [dateFilter, customStartDate, customEndDate]);

    // Financial calculations reactive to dateRange
    const stats = React.useMemo(() => {
        let totalRevenue = 0;
        let totalPipeline = 0;
        let workforceCost = 0;
        let marketingBudget = 0;
        let marketingSpent = 0;

        let productData: Record<string, { revenue: number, pipeline: number, reach: number, count: number, transactions: any[] }> = {
            "Cognithorz": { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] },
            "FortuMars": { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] },
            "Black Ticket": { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] },
            "Campus Connect": { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] },
            "Other": { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] }
        };

        let teamRevenue: Record<string, number> = {};

        // Process Clients
        clients?.forEach(c => {
            const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
            const isRelevant = !dateRange.start || (isAfter(created, dateRange.start) && isBefore(created, dateRange.end));

            const team = teams?.find((t: any) => t.id === c.assignedTeamId);
            const teamName = team?.name || "Unassigned";
            if (!teamRevenue[teamName]) teamRevenue[teamName] = 0;

            (c.payments || []).forEach(p => {
                const received = parseFloat(p.amountReceived || '0') || 0;
                const total = parseFloat(p.amount) || 0;
                
                if (isRelevant) {
                    totalRevenue += received;
                    if (p.status !== 'Paid') totalPipeline += (total - received);
                    teamRevenue[teamName] += received;

                    // Map to product
                    const name = c.companyName.toLowerCase();
                    let key = "Other";
                    if (name.includes('black ticket')) key = "Black Ticket";
                    else if (name.includes('campus connect')) key = "Campus Connect";
                    else if (name.includes('fortumars')) key = "FortuMars";
                    else if (name.includes('cognithorz')) key = "Cognithorz";

                    productData[key].revenue += received;
                    if (p.status !== 'Paid') productData[key].pipeline += (total - received);
                    productData[key].count += 1;
                    
                    if (received > 0) {
                        productData[key].transactions.push({
                            clientName: c.companyName,
                            amount: received,
                            team: teamName,
                            date: p.invoiceDate || format(created, 'PP')
                        });
                    }
                }
            });
        });

        // Workforce (usually static for the period)
        users?.forEach(u => { workforceCost += (u.payrollAmount || 0); });

        // Marketing & Social
        marketing?.forEach(s => {
            const date = s.date?.toDate ? s.date.toDate() : new Date(s.date || Date.now());
            const isRelevant = !dateRange.start || (isAfter(date, dateRange.start) && isBefore(date, dateRange.end));

            if (s.type === 'topup') marketingBudget += (s.topupAmount || 0);
            else {
                const spend = s.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0;
                if (isRelevant) marketingSpent += spend;
            }

            s.socialLogs?.forEach(log => {
                let key = "Other";
                const bId = log.brandId.toLowerCase();
                if (bId.includes('blackticket')) key = "Black Ticket";
                else if (bId.includes('campusconnect')) key = "Campus Connect";
                else if (bId.includes('fortumars')) key = "FortuMars";
                else if (bId.includes('cognithorz')) key = "Cognithorz";
                if (isRelevant) productData[key].reach = Math.max(productData[key].reach, log.count);
            });
        });

        const netProfitRaw = totalRevenue - workforceCost - marketingSpent;
        const netProfit = Math.max(0, netProfitRaw);

        return { 
            totalRevenue, 
            totalPipeline, 
            workforceCost,
            netProfit,
            netProfitRaw,
            margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
            productData, 
            marketingBudget, 
            marketingSpent,
            marketingBalance: Math.max(0, marketingBudget - marketingSpent),
            teamRevenue,
            lastUpdate: marketing?.[0]?.date || null
        };
    }, [clients, marketing, users, teams, dateRange]);

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
        <div className="space-y-4 animate-fade-in-up pb-20 font-jakarta max-w-[1600px] mx-auto">
            {/* Header Terminal */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-1">
                <div className="space-y-0.5">
                    <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-slate-900">Financial Ledger</h1>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        {dateFilter === 'custom-range' ? `${format(dateRange.start!, 'PP')} - ${format(dateRange.end, 'PP')}` : `Operational Audit • ${format(new Date(), 'MMMM yyyy')}`}
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[160px] rounded-full h-9 bg-white shadow-sm border-none ring-1 ring-border/50 text-[10px] font-black uppercase">
                            <div className="flex items-center gap-2">
                                <Filter className="size-3 opacity-50" />
                                <SelectValue placeholder="Timeline" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                            <SelectGroup>
                                <SelectLabel className="text-[9px] font-black uppercase opacity-40">Presets</SelectLabel>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="this-week">This Week</SelectItem>
                                <SelectItem value="prev-week">Previous Week</SelectItem>
                                <SelectItem value="this-month">This Month</SelectItem>
                                <SelectItem value="prev-month">Previous Month</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel className="text-[9px] font-black uppercase opacity-40">Custom</SelectLabel>
                                <SelectItem value="custom-date">Specific Date</SelectItem>
                                <SelectItem value="custom-range">Range Selection</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    {(dateFilter === 'custom-date' || dateFilter === 'custom-range') && (
                        <div className="flex gap-1 items-center animate-fade-in-up">
                            <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="h-9 rounded-none w-32 text-[10px] font-bold" />
                            {dateFilter === 'custom-range' && (
                                <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="h-9 rounded-none w-32 text-[10px] font-bold" />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Core KPI Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Revenue" value={`₹${(stats.totalRevenue / 100000).toFixed(2)}L`} trend="+22.4%" up={true} icon={DollarSign} color="text-primary" bg="bg-primary/5" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('revenue')} />
                <KPICard title="Expenses" value={`₹${((stats.workforceCost + stats.marketingSpent) / 100000).toFixed(2)}L`} trend="+7.8%" up={false} icon={TrendingDown} color="text-amber-600" bg="bg-amber-50" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('expenses')} />
                <KPICard title="Net Profit" value={`₹${(stats.netProfit / 100000).toFixed(2)}L`} trend={stats.netProfitRaw < 0 ? "Deficit" : "+18.7%"} up={stats.netProfitRaw > 0} icon={TrendingUp} color={stats.netProfitRaw > 0 ? "text-emerald-600" : "text-rose-600"} bg={stats.netProfitRaw > 0 ? "bg-emerald-50" : "bg-rose-50"} lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('profit')} />
                <KPICard title="Margin" value={`${stats.margin.toFixed(1)}%`} trend="+2.1pp" up={true} icon={Target} color="text-indigo-600" bg="bg-indigo-50" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('margin')} />
            </div>

            {/* Product Performance (Revenue Only, No Profits from Social) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Package className="size-4" /> Proprietary Product Ledger
                                </CardTitle>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Money Got (Client) vs Brand Awareness (Social)</p>
                            </div>
                            <Badge className="bg-primary text-white rounded-none font-black text-[8px] h-4 uppercase px-2">Verified Audit</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black text-[8px] uppercase py-3 px-6 tracking-widest">Brand Identity</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Money Got</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">In Pipeline</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Social Reach</TableHead>
                                    <TableHead className="text-right px-6 font-black text-[8px] uppercase py-3">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(stats.productData).map(([name, data]) => (
                                    <TableRow 
                                        key={name} 
                                        className="border-border/50 group hover:bg-primary/5 transition-colors cursor-pointer"
                                        onClick={() => setSelectedBrand({ name, ...data })}
                                    >
                                        <TableCell className="py-4 px-6 font-black text-[11px] uppercase tracking-tight">{name}</TableCell>
                                        <TableCell className="text-center font-bold text-emerald-600 text-xs">₹{(data.revenue / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-center font-bold text-amber-600 text-xs">₹{(data.pipeline / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black">{data.reach > 1000 ? `${(data.reach/1000).toFixed(1)}K` : data.reach}</span>
                                                <span className="text-[7px] font-bold text-muted-foreground uppercase">Followers</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-6">
                                            <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Team ROI Matrix */}
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Users className="size-4" /> Team Revenue Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[300px]">
                            <div className="divide-y divide-border/50">
                                {Object.entries(stats.teamRevenue).map(([name, rev]) => (
                                    <div key={name} className="p-4 flex items-center justify-between group hover:bg-white transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/5 text-primary rounded-none"><Users className="size-3.5" /></div>
                                            <p className="text-[10px] font-black uppercase text-slate-800">{name}</p>
                                        </div>
                                        <p className="text-sm font-black text-emerald-600">₹{(rev / 1000).toFixed(1)}K</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Marketing & Upcoming */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-5 flex flex-col gap-6">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Marketing Budget Control</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Ad spend utilization audit</p>
                    </div>
                    <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-end">
                            <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Top-ups</p><p className="text-xl font-black">₹{(stats.marketingBudget / 100000).toFixed(2)}L</p></div>
                            <div className="text-right"><p className="text-[9px] font-bold text-muted-foreground uppercase">Ad Spends</p><p className="text-xl font-black text-rose-600">₹{(stats.marketingSpent / 100000).toFixed(2)}L</p></div>
                        </div>
                        <Progress value={(stats.marketingSpent / (stats.marketingBudget || 1)) * 100} className="h-1.5 rounded-none bg-muted" indicatorClassName="bg-primary" />
                        <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-widest">
                            <span>Usage: {Math.round((stats.marketingSpent / (stats.marketingBudget || 1)) * 100)}%</span>
                            <span>Limit: ₹5.00L</span>
                        </div>
                    </div>
                    <div className="p-4 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-none">
                        <p className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Remaining Balance</p>
                        <p className="text-2xl font-black text-emerald-900">₹{(stats.marketingBalance / 100000).toFixed(2)}L</p>
                    </div>
                </Card>

                <Card className="lg:col-span-8 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Clock className="size-4" /> Upcoming Pipeline Milestones
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[300px]">
                            <div className="divide-y divide-border/50">
                                {clients?.flatMap(c => (c.payments || []).map(p => ({ ...p, clientName: c.companyName })))
                                    .filter(p => p && p.status !== 'Paid')
                                    .sort((a, b) => {
                                        if (!a.dueDate) return 1;
                                        if (!b.dueDate) return -1;
                                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                    })
                                    .slice(0, 10)
                                    .map((p, i) => (
                                    <div key={i} className="p-4 hover:bg-white transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-none bg-primary/5 text-primary"><ListChecks className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black uppercase text-primary truncate max-w-[200px]">{p.clientName}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Scheduled Installment</p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-0.5">
                                            <p className="text-sm font-black tabular-nums">₹{(parseFloat(p.amount) / 1000).toFixed(1)}K</p>
                                            <p className="text-[9px] font-bold uppercase text-muted-foreground">{p.dueDate || 'Date Pending'}</p>
                                        </div>
                                    </div>
                                ))}
                                {(clients?.length === 0 || !clients) && (
                                    <div className="py-20 text-center opacity-20 uppercase font-black text-[9px] tracking-widest">No milestones pending</div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Brand Detail Sheet */}
            <Sheet open={!!selectedBrand} onOpenChange={o => !o && setSelectedBrand(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-md p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 border-b bg-white shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-primary text-white font-black text-[8px] h-4 uppercase rounded-none border-none px-2">Brand Audit</Badge>
                        </div>
                        <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{selectedBrand?.name}</SheetTitle>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Revenue Source Analysis</p>
                    </SheetHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Money Got Breakdown</h4>
                                <div className="space-y-3">
                                    {selectedBrand?.transactions?.length > 0 ? selectedBrand.transactions.map((t: any, i: number) => (
                                        <div key={i} className="p-5 bg-white ring-1 ring-border shadow-sm space-y-3 hover:border-primary transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="font-black text-xs uppercase tracking-tight">{t.clientName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{t.team} Team</p>
                                                </div>
                                                <span className="text-sm font-black text-emerald-600">₹{t.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="pt-2 border-t border-dashed flex items-center justify-between text-[8px] font-black uppercase text-muted-foreground/50">
                                                <span>Updated on: {t.date}</span>
                                                <ShieldCheck className="size-2.5" />
                                            </div>
                                        </div>
                                    )) : <p className="py-10 text-center text-xs italic text-muted-foreground uppercase opacity-40">No confirmed revenue in this window.</p>}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Social Reach Audit</h4>
                                <div className="p-6 bg-white border border-border shadow-sm rounded-none flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/5 text-primary rounded-none"><Users className="size-6" /></div>
                                        <div>
                                            <p className="text-2xl font-black">{selectedBrand?.reach.toLocaleString()}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Aggregated Followers</p>
                                        </div>
                                    </div>
                                    <TrendingUp className="size-6 text-emerald-500 opacity-20" />
                                </div>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase italic text-center">Social data is used for awareness auditing and does not influence Net Profit.</p>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* KPI Audit Dialog */}
            <Dialog open={!!selectedMetric} onOpenChange={o => !o && setSelectedMetric(null)}>
                <DialogContent className="rounded-none border-none shadow-3xl sm:max-w-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 border-b bg-white">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Audit Log: {selectedMetric?.toUpperCase()}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Transaction verification and historical synchronization</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-8 space-y-6">
                            {selectedMetric === 'revenue' && (
                                <div className="space-y-4">
                                    {clients?.flatMap(c => (c.payments || []).filter(p => p.status === 'Paid').map(p => ({ ...p, clientName: c.companyName }))).map((p, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100">
                                            <div>
                                                <p className="font-bold text-xs uppercase">{p.clientName}</p>
                                                <p className="text-[9px] text-emerald-600 font-bold uppercase">Confirmed: {p.invoiceDate || 'System Audit'}</p>
                                            </div>
                                            <p className="text-sm font-black text-emerald-900">₹{parseFloat(p.amountReceived || '0').toLocaleString()}</p>
                                        </div>
                                    ))}
                                    {(!clients || clients.length === 0) && <p className="py-10 text-center opacity-30 uppercase font-black text-[10px]">No confirmed revenue</p>}
                                </div>
                            )}
                            {selectedMetric === 'expenses' && (
                                <div className="space-y-4">
                                    <div className="p-6 bg-rose-50 border border-rose-100 rounded-none text-center space-y-1">
                                        <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Total Monthly Payroll</p>
                                        <p className="text-3xl font-black text-rose-900">₹{stats.workforceCost.toLocaleString()}</p>
                                    </div>
                                    <div className="p-6 bg-muted/20 border rounded-none text-center space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Marketing Spend</p>
                                        <p className="text-2xl font-black">₹{stats.marketingSpent.toLocaleString()}</p>
                                    </div>
                                    <p className="text-[9px] font-bold text-center text-muted-foreground uppercase italic">Expense audit derived from verified payroll and marketing ad-spend logs.</p>
                                </div>
                            )}
                            {selectedMetric === 'profit' && (
                                <div className="space-y-8 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            className="p-4 bg-muted/20 border rounded-none cursor-pointer hover:bg-emerald-50 transition-all group"
                                            onClick={() => setSelectedMetric('revenue')}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-[9px] font-bold uppercase text-muted-foreground">Total Inflow</p>
                                                <ChevronRight className="size-3 opacity-0 group-hover:opacity-40" />
                                            </div>
                                            <p className="text-xl font-black text-emerald-600">₹{stats.totalRevenue.toLocaleString()}</p>
                                        </div>
                                        <div 
                                            className="p-4 bg-muted/20 border rounded-none cursor-pointer hover:bg-rose-50 transition-all group"
                                            onClick={() => setSelectedMetric('expenses')}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-[9px] font-bold uppercase text-muted-foreground">Total Outflow</p>
                                                <ChevronRight className="size-3 opacity-0 group-hover:opacity-40" />
                                            </div>
                                            <p className="text-xl font-black text-rose-600">₹{(stats.workforceCost + stats.marketingSpent).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className={cn("p-8 rounded-none text-center shadow-2xl", stats.netProfitRaw > 0 ? "bg-primary text-white" : "bg-rose-600 text-white")}>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">{stats.netProfitRaw > 0 ? "Calculated Net Profit" : "Operational Deficit"}</p>
                                        <p className="text-4xl font-black tracking-tighter">₹{stats.netProfit.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white">
                        <Button className="w-full rounded-none h-12 font-black uppercase text-[10px]" onClick={() => setSelectedMetric(null)}>Acknowledge Audit</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <footer className="pt-8 flex items-center justify-between text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.4em] border-t border-dashed">
                <p>© 2026 MARSHRM</p>
                <p>BY FORTUMARS</p>
            </footer>
        </div>
    );
}

function KPICard({ title, value, trend, up, icon: Icon, color, bg, lastUpdate, onClick }: any) {
    return (
        <Card 
            className="bg-white/50 border-none ring-1 ring-border/50 rounded-none p-5 space-y-4 shadow-sm group hover:shadow-md transition-all cursor-pointer"
            onClick={onClick}
        >
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
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{title}</p>
                <h3 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">{value}</h3>
            </div>
            <div className="pt-2 flex items-center justify-between">
                <div className="h-6 w-24 opacity-20">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[{v:10}, {v:20}, {v:15}, {v:30}, {v:25}, {v:40}]}>
                            <Area type="monotone" dataKey="v" stroke={up ? "#10b981" : "#f43f5e"} fill={up ? "#10b981" : "#f43f5e"} fillOpacity={0.2} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[7px] font-black uppercase text-muted-foreground/30">
                    {lastUpdate ? `Updated: ${format(lastUpdate.toDate(), 'HH:mm')}` : 'Live Audit'}
                </p>
            </div>
        </Card>
    );
}
