
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, limit, Timestamp, getDocs } from 'firebase/firestore';
import { 
    TrendingUp, Plus, Trash2, Edit, ExternalLink, ShieldCheck, 
    BarChart3, PieChart, Users, Zap, DollarSign, Target, 
    Globe, PhoneCall, Mic, LayoutGrid, CheckCircle2, 
    MoreHorizontal, Download, Share2, Info, ArrowUpRight, 
    ArrowDownRight, Instagram, Linkedin, Facebook, Twitter, 
    Youtube, Briefcase, Settings2, PlusCircle, Filter, 
    Clock, ListTodo, Activity, BadgeCheck, Search
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, isSameMonth } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Area, AreaChart, Bar, BarChart, CartesianGrid, 
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Line, LineChart
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// --- DATA TYPES ---

type Brand = {
    id: string;
    name: string;
    gradient: string;
    channels: string[]; // e.g., ["Instagram", "LinkedIn"]
};

type AdPlatform = {
    id: string;
    name: string;
    color: string;
};

type SocialLog = {
    brandId: string;
    platformId: string;
    count: number;
};

type SpendLog = {
    platformId: string;
    amount: number;
    reason: string;
};

type CampaignLog = {
    id: string;
    name: string;
    brandId: string;
    platformId: string;
    status: 'Active' | 'Completed' | 'Paused';
    spend: number;
    budget: number;
    clicks: number;
    roi: number;
};

type MarketingSession = {
    id: string;
    date: any;
    auditedBy: string;
    auditedByName: string;
    socialLogs: SocialLog[];
    adSpends: SpendLog[];
    campaigns: CampaignLog[];
};

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

// --- MAIN PAGE ---

export default function MarketingManagementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Registry States
    const [isRegistryOpen, setIsRegistryOpen] = React.useState(false);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [selectedBrandForEntry, setSelectedBrandForEntry] = React.useState<string>('all');
    
    // Dynamic Config Ref
    const registryRef = useMemoFirebase(() => doc(firestore, 'settings', 'marketing_registry'), [firestore]);
    const { data: registry } = useDoc<any>(registryRef);

    const brands: Brand[] = registry?.brands || [
        { id: 'cognithorz', name: 'Cognithorz', gradient: 'from-sky-400 to-blue-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
        { id: 'fortumars', name: 'FortuMars', gradient: 'from-orange-400 to-blue-900', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
        { id: 'blackticket', name: 'Black Ticket', gradient: 'from-slate-900 to-rose-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] },
        { id: 'campusconnect', name: 'Campus Connect', gradient: 'from-purple-500 to-indigo-600', channels: ['Instagram', 'LinkedIn', 'Facebook'] }
    ];

    const adPlatforms: AdPlatform[] = registry?.adPlatforms || [
        { id: 'meta', name: 'Meta Ads', color: '#0181F5' },
        { id: 'google', name: 'Google Ads', color: '#F4B400' },
        { id: 'linkedin', name: 'LinkedIn Ads', color: '#0077B5' },
        { id: 'youtube', name: 'YouTube Ads', color: '#FF0000' }
    ];

    // Data Queries
    const sessionsQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions'), orderBy('date', 'desc'), limit(50)), [firestore]);
    const { data: sessions, isLoading } = useCollection<MarketingSession>(sessionsQuery);

    const latestSession = sessions?.[0];

    // Form States
    const [formData, setFormData] = React.useState<Partial<MarketingSession>>({
        socialLogs: [],
        adSpends: [],
        campaigns: []
    });

    const [selectedAuditEntry, setSelectedAuditEntry] = React.useState<MarketingSession | null>(null);

    // Derived Analytics
    const totalFollowers = React.useMemo(() => {
        if (!latestSession?.socialLogs) return 0;
        return latestSession.socialLogs.reduce((acc, curr) => acc + curr.count, 0);
    }, [latestSession]);

    const mtdSpend = React.useMemo(() => {
        if (!sessions) return 0;
        const start = startOfMonth(new Date());
        return sessions
            .filter(s => s.date && s.date.toDate() >= start)
            .reduce((acc, curr) => acc + (curr.adSpends?.reduce((a, c) => a + c.amount, 0) || 0), 0);
    }, [sessions]);

    const chartData = React.useMemo(() => {
        if (!sessions) return [];
        return [...sessions].reverse().map(s => ({
            date: format(s.date?.toDate() || new Date(), 'MMM dd'),
            followers: s.socialLogs?.reduce((acc, curr) => acc + curr.count, 0) || 0,
            spend: s.adSpends?.reduce((acc, curr) => acc + curr.amount, 0) || 0
        }));
    }, [sessions]);

    // Handlers
    const handleSaveSession = async () => {
        if (!user) return;
        const userDoc = await getDocs(query(collection(firestore, 'users'), where('id', '==', user.uid)));
        const userData = userDoc.docs[0]?.data();

        const payload = {
            ...formData,
            date: serverTimestamp(),
            auditedBy: user.uid,
            auditedByName: userData ? `${userData.firstName} ${userData.lastName}` : 'Auditor'
        };

        addDocumentNonBlocking(collection(firestore, 'marketing_sessions'), payload);
        toast({ title: 'Intelligence Synchronized', description: 'Cross-company data logged to executive ledger.' });
        setIsAddOpen(false);
        setFormData({ socialLogs: [], adSpends: [], campaigns: [] });
    };

    const handleUpdateRegistry = (newRegistry: any) => {
        setDocumentNonBlocking(registryRef, newRegistry, { merge: true });
        toast({ title: 'Registry Updated' });
    };

    return (
        <div className="space-y-6 animate-fade-in-up font-jakarta pb-20">
            <PageHeader title="Marketing Intelligence Hub" description="Industrial dashboard for tracking brand velocity and authorized ad expenditures.">
                <div className="flex gap-2">
                    <Dialog open={isRegistryOpen} onOpenChange={setIsRegistryOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-none h-11 bg-white border-none ring-1 ring-border shadow-sm font-black uppercase text-[10px] tracking-widest px-6">
                                <Settings2 className="size-4 mr-2" /> Registry Control
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl rounded-none border-none shadow-2xl p-0 overflow-hidden h-[80vh] flex flex-col">
                            <DialogHeader className="p-8 border-b bg-white shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Organizational Registry</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Manage authorized brands and tactical platforms</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-10">
                                    {/* Brands Config */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><BadgeCheck className="size-4"/> Authorized Brands</h4>
                                            <Button variant="ghost" size="sm" className="h-7 rounded-none font-bold uppercase text-[9px]" onClick={() => {
                                                const name = prompt("Enter Brand Name:");
                                                if (name) handleUpdateRegistry({ brands: [...brands, { id: name.toLowerCase().replace(/\s/g, ''), name, gradient: 'from-slate-400 to-slate-600', channels: ['Facebook', 'Instagram'] }] });
                                            }}><Plus className="size-3 mr-1" /> Add Brand</Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {brands.map(brand => (
                                                <Card key={brand.id} className="rounded-none border-none ring-1 ring-border shadow-sm overflow-hidden">
                                                    <div className={cn("h-1.5 w-full bg-gradient-to-r", brand.gradient)} />
                                                    <CardContent className="p-4 flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="font-black text-sm uppercase tracking-tight">{brand.name}</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {brand.channels.map(c => <Badge key={c} variant="outline" className="rounded-none text-[8px] font-bold uppercase px-1.5 h-4">{c}</Badge>)}
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => handleUpdateRegistry({ brands: brands.filter(b => b.id !== brand.id) })}>
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Platforms Config */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Zap className="size-4"/> Advertising Channels</h4>
                                            <Button variant="ghost" size="sm" className="h-7 rounded-none font-bold uppercase text-[9px]" onClick={() => {
                                                const name = prompt("Enter Ad Platform Name:");
                                                if (name) handleUpdateRegistry({ adPlatforms: [...adPlatforms, { id: name.toLowerCase().replace(/\s/g, ''), name, color: '#6366f1' }] });
                                            }}><Plus className="size-3 mr-1" /> Add Platform</Button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {adPlatforms.map(plat => (
                                                <div key={plat.id} className="p-3 bg-white border border-border flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-2" style={{ backgroundColor: plat.color }} />
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
                            <Button className="rounded-none h-11 shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Daily Intelligence
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-none border-none shadow-2xl p-0 overflow-hidden h-[90vh] flex flex-col">
                            <DialogHeader className="p-8 border-b bg-white shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Mission Intelligence Terminal</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Log fleet-wide performance and authorized expenditures</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-12">
                                    {/* Social Reach Entry */}
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Users className="size-4"/> Social Growth Matrix</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {brands.map(brand => (
                                                <div key={brand.id} className="space-y-4 p-6 bg-white border border-border shadow-sm">
                                                    <div className="flex items-center justify-between border-b border-dashed pb-3">
                                                        <p className="font-black text-sm uppercase tracking-tight">{brand.name}</p>
                                                        <div className={cn("size-3 rounded-full bg-gradient-to-r", brand.gradient)} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {brand.channels.map(channel => (
                                                            <div key={channel} className="space-y-1.5">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground">{channel} Followers</Label>
                                                                <Input 
                                                                    type="number" 
                                                                    placeholder="Count..." 
                                                                    className="h-10 rounded-none border-none ring-1 ring-muted bg-muted/5 font-bold"
                                                                    onChange={e => {
                                                                        const logs = [...(formData.socialLogs || [])];
                                                                        const existing = logs.find(l => l.brandId === brand.id && l.platformId === channel);
                                                                        if (existing) existing.count = parseInt(e.target.value) || 0;
                                                                        else logs.push({ brandId: brand.id, platformId: channel, count: parseInt(e.target.value) || 0 });
                                                                        setFormData({ ...formData, socialLogs: logs });
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Ad Spend Entry */}
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><DollarSign className="size-4"/> Authorized Expenditures</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {adPlatforms.map(plat => (
                                                <div key={plat.id} className="p-6 bg-white border border-border shadow-sm space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="size-3" style={{ backgroundColor: plat.color }} />
                                                        <p className="font-black text-[11px] uppercase tracking-widest">{plat.name}</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                        <div className="md:col-span-3 space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label>
                                                            <Input 
                                                                type="number" 
                                                                className="rounded-none h-10 border-none ring-1 ring-muted bg-muted/5 font-black text-indigo-600"
                                                                onChange={e => {
                                                                    const spends = [...(formData.adSpends || [])];
                                                                    const existing = spends.find(s => s.platformId === plat.id);
                                                                    if (existing) existing.amount = parseInt(e.target.value) || 0;
                                                                    else spends.push({ platformId: plat.id, amount: parseInt(e.target.value) || 0, reason: '' });
                                                                    setFormData({ ...formData, adSpends: spends });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="md:col-span-9 space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Strategic Justification</Label>
                                                            <Textarea 
                                                                placeholder="Describe why this expenditure was authorized..." 
                                                                className="rounded-none min-h-[100px] border-none ring-1 ring-muted bg-muted/5 font-medium text-sm leading-relaxed"
                                                                onChange={e => {
                                                                    const spends = [...(formData.adSpends || [])];
                                                                    const existing = spends.find(s => s.platformId === plat.id);
                                                                    if (existing) existing.reason = e.target.value;
                                                                    else spends.push({ platformId: plat.id, amount: 0, reason: e.target.value });
                                                                    setFormData({ ...formData, adSpends: spends });
                                                                }}
                                                            />
                                                            {(formData.adSpends?.find(s => s.platformId === plat.id)?.amount || 0) > 0 && (
                                                                <p className="text-[8px] font-black uppercase text-indigo-600 italic">
                                                                    "{numberToWords(formData.adSpends?.find(s => s.platformId === plat.id)?.amount || 0)}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-white shrink-0">
                                <Button onClick={handleSaveSession} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">Finalize Intelligence Protocol</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            {/* Industrial Analytics Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                    label="Total Fleet Reach" 
                    value={`${(totalFollowers / 1000000).toFixed(1)}M`} 
                    sub={`${totalFollowers.toLocaleString()} Authorized Followers`} 
                    icon={Users} 
                    color="text-indigo-600" 
                    trend="+4.5%"
                />
                <MetricCard 
                    label="Financial Velocity (MTD)" 
                    value={`₹${(mtdSpend / 1000).toFixed(1)}K`} 
                    sub="Audited Monthly Expenditure" 
                    icon={DollarSign} 
                    color="text-emerald-600" 
                    trend="+12.8%"
                />
                <MetricCard 
                    label="Efficiency Sensor" 
                    value="₹8.15" 
                    sub="Avg. Acquisition Cost (CPA)" 
                    icon={Zap} 
                    color="text-amber-600" 
                />
            </div>

            {/* Central Operational Monitor */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Social Overview Matrix */}
                <Card className="lg:col-span-7 border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/10 border-b p-6">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                                <Globe className="size-4" /> Company Social Matrix
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <Table>
                            <TableHeader className="bg-muted/20">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Company</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Total Reach</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Breakdown</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {brands.map(brand => {
                                    const brandLogs = latestSession?.socialLogs.filter(l => l.brandId === brand.id) || [];
                                    const total = brandLogs.reduce((acc, curr) => acc + curr.count, 0);
                                    
                                    return (
                                        <TableRow key={brand.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-6 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("size-8 rounded-none flex items-center justify-center text-white text-[10px] font-black bg-gradient-to-br shadow-sm", brand.gradient)}>{brand.name[0]}</div>
                                                    <span className="font-black text-xs uppercase tracking-tight">{brand.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-sm font-black tracking-tight">{total.toLocaleString()}</span>
                                                    <span className="text-[8px] font-bold text-emerald-600">(+3%)</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    {brand.channels.slice(0, 4).map(ch => {
                                                        const count = brandLogs.find(l => l.platformId === ch)?.count || 0;
                                                        const Icon = PLATFORM_ICONS[ch] || Share2;
                                                        return (
                                                            <div key={ch} className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <Icon className="size-3 text-muted-foreground" />
                                                                <span className="text-[10px] font-bold">{count >= 1000 ? `${(count/1000).toFixed(1)}K` : count}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Spend Intelligence Chart */}
                <Card className="lg:col-span-5 border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white flex flex-col">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <BarChart3 className="size-4" /> Ad Spend Volume
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-2 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.slice(-6)}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[10px] font-bold uppercase fill-muted-foreground" tickMargin={10} />
                                <YAxis axisLine={false} tickLine={false} className="text-[9px] font-bold fill-muted-foreground" tickFormatter={v => `₹${v/1000}K`} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} content={<ChartTooltipContent />} />
                                <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                    <div className="p-6 pt-0 mt-auto border-t border-dashed border-border/50">
                        <div className="pt-4 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-black uppercase text-muted-foreground">Total Cumulative Spend</p>
                                <p className="text-lg font-black tracking-tight">₹{mtdSpend.toLocaleString()}</p>
                            </div>
                            <Badge variant="outline" className="rounded-none bg-primary/5 text-primary border-primary/20 text-[8px] font-black uppercase px-3 h-6">Performance Audited</Badge>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Growth Velocity Sensor */}
            <Card className="border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white overflow-hidden">
                <CardHeader className="p-8 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                                <TrendingUp className="size-4" /> Growth Velocity Tracking
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Correlation between ad volume and brand growth</CardDescription>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2"><div className="size-2 bg-primary" /><span className="text-[9px] font-black uppercase opacity-40">Reach</span></div>
                            <div className="flex items-center gap-2"><div className="size-2 bg-rose-500" /><span className="text-[9px] font-black uppercase opacity-40">Expenditure</span></div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[10px] font-bold uppercase fill-muted-foreground" />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorReach)" />
                            <Line type="monotone" dataKey="spend" stroke="#f43f5e" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Executive Audit Ledger */}
            <Card className="border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white overflow-hidden">
                <CardHeader className="bg-muted/10 border-b p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                                <ShieldCheck className="size-5" /> Executive Audit Ledger
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Consolidated history of authorized marketing sessions</CardDescription>
                        </div>
                        <div className="flex bg-white ring-1 ring-border p-1 rounded-none shadow-sm">
                            <Button variant="ghost" size="sm" className="h-8 rounded-none font-bold uppercase text-[9px] px-4">Daily</Button>
                            <Button variant="ghost" size="sm" className="h-8 rounded-none font-bold uppercase text-[9px] px-4 bg-muted/50">MTD Audit</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/20">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 px-10">Audit Period & Attribution</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 text-center">Total Audited Spend</TableHead>
                                <TableHead className="text-right font-black uppercase tracking-widest text-[10px] py-6 px-10">Control</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={3} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Syncing Intelligence Ledger...</TableCell></TableRow>
                            ) : sessions?.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No authorized sessions recorded.</TableCell></TableRow>
                            ) : sessions?.map(session => (
                                <TableRow key={session.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                    <TableCell className="py-6 px-10">
                                        <div className="flex items-center gap-5">
                                            <div className="p-3 bg-primary/10 text-primary rounded-none shadow-sm">
                                                <BadgeCheck className="size-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-black text-sm uppercase tracking-tight">{session.date ? format(session.date.toDate(), 'dd MMM yyyy') : '...'}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    Audited by: {session.auditedByName || 'System'} | {session.date ? format(session.date.toDate(), 'HH:mm:ss') : '--'} IST
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-base font-black text-indigo-600">₹{(session.adSpends?.reduce((acc, curr) => acc + curr.amount, 0) || 0).toLocaleString()}</span>
                                            <span className="text-[8px] font-black uppercase text-muted-foreground/40">authorized expenditure</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right px-10">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="rounded-none h-10 w-10 hover:bg-muted/50"><MoreHorizontal className="size-5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-none border-none shadow-2xl p-2 w-56">
                                                <DropdownMenuItem onClick={() => setSelectedAuditEntry(session)} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                                    <ExternalLink className="size-4 text-primary" /> View Intelligence
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { if(confirm("Confirm removal from ledger?")) deleteDocumentNonBlocking(doc(firestore, 'marketing_sessions', session.id)); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-rose-50 text-rose-600">
                                                    <Trash2 className="size-4" /> Purge Record
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Deep-Dive Intelligence Sheet */}
            <Dialog open={!!selectedAuditEntry} onOpenChange={o => !o && setSelectedAuditEntry(null)}>
                <DialogContent className="max-w-4xl rounded-none border-none shadow-2xl p-0 h-[85vh] flex flex-col">
                    <DialogHeader className="p-10 border-b bg-white shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Mission Audit Report</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Detailed session breakdown and strategic justification</DialogDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black uppercase">{selectedAuditEntry?.date ? format(selectedAuditEntry.date.toDate(), 'PPP') : ''}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">ID: {selectedAuditEntry?.id.slice(0, 12).toUpperCase()}</p>
                            </div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-secondary/10">
                        <div className="p-10 space-y-12">
                            {/* Brand Metrics Section */}
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                                    <Users className="size-4" /> Brand Growth Matrix
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {brands.map(brand => {
                                        const logs = selectedAuditEntry?.socialLogs.filter(l => l.brandId === brand.id) || [];
                                        if (logs.length === 0) return null;
                                        return (
                                            <Card key={brand.id} className="rounded-none border-none ring-1 ring-border/50 shadow-sm p-6 bg-white space-y-4">
                                                <div className="flex items-center justify-between border-b pb-3">
                                                    <p className="font-black text-sm uppercase tracking-tight">{brand.name}</p>
                                                    <div className={cn("size-2 rounded-full", brand.gradient.split(' ')[1].replace('to-', 'bg-'))} />
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {logs.map(log => {
                                                        const Icon = PLATFORM_ICONS[log.platformId] || Share2;
                                                        return (
                                                            <div key={log.platformId} className="space-y-1">
                                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                    <Icon className="size-3" />
                                                                    <span className="text-[8px] font-black uppercase tracking-tight">{log.platformId}</span>
                                                                </div>
                                                                <p className="text-sm font-black tracking-tight">{log.count.toLocaleString()}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Financial Expenditure Section */}
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                                    <DollarSign className="size-4" /> Authorized Expenditures
                                </h4>
                                <div className="space-y-4">
                                    {selectedAuditEntry?.adSpends.filter(s => s.amount > 0).map((spend, i) => {
                                        const Icon = PLATFORM_ICONS[spend.platformId] || Globe;
                                        return (
                                            <Card key={i} className="rounded-none border-none ring-1 ring-border/50 shadow-sm p-6 bg-white overflow-hidden relative">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4 min-w-[200px]">
                                                        <div className="p-3 bg-muted/10 text-primary rounded-none"><Icon className="size-5"/></div>
                                                        <div>
                                                            <p className="font-black text-sm uppercase tracking-tight">{spend.platformId}</p>
                                                            <p className="text-xl font-black text-indigo-600">₹{spend.amount.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 p-5 bg-muted/20 border-l-4 border-primary/20 space-y-2">
                                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Strategic Justification</p>
                                                        <p className="text-sm font-medium italic leading-relaxed text-foreground/80">"{spend.reason || 'No justification provided for this tactical expenditure.'}"</p>
                                                        <p className="text-[8px] font-black uppercase text-indigo-600/40 mt-3">{numberToWords(spend.amount)}</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Audit Attribution Footer */}
                            <div className="pt-10 flex flex-col items-center text-center space-y-6">
                                <div className="h-px w-32 bg-primary/20" />
                                <div className="space-y-1">
                                    <p className="text-sm font-black uppercase tracking-tighter text-primary">Authenticated Audit Session</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Verified by Officer: {selectedAuditEntry?.auditedByName}</p>
                                    <p className="text-[8px] font-mono text-muted-foreground italic opacity-40 mt-4">Platform: MarsHRM Marketing Engine v4.0 • E-Signed and Sealed</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- HELPER COMPONENTS ---

function MetricCard({ label, value, sub, icon: Icon, color, trend }: { label: string, value: string, sub: string, icon: any, color: string, trend?: string }) {
    return (
        <Card className="border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white p-6 space-y-4 group hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
                <div className={cn("p-4 rounded-none shadow-sm transition-transform group-hover:scale-105", color, "bg-muted/10")}>
                    <Icon className="size-5" />
                </div>
                {trend && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-none bg-emerald-50 text-emerald-600 rounded-none h-6 px-3 tracking-widest flex items-center gap-1">
                        <ArrowUpRight className="size-2" /> {trend}
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
