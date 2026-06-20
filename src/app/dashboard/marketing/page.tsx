
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, limit, getDocs } from 'firebase/firestore';
import { 
    Plus, Trash2, ExternalLink, ShieldCheck, 
    BarChart3, Users, Zap, DollarSign, 
    Globe, LayoutGrid, CheckCircle2, 
    MoreHorizontal, Info, ArrowUpRight, 
    Instagram, Linkedin, Facebook, Twitter, 
    Youtube, Briefcase, Settings2, PlusCircle, 
    BadgeCheck, X, Activity, Clock, Wallet, PieChart,
    ChevronRight, ArrowUp, ArrowDown, History, PlusSquare
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfMonth, isSameMonth } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Area, AreaChart, CartesianGrid, 
    XAxis, YAxis, Tooltip
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';

// --- UTILITIES ---

function numberToWords(num: number): string {
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    if (num === 0) return 'zero';
    const translate = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' and ' + translate(n % 100) : '');
        if (n < 1000000) return translate(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + translate(n % 1000) : '');
        return n.toString();
    };
    return translate(num) + ' rupees only';
}

const PLATFORM_ICONS: Record<string, any> = {
    'Instagram': Instagram,
    'LinkedIn': Linkedin,
    'Facebook': Facebook,
    'Twitter': Twitter,
    'YouTube': Youtube,
    'Meta Ads': Facebook,
    'Google Ads': Globe,
    'LinkedIn Ads': Linkedin,
    'YouTube Ads': Youtube,
    'Naukri': Briefcase
};

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
    category: 'Search' | 'Social' | 'Video' | 'Professional';
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
    runningBalance?: number; // Calculated field
};

// --- CONSTANTS ---

const DEFAULT_BRANDS: Brand[] = [
    { id: 'cognithorz', name: 'Cognithorz', gradient: 'from-sky-400 to-blue-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'fortumars', name: 'FortuMars', gradient: 'from-orange-400 to-blue-900', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'blackticket', name: 'Black Ticket', gradient: 'from-slate-900 to-rose-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
    { id: 'campusconnect', name: 'Campus Connect', gradient: 'from-purple-500 to-indigo-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] }
];

const DEFAULT_AD_PLATFORMS: AdPlatform[] = [
    { id: 'meta', name: 'Meta Ads', color: '#0181F5', category: 'Social' },
    { id: 'google', name: 'Google Ads', color: '#F4B400', category: 'Search' },
    { id: 'linkedin', name: 'LinkedIn Ads', color: '#0077B5', category: 'Professional' },
    { id: 'youtube', name: 'YouTube Ads', color: '#FF0000', category: 'Video' }
];

const performanceChartConfig = {
  reach: { label: "Followers", color: "hsl(var(--primary))" },
  spend: { label: "Spend", color: "hsl(var(--accent))" },
} satisfies ChartConfig;

// --- MAIN COMPONENT ---

export default function MarketingManagementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Dialog & UI States
    const [isRegistryOpen, setIsRegistryOpen] = React.useState(false);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isTopupOpen, setIsTopupOpen] = React.useState(false);
    const [selectedAuditEntry, setSelectedAuditEntry] = React.useState<MarketingSession | null>(null);
    
    // Form Persistence State
    const [formData, setFormData] = React.useState<Partial<MarketingSession>>({
        socialLogs: [],
        adSpends: []
    });
    const [topupValue, setTopupValue] = React.useState<string>("");

    // Config Refs
    const registryRef = useMemoFirebase(() => doc(firestore, 'settings', 'marketing_registry'), [firestore]);
    const { data: registry } = useDoc<any>(registryRef);

    // Memoize registry data to prevent re-renders
    const brands = React.useMemo(() => registry?.brands || DEFAULT_BRANDS, [registry]);
    const adPlatforms = React.useMemo(() => registry?.adPlatforms || DEFAULT_AD_PLATFORMS, [registry]);

    // Data Queries
    const sessionsQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions'), orderBy('date', 'desc'), limit(200)), [firestore]);
    const { data: rawSessions, isLoading } = useCollection<MarketingSession>(sessionsQuery);

    // Calculate Running Balance for History
    const sessions = React.useMemo(() => {
        if (!rawSessions) return [];
        // Sort ascending to calculate balance
        const sorted = [...rawSessions].sort((a, b) => {
            const timeA = a.date?.toDate?.()?.getTime() || 0;
            const timeB = b.date?.toDate?.()?.getTime() || 0;
            return timeA - timeB;
        });

        let currentBal = 0;
        const mapped = sorted.map(session => {
            if (session.type === 'topup') {
                currentBal += (session.topupAmount || 0);
            } else {
                const spend = Array.isArray(session.adSpends) ? session.adSpends.reduce((a, c) => a + (c.amount || 0), 0) : 0;
                currentBal -= spend;
            }
            return { ...session, runningBalance: currentBal };
        });

        // Return descending for display
        return mapped.reverse();
    }, [rawSessions]);

    const latestSession = React.useMemo(() => sessions.find(s => s.type === 'spend'), [sessions]);

    // Total followers aggregation from latest session
    const totalFollowers = React.useMemo(() => {
        if (!latestSession?.socialLogs || !Array.isArray(latestSession.socialLogs)) return 0;
        return latestSession.socialLogs.reduce((acc, curr) => acc + (curr.count || 0), 0);
    }, [latestSession]);

    // MTD spend calculation (current month only)
    const mtdSpend = React.useMemo(() => {
        if (!sessions) return 0;
        const start = startOfMonth(new Date());
        return sessions
            .filter(s => s.type === 'spend' && s.date && s.date.toDate() >= start)
            .reduce((acc, curr) => {
                const sessionTotal = Array.isArray(curr.adSpends) 
                    ? curr.adSpends.reduce((a, c) => a + (c.amount || 0), 0) 
                    : 0;
                return acc + sessionTotal;
            }, 0);
    }, [sessions]);

    const currentBalance = React.useMemo(() => sessions[0]?.runningBalance || 0, [sessions]);

    const chartData = React.useMemo(() => {
        if (!sessions) return [];
        return [...sessions]
            .filter(s => s.type === 'spend')
            .reverse()
            .slice(-14)
            .map(s => ({
                date: format(s.date?.toDate() || new Date(), 'MMM dd'),
                reach: Array.isArray(s.socialLogs) ? s.socialLogs.reduce((acc, curr) => acc + (curr.count || 0), 0) : 0,
                spend: Array.isArray(s.adSpends) ? s.adSpends.reduce((acc, curr) => acc + (curr.amount || 0), 0) : 0
            }));
    }, [sessions]);

    // Populate form from latest session when opening
    React.useEffect(() => {
        if (isAddOpen) {
            const initialSocialLogs = latestSession?.socialLogs || [];
            const initialAdSpends = adPlatforms.map(p => {
                const prev = latestSession?.adSpends?.find(s => s.platformId === p.id);
                return { platformId: p.id, amount: 0, reason: prev?.reason || '' };
            });

            setFormData({
                socialLogs: initialSocialLogs,
                adSpends: initialAdSpends
            });
        }
    }, [isAddOpen, latestSession, adPlatforms]);

    // Handlers
    const handleSaveSession = async () => {
        if (!user) return;
        const userDoc = await getDocs(query(collection(firestore, 'users'), where('id', '==', user.uid)));
        const userData = userDoc.docs[0]?.data();

        const payload = {
            ...formData,
            type: 'spend',
            date: serverTimestamp(),
            auditedBy: user.uid,
            auditedByName: userData ? `${userData.firstName} ${userData.lastName}` : 'Auditor'
        };

        addDocumentNonBlocking(collection(firestore, 'marketing_sessions'), payload);
        toast({ title: 'Today\'s Data Recorded' });
        setIsAddOpen(false);
    };

    const handleAddBudget = async () => {
        if (!user || !topupValue) return;
        const userDoc = await getDocs(query(collection(firestore, 'users'), where('id', '==', user.uid)));
        const userData = userDoc.docs[0]?.data();

        const payload = {
            type: 'topup',
            topupAmount: parseFloat(topupValue),
            date: serverTimestamp(),
            auditedBy: user.uid,
            auditedByName: userData ? `${userData.firstName} ${userData.lastName}` : 'Auditor'
        };

        addDocumentNonBlocking(collection(firestore, 'marketing_sessions'), payload);
        toast({ title: 'Budget Added', description: `₹${parseFloat(topupValue).toLocaleString()} added to fleet capital.` });
        setIsTopupOpen(false);
        setTopupValue("");
    };

    const handleUpdateRegistry = (update: any) => {
        setDocumentNonBlocking(registryRef, update, { merge: true });
        toast({ title: 'Settings Updated' });
    };

    return (
        <div className="space-y-6 animate-fade-in-up pb-20 max-w-[1600px] mx-auto font-jakarta text-slate-900">
            <PageHeader title="Marketing Manager" description="Track your company growth and advertising spend.">
                <div className="flex gap-2">
                    <Button onClick={() => setIsTopupOpen(true)} variant="outline" className="rounded-xl h-10 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm border-border bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        <PlusSquare className="size-3.5 mr-2" /> Add Budget
                    </Button>
                    <Dialog open={isRegistryOpen} onOpenChange={setIsRegistryOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-xl h-10 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm border-border bg-white hover:bg-muted/50">
                                <Settings2 className="size-3.5 mr-2" /> Settings
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-3xl border-none shadow-2xl p-0 h-[85vh] flex flex-col">
                            <DialogHeader className="p-8 border-b shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Company Registry</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Manage your brands and platforms</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-10">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><BadgeCheck className="size-4"/> Your Brands</h4>
                                            <Button variant="ghost" size="sm" className="h-7 rounded-lg font-bold uppercase text-[9px]" onClick={() => {
                                                const name = prompt("Enter Brand Name:");
                                                if (name) handleUpdateRegistry({ brands: [...brands, { id: name.toLowerCase().replace(/\s/g, ''), name, gradient: 'from-slate-400 to-slate-600', channels: ['Facebook', 'Instagram'] }] });
                                            }}><Plus className="size-3 mr-1" /> Add Brand</Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {brands.map(brand => (
                                                <Card key={brand.id} className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden bg-white group">
                                                    <div className={cn("h-1.5 w-full bg-gradient-to-r", brand.gradient)} />
                                                    <CardContent className="p-6 space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-black text-sm uppercase tracking-tight">{brand.name}</p>
                                                            <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 h-8 w-8" onClick={() => handleUpdateRegistry({ brands: brands.filter(b => b.id !== brand.id) })}>
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Active Channels</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {brand.channels.map(channel => (
                                                                    <Badge key={channel} variant="outline" className="rounded-lg font-bold text-[9px] uppercase px-2 py-1 gap-2 bg-muted/20">
                                                                        {channel}
                                                                        <X className="size-2.5 cursor-pointer opacity-40 hover:opacity-100" onClick={() => {
                                                                            const updated = brands.map(b => b.id === brand.id ? { ...b, channels: b.channels.filter(c => c !== channel) } : b);
                                                                            handleUpdateRegistry({ brands: updated });
                                                                        }} />
                                                                    </Badge>
                                                                ))}
                                                                <Button variant="outline" size="sm" className="h-6 rounded-lg font-black uppercase text-[8px] border-dashed text-primary px-2" onClick={() => {
                                                                    const chan = prompt("Enter Social Media Name:");
                                                                    if (chan) {
                                                                        const updated = brands.map(b => b.id === brand.id ? { ...b, channels: [...b.channels, chan] } : b);
                                                                        handleUpdateRegistry({ brands: updated });
                                                                    }
                                                                }}>+ Add Channel</Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><DollarSign className="size-4"/> Ad Platforms</h4>
                                            <Button variant="ghost" size="sm" className="h-7 rounded-lg font-bold uppercase text-[9px]" onClick={() => {
                                                const name = prompt("Enter Platform Name:");
                                                if (name) handleUpdateRegistry({ adPlatforms: [...adPlatforms, { id: name.toLowerCase().replace(/\s/g, ''), name, color: '#6366f1', category: 'Search' }] });
                                            }}><Plus className="size-3 mr-1" /> Add Platform</Button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {adPlatforms.map(plat => (
                                                <div key={plat.id} className="p-4 bg-white border rounded-xl flex items-center justify-between shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-2 rounded-full" style={{ backgroundColor: plat.color }} />
                                                        <span className="text-[10px] font-black uppercase tracking-tight">{plat.name}</span>
                                                    </div>
                                                    <X className="size-3 cursor-pointer opacity-30 hover:opacity-100" onClick={() => handleUpdateRegistry({ adPlatforms: adPlatforms.filter(p => p.id !== plat.id) })} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl h-10 shadow-lg font-black uppercase text-[10px] tracking-widest px-8 shadow-primary/20">
                                <PlusCircle className="mr-2 h-4 w-4" /> Update Today's Data
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-3xl border-none shadow-2xl p-0 overflow-hidden h-[90vh] flex flex-col">
                            <DialogHeader className="p-8 border-b shrink-0 bg-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Daily Intelligence Update</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Record your brand growth and spending</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-12">
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Users className="size-4"/> Social Performance</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {brands.map(brand => (
                                                <div key={brand.id} className="space-y-4 p-6 bg-white border rounded-2xl shadow-sm">
                                                    <p className="font-black text-sm uppercase tracking-tight border-b pb-3">{brand.name}</p>
                                                    <div className="grid grid-cols-1 gap-6">
                                                        {brand.channels.map(channel => {
                                                            const log = formData.socialLogs?.find(l => l.brandId === brand.id && l.platformId === channel);
                                                            return (
                                                                <div key={channel} className="space-y-3 p-3 bg-muted/10 rounded-xl">
                                                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">{channel}</Label>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Followers</p>
                                                                            <Input type="number" value={log?.count || 0} className="h-10 rounded-lg font-black" onChange={e => {
                                                                                const logs = [...(formData.socialLogs || [])];
                                                                                const idx = logs.findIndex(l => l.brandId === brand.id && l.platformId === channel);
                                                                                if (idx > -1) logs[idx].count = parseInt(e.target.value) || 0;
                                                                                else logs.push({ brandId: brand.id, platformId: channel, count: parseInt(e.target.value) || 0, posts: 0 });
                                                                                setFormData({ ...formData, socialLogs: logs });
                                                                            }} />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">Daily Posts</p>
                                                                            <Input type="number" value={log?.posts || 0} className="h-10 rounded-lg font-black" onChange={e => {
                                                                                const logs = [...(formData.socialLogs || [])];
                                                                                const idx = logs.findIndex(l => l.brandId === brand.id && l.platformId === channel);
                                                                                if (idx > -1) logs[idx].posts = parseInt(e.target.value) || 0;
                                                                                else logs.push({ brandId: brand.id, platformId: channel, count: 0, posts: parseInt(e.target.value) || 0 });
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
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><DollarSign className="size-4"/> Advertising Spend</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {adPlatforms.map(plat => {
                                                const spend = formData.adSpends?.find(s => s.platformId === plat.id);
                                                return (
                                                    <div key={plat.id} className="p-6 bg-white border rounded-2xl shadow-sm space-y-4">
                                                        <p className="font-black text-[11px] uppercase tracking-widest">{plat.name}</p>
                                                        <div className="space-y-4">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground">Spend (₹)</Label>
                                                                <Input type="number" value={spend?.amount || 0} className="h-10 rounded-lg font-black text-primary" onChange={e => {
                                                                    const spends = [...(formData.adSpends || [])];
                                                                    const idx = spends.findIndex(s => s.platformId === plat.id);
                                                                    if (idx > -1) spends[idx].amount = parseInt(e.target.value) || 0;
                                                                    else spends.push({ platformId: plat.id, amount: parseInt(e.target.value) || 0, reason: '' });
                                                                    setFormData({ ...formData, adSpends: spends });
                                                                }} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground">Reason for spend</Label>
                                                                <Textarea value={spend?.reason || ''} className="rounded-lg min-h-[80px]" placeholder="Strategic justification..." onChange={e => {
                                                                    const spends = [...(formData.adSpends || [])];
                                                                    const idx = spends.findIndex(s => s.platformId === plat.id);
                                                                    if (idx > -1) spends[idx].reason = e.target.value;
                                                                    else spends.push({ platformId: plat.id, amount: 0, reason: e.target.value });
                                                                    setFormData({ ...formData, adSpends: spends });
                                                                }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-white shrink-0">
                                <Button onClick={handleSaveSession} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Today's Records</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            {/* Top Row: Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard label="Total Followers" value={totalFollowers.toLocaleString()} sub="Fleet Reach" icon={Users} color="text-primary" />
                <MetricCard label="Total Budget" value={`₹${currentBalance.toLocaleString()}`} sub="Current Fleet Capital" icon={Wallet} color="text-indigo-600" />
                <MetricCard label="Money Spent" value={`₹${mtdSpend.toLocaleString()}`} sub="Ad Cost MTD" icon={PieChart} color="text-rose-600" trend={`${mtdSpend > 0 && currentBalance > 0 ? ((mtdSpend / (currentBalance + mtdSpend)) * 100).toFixed(1) : 0}% Used`} />
                <MetricCard label="Budget Left" value={`₹${currentBalance.toLocaleString()}`} sub="Available Funds" icon={ShieldCheck} color="text-emerald-600" />
            </div>

            {/* Main Visual Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-8 border-none ring-1 ring-border/50 shadow-sm rounded-3xl bg-white overflow-hidden flex flex-col">
                    <CardHeader className="p-8 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">Growth & Spend</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Correlation between spending and reach</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 h-[400px]">
                        <ChartContainer config={performanceChartConfig} className="h-full w-full">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[10px] font-black uppercase fill-muted-foreground" tickMargin={10} />
                                <YAxis axisLine={false} tickLine={false} className="text-[10px] font-black fill-muted-foreground" tickFormatter={v => `₹${v/1000}K`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area type="monotone" dataKey="reach" stroke="hsl(var(--primary))" strokeWidth={4} fill="url(#colorReach)" />
                                <Area type="monotone" dataKey="spend" stroke="#f43f5e" strokeWidth={2} fill="url(#colorSpend)" strokeDasharray="4 4" />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <div className="lg:col-span-4 flex flex-col gap-4">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Ad Platforms</h4>
                    {adPlatforms.map(plat => {
                        const platSpend = latestSession?.adSpends?.find(s => s.platformId === plat.id)?.amount || 0;
                        const Icon = PLATFORM_ICONS[plat.name] || Globe;
                        return (
                            <Card key={plat.id} className="border-none ring-1 ring-border/50 shadow-sm rounded-2xl bg-white p-5 group hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-xl bg-muted/5 border border-border group-hover:border-primary/20 transition-colors">
                                            <Icon className="size-5" style={{ color: plat.color }} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="font-black text-xs uppercase tracking-tight">{plat.name}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Authorized Sector</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black tracking-tight text-rose-600">-₹{platSpend.toLocaleString()}</p>
                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-40">Today's Spend</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Row: Social Matrix & Google Pay Style Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-7 border-none ring-1 ring-border/50 shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-muted/5 border-b p-6"><CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><Users className="size-4" /> Social Media Matrix</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/10"><TableRow><TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-8">Brand</TableHead><TableHead className="font-black uppercase tracking-widest text-[9px]">Followers</TableHead><TableHead className="font-black uppercase tracking-widest text-[9px]">Posts</TableHead><TableHead className="font-black uppercase tracking-widest text-[9px] text-right px-8">Status</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {brands.map(brand => {
                                    const logs = latestSession?.socialLogs?.filter(l => l.brandId === brand.id) || [];
                                    const total = logs.reduce((acc, curr) => acc + (curr.count || 0), 0);
                                    const totalPosts = logs.reduce((acc, curr) => acc + (curr.posts || 0), 0);
                                    return (
                                        <TableRow key={brand.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-6 px-8"><div className="flex items-center gap-3"><div className={cn("size-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shadow-sm bg-gradient-to-br", brand.gradient)}>{brand.name[0]}</div><span className="font-black text-xs uppercase tracking-tight">{brand.name}</span></div></TableCell>
                                            <TableCell><span className="text-sm font-black tabular-nums">{total.toLocaleString()}</span></TableCell>
                                            <TableCell><span className="text-xs font-bold text-muted-foreground uppercase">{totalPosts} Missions</span></TableCell>
                                            <TableCell className="text-right px-8"><Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-600 border-none font-black text-[8px] px-3 h-5">SYNCED</Badge></TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* GOOGLE PAY STYLE LEDGER */}
                <Card className="lg:col-span-5 border-none ring-1 ring-border/50 shadow-sm rounded-3xl bg-white overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 border-b p-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><History className="size-4" /> Monthly Ledger</CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-700 rounded-lg font-black text-[8px] border-none px-3 py-1">TOTAL AUDITED</Badge>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[500px]">
                            {isLoading ? (
                                <div className="p-20 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-widest">Scanning records...</div>
                            ) : sessions.length === 0 ? (
                                <div className="p-20 text-center text-muted-foreground italic uppercase font-black text-[10px]">No fleet activity found.</div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {/* Monthly Grouping */}
                                    {sessions.map((session, index) => {
                                        const date = session.date?.toDate?.() || new Date();
                                        const prev = sessions[index - 1];
                                        const showMonth = !prev || !isSameMonth(date, prev.date?.toDate?.() || new Date());
                                        const isTopup = session.type === 'topup';
                                        const totalSpend = Array.isArray(session.adSpends) ? session.adSpends.reduce((a, c) => a + (c.amount || 0), 0) : 0;
                                        const amount = isTopup ? (session.topupAmount || 0) : totalSpend;

                                        return (
                                            <div key={session.id}>
                                                {showMonth && (
                                                    <div className="bg-muted/30 px-6 py-3 sticky top-0 z-10 backdrop-blur-sm border-b">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(date, 'MMMM yyyy')}</span>
                                                    </div>
                                                )}
                                                <div className="p-6 hover:bg-muted/10 transition-all group flex items-center justify-between cursor-pointer" onClick={() => setSelectedAuditEntry(session)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn("size-10 rounded-2xl flex items-center justify-center shadow-sm", isTopup ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                                            {isTopup ? <Wallet className="size-5" /> : <Activity className="size-5" />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-xs uppercase tracking-tight">{isTopup ? "Budget Added" : "Ad Expenditure"}</span>
                                                                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase">{format(date, 'hh:mm a')}</span>
                                                            </div>
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Auditor: {session.auditedByName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className={cn("text-sm font-black tabular-nums", isTopup ? "text-emerald-600" : "text-rose-600")}>
                                                            {isTopup ? `+₹${amount.toLocaleString()}` : `-₹${amount.toLocaleString()}`}
                                                        </p>
                                                        <p className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-tight">
                                                            Balance: ₹{(session.runningBalance || 0).toLocaleString()}
                                                        </p>
                                                    </div>
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

            {/* Top-up Dialog */}
            <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
                <DialogContent className="rounded-3xl border-none shadow-2xl p-8 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Add Budget</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase opacity-60">Inject capital into the fleet marketing budget</DialogDescription>
                    </DialogHeader>
                    <div className="py-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Amount (₹)</Label>
                            <Input 
                                type="number" 
                                value={topupValue}
                                onChange={e => setTopupValue(e.target.value)}
                                placeholder="0" 
                                className="h-12 rounded-2xl font-black text-xl border-none ring-1 ring-border bg-muted/20"
                            />
                            {topupValue && <p className="text-[8px] font-black uppercase text-emerald-600 italic">"{numberToWords(parseFloat(topupValue))}"</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddBudget} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700">Confirm Deposit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Entry Details Deep-Dive */}
            <Dialog open={!!selectedAuditEntry} onOpenChange={o => !o && setSelectedAuditEntry(null)}>
                <DialogContent className="max-w-4xl rounded-3xl border-none shadow-2xl p-0 h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="p-10 border-b shrink-0 bg-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Entry Details</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Audited session intelligence breakdown</DialogDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black uppercase">{selectedAuditEntry?.date ? format(selectedAuditEntry.date.toDate(), 'PPP') : ''}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-0.5">Auditor: {selectedAuditEntry?.auditedByName}</p>
                            </div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-muted/5">
                        <div className="p-10 space-y-12">
                            {selectedAuditEntry?.type === 'topup' ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                    <div className="p-6 rounded-full bg-emerald-50 text-emerald-600 shadow-sm"><Wallet className="size-16" /></div>
                                    <div>
                                        <h3 className="text-4xl font-black text-emerald-700 tracking-tighter">+₹{selectedAuditEntry.topupAmount?.toLocaleString()}</h3>
                                        <p className="text-[10px] font-black uppercase text-emerald-600 mt-2 tracking-widest">Budget Addition Protocol</p>
                                    </div>
                                    <Separator className="w-48 my-4" />
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Balance After: ₹{selectedAuditEntry.runningBalance?.toLocaleString()}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3"><Users className="size-4" /> Social Matrix Snapshot</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {brands.map(brand => {
                                                const logs = selectedAuditEntry?.socialLogs?.filter(l => l.brandId === brand.id) || [];
                                                if (logs.length === 0) return null;
                                                return (
                                                    <Card key={brand.id} className="rounded-2xl border-none ring-1 ring-border/50 shadow-sm p-6 bg-white space-y-4">
                                                        <p className="font-black text-sm uppercase tracking-tight border-b pb-2">{brand.name}</p>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {logs.map(log => (
                                                                <div key={log.platformId} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl">
                                                                    <span className="text-[10px] font-black uppercase">{log.platformId}</span>
                                                                    <div className="text-right"><p className="text-sm font-black tabular-nums">{(log.count || 0).toLocaleString()}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">{(log.posts || 0)} Missions</p></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3"><DollarSign className="size-4" /> Expenditure Audit</h4>
                                        <div className="space-y-4">
                                            {selectedAuditEntry?.adSpends?.filter(s => (s.amount || 0) > 0).map((spend, i) => (
                                                <Card key={i} className="rounded-2xl border-none ring-1 ring-border/50 shadow-sm p-6 bg-white flex flex-col md:flex-row gap-6">
                                                    <div className="min-w-[150px]"><p className="font-black text-xs uppercase tracking-tight text-muted-foreground">{spend.platformId}</p><p className="text-2xl font-black text-rose-600">-₹{(spend.amount || 0).toLocaleString()}</p></div>
                                                    <div className="flex-1 p-4 bg-muted/20 border-l-4 border-primary rounded-r-xl space-y-1.5"><p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Strategic Justification</p><p className="text-sm font-medium italic leading-relaxed">"{spend.reason || 'Routine tactical maintenance.'}"</p></div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-8 border-t bg-white flex gap-4">
                        <Button variant="outline" className="flex-1 rounded-xl h-12 font-black uppercase text-[10px] tracking-widest" onClick={() => setSelectedAuditEntry(null)}>Close</Button>
                        <Button variant="destructive" className="rounded-xl h-12 px-6 font-black uppercase text-[10px]" onClick={() => { if(confirm("Confirm record purge?")) { deleteDocumentNonBlocking(doc(firestore, 'marketing_sessions', selectedAuditEntry!.id)); setSelectedAuditEntry(null); } }}><Trash2 className="size-4" /></Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- HELPER COMPONENTS ---

function MetricCard({ label, value, sub, icon: Icon, color, trend }: any) {
    return (
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 ring-1 ring-border/50 group transition-all duration-500 hover:shadow-xl">
            <div className="flex justify-between items-start">
                <div className={cn("p-3 rounded-xl shadow-sm transition-transform group-hover:scale-110", color, "bg-muted/10")}>
                    <Icon className="size-5" />
                </div>
                {trend && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-none bg-emerald-50 text-emerald-600 rounded-full h-6 px-3 tracking-widest flex items-center gap-1">
                        <Info className="size-2.5" /> {trend}
                    </Badge>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1.5">{label}</p>
                <h3 className="text-3xl font-black tracking-tighter leading-none mb-2">{value}</h3>
                <p className="text-[9px] font-bold uppercase text-muted-foreground/60 tracking-tight">{sub}</p>
            </div>
        </Card>
    );
}
