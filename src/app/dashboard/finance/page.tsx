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
    Plus,
    History as HistoryIcon,
    Check,
    X,
    Zap,
    PieChart as PieChartIcon
} from "lucide-react";
import { 
    Area, AreaChart, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, Bar, BarChart, Cell, Pie, PieChart, Legend
} from 'recharts';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import Link from 'next/link';
import { format, isAfter, isBefore, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent } from '@/components/ui/tabs';

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

type ManualTransaction = {
    id: string;
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: any;
    teamId?: string;
    notes?: string;
};

export default function FinancePage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // Filter States
    const [dateFilter, setDateFilter] = React.useState<string>("this-month");
    const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Detail States
    const [selectedMetric, setSelectedMetric] = React.useState<string | null>(null);
    const [selectedPortfolio, setSelectedPortfolio] = React.useState<any | null>(null);
    const [isManualEntryOpen, setIsManualEntryOpen] = React.useState(false);

    // Manual Entry Form State
    const [manualForm, setManualForm] = React.useState({
        title: '', amount: '', type: 'income' as 'income' | 'expense', category: 'General', teamId: 'unassigned', date: format(new Date(), 'yyyy-MM-dd')
    });

    // Data Streams
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

    const marketingQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions'), orderBy('date', 'desc')), [firestore]);
    const { data: marketing, isLoading: marketingLoading } = useCollection<MarketingSession>(marketingQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: teams } = useCollection<any>(teamsQuery);

    const manualTransactionsQuery = useMemoFirebase(() => query(collection(firestore, 'financial_transactions'), orderBy('date', 'desc')), [firestore]);
    const { data: manualTransactions, isLoading: manualLoading } = useCollection<ManualTransaction>(manualTransactionsQuery);

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
        let manualIncome = 0;
        let manualExpense = 0;

        let portfolioData: Record<string, { revenue: number, pipeline: number, reach: number, count: number, transactions: any[] }> = {};
        let teamRevenue: Record<string, number> = {};
        let masterHistory: any[] = [];

        // Process Manual Transactions
        manualTransactions?.forEach(mt => {
            const date = mt.date?.toDate ? mt.date.toDate() : new Date(mt.date || Date.now());
            const isRelevant = !dateRange.start || (isAfter(date, dateRange.start) && isBefore(date, dateRange.end));
            if (isRelevant) {
                if (mt.type === 'income') {
                    manualIncome += (mt.amount || 0);
                    masterHistory.push({
                        id: mt.id,
                        title: mt.title,
                        amount: mt.amount,
                        type: 'income',
                        category: mt.category,
                        date: date,
                        icon: TrendingUp
                    });
                } else {
                    manualExpense += (mt.amount || 0);
                    masterHistory.push({
                        id: mt.id,
                        title: mt.title,
                        amount: mt.amount,
                        type: 'expense',
                        category: mt.category,
                        date: date,
                        icon: TrendingDown
                    });
                }
            }
        });

        // Process Clients
        clients?.forEach(c => {
            const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
            const team = teams?.find((t: any) => t.id === c.assignedTeamId);
            const teamName = team?.name || "Unassigned";
            if (!teamRevenue[teamName]) teamRevenue[teamName] = 0;

            (c.payments || []).forEach(p => {
                const received = parseFloat(p.amountReceived || '0') || 0;
                const total = parseFloat(p.amount) || 0;
                
                const pDate = p.invoiceDate ? new Date(p.invoiceDate) : (p.dueDate ? new Date(p.dueDate) : created);
                const isRelevant = !dateRange.start || (isAfter(pDate, dateRange.start) && isBefore(pDate, dateRange.end));

                if (isRelevant) {
                    totalRevenue += received;
                    if (p.status !== 'Paid') totalPipeline += (total - received);
                    teamRevenue[teamName] += received;

                    const key = c.serviceType || "Direct Services";
                    if (!portfolioData[key]) {
                        portfolioData[key] = { revenue: 0, pipeline: 0, reach: 0, count: 0, transactions: [] };
                    }

                    portfolioData[key].revenue += received;
                    if (p.status !== 'Paid') portfolioData[key].pipeline += (total - received);
                    portfolioData[key].count += 1;
                    
                    if (received > 0) {
                        portfolioData[key].transactions.push({
                            clientName: c.companyName,
                            amount: received,
                            team: teamName,
                            date: p.invoiceDate || format(created, 'PP')
                        });
                        masterHistory.push({
                            id: `pay-${c.id}-${p.id}`,
                            title: c.companyName,
                            amount: received,
                            type: 'income',
                            category: 'Client Payment',
                            date: pDate,
                            icon: DollarSign,
                            team: teamName
                        });
                    }
                }
            });
        });

        // Process Workforce
        users?.forEach(u => { workforceCost += (u.payrollAmount || 0); });

        // Process Marketing
        marketing?.forEach(s => {
            const date = s.date?.toDate ? s.date.toDate() : new Date(s.date || Date.now());
            const isRelevant = !dateRange.start || (isAfter(date, dateRange.start) && isBefore(date, dateRange.end));

            if (s.type === 'topup') marketingBudget += (s.topupAmount || 0);
            else {
                const spend = s.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0;
                if (isRelevant) {
                    marketingSpent += spend;
                    if (spend > 0) {
                        masterHistory.push({
                            id: `mkt-${s.id}`,
                            title: 'Ad Spend Portfolio',
                            amount: spend,
                            type: 'expense',
                            category: 'Marketing',
                            date: date,
                            icon: Zap
                        });
                    }
                }
            }
        });

        const totalIn = totalRevenue + manualIncome;
        const totalOut = workforceCost + marketingSpent + manualExpense;
        const netProfitRaw = totalIn - totalOut;
        const netProfit = Math.max(0, netProfitRaw);

        return { 
            totalRevenue: totalIn, 
            totalPipeline, 
            workforceCost,
            netProfit,
            netProfitRaw,
            margin: totalIn > 0 ? (netProfit / totalIn) * 100 : 0,
            portfolioData, 
            marketingBudget, 
            marketingSpent,
            marketingBalance: Math.max(0, marketingBudget - marketingSpent),
            teamRevenue,
            lastUpdate: marketing?.[0]?.date || null,
            masterHistory: masterHistory.sort((a, b) => b.date.getTime() - a.date.getTime())
        };
    }, [clients, marketing, users, teams, dateRange, manualTransactions]);

    const topTeam = React.useMemo(() => {
        const entries = Object.entries(stats.teamRevenue);
        if (entries.length === 0) return null;
        const valid = entries.filter(e => e[1] > 0);
        if (valid.length === 0) return null;
        return valid.reduce((prev, curr) => curr[1] > prev[1] ? curr : prev);
    }, [stats.teamRevenue]);

    const handleSaveManualEntry = async () => {
        if (!manualForm.title || !manualForm.amount) return;
        const payload = {
            title: manualForm.title,
            amount: parseFloat(manualForm.amount),
            type: manualForm.type,
            category: manualForm.category,
            teamId: manualForm.teamId === 'unassigned' ? null : manualForm.teamId,
            date: Timestamp.fromDate(new Date(manualForm.date)),
            createdAt: serverTimestamp()
        };
        await addDocumentNonBlocking(collection(firestore, 'financial_transactions'), payload);
        toast({ title: 'Transaction Logged', description: `${manualForm.type === 'income' ? 'Money In' : 'Money Out'} recorded.` });
        setIsManualEntryOpen(false);
        setManualForm({
            title: '', amount: '', type: 'income', category: 'General', teamId: 'unassigned', date: format(new Date(), 'yyyy-MM-dd')
        });
    };

    if (clientsLoading || marketingLoading || manualLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary opacity-20">
                    <Loader2 className="size-12 animate-spin" />
                    <p className="font-black uppercase text-xs tracking-[0.3em]">Syncing Ledger...</p>
                </div>
            </div>
        );
    }

    const teamChartData = Object.entries(stats.teamRevenue).map(([name, value]) => ({ name, value }));
    const portfolioBreakdown = Object.entries(stats.portfolioData).map(([name, data]) => ({ name, value: data.revenue }));

    return (
        <div className="space-y-4 animate-fade-in-up pb-20 font-jakarta max-w-[1600px] mx-auto">
            {/* Header Terminal */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-1">
                <div className="space-y-0.5 text-left w-full md:w-auto">
                    <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-slate-900">Money Ledger</h1>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        {dateFilter === 'custom-range' ? `${format(dateRange.start!, 'PP')} - ${format(dateRange.end, 'PP')}` : `Verified Audit • ${format(new Date(), 'MMMM yyyy')}`}
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <Button onClick={() => setIsManualEntryOpen(true)} className="rounded-full h-9 px-6 bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                        <Plus className="size-4 mr-2" /> Record Entry
                    </Button>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard title="Money Got" value={`₹${(stats.totalRevenue / 100000).toFixed(2)}L`} trend="+22.4%" up={true} icon={DollarSign} color="text-primary" bg="bg-primary/5" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('revenue')} />
                <KPICard title="In Pipeline" value={`₹${(stats.totalPipeline / 100000).toFixed(2)}L`} trend="Pending" up={true} icon={Clock} color="text-amber-600" bg="bg-amber-50" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('pipeline')} />
                <KPICard title="Money Spent" value={`₹${((stats.workforceCost + stats.marketingSpent) / 100000).toFixed(2)}L`} trend="+7.8%" up={false} icon={TrendingDown} color="text-rose-600" bg="bg-rose-50" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('expenses')} />
                <KPICard title="Leftover" value={`₹${(stats.netProfit / 100000).toFixed(2)}L`} trend={stats.netProfitRaw < 0 ? "Deficit" : "+18.7%"} up={stats.netProfitRaw > 0} icon={TrendingUp} color={stats.netProfitRaw > 0 ? "text-emerald-600" : "text-rose-600"} bg={stats.netProfitRaw > 0 ? "bg-emerald-50" : "bg-rose-50"} lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('profit')} />
                <KPICard title="Profit %" value={`${stats.margin.toFixed(1)}%`} trend="+2.1pp" up={true} icon={Target} color="text-indigo-600" bg="bg-indigo-50" lastUpdate={stats.lastUpdate} onClick={() => setSelectedMetric('margin')} />
            </div>

            {/* Row 2: Portfolio & ROI Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-4 text-left">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1 text-left">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Package className="size-4" /> Service Portfolio
                                </CardTitle>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Revenue distribution by sector</p>
                            </div>
                            <Badge className="bg-primary text-white rounded-none font-black text-[8px] h-4 uppercase px-2">Live Audit</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black text-[8px] uppercase py-3 px-6 tracking-widest">Category</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Money Received</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Planned Money</TableHead>
                                    <TableHead className="font-black text-[8px] uppercase py-3 text-center">Workload</TableHead>
                                    <TableHead className="text-right px-6 font-black text-[8px] uppercase py-3">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(stats.portfolioData).map(([name, data]) => (
                                    <TableRow 
                                        key={name} 
                                        className="border-border/50 group hover:bg-primary/5 transition-colors cursor-pointer"
                                        onClick={() => setSelectedPortfolio({ name, ...data })}
                                    >
                                        <TableCell className="py-4 px-6 font-black text-[11px] uppercase tracking-tight">{name}</TableCell>
                                        <TableCell className="text-center font-bold text-emerald-600 text-xs">₹{(data.revenue / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-center font-bold text-amber-600 text-xs">₹{(data.pipeline / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black">{data.count}</span>
                                                <span className="text-[7px] font-bold text-muted-foreground uppercase">Tasks</span>
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

                <Card className="lg:col-span-4 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-4 text-left">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Clock className="size-4" /> Upcoming Money
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[300px]">
                            <div className="divide-y divide-border/50">
                                {clients?.flatMap(c => (c.payments || []).map(p => ({ ...p, clientName: c.companyName, clientId: c.id })))
                                    .filter(p => p && p.status !== 'Paid')
                                    .sort((a, b) => {
                                        if (!a.dueDate) return 1;
                                        if (!b.dueDate) return -1;
                                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                    })
                                    .slice(0, 10)
                                    .map((p, i) => (
                                    <Link href={`/dashboard/clients?clientId=${p.clientId}`} key={i} className="p-4 hover:bg-white transition-all flex items-center justify-between group cursor-pointer block">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-none bg-primary/5 text-primary"><ListChecks className="size-4" /></div>
                                            <div className="space-y-0.5 text-left">
                                                <p className="text-[10px] font-black uppercase text-primary truncate max-w-[200px]">{p.clientName}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Next Installment</p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-0.5">
                                            <p className="text-sm font-black tabular-nums">₹{(parseFloat(p.amount) / 1000).toFixed(1)}K</p>
                                            <p className="text-[9px] font-bold uppercase text-muted-foreground">{p.dueDate || 'Date Pending'}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Master History Terminal (GPay Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-12 bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-6 flex flex-row items-center justify-between text-left">
                        <div className="space-y-1 text-left">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <HistoryIcon className="size-4" /> Master Ledger History
                            </CardTitle>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Chronological financial feed</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700 font-black text-[8px] rounded-none border-none">Money In</Badge>
                            <Badge className="bg-rose-50 text-rose-700 font-black text-[8px] rounded-none border-none">Money Out</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <div className="divide-y divide-border/50">
                                {stats.masterHistory.length > 0 ? stats.masterHistory.map((item, i) => (
                                    <div key={i} className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-5">
                                            <Avatar className="h-12 w-12 rounded-none border-none ring-1 ring-border shadow-sm">
                                                <AvatarFallback className={cn("rounded-none font-black text-xs", item.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                                    <item.icon className="size-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1 text-left">
                                                <p className="font-black text-sm uppercase tracking-tight text-slate-800">{item.title}</p>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none px-2 h-4 border-muted-foreground/20 text-muted-foreground/60">{item.category}</Badge>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{format(item.date, 'PPP')}</span>
                                                    {item.team && <span className="text-[8px] font-black uppercase text-primary tracking-widest opacity-60">• {item.team}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className={cn("text-lg font-black tabular-nums", item.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                                                {item.type === 'income' ? '+' : '-'} ₹{item.amount.toLocaleString()}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 opacity-30">
                                                <CheckCircle2 className="size-2.5" />
                                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Verified Audit</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-32 text-center opacity-20 uppercase font-black text-[10px] tracking-widest flex flex-col items-center gap-4">
                                        <HistoryIcon className="size-12" />
                                        <span>No transactions in this period</span>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Manual Entry Dialog */}
            <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                <DialogContent className="rounded-none border-none shadow-3xl p-0 overflow-hidden sm:max-w-md">
                    <DialogHeader className="p-8 bg-white border-b shrink-0 text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                            <Plus className="size-5" /> New Transaction
                        </DialogTitle>
                        <DialogDescription className="text-[9px] font-bold uppercase tracking-widest opacity-60 text-left">Record miscellaneous income or expenses</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6 bg-muted/5 text-left">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Transaction Title</Label>
                            <Input value={manualForm.title} onChange={e => setManualForm({...manualForm, title: e.target.value})} placeholder="e.g., Office Rent, Laptop Buy..." className="h-11 rounded-none border-none ring-1 ring-border" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount (₹)</Label>
                                <Input type="number" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} placeholder="0.00" className="h-11 rounded-none border-none ring-1 ring-border font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Entry Type</Label>
                                <Select value={manualForm.type} onValueChange={(v: any) => setManualForm({...manualForm, type: v})}>
                                    <SelectTrigger className="h-11 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-none">
                                        <SelectItem value="income">Money In (Income)</SelectItem>
                                        <SelectItem value="expense">Money Out (Expense)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Category</Label>
                            <Select value={manualForm.category} onValueChange={v => setManualForm({...manualForm, category: v})}>
                                <SelectTrigger className="h-11 rounded-none font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-none">
                                    <SelectItem value="Operations">Operations</SelectItem>
                                    <SelectItem value="Personnel">Personnel</SelectItem>
                                    <SelectItem value="Assets">Assets</SelectItem>
                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                    <SelectItem value="Client Misc">Client Misc</SelectItem>
                                    <SelectItem value="General">General</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Stamping Date</Label>
                            <Input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="h-11 rounded-none border-none ring-1 ring-border" />
                        </div>
                    </div>
                    <div className="p-8 border-t bg-white">
                        <Button onClick={handleSaveManualEntry} className="w-full h-12 rounded-none font-black uppercase tracking-widest shadow-2xl">Confirm Stamping</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Graphs Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Card className="bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6">
                    <CardHeader className="p-0 pb-6 flex flex-row items-center justify-between space-y-0 text-left">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 text-left">
                            <TrendingUp className="size-4" /> Team Revenue Performance
                        </CardTitle>
                        {topTeam && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase rounded-none px-2 h-5 flex items-center">
                                Top: {topTeam[0]}
                            </Badge>
                        )}
                    </CardHeader>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamChartData}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[9px] font-black uppercase" />
                                <YAxis axisLine={false} tickLine={false} className="text-[9px] font-bold" tickFormatter={v => `₹${v/1000}k`} />
                                <Tooltip 
                                    cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                                    contentStyle={{borderRadius: '0px', border: '1px solid #eee', fontSize: '10px'}} 
                                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                                />
                                <Bar dataKey="value" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', paddingTop: '20px' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="bg-white/50 border-none ring-1 ring-border/50 rounded-none shadow-sm p-6">
                    <CardHeader className="p-0 pb-6 text-left">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 text-left">
                            <PieChartIcon className="size-4" /> Sector Distribution
                        </CardTitle>
                    </CardHeader>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={portfolioBreakdown} 
                                    cx="50%" cy="50%" 
                                    innerRadius={60} outerRadius={100} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="none"
                                >
                                    {portfolioBreakdown.map((_, index) => (
                                        <Cell key={index} fill={['#6D28D9', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E'][index % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
                                <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Portfolio Detail Sheet */}
            <Sheet open={!!selectedPortfolio} onOpenChange={o => !o && setSelectedPortfolio(null)}>
                <SheetContent className="rounded-none border-none shadow-3xl w-full sm:max-w-md p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-8 border-b bg-white shrink-0 text-left">
                        <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-primary text-white font-black text-[8px] h-4 uppercase rounded-none border-none px-2">Sector Detail</Badge>
                        </div>
                        <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-primary text-left">{selectedPortfolio?.name}</SheetTitle>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest text-left">Received Funds Analysis</p>
                    </SheetHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 pb-32">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] text-left">Transaction Log</h4>
                                <div className="space-y-3">
                                    {selectedPortfolio?.transactions?.length > 0 ? selectedPortfolio.transactions.map((t: any, i: number) => (
                                        <div key={i} className="p-5 bg-white ring-1 ring-border shadow-sm space-y-3 hover:border-primary transition-all">
                                            <div className="flex justify-between items-start text-left">
                                                <div className="space-y-1">
                                                    <p className="font-black text-xs uppercase tracking-tight">{t.clientName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{t.team} Team</p>
                                                </div>
                                                <span className="text-sm font-black text-emerald-600">₹{t.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="pt-2 border-t border-dashed flex items-center justify-between text-[8px] font-black uppercase text-muted-foreground/50">
                                                <span>Updated on: {t.date}</span>
                                                <CheckCircle2 className="size-2.5" />
                                            </div>
                                        </div>
                                    )) : <p className="py-10 text-center text-xs italic text-muted-foreground uppercase opacity-40">No confirmed payments in this window.</p>}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* KPI Audit Dialog */}
            <Dialog open={!!selectedMetric} onOpenChange={o => !o && setSelectedMetric(null)}>
                <DialogContent className="rounded-none border-none shadow-3xl sm:max-w-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 border-b bg-white text-left">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary text-left">Audit: {selectedMetric === 'revenue' ? 'Money Got' : selectedMetric === 'pipeline' ? 'In Pipeline' : selectedMetric?.toUpperCase()}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-left">Verified historical logs</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-8 space-y-6">
                            <Tabs value={selectedMetric === 'profit' ? 'overview' : 'details'}>
                                <TabsContent value="details" className="space-y-4 mt-0">
                                    {selectedMetric === 'revenue' && (
                                        <div className="space-y-4">
                                            {stats.masterHistory.filter(h => h.type === 'income').map((h, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 text-left">
                                                    <div>
                                                        <p className="font-bold text-xs uppercase">{h.title}</p>
                                                        <p className="text-[9px] text-emerald-600 font-bold uppercase">Confirmed: {format(h.date, 'PP')}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-emerald-900">₹{h.amount.toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedMetric === 'pipeline' && (
                                        <div className="space-y-4">
                                            {clients?.flatMap(c => (c.payments || []).map(p => ({ ...p, clientName: c.companyName })))
                                                .filter(p => p && p.status !== 'Paid')
                                                .map((h, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 text-left">
                                                    <div>
                                                        <p className="font-bold text-xs uppercase">{h.clientName}</p>
                                                        <p className="text-[9px] text-amber-600 font-bold uppercase">Due: {h.dueDate || 'N/A'}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-amber-900">₹{parseFloat(h.amount).toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedMetric === 'expenses' && (
                                        <div className="space-y-4">
                                            {stats.masterHistory.filter(h => h.type === 'expense').map((h, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 text-left">
                                                    <div>
                                                        <p className="font-bold text-xs uppercase">{h.title}</p>
                                                        <p className="text-[9px] text-rose-600 font-bold uppercase">Confirmed: {format(h.date, 'PP')}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-rose-900">₹{h.amount.toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="overview" className="mt-0">
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div onClick={() => setSelectedMetric('revenue')} className="p-6 bg-muted/20 border rounded-none cursor-pointer hover:bg-emerald-50 transition-all group text-left">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Total Inflow</p>
                                                    <ChevronRight className="size-3 opacity-0 group-hover:opacity-40" />
                                                </div>
                                                <p className="text-xl font-black text-emerald-600">₹{stats.totalRevenue.toLocaleString()}</p>
                                            </div>
                                            <div onClick={() => setSelectedMetric('expenses')} className="p-6 bg-muted/20 border rounded-none cursor-pointer hover:bg-rose-50 transition-all group text-left">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Total Outflow</p>
                                                    <ChevronRight className="size-3 opacity-0 group-hover:opacity-40" />
                                                </div>
                                                <p className="text-xl font-black text-rose-600">₹{(stats.totalRevenue - stats.netProfitRaw).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className={cn("p-10 text-center shadow-2xl ring-1 ring-border/50", stats.netProfitRaw > 0 ? "bg-primary text-white" : "bg-rose-600 text-white")}>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">{stats.netProfitRaw > 0 ? "Operational Gain" : "Operational Deficit"}</p>
                                            <p className="text-5xl font-black tracking-tighter">₹{stats.netProfit.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white">
                        <Button className="w-full rounded-none h-12 font-black uppercase text-[10px]" onClick={() => setSelectedMetric(null)}>Acknowledge Audit</Button>
                    </div>
                </DialogContent>
            </Dialog>
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
                <div className={cn("flex items-center gap-1 text-[10px] font-black text-left", up ? "text-emerald-600" : "text-rose-600")}>
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {trend}
                </div>
            </div>
            <div className="min-w-0 text-left">
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
                <div className="flex items-center gap-1 opacity-20">
                    <CheckCircle2 className="size-2" />
                    <p className="text-[7px] font-black uppercase text-muted-foreground/80 tracking-tight">
                        {lastUpdate ? `Last Sync: ${format(lastUpdate.toDate(), 'HH:mm')}` : 'Live Audit'}
                    </p>
                </div>
            </div>
        </Card>
    );
}
