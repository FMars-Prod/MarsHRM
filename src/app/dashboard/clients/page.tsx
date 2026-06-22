'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { 
    Users, Plus, Trash2, Edit, Search, ExternalLink, ShieldCheck, 
    Building2, Filter, Download, 
    Briefcase, Zap, MapPin, X, 
    DollarSign, BriefcaseBusiness, IndianRupee, Loader2, TrendingUp, ReceiptIndianRupee,
    Wallet, CheckCircle2, Clock, ChevronRight, MoreHorizontal
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
import Link from 'next/link';

type PaymentInstallment = {
    id: string;
    amount: string;
    status: 'Pending' | 'Paid';
};

type Client = {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    pocPosition?: string;
    productNeeded?: string;
    handlingEmployeeId?: string;
    projectType?: 'Technical' | 'Digital Marketing';
    assignedTeamId?: string;
    productHeadId?: string;
    fullPaymentPrice?: number;
    payments?: PaymentInstallment[];
    status: 'Active' | 'Inactive' | 'Lead' | 'Archived';
    category: string;
    logoUrl?: string;
    address?: string;
    website?: string;
    createdAt?: any;
    // UI Metadata
    managerName?: string;
    managerAvatar?: string;
    projectsCount?: number;
    lastActivity?: string;
};

export default function ClientsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Filter States
    const [dateFilter, setDateFilter] = React.useState<string>("all-time");
    const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Dialog & UI States
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [editingClient, setEditingClient] = React.useState<Client | null>(null);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");

    // Form States
    const [clientForm, setClientForm] = React.useState<Partial<Client>>({
        name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
        address: '', website: '', pocPosition: '', productNeeded: '', projectType: 'Technical',
        handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
        payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending' }]
    });

    // Access Control
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    // Data Fetching
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    const vaultAssetsQuery = useMemoFirebase(() => query(collection(firestore, 'vault_assets')), [firestore]);
    const { data: vaultAssets } = useCollection<any>(vaultAssetsQuery);

    // Filter Logic
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
                end = endOfDay(now);
                break;
            case 'this-month':
                start = startOfMonth(now);
                end = endOfMonth(now);
                break;
            case 'prev-month':
                start = startOfMonth(subMonths(now, 1));
                end = endOfMonth(subMonths(now, 1));
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
                start = null;
                break;
        }
        return { start, end };
    }, [dateFilter, customStartDate, customEndDate]);

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
                c.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered.map(c => {
            const manager = allUsers?.find((u: any) => u.id === c.handlingEmployeeId);
            return {
                ...c,
                managerName: manager ? `${manager.firstName} ${manager.lastName}` : (c.managerName || 'Unassigned'),
                managerAvatar: manager?.avatar || '',
                projectsCount: c.projectsCount || 0,
                lastActivity: c.lastActivity || 'No recent activity'
            };
        });
    }, [rawClients, allUsers, searchQuery, dateRange]);

    // Financial Aggregates
    const stats = React.useMemo(() => {
        let collected = 0;
        let pending = 0;
        let technicalVal = 0;
        let marketingVal = 0;

        filteredClients.forEach(c => {
            const clientTotal = c.fullPaymentPrice || 0;
            if (c.projectType === 'Technical') technicalVal += clientTotal;
            if (c.projectType === 'Digital Marketing') marketingVal += clientTotal;

            if (c.payments) {
                c.payments.forEach(p => {
                    const amt = parseFloat(p.amount) || 0;
                    if (p.status === 'Paid') collected += amt;
                    else pending += amt;
                });
            }
        });

        return { collected, pending, technicalVal, marketingVal };
    }, [filteredClients]);

    const handleAddPaymentRow = () => {
        setClientForm(prev => ({
            ...prev,
            payments: [
                ...(prev.payments || []),
                { id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending' }
            ]
        }));
    };

    const handleRemovePaymentRow = (id: string) => {
        setClientForm(prev => ({
            ...prev,
            payments: (prev.payments || []).filter(p => p.id !== id)
        }));
    };

    const handlePaymentChange = (id: string, field: keyof PaymentInstallment, value: string) => {
        setClientForm(prev => ({
            ...prev,
            payments: (prev.payments || []).map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const totalCalculatedPayment = React.useMemo(() => {
        return (clientForm.payments || []).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    }, [clientForm.payments]);

    const handleSaveClient = async () => {
        if (!clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Organization Name Required' });
            return;
        }

        const payload = {
            ...clientForm,
            fullPaymentPrice: Number(clientForm.fullPaymentPrice) || totalCalculatedPayment,
            createdAt: editingClient ? editingClient.createdAt : serverTimestamp(),
            lastActivity: 'Record Updated'
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
            name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
            address: '', website: '', pocPosition: '', productNeeded: '', projectType: 'Technical',
            handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
            payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending' }]
        });
    };

    const handleDeleteClient = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'clients', id));
        toast({ title: 'Record Purged' });
        setSelectedClient(null);
    };

    const clientInvoices = React.useMemo(() => {
        if (!selectedClient || !vaultAssets) return [];
        return vaultAssets.filter(a => a.clientId === selectedClient.id && a.isInvoice);
    }, [selectedClient, vaultAssets]);

    if (!isAuthorized && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 space-y-6">
                <div className="p-6 rounded-[2.5rem] bg-rose-50 ring-8 ring-rose-50/50 shadow-inner">
                    <ShieldCheck className="size-20 text-rose-600 opacity-80" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Access Restricted</h2>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest max-w-sm mx-auto">This terminal is limited to Executive Tier personnel.</p>
                </div>
                <Button asChild variant="outline" className="rounded-full h-12 px-10 font-black uppercase text-[10px] tracking-widest border-2">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        );
    }

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
                            <SelectGroup>
                                <SelectLabel>Presets</SelectLabel>
                                <SelectItem value="all-time">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="this-week">This Week</SelectItem>
                                <SelectItem value="prev-week">Previous Week</SelectItem>
                                <SelectItem value="this-month">This Month</SelectItem>
                                <SelectItem value="prev-month">Previous Month</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Custom</SelectLabel>
                                <SelectItem value="custom-date">Select Date</SelectItem>
                                <SelectItem value="custom-range">Select Range</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    {(dateFilter === 'custom-date' || dateFilter === 'custom-range') && (
                        <div className="flex gap-2 items-center animate-fade-in-up">
                            <Input 
                                type="date" 
                                value={customStartDate} 
                                onChange={e => setCustomStartDate(e.target.value)} 
                                className="h-11 rounded-full w-40 bg-white shadow-sm border-none ring-1 ring-border/50" 
                            />
                            {dateFilter === 'custom-range' && (
                                <>
                                    <span className="text-[10px] font-black uppercase text-muted-foreground">to</span>
                                    <Input 
                                        type="date" 
                                        value={customEndDate} 
                                        onChange={e => setCustomEndDate(e.target.value)} 
                                        className="h-11 rounded-full w-40 bg-white shadow-sm border-none ring-1 ring-border/50" 
                                    />
                                </>
                            )}
                        </div>
                    )}

                    <Button variant="outline" className="h-11 px-6 gap-2 rounded-full bg-white shadow-sm border-none ring-1 ring-border/50 font-bold uppercase text-[10px] tracking-widest">
                        <Download className="size-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard label="Total Clients" value={filteredClients.length} sub="Filtered Capacity" icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <MetricCard label="Revenue Got" value={`₹${stats.collected.toLocaleString()}`} sub="Paid Invoices" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
                <MetricCard label="In Pipeline" value={`₹${stats.pending.toLocaleString()}`} sub="Pending Dues" icon={Clock} color="text-amber-600" bg="bg-amber-50" />
                <MetricCard label="Technical Val" value={`₹${stats.technicalVal.toLocaleString()}`} sub="Engineering Tier" icon={BriefcaseBusiness} color="text-indigo-600" bg="bg-indigo-50" />
                <MetricCard label="Marketing Val" value={`₹${stats.marketingVal.toLocaleString()}`} sub="Growth Strategy" icon={Zap} color="text-purple-600" bg="bg-purple-50" />
            </div>

            {/* Main Terminal */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden ring-1 ring-border/50">
                <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                        <Input 
                            placeholder="Search clients by organization or sector..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-12 h-12 bg-muted/20 border-none ring-1 ring-border/50 rounded-2xl font-medium text-sm"
                        />
                    </div>
                    
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) { setEditingClient(null); resetForm(); } setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[11px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                <Plus className="size-4" /> Provision Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-3xl flex flex-col h-[90vh]">
                            <DialogHeader className="p-10 border-b bg-white shrink-0">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Client Provisioning</DialogTitle>
                                <DialogDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Register new strategic account details</DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-10 space-y-12 pb-20">
                                    {/* Section 1: Identity */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-primary">
                                            <Building2 className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Organization Identity</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Organization Name</Label>
                                                <Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} placeholder="e.g., ABC Tech Solutions" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry Sector</Label>
                                                <Input value={clientForm.category} onChange={e => setClientForm({...clientForm, category: e.target.value})} placeholder="e.g., Manufacturing" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product Needed</Label>
                                                <Input value={clientForm.productNeeded} onChange={e => setClientForm({...clientForm, productNeeded: e.target.value})} placeholder="e.g., Mobile ERP Suite" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Status</Label>
                                                <Select value={clientForm.status} onValueChange={v => setClientForm({...clientForm, status: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Active">Active Client</SelectItem>
                                                        <SelectItem value="Lead">Potential Client</SelectItem>
                                                        <SelectItem value="Inactive">Not Working</SelectItem>
                                                        <SelectItem value="Archived">Closed Record</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Total Project Value</Label>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-primary" />
                                                <Input 
                                                    type="number" 
                                                    value={clientForm.fullPaymentPrice} 
                                                    onChange={e => setClientForm({...clientForm, fullPaymentPrice: parseFloat(e.target.value) || 0})} 
                                                    placeholder="Enter Total Contract Amount" 
                                                    className="pl-12 h-16 text-3xl font-black rounded-2xl border-2 border-primary/20 focus:border-primary shadow-inner" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Section */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-emerald-600">
                                            <DollarSign className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Milestone Ledger</h4>
                                        </div>
                                        <div className="p-8 bg-white border-2 border-dashed border-emerald-100 rounded-[2rem] space-y-8 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <Label className="text-xs font-black uppercase text-emerald-700">Payment Breakdown</Label>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Divide the total ₹{clientForm.fullPaymentPrice?.toLocaleString()} into installments.</p>
                                                </div>
                                                <Button type="button" onClick={handleAddPaymentRow} className="rounded-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-6">
                                                    <Plus className="size-3.5 mr-2" /> Add Installment
                                                </Button>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {clientForm.payments?.map((payment, idx) => (
                                                    <div key={payment.id} className="flex gap-6 items-center animate-fade-in-up">
                                                        <div className="flex-1">
                                                            <div className="relative">
                                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                                                <Input 
                                                                    type="number" 
                                                                    value={payment.amount} 
                                                                    onChange={e => handlePaymentChange(payment.id, 'amount', e.target.value)} 
                                                                    placeholder="Amount" 
                                                                    className="pl-10 h-12 rounded-xl font-black text-sm" 
                                                                />
                                                            </div>
                                                        </div>
                                                        <Select value={payment.status} onValueChange={v => handlePaymentChange(payment.id, 'status', v as any)}>
                                                            <SelectTrigger className="w-40 h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Pending">Pending</SelectItem>
                                                                <SelectItem value="Paid">Paid</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {clientForm.payments!.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => handleRemovePaymentRow(payment.id)}>
                                                                <Trash2 className="size-5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <Separator />
                                            <div className="flex items-center justify-between pt-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project Value</p>
                                                    <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{Number(clientForm.fullPaymentPrice).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Scheduled Total</p>
                                                    <p className={cn("text-2xl font-black tracking-tighter", totalCalculatedPayment > (clientForm.fullPaymentPrice || 0) ? "text-rose-600" : "text-emerald-600")}>
                                                        ₹{totalCalculatedPayment.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="p-10 border-t bg-white shrink-0">
                                <Button onClick={handleSaveClient} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20">Finalize Registry</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10 border-y">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 px-8 tracking-widest">Client Identity</TableHead>
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 tracking-widest">Industry</TableHead>
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 tracking-widest">Account Manager</TableHead>
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 tracking-widest text-center">Project Value</TableHead>
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 tracking-widest">Status</TableHead>
                                <TableHead className="font-black text-[10px] text-slate-500 uppercase h-16 tracking-widest text-right px-8">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-64 text-center animate-pulse text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Scanning Strategic Registry...</TableCell></TableRow>
                            ) : filteredClients.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-64 text-center text-muted-foreground italic font-medium uppercase text-[10px] tracking-widest opacity-30">No active partnerships detected for this period.</TableCell></TableRow>
                            ) : filteredClients.map(client => (
                                <TableRow key={client.id} className="border-b group hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedClient(client)}>
                                    <TableCell className="py-8 px-8">
                                        <div className="flex items-center gap-5">
                                            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm shadow-inner border border-primary/5">
                                                {client.companyName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="font-black text-[15px] text-slate-900 uppercase tracking-tight leading-none block">{client.companyName}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{client.productNeeded || 'Enterprise Suite'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[11px] text-slate-600 font-bold uppercase tracking-tight">{client.category}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-9 ring-1 ring-border shadow-sm">
                                                <AvatarImage src={client.managerAvatar} className="object-cover" />
                                                <AvatarFallback className="text-[10px] font-black bg-muted">{client.managerName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-bold text-slate-700 uppercase">{client.managerName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-black text-sm text-slate-900">
                                        ₹{(client.fullPaymentPrice || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-lg font-black text-[9px] px-3 h-6 border-none uppercase tracking-widest shadow-sm",
                                            client.status === 'Active' ? "bg-emerald-100 text-emerald-700" :
                                            client.status === 'Lead' ? "bg-amber-100 text-amber-700" :
                                            client.status === 'Inactive' ? "bg-slate-100 text-slate-600" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {client.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}><MoreHorizontal className="size-5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 border-none shadow-3xl">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="font-black text-[11px] uppercase tracking-widest gap-3 py-4 px-4">
                                                    <Edit className="size-4.5 text-primary" /> Edit Record
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={e => { e.preventDefault(); e.stopPropagation(); }} className="font-black text-[11px] uppercase tracking-widest gap-3 py-4 px-4 text-rose-600 hover:bg-rose-50">
                                                            <Trash2 className="size-4.5" /> Purge Partner
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-3xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="font-black text-2xl tracking-tighter uppercase text-primary">Purge Account?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">This will permanently remove "{client.companyName}" from the strategic partner directory.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-10 gap-3">
                                                            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[11px] h-12 px-8">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="rounded-xl font-bold uppercase text-[11px] h-12 px-8 bg-rose-600 hover:bg-rose-700">Confirm Purge</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                
                <div className="p-10 border-t flex flex-col sm:flex-row items-center justify-between gap-8 bg-muted/5">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Audit Registry: {filteredClients.length} strategic partners</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="size-11 rounded-2xl border-none ring-1 ring-border shadow-sm"><ChevronRight className="size-5 rotate-180"/></Button>
                        <Button variant="secondary" size="sm" className="h-11 w-11 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20">1</Button>
                        <Button variant="ghost" size="sm" className="h-11 w-11 rounded-2xl font-black text-xs">2</Button>
                        <Button variant="outline" size="icon" className="size-11 rounded-2xl border-none ring-1 ring-border shadow-sm"><ChevronRight className="size-5"/></Button>
                    </div>
                </div>
            </div>

            {/* Account Intelligence Sheet */}
            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[540px] p-0 border-none shadow-3xl overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-10 pb-8 bg-white border-b shadow-sm">
                        <div className="flex items-start justify-between mb-10">
                            <div className="flex items-center gap-6">
                                <div className="size-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-primary/10">
                                    {selectedClient?.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <SheetTitle className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">{selectedClient?.companyName}</SheetTitle>
                                        <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px] font-black h-5 uppercase tracking-widest px-2.5 shadow-sm">{selectedClient?.status}</Badge>
                                    </div>
                                    <SheetDescription className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">{selectedClient?.category} Unit • Strategic Account</SheetDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => setSelectedClient(null)}><X className="size-6"/></Button>
                        </div>

                        <div className="grid grid-cols-3 gap-8 p-8 bg-muted/10 rounded-[2rem] border border-dashed border-border/50">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Account Lead</p>
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-7 ring-1 ring-border shadow-sm">
                                        <AvatarImage src={selectedClient?.managerAvatar} className="object-cover" />
                                        <AvatarFallback className="text-[8px] font-black bg-muted">{selectedClient?.managerName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.managerName || 'Unassigned'}</p>
                                </div>
                            </div>
                            <DetailCol label="Official Email" value={selectedClient?.email || 'N/A'} />
                            <DetailCol label="Contact Signal" value={selectedClient?.phone || 'N/A'} />
                        </div>
                    </SheetHeader>

                    <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                        <div className="px-10 bg-white border-b shrink-0 overflow-x-auto no-scrollbar">
                            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-12 border-none rounded-none">
                                {['Overview', 'Milestones', 'Invoices', 'Contracts'].map(tab => (
                                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-black text-[11px] uppercase px-0 pb-5 tracking-widest shadow-none">
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-10 pb-24">
                                <TabsContent value="overview" className="mt-0 space-y-12">
                                    <div className="space-y-8">
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <Briefcase className="size-3.5 text-primary" /> Profile Brief
                                        </h4>
                                        <div className="space-y-6">
                                            <InfoLine label="Account Status" value={selectedClient?.status || 'Active'} />
                                            <InfoLine label="Project Value" value={`₹${(selectedClient?.fullPaymentPrice || 0).toLocaleString()}`} />
                                            <InfoLine label="Product" value={selectedClient?.productNeeded || 'Enterprise Suite'} />
                                            <InfoLine label="Project Tier" value={selectedClient?.projectType || 'General'} />
                                            <InfoLine label="HQ Website" value={selectedClient?.website || 'N/A'} isLink />
                                            <div className="pt-4">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Operational HQ</p>
                                                <div className="p-6 bg-white rounded-3xl ring-1 ring-border shadow-sm flex items-start gap-4 border-l-4 border-primary">
                                                    <MapPin className="size-5 text-primary mt-0.5" />
                                                    <p className="text-sm font-bold leading-relaxed text-slate-600 uppercase italic">"{selectedClient?.address || 'No physical address registered.'}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="milestones" className="mt-0 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <DollarSign className="size-3.5 text-primary" /> Payment Ledger
                                        </h4>
                                    </div>
                                    <div className="space-y-4">
                                        {selectedClient?.payments?.map((p, i) => (
                                            <div key={p.id} className="flex items-center justify-between p-6 bg-white rounded-2xl ring-1 ring-border shadow-sm hover:ring-primary/30 transition-all group">
                                                <div className="flex items-center gap-5">
                                                    <div className="size-10 rounded-xl bg-muted/20 flex items-center justify-center font-black text-[11px] text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">{i+1}</div>
                                                    <span className="font-black text-sm text-slate-800 tracking-tight uppercase leading-none">Milestone {i+1}</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <span className="font-black text-sm text-slate-900">₹{parseFloat(p.amount).toLocaleString()}</span>
                                                    <Badge className={cn(
                                                        "rounded-lg font-black text-[9px] uppercase tracking-widest border-none px-3 h-7",
                                                        p.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                    )}>{p.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="invoices" className="mt-0 space-y-8">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <ReceiptIndianRupee className="size-3.5 text-primary" /> Account Invoices
                                    </h4>
                                    <div className="space-y-4">
                                        {clientInvoices.length > 0 ? clientInvoices.map((inv: any) => (
                                            <Link href={inv.link} target="_blank" key={inv.id} className="flex items-center justify-between p-6 bg-white rounded-2xl ring-1 ring-border shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-5">
                                                    <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ReceiptIndianRupee className="size-6" /></div>
                                                    <div>
                                                        <p className="font-black text-sm uppercase truncate max-w-[200px]">{inv.title}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{inv.uploadedAt ? format(inv.uploadedAt.toDate(), 'PP') : 'Audit Log'}</p>
                                                    </div>
                                                </div>
                                                <ExternalLink className="size-5 opacity-20 group-hover:opacity-100" />
                                            </Link>
                                        )) : (
                                            <div className="py-20 text-center opacity-20 italic text-sm font-bold uppercase tracking-widest">No audited invoices found.</div>
                                        )}
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

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border shadow-sm rounded-3xl bg-white p-6 space-y-5 group transition-all hover:shadow-xl ring-1 ring-border/50">
            <div className="flex items-center gap-5">
                <div className={cn("p-3.5 rounded-2xl shadow-sm transition-transform group-hover:scale-105", bg, color)}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">{label}</p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 truncate">{value}</h3>
                </div>
            </div>
            <div className="pt-4 border-t border-dashed border-border/50">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{sub}</span>
            </div>
        </Card>
    );
}

function DetailCol({ label, value }: { label: string, value: string }) {
    return (
        <div className="space-y-1.5">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className="text-[11px] font-black text-slate-800 uppercase truncate">{value}</p>
        </div>
    );
}

function InfoLine({ label, value, isLink }: { label: string, value: string, isLink?: boolean }) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-dashed border-border/50 last:border-none group gap-8">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
            <span className={cn(
                "text-[11px] font-black truncate uppercase text-right flex-1",
                isLink ? "text-primary underline cursor-pointer" : "text-slate-800"
            )}>
                {value}
            </span>
        </div>
    );
}
