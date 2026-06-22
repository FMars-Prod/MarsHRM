'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, getDocs, limit, collectionGroup } from 'firebase/firestore';
import { 
    Users, Plus, Trash2, Edit, Search, ExternalLink, ShieldCheck, 
    Building2, Filter, Download, 
    Briefcase, Zap, MapPin, X, 
    DollarSign, BriefcaseBusiness, IndianRupee, Loader2, TrendingUp, ReceiptIndianRupee,
    Wallet, CheckCircle2, Clock, ChevronRight, MoreHorizontal, Mail, Phone, Calendar, FileText, CheckCircle, AlertCircle, LayoutGrid, Globe, Map, UserCircle,
    Info, CalendarDays, Receipt, BadgeIndianRupee, HandCoins, UserPlus, Video, Trophy, ListChecks
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, subMonths, endOfMonth, isAfter, isBefore } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

type PaymentInstallment = {
    id: string;
    amount: string;
    dueDate?: string;
    status: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
    invoiceNumber?: string;
    invoiceDate?: string;
    amountReceived?: string;
    remainingBalance?: string;
    remarks?: string;
};

type Client = {
    id: string;
    companyName: string;
    clientName: string;
    legalBusinessName?: string;
    email: string;
    phone: string;
    pocPosition?: string;
    productNeeded?: string;
    handlingEmployeeId?: string;
    projectType?: 'Technical' | 'Digital Marketing';
    assignedTeamId?: string;
    productHeadId?: string;
    fullPaymentPrice?: number;
    currencyType: string;
    expectedAnnualRevenue?: number;
    discountOffered?: number;
    projectTotalCost?: number;
    contractStartDate?: string;
    payments?: PaymentInstallment[];
    status: 'Active' | 'Prospect' | 'On Hold' | 'Inactive' | 'Archived';
    category: string;
    companySize?: string;
    priority?: 'Strategic' | 'High' | 'Medium' | 'Low';
    representativeName?: string;
    logoUrl?: string;
    address?: string;
    website?: string;
    hqLocation?: string;
    country?: string;
    state?: string;
    city?: string;
    createdAt?: any;
    gstNumber?: string;
    notes?: string;
    managerName?: string;
    managerAvatar?: string;
    projectsCount?: number;
    lastActivity?: string;
};

const INDUSTRY_SECTORS = [
    "Manufacturing", "IT & Software", "Finance", "Healthcare", "Education", "Retail", "Real Estate", "Automotive", "Logistics", "Energy", "Other"
];

const CURRENCIES = ["₹", "$", "€", "£", "AED", "SGD"];

export default function ClientsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [dateFilter, setDateFilter] = React.useState<string>("all-time");
    const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [rankBy, setRankBy] = React.useState<'price' | 'services'>('price');

    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [editingClient, setEditingClient] = React.useState<Client | null>(null);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [suggestedNames, setSuggestedNames] = React.useState<string[]>([]);
    const [tableFilter, setTableFilter] = React.useState<string>("all");

    const [clientForm, setClientForm] = React.useState<Partial<Client>>({
        companyName: '', clientName: '', legalBusinessName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
        companySize: '1-10 Employees', priority: 'Medium', representativeName: '',
        address: '', website: '', hqLocation: '', country: 'India', state: '', city: '',
        pocPosition: '', productNeeded: '', projectType: 'Technical',
        handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
        currencyType: '₹', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
        contractStartDate: format(new Date(), 'yyyy-MM-dd'),
        gstNumber: '', notes: '',
        payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    const vaultAssetsQuery = useMemoFirebase(() => query(collection(firestore, 'vault_assets')), [firestore]);
    const { data: vaultAssets } = useCollection<any>(vaultAssetsQuery);

    const meetingsQuery = useMemoFirebase(() => query(collection(firestore, 'meetings')), [firestore]);
    const { data: allMeetings } = useCollection<any>(meetingsQuery);

    const dateRange = React.useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today': start = startOfDay(now); end = endOfDay(now); break;
            case 'this-week': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfDay(now); break;
            case 'this-month': start = startOfMonth(now); end = endOfMonth(now); break;
            case 'all-time': start = null; break;
            default: start = null; break;
        }
        return { start, end };
    }, [dateFilter]);

    const filteredClients = React.useMemo(() => {
        if (!rawClients) return [];
        let filtered = rawClients;

        if (dateRange.start) {
            filtered = filtered.filter(c => {
                const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
                return isAfter(created, dateRange.start!) && isBefore(created, dateRange.end);
            });
        }

        if (searchQuery) {
            filtered = filtered.filter(c => 
                c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (c.clientName && c.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                c.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (tableFilter === 'revenue') {
            filtered = filtered.filter(c => (c.payments?.some(p => p.status === 'Paid')));
        } else if (tableFilter === 'pipeline') {
            filtered = filtered.filter(c => (c.payments?.some(p => p.status !== 'Paid')));
        } else if (tableFilter === 'technical') {
            filtered = filtered.filter(c => c.projectType === 'Technical');
        } else if (tableFilter === 'marketing') {
            filtered = filtered.filter(c => c.projectType === 'Digital Marketing');
        }

        return filtered.map(c => {
            const manager = allUsers?.find((u: any) => u.id === c.handlingEmployeeId);
            return {
                ...c,
                managerName: manager ? `${manager.firstName} ${manager.lastName}` : (c.managerName || 'Unassigned'),
                managerAvatar: manager?.avatar || '',
            };
        });
    }, [rawClients, allUsers, searchQuery, dateRange, tableFilter]);

    const stats = React.useMemo(() => {
        let collected = 0;
        let pending = 0;
        let technicalVal = 0;
        let marketingVal = 0;

        filteredClients.forEach(c => {
            const clientTotal = c.projectTotalCost || c.fullPaymentPrice || 0;
            if (c.projectType === 'Technical') technicalVal += clientTotal;
            if (c.projectType === 'Digital Marketing') marketingVal += clientTotal;

            if (c.payments) {
                c.payments.forEach(p => {
                    const amtReceived = parseFloat(p.amountReceived || '0') || 0;
                    const amtDue = parseFloat(p.amount) || 0;
                    collected += amtReceived;
                    if (p.status !== 'Paid') pending += (amtDue - amtReceived);
                });
            }
        });

        return { collected, pending, technicalVal, marketingVal };
    }, [filteredClients]);

    const topRankedClients = React.useMemo(() => {
        if (!filteredClients) return [];
        return [...filteredClients].sort((a, b) => {
            if (rankBy === 'price') {
                return (b.projectTotalCost || 0) - (a.projectTotalCost || 0);
            }
            const aServices = a.projectType ? 1 : 0; 
            const bServices = b.projectType ? 1 : 0;
            return bServices - aServices;
        }).slice(0, 5);
    }, [filteredClients, rankBy]);

    const handleSaveClient = async () => {
        if (!clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Organization Name Required' });
            return;
        }

        const payload = {
            ...clientForm,
            fullPaymentPrice: Number(clientForm.fullPaymentPrice) || 0,
            projectTotalCost: Number(clientForm.projectTotalCost) || 0,
            createdAt: editingClient ? editingClient.createdAt : serverTimestamp(),
        };

        if (editingClient) {
            updateDocumentNonBlocking(doc(firestore, 'clients', editingClient.id), payload);
            toast({ title: 'Record Updated' });
        } else {
            addDocumentNonBlocking(collection(firestore, 'clients'), payload);
            toast({ title: 'Client Provisioned' });
        }
        setIsAddOpen(false);
        setEditingClient(null);
        resetForm();
    };

    const resetForm = () => {
        setClientForm({
            companyName: '', clientName: '', legalBusinessName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
            companySize: '1-10 Employees', priority: 'Medium', representativeName: '',
            address: '', website: '', hqLocation: '', country: 'India', state: '', city: '',
            pocPosition: '', productNeeded: '', projectType: 'Technical',
            handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
            currencyType: '₹', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
            contractStartDate: format(new Date(), 'yyyy-MM-dd'),
            gstNumber: '', notes: '',
            payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
        });
    };

    const clientInvoices = React.useMemo(() => {
        if (!selectedClient || !vaultAssets) return [];
        return vaultAssets.filter((a: any) => a.clientId === selectedClient.id && a.isInvoice);
    }, [selectedClient, vaultAssets]);

    const clientMeetings = React.useMemo(() => {
        if (!selectedClient || !allMeetings) return [];
        return allMeetings.filter((m: any) => m.clientId === selectedClient.id);
    }, [selectedClient, allMeetings]);

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-1">Clients</h1>
                    <p className="text-sm font-medium text-muted-foreground">Strategic partnership and account directory</p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[180px] rounded-full h-11 bg-white shadow-sm border-none ring-1 ring-border/50">
                            <div className="flex items-center gap-2">
                                <Filter className="size-3.5 opacity-50" />
                                <SelectValue placeholder="Timeline" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-time">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="this-week">This Week</SelectItem>
                            <SelectItem value="this-month">This Month</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-11 px-6 gap-2 rounded-full bg-white shadow-sm border-none ring-1 ring-border/50 font-bold uppercase text-[10px] tracking-widest">
                        <Download className="size-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard label="Total Clients" value={filteredClients.length} sub="Filtered Fleet" icon={Users} color="text-blue-600" bg="bg-blue-50" onClick={() => setTableFilter('all')} active={tableFilter === 'all'} />
                <MetricCard label="Revenue Got" value={`₹${stats.collected.toLocaleString()}`} sub="Paid Invoices" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" valueColor="text-emerald-600" onClick={() => setTableFilter('revenue')} active={tableFilter === 'revenue'} />
                <MetricCard label="In Pipeline" value={`₹${stats.pending.toLocaleString()}`} sub="Pending Dues" icon={Clock} color="text-amber-600" bg="bg-amber-50" onClick={() => setTableFilter('pipeline')} active={tableFilter === 'pipeline'} />
                <MetricCard label="Technical Val" value={`₹${stats.technicalVal.toLocaleString()}`} sub="Engineering" icon={BriefcaseBusiness} color="text-indigo-600" bg="bg-indigo-50" onClick={() => setTableFilter('technical')} active={tableFilter === 'technical'} />
                <MetricCard label="Marketing Val" value={`₹${stats.marketingVal.toLocaleString()}`} sub="Growth Strategy" icon={Zap} color="text-purple-600" bg="bg-purple-50" onClick={() => setTableFilter('marketing')} active={tableFilter === 'marketing'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden ring-1 ring-border/50">
                    <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b">
                        <div className="relative flex-1 w-full max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                            <Input 
                                placeholder="Search clients..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-12 h-12 bg-muted/20 border-none ring-1 ring-border/50 rounded-2xl"
                            />
                        </div>
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-12 px-8 rounded-2xl font-black uppercase text-[11px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                    <Plus className="size-4" /> Add a Client!
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-3xl h-[90vh] flex flex-col">
                                <DialogHeader className="p-10 border-b bg-white">
                                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Add New Client</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="flex-1 bg-muted/5 p-10">
                                    <div className="space-y-10">
                                        {/* Simplified Add Form content for brevity */}
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Organization Name</Label><Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} className="h-12 rounded-xl" /></div>
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Email</Label><Input value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} className="h-12 rounded-xl" /></div>
                                        </div>
                                        {/* Financial Section */}
                                        <div className="p-8 bg-white border-2 border-dashed border-primary/20 rounded-3xl space-y-6">
                                            <h4 className="text-xs font-black uppercase text-primary tracking-widest">Financial Structure</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Project Value</Label><Input type="number" value={clientForm.fullPaymentPrice} onChange={e => setClientForm({...clientForm, fullPaymentPrice: parseFloat(e.target.value)})} className="h-12 rounded-xl" /></div>
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Currency</Label>
                                                    <Select value={clientForm.currencyType} onValueChange={v => setClientForm({...clientForm, currencyType: v})}>
                                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <div className="p-10 border-t bg-white">
                                    <Button onClick={handleSaveClient} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-2xl">Finalize Registry</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10 border-y">
                                <TableRow>
                                    <TableHead className="font-black text-[10px] uppercase h-16 px-8 tracking-widest">Client Identity</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest">Project Value</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest">Status</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest text-right px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse text-xs font-black text-muted-foreground uppercase">Scanning Registry...</TableCell></TableRow>
                                ) : filteredClients.map(client => (
                                    <TableRow key={client.id} className="border-b group hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedClient(client)}>
                                        <TableCell className="py-8 px-8">
                                            <div className="flex items-center gap-5">
                                                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">{client.companyName.slice(0,2).toUpperCase()}</div>
                                                <div className="space-y-1">
                                                    <span className="font-black text-[15px] uppercase tracking-tight block">{client.companyName}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{client.category}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-black text-sm text-emerald-600">
                                            {client.currencyType}{client.projectTotalCost?.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("rounded-lg font-black text-[9px] px-3 h-6 border-none uppercase tracking-widest shadow-sm", 
                                                client.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                                                {client.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-8" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10"><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-3xl">
                                                    <DropdownMenuItem className="font-black text-[11px] uppercase gap-3 py-4 px-4" asChild>
                                                        <Link href={`/dashboard/meetings?clientId=${client.id}`}><Video className="size-4 text-primary" /> Schedule Meeting</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="font-black text-[11px] uppercase gap-3 py-4 px-4">
                                                        <Edit className="size-4 text-primary" /> Edit Record
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="font-black text-[11px] uppercase gap-3 py-4 px-4 text-rose-600" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'clients', client.id))}>
                                                        <Trash2 className="size-4" /> Purge Partner
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2"><Trophy className="size-4" /> Top Clients</CardTitle>
                            <div className="flex bg-muted/30 p-1 rounded-xl">
                                <button onClick={() => setRankBy('price')} className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all", rankBy === 'price' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}>Price</button>
                                <button onClick={() => setRankBy('services')} className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all", rankBy === 'services' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}>Services</button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-4">
                            {topRankedClients.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-muted-foreground/30 w-4">#0{i+1}</span>
                                        <div className="size-9 rounded-xl bg-muted/20 flex items-center justify-center font-black text-[10px]">{c.companyName[0]}</div>
                                        <p className="font-bold text-xs uppercase truncate max-w-[120px]">{c.companyName}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-600">{rankBy === 'price' ? `${c.currencyType}${c.projectTotalCost?.toLocaleString()}` : "1 Service"}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
                        <CardHeader className="p-8 pb-4"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Video className="size-4" /> Upcoming Meets</CardTitle></CardHeader>
                        <ScrollArea className="h-64">
                            <div className="p-8 pt-0 space-y-4">
                                {allMeetings?.filter(m => isAfter(m.date.toDate(), new Date())).map(m => (
                                    <div key={m.id} className="p-4 rounded-2xl bg-muted/20 border border-transparent hover:bg-white hover:shadow-md transition-all space-y-2">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-primary">{m.title}</span><Badge className="h-4 text-[8px] bg-sky-100 text-sky-700 border-none uppercase">CLIENT MEET</Badge></div>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-2"><Clock className="size-3"/> {format(m.date.toDate(), 'PPP p')}</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            </div>

            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[540px] p-0 border-none shadow-3xl flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-10 pb-8 bg-white border-b shadow-sm">
                        <div className="flex items-start justify-between mb-8">
                            <div className="flex items-center gap-6">
                                <div className="size-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/10 shadow-inner">
                                    {selectedClient?.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <SheetTitle className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">{selectedClient?.companyName}</SheetTitle>
                                        <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px] font-black h-5 uppercase px-2.5 shadow-sm">{selectedClient?.status}</Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <span>{selectedClient?.category}</span>
                                        <span>•</span>
                                        <span>Since {selectedClient?.createdAt ? format(selectedClient.createdAt.toDate(), 'MMM yyyy') : 'Jan 2025'}</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => setSelectedClient(null)}><X className="size-6"/></Button>
                        </div>
                        <div className="grid grid-cols-3 gap-6 pt-6 border-t border-dashed">
                            <div className="space-y-1.5"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Account Manager</p><div className="flex items-center gap-2.5"><Avatar className="size-7"><AvatarFallback className="text-[8px] font-black bg-muted">{selectedClient?.managerName?.[0]}</AvatarFallback></Avatar><p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.managerName}</p></div></div>
                            <div className="space-y-1.5"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Email</p><p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.email}</p></div>
                            <div className="space-y-1.5"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Phone</p><p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.phone}</p></div>
                        </div>
                    </SheetHeader>

                    <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                        <div className="px-10 bg-white border-b shrink-0 overflow-x-auto no-scrollbar">
                            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-12 border-none rounded-none">
                                {['Overview', 'Invoices', 'Meetings', 'Audit'].map(tab => (
                                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-black text-[11px] uppercase px-0 pb-5 tracking-widest">
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-10 space-y-10">
                                <TabsContent value="overview" className="mt-0 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">About Client</h4>
                                            <div className="space-y-5">
                                                <DetailLine label="Value" value={`${selectedClient?.currencyType}${selectedClient?.projectTotalCost?.toLocaleString()}`} isPrice />
                                                <DetailLine label="Size" value={selectedClient?.companySize || 'N/A'} />
                                                <DetailLine label="GST" value={selectedClient?.gstNumber || 'N/A'} />
                                                <DetailLine label="Website" value={selectedClient?.website || 'N/A'} />
                                                <div className="pt-2">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Address</p>
                                                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase">{selectedClient?.address || 'No physical address registered.'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Operational Stats</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <StatBox label="Meetings" value={clientMeetings.length.toString()} icon={Users} color="bg-blue-50 text-blue-600" />
                                                <StatBox label="Invoices" value={clientInvoices.length.toString()} icon={ReceiptIndianRupee} color="bg-purple-50 text-purple-600" />
                                                <StatBox label="Milestones" value={selectedClient?.payments?.length?.toString() || '0'} icon={ListChecks} color="bg-emerald-50 text-emerald-600" />
                                                <StatBox label="Priority" value={selectedClient?.priority || 'Low'} icon={Trophy} color="bg-amber-50 text-amber-600" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Account Executive Intelligence</h4>
                                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 ring-1 ring-border/50">
                                            <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase italic">"{selectedClient?.notes || 'Strategic partnership protocol initiated.'}"</p>
                                        </Card>
                                    </div>
                                </TabsContent>
                                
                                <TabsContent value="invoices" className="mt-0 space-y-6">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Account Invoices</h4>
                                    <div className="space-y-4">
                                        {clientInvoices.map((inv: any) => (
                                            <div key={inv.id} className="p-6 rounded-2xl bg-white ring-1 ring-border shadow-sm flex items-center justify-between hover:bg-slate-50 transition-all group">
                                                <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-purple-50 text-purple-600"><ReceiptIndianRupee className="size-5" /></div><div><p className="font-bold text-sm uppercase">{inv.title}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{format(inv.uploadedAt.toDate(), 'PPP')}</p></div></div>
                                                <Button variant="ghost" size="icon" asChild><Link href={inv.link} target="_blank"><ExternalLink className="size-4" /></Link></Button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="meetings" className="mt-0 space-y-6">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Account Engagements</h4>
                                    <div className="space-y-4">
                                        {clientMeetings.map((m: any) => (
                                            <div key={m.id} className="p-6 rounded-2xl bg-white ring-1 ring-border shadow-sm flex items-center justify-between group">
                                                <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-sky-50 text-sky-600"><Video className="size-5" /></div><div><p className="font-bold text-sm uppercase">{m.title}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{format(m.date.toDate(), 'PPP p')}</p></div></div>
                                                <Button variant="ghost" size="icon" asChild><Link href={m.link} target="_blank"><ExternalLink className="size-4" /></Link></Button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg, valueColor, onClick, active }: any) {
    return (
        <Card className={cn("border shadow-sm rounded-3xl bg-white p-5 space-y-4 group transition-all hover:shadow-xl ring-1 ring-border/50 cursor-pointer", active && "ring-2 ring-primary")} onClick={onClick}>
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-105", bg, color)}><Icon className="size-4" /></div>
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{label}</p>
                    <h3 className={cn("text-lg font-black tracking-tight truncate leading-none", valueColor || "text-slate-900")}>{value}</h3>
                </div>
            </div>
            <div className="pt-3 border-t border-dashed border-border/50"><p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">{sub}</p></div>
        </Card>
    );
}

function DetailLine({ label, value, isPrice }: { label: string, value: string, isPrice?: boolean }) {
    return (
        <div className="grid grid-cols-5 items-center gap-4">
            <span className="col-span-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={cn("col-span-3 text-[11px] font-black truncate uppercase text-right", isPrice ? "text-emerald-600" : "text-slate-800")}>{value}</span>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) {
    return (
        <div className="p-4 bg-white rounded-2xl ring-1 ring-border shadow-sm space-y-3 transition-transform hover:scale-105">
            <div className={cn("p-2 rounded-xl inline-block shadow-sm", color)}><Icon className="size-4" /></div>
            <div><p className="text-xl font-black text-slate-900 leading-none">{value}</p><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">{label}</p></div>
        </div>
    );
}
