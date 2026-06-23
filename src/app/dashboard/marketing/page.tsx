'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, limit, Timestamp } from 'firebase/firestore';
import { 
    Plus, Trash2, ExternalLink, ShieldCheck, 
    Users, Zap, DollarSign, 
    Globe, Activity, Wallet, PieChart,
    ChevronRight, History, PlusSquare,
    Calendar, Timer, Link as LinkIcon,
    Instagram, Linkedin, Facebook, Twitter, 
    Youtube, Settings2, PlusCircle, 
    BadgeCheck, X, Loader2, Briefcase,
    ShieldAlert, TrendingUp, IndianRupee, AlertCircle, Filter
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, startOfWeek, endOfWeek, subWeeks, startOfMonth as startOfMonthFn, subMonths, endOfMonth as endOfMonthFn, startOfDay, endOfDay } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Area, AreaChart, CartesianGrid, 
    XAxis, YAxis, Tooltip
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { addDocumentNonBlocking } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import Link from 'next/link';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- UTILITIES ---

function formatCompact(num: number) {
    return Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(num).toLowerCase();
}

// --- DATA TYPES ---

type Brand = {
    id: string;
    name: string;
    gradient: string;
    channels: string[]; 
};

type AdPlatform = {
    id: string;
    name: string;
    color: string;
    category: 'Search' | 'Social' | 'Video' | 'Professional' | 'Job Board';
};

type SocialLog = {
    brandId: string;
    platformId: string;
    count: number; 
    posts: number; 
};

type SpendLog = {
    platformId: string;
    amount: number;
    reason: string;
    type?: 'Campaign' | 'Boosting';
    deadline?: any;
};

type MarketingSession = {
    id: string;
    date: any;
    auditedBy: string;
    auditedByName: string;
    socialLogs?: SocialLog[];
    adSpends?: SpendLog[];
    type: 'spend' | 'topup';
    topupAmount?: number;
    runningBalance?: number; 
};

const DEFAULT_BRANDS: Brand[] = [
    { id: 'cognithorz', name: 'Cognithorz', gradient: 'from-sky-400 to-blue-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'fortumars', name: 'FortuMars', gradient: 'from-red-600 to-blue-900', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'blackticket', name: 'Black Ticket', gradient: 'from-slate-900 to-rose-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'campusconnect', name: 'Campus Connect', gradient: 'from-purple-500 to-indigo-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] }
];

const performanceChartConfig = {
  reach: { label: "Followers", color: "hsl(var(--primary))" },
  spend: { label: "Spend", color: "#f43f5e" },
} satisfies ChartConfig;

export default function MarketingManagementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Filter States
    const [dateFilter, setDateFilter] = React.useState<string>("this-month");
    const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Access Control
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    // UI States
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isTopupOpen, setIsTopupOpen] = React.useState(false);
    const [isBudgetWarningOpen, setIsBudgetWarningOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>({ socialLogs: [], adSpends: [] });
    const [topupValue, setTopupValue] = React.useState<string>("");

    const registryRef = useMemoFirebase(() => doc(firestore, 'settings', 'marketing_registry'), [firestore]);
    const { data: registry } = useDoc<any>(registryRef);
    const brands = React.useMemo(() => registry?.brands || DEFAULT_BRANDS, [registry]);

    const allPlatformIds = React.useMemo(() => {
        const ids = new Set<string>();
        brands.forEach(b => b.channels.forEach(c => ids.add(c)));
        return Array.from(ids).sort();
    }, [brands]);

    const sessionsQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions'), orderBy('date', 'desc'), limit(1000)), [firestore]);
    const { data: rawSessions, isLoading: sessionsLoading } = useCollection<MarketingSession>(sessionsQuery);

    const dateRange = React.useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'this-week':
                start = startOfWeek(now, { weekStartsOn: 1 });
                end = endOfDay(now);
                break;
            case 'prev-week':
                start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
                end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
                break;
            case 'this-month':
                start = startOfMonthFn(now);
                end = endOfMonthFn(now);
                break;
            case 'prev-month':
                start = startOfMonthFn(subMonths(now, 1));
                end = endOfMonthFn(subMonths(now, 1));
                break;
            case 'custom-date':
                start = startOfDay(new Date(customStartDate));
                end = endOfDay(new Date(customStartDate));
                break;
            case 'custom-range':
                start = startOfDay(new Date(customStartDate));
                end = endOfDay(new Date(customEndDate));
                break;
            case 'all-time':
                start = null;
                break;
            default:
                start = startOfMonthFn(now);
                end = endOfMonthFn(now);
                break;
        }
        return { start, end };
    }, [dateFilter, customStartDate, customEndDate]);

    const sessions = React.useMemo(() => {
        if (!rawSessions) return [];
        const sorted = [...rawSessions].sort((a, b) => (a.date?.toDate?.()?.getTime() || 0) - (b.date?.toDate?.()?.getTime() || 0));
        let currentBal = 0;
        const mapped = sorted.map(session => {
            if (session.type === 'topup') currentBal += (session.topupAmount || 0);
            else {
                const spend = Array.isArray(session.adSpends) ? session.adSpends.reduce((a, c) => a + (c.amount || 0), 0) : 0;
                currentBal -= spend;
            }
            return { ...session, runningBalance: currentBal };
        });
        return mapped.reverse();
    }, [rawSessions]);

    const filteredSessions = React.useMemo(() => {
        if (!dateRange.start) return sessions;
        return sessions.filter(s => {
            const date = s.date?.toDate ? s.date.toDate() : new Date(s.date || Date.now());
            return isAfter(date, dateRange.start!) && isBefore(date, dateRange.end);
        });
    }, [sessions, dateRange]);

    // Financial Intelligence Calculations
    const currentBalance = React.useMemo(() => sessions[0]?.runningBalance || 0, [sessions]);
    
    const lastUpdateDate = React.useMemo(() => sessions[0]?.date, [sessions]);
    const lastSpentDate = React.useMemo(() => sessions.find(s => s.type === 'spend')?.date, [sessions]);

    const totalEverAdded = React.useMemo(() => 
        sessions.filter(s => s.type === 'topup').reduce((acc, curr) => acc + (curr.topupAmount || 0), 0),
    [sessions]);

    const totalEverSpent = React.useMemo(() => 
        sessions.filter(s => s.type === 'spend').reduce((acc, curr) => 
            acc + (curr.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0)
        , 0),
    [sessions]);

    const periodSpend = React.useMemo(() => {
        return filteredSessions
            .filter(s => s.type === 'spend')
            .reduce((acc, curr) => acc + (Array.isArray(curr.adSpends) ? curr.adSpends.reduce((a, c) => a + (c.amount || 0), 0) : 0), 0);
    }, [filteredSessions]);

    const latestSession = React.useMemo(() => filteredSessions.find(s => s.type === 'spend'), [filteredSessions]);
    const prevSession = React.useMemo(() => filteredSessions.filter(s => s.type === 'spend')[1], [filteredSessions]);

    const chartData = React.useMemo(() => {
        return [...filteredSessions]
            .filter(s => s.type === 'spend')
            .reverse()
            .slice(-14)
            .map(s => ({
                date: format(s.date?.toDate() || new Date(), 'MMM dd'),
                reach: Array.isArray(s.socialLogs) ? s.socialLogs.reduce((acc, curr) => acc + (curr.count || 0), 0) : 0,
                spend: Array.isArray(s.adSpends) ? s.adSpends.reduce((a, c) => a + (c.amount || 0), 0) : 0
            }));
    }, [filteredSessions]);

    const deadlines = React.useMemo(() => {
        const activeCampaignsMap = new Map<string, any>();
        [...sessions].reverse().forEach(session => {
            if (session.type === 'spend' && session.adSpends) {
                session.adSpends.forEach(spend => {
                    if (spend.type === 'Campaign' && spend.deadline && spend.reason) {
                        const key = `${spend.platformId}-${spend.reason}`;
                        const deadlineDate = spend.deadline.toDate ? spend.deadline.toDate() : new Date(spend.deadline);
                        activeCampaignsMap.set(key, {
                            title: `${spend.platformId}: ${spend.reason}`,
                            end: deadlineDate,
                            status: isAfter(deadlineDate, new Date()) ? 'Active' : 'Overdue'
                        });
                    }
                });
            }
        });
        return Array.from(activeCampaignsMap.values()).sort((a, b) => a.end.getTime() - b.end.getTime());
    }, [sessions]);

    const handleSaveSession = async () => {
        if (!user || !userData) return;
        const totalRequestedSpend = (formData.adSpends || []).reduce((acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0), 0);
        if (totalRequestedSpend > currentBalance) { setIsBudgetWarningOpen(true); return; }

        const processedLogs = (formData.socialLogs || []).map((log: any) => ({
            brandId: log.brandId, platformId: log.platformId, count: log.count, posts: (log.posts || 0) + (log.newPosts || 0)
        }));
        const processedAdSpends = (formData.adSpends || []).map((spend: any) => ({
            ...spend, deadline: spend.deadline ? Timestamp.fromDate(new Date(spend.deadline)) : null
        }));

        const payload = {
            socialLogs: processedLogs, adSpends: processedAdSpends, type: 'spend',
            date: serverTimestamp(), auditedBy: user.uid, auditedByName: `${userData.firstName} ${userData.lastName}`
        };
        addDocumentNonBlocking(collection(firestore, 'marketing_sessions'), payload);
        toast({ title: 'Records Updated' });
        setIsAddOpen(false);
    };

    const handleAddBudget = async () => {
        if (!user || !topupValue || !userData) return;
        const amount = parseFloat(topupValue);
        if (amount <= 0) return;
        const payload = {
            type: 'topup', topupAmount: amount,
            date: serverTimestamp(), auditedBy: user.uid, auditedByName: `${userData.firstName} ${userData.lastName}`
        };
        addDocumentNonBlocking(collection(firestore, 'marketing_sessions'), payload);
        toast({ title: 'Budget Added' });
        setIsTopupOpen(false);
        setTopupValue("");
    };

    const formatShortDate = (ts: any) => ts ? format(ts.toDate(), 'MMM dd, p') : 'N/A';

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 space-y-6">
                <div className="p-6 rounded-none bg-rose-50 ring-8 ring-rose-50/50 shadow-inner"><ShieldAlert className="size-20 text-rose-600 opacity-80" /></div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Access Restricted</h2>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest max-w-sm mx-auto">This terminal is limited to Executive Tier personnel only.</p>
                </div>
                <Button asChild variant="outline" className="rounded-full h-12 px-10 font-black uppercase text-[10px] tracking-widest border-2"><Link href="/dashboard">Return to Mission Hub</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up pb-20 max-w-[1600px] mx-auto font-jakarta text-slate-900 px-4">
            <PageHeader title="Marketing Manager" description="Track company growth and budget.">
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[160px] rounded-full h-10 bg-white shadow-sm border-none ring-1 ring-border/50 text-xs">
                            <div className="flex items-center gap-2">
                                <Filter className="size-3 opacity-50" />
                                <SelectValue placeholder="Timeline" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Presets</SelectLabel>
                                <SelectItem value="all-time">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="this-week">This Week</SelectItem>
                                <SelectItem value="this-month">This Month</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Button onClick={() => setIsTopupOpen(true)} variant="outline" className="rounded-full h-10 font-bold uppercase text-[9px] tracking-widest px-4 shadow-sm border-none ring-1 ring-border/50 bg-emerald-50 text-emerald-700">
                        <IndianRupee className="size-3 mr-1.5" /> Add Budget
                    </Button>
                    
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full h-10 shadow-lg font-black uppercase text-[9px] tracking-widest px-6 shadow-primary/20">
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Update Data
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-none border-none shadow-3xl p-0 overflow-hidden h-[90vh] flex flex-col">
                            <DialogHeader className="p-8 border-b shrink-0 bg-white">
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Marketing Updates</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-10">
                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Users className="size-3.5"/> Brand Growth</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {brands.map(brand => (
                                                <div key={brand.id} className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm space-y-4">
                                                    <p className="font-black text-xs uppercase tracking-tight border-b border-dashed pb-3">{brand.name}</p>
                                                    <div className="space-y-4">
                                                        {brand.channels.map(channel => {
                                                            const log = formData.socialLogs?.find((l: any) => l.brandId === brand.id && l.platformId === channel);
                                                            return (
                                                                <div key={channel} className="space-y-3 p-3 bg-muted/10 rounded-none">
                                                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">{channel}</Label>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Followers</p>
                                                                            <Input type="number" min="0" value={log?.count || 0} className="h-9 rounded-none font-black text-xs" onChange={e => {
                                                                                const logs = [...(formData.socialLogs || [])];
                                                                                const idx = logs.findIndex((l: any) => l.brandId === brand.id && l.platformId === channel);
                                                                                if (idx > -1) logs[idx].count = Math.max(0, parseInt(e.target.value) || 0);
                                                                                else logs.push({ brandId: brand.id, platformId: channel, count: Math.max(0, parseInt(e.target.value) || 0), newPosts: 0 });
                                                                                setFormData({ ...formData, socialLogs: logs });
                                                                            }} />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-[8px] font-bold text-emerald-600 uppercase opacity-60">New Posts</p>
                                                                            <Input type="number" min="0" value={log?.newPosts || 0} className="h-9 rounded-none font-black text-xs border-emerald-100" onChange={e => {
                                                                                const logs = [...(formData.socialLogs || [])];
                                                                                const idx = logs.findIndex((l: any) => l.brandId === brand.id && l.platformId === channel);
                                                                                if (idx > -1) logs[idx].newPosts = Math.max(0, parseInt(e.target.value) || 0);
                                                                                else logs.push({ brandId: brand.id, platformId: channel, count: 0, newPosts: Math.max(0, parseInt(e.target.value) || 0) });
                                                                                setFormData({ ...formData, socialLogs: logs });
                                                                            }} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-white shrink-0">
                                <Button onClick={handleSaveSession} className="w-full h-12 rounded-none font-black uppercase tracking-widest shadow-2xl">Finalize Updates</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            {/* Matrix Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Campaign Active" value={deadlines.filter(d => d.status === 'Active').length} sub="Upcoming Ends" icon={Timer} color="text-amber-600" bg="bg-amber-50" />
                
                <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-none bg-indigo-50 text-indigo-600 shadow-sm group-hover:scale-105 transition-transform"><Wallet className="size-5" /></div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Current Budget</p>
                            <h3 className="text-xl font-black tracking-tight text-slate-900">₹{currentBalance.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-dashed border-border/50">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Update: {formatShortDate(lastUpdateDate)}</p>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-none bg-rose-50 text-rose-600 shadow-sm group-hover:scale-105 transition-transform"><PieChart className="size-5" /></div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Period Spend</p>
                            <h3 className="text-xl font-black tracking-tight text-slate-900">₹{periodSpend.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-dashed border-border/50 space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Spend: {formatShortDate(lastSpentDate)}</p>
                    </div>
                </Card>
                
                <Card className="border-none shadow-sm rounded-none bg-white p-5 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-none bg-emerald-50 text-emerald-600 shadow-sm group-hover:scale-105 transition-transform"><TrendingUp className="size-5" /></div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Budget Overview</p>
                            <h3 className="text-lg font-black tracking-tight text-slate-900">Overview</h3>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-dashed border-border/50 flex justify-between gap-4">
                        <div>
                            <p className="text-[8px] font-black text-muted-foreground uppercase">Total Added</p>
                            <p className="text-xs font-black text-emerald-600">₹{totalEverAdded.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-muted-foreground uppercase">Total Spent</p>
                            <p className="text-xs font-black text-rose-600">₹{totalEverSpent.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 space-y-4">
                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white overflow-hidden">
                        <CardHeader className="bg-muted/5 border-b p-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2"><Users className="size-4" /> Follower Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/10 border-b">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-black uppercase tracking-widest text-[8px] py-4 px-6">Brand Identity</TableHead>
                                            {allPlatformIds.map(platform => (
                                                <TableHead key={platform} className="font-black uppercase tracking-widest text-[8px] py-4 text-center">{platform}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {brands.map(brand => (
                                            <TableRow key={brand.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                                <TableCell className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("size-8 rounded-none flex items-center justify-center text-[10px] text-white font-black bg-gradient-to-br shadow-sm", brand.gradient)}>
                                                            {brand.name[0]}
                                                        </div>
                                                        <span className="font-black text-xs uppercase tracking-tighter">{brand.name}</span>
                                                    </div>
                                                </TableCell>
                                                {allPlatformIds.map(platform => {
                                                    const log = latestSession?.socialLogs?.find(l => l.brandId === brand.id && l.platformId === platform);
                                                    const prevLog = prevSession?.socialLogs?.find(l => l.brandId === brand.id && l.platformId === platform);
                                                    const hasChannel = brand.channels.includes(platform);
                                                    const followerDiff = log && prevLog ? (log.count - prevLog.count) : 0;

                                                    if (!hasChannel) return <TableCell key={platform} className="text-center opacity-10">—</TableCell>;

                                                    return (
                                                        <TableCell key={platform} className="py-4 text-center">
                                                            <div className="space-y-0.5">
                                                                <span className="text-xs font-black tabular-nums">{formatCompact(log?.count || 0)}</span>
                                                                {followerDiff !== 0 && (
                                                                    <p className={cn("text-[8px] font-black uppercase", followerDiff > 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                        {followerDiff > 0 ? `+${followerDiff}` : followerDiff}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white overflow-hidden flex flex-col">
                        <CardHeader className="bg-muted/5 border-b p-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2"><History className="size-4" /> Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1">
                            <ScrollArea className="h-[400px]">
                                {sessionsLoading ? (
                                    <div className="p-20 text-center animate-pulse uppercase font-black text-[9px] text-muted-foreground tracking-widest">Scanning records...</div>
                                ) : filteredSessions.length === 0 ? (
                                    <div className="p-24 text-center text-muted-foreground italic uppercase font-black text-[9px] tracking-widest opacity-30">No records found.</div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {filteredSessions.map((session) => {
                                            const isTopup = session.type === 'topup';
                                            const amount = isTopup ? (session.topupAmount || 0) : (session.adSpends?.reduce((a, c) => a + (c.amount || 0), 0) || 0);

                                            return (
                                                <div key={session.id} className="px-6 py-4 hover:bg-muted/5 transition-all group flex items-center justify-between cursor-pointer">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn("size-10 rounded-none flex items-center justify-center shadow-sm", isTopup ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                                            {isTopup ? <Wallet className="size-5" /> : <Activity className="size-5" />}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-xs uppercase tracking-tight">{isTopup ? "Deposit" : "Spend"}</span>
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{format(session.date?.toDate?.() || new Date(), 'MMM dd, p')}</span>
                                                            </div>
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">By: {session.auditedByName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right space-y-0.5">
                                                        <p className={cn("text-base font-black tabular-nums", isTopup ? "text-emerald-600" : "text-rose-600")}>
                                                            {isTopup ? `+₹${amount.toLocaleString()}` : `-₹${amount.toLocaleString()}`}
                                                        </p>
                                                        <p className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-tight">Bal: ₹{(session.runningBalance || 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-4">
                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white overflow-hidden p-6 space-y-6">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><TrendingUp className="size-3.5" /> Reach Pulse</CardTitle>
                        <div className="h-[200px]">
                            <ChartContainer config={performanceChartConfig} className="h-full w-full">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#F1F5F9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[7px] font-black uppercase fill-muted-foreground/40" tickMargin={10} />
                                    <YAxis hide />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Area type="monotone" dataKey="reach" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorReach)" />
                                </AreaChart>
                            </ChartContainer>
                        </div>
                    </Card>

                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white p-6 overflow-hidden flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Timer className="size-3.5" /> Ending Soon</CardTitle>
                            <Badge className="bg-rose-500 text-white rounded-none font-black text-[8px] px-2 h-4 shadow-sm">{deadlines.filter(d => d.status === 'Overdue').length} ALERTS</Badge>
                        </div>
                        <ScrollArea className="h-[250px]">
                            <div className="space-y-2">
                                {deadlines.length > 0 ? deadlines.map((d, i) => (
                                    <div key={i} className="p-3 rounded-none bg-muted/20 border border-transparent hover:border-border/50 hover:bg-white transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-1.5 rounded-none text-white", d.status === 'Overdue' ? "bg-rose-500" : "bg-sky-500")}>
                                                <Calendar className="size-3.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase truncate max-w-[100px]">{d.title}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">{format(d.end, 'MMM dd')}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                )) : (
                                    <div className="py-20 text-center opacity-20 uppercase font-black text-[8px] tracking-widest">No active deadlines</div>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            </div>
            
            {/* Top-up Dialog */}
            <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
                <DialogContent className="rounded-none border-none shadow-3xl p-8 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Add Budget</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4 text-center">
                        <div className="p-4 bg-emerald-50 rounded-none inline-block"><IndianRupee className="size-8 text-emerald-600" /></div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Amount (₹)</Label>
                            <Input 
                                type="number" 
                                value={topupValue}
                                onChange={e => setTopupValue(e.target.value)}
                                placeholder="0.00" 
                                className="h-14 rounded-none font-black text-2xl text-center border-none ring-1 ring-emerald-100 bg-white"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddBudget} className="w-full h-12 rounded-none font-black uppercase tracking-widest shadow-2xl bg-emerald-600 hover:bg-emerald-700">Add Funds</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Budget Warning */}
            <Dialog open={isBudgetWarningOpen} onOpenChange={setIsBudgetWarningOpen}>
                <DialogContent className="rounded-none border-none shadow-3xl p-8 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-center">Insufficient Balance</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4 text-center">
                        <p className="text-xs font-medium leading-relaxed text-slate-600">The requested expenditure exceeds the available balance.</p>
                        <div className="p-4 bg-muted/30 rounded-none border border-dashed border-border/50">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Available</p>
                            <p className="text-2xl font-black text-emerald-600">₹{currentBalance.toLocaleString()}</p>
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row gap-3">
                        <Button variant="outline" className="flex-1 rounded-none h-12 font-black uppercase text-[10px]" onClick={() => setIsBudgetWarningOpen(false)}>Discard</Button>
                        <Button className="flex-1 rounded-none h-12 font-black uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={() => { setIsBudgetWarningOpen(false); setIsTopupOpen(true); }}>Add Funds</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
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
            <div className="pt-3 border-t border-dashed border-border/50">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{sub}</p>
            </div>
        </Card>
    );
}
