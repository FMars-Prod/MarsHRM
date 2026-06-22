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
    Info, CalendarDays, Receipt, BadgeIndianRupee, HandCoins, UserPlus
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
    category: string; // Industry Sector
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
    // UI Metadata
    managerName?: string;
    managerAvatar?: string;
    projectsCount?: number;
    lastActivity?: string;
};

const INDUSTRY_SECTORS = [
    "Manufacturing", "IT & Software", "Finance", "Healthcare", "Education", "Retail", "Real Estate", "Automotive", "Logistics", "Energy", "Other"
];

const COMPANY_SIZES = [
    "1-10 Employees", "11-50 Employees", "51-200 Employees", "201-500 Employees", "501-1000 Employees", "1000+ Employees"
];

const COUNTRIES = ["India", "United States", "United Kingdom", "UAE", "Singapore", "Australia", "Canada"];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

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
    const [suggestedNames, setSuggestedNames] = React.useState<string[]>([]);

    // Form States
    const [clientForm, setClientForm] = React.useState<Partial<Client>>({
        companyName: '', clientName: '', legalBusinessName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
        companySize: '1-10 Employees', priority: 'Medium', representativeName: '',
        address: '', website: '', hqLocation: '', country: 'India', state: '', city: '',
        pocPosition: '', productNeeded: '', projectType: 'Technical',
        handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
        currencyType: 'INR', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
        contractStartDate: format(new Date(), 'yyyy-MM-dd'),
        gstNumber: '', notes: '',
        payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
    });

    // Access Control
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'Team Lead';

    // Data Fetching
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    const vaultAssetsQuery = useMemoFirebase(() => query(collection(firestore, 'vault_assets')), [firestore]);
    const { data: vaultAssets } = useCollection<any>(vaultAssetsQuery);

    // Fetch potential client names from reports for suggestions
    React.useEffect(() => {
        const sourceSuggestions = async () => {
            if (!firestore) return;
            try {
                const reportsSnap = await getDocs(query(collectionGroup(firestore, 'reports'), limit(100)));
                const names = new Set<string>();
                reportsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.clientName) names.add(data.clientName);
                    if (data.technicalMeetings) {
                        data.technicalMeetings.forEach((m: any) => { if (m.clientName) names.add(m.clientName); });
                    }
                });
                setSuggestedNames(Array.from(names).slice(0, 10));
            } catch (e) {
                console.error("Suggestion fetch failed", e);
            }
        };
        sourceSuggestions();
    }, [firestore]);

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
                (c.clientName && c.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
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

    const handleAddPaymentRow = () => {
        setClientForm(prev => ({
            ...prev,
            payments: [
                ...(prev.payments || []),
                { id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }
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
        setClientForm(prev => {
            const updatedPayments = (prev.payments || []).map(p => {
                if (p.id === id) {
                    const updatedP = { ...p, [field]: value };
                    // Auto-calculate remaining balance if amount or amountReceived changes
                    if (field === 'amount' || field === 'amountReceived') {
                        const total = parseFloat(updatedP.amount) || 0;
                        const received = parseFloat(updatedP.amountReceived || '0') || 0;
                        updatedP.remainingBalance = (total - received).toString();
                    }
                    return updatedP;
                }
                return p;
            });
            return { ...prev, payments: updatedPayments };
        });
    };

    const totalCalculatedPayment = React.useMemo(() => {
        return (clientForm.payments || []).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    }, [clientForm.payments]);

    // Sync project total cost when project value or discount changes
    React.useEffect(() => {
        const val = Number(clientForm.fullPaymentPrice) || 0;
        const discount = Number(clientForm.discountOffered) || 0;
        const total = val - (val * (discount / 100));
        if (total !== clientForm.projectTotalCost) {
            setClientForm(prev => ({ ...prev, projectTotalCost: total }));
        }
    }, [clientForm.fullPaymentPrice, clientForm.discountOffered]);

    const handleSaveClient = async () => {
        if (!clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Organization Name Required' });
            return;
        }

        const payload = {
            ...clientForm,
            fullPaymentPrice: Number(clientForm.fullPaymentPrice) || 0,
            projectTotalCost: Number(clientForm.projectTotalCost) || 0,
            expectedAnnualRevenue: Number(clientForm.expectedAnnualRevenue) || 0,
            discountOffered: Number(clientForm.discountOffered) || 0,
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
            companyName: '', clientName: '', legalBusinessName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', 
            companySize: '1-10 Employees', priority: 'Medium', representativeName: '',
            address: '', website: '', hqLocation: '', country: 'India', state: '', city: '',
            pocPosition: '', productNeeded: '', projectType: 'Technical',
            handlingEmployeeId: '', assignedTeamId: '', productHeadId: '', fullPaymentPrice: 0,
            currencyType: 'INR', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
            contractStartDate: format(new Date(), 'yyyy-MM-dd'),
            gstNumber: '', notes: '',
            payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
        });
    };

    const handleDeleteClient = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'clients', id));
        toast({ title: 'Record Purged' });
        setSelectedClient(null);
    };

    const clientInvoices = React.useMemo(() => {
        if (!selectedClient || !vaultAssets) return [];
        return vaultAssets.filter((a: any) => a.clientId === selectedClient.id && a.isInvoice);
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
                <MetricCard label="Revenue Got" value={`${clientForm.currencyType || '₹'}${stats.collected.toLocaleString()}`} sub="Paid Invoices" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
                <MetricCard label="In Pipeline" value={`${clientForm.currencyType || '₹'}${stats.pending.toLocaleString()}`} sub="Pending Dues" icon={Clock} color="text-amber-600" bg="bg-amber-50" />
                <MetricCard label="Technical Val" value={`${clientForm.currencyType || '₹'}${stats.technicalVal.toLocaleString()}`} sub="Engineering Tier" icon={BriefcaseBusiness} color="text-indigo-600" bg="bg-indigo-50" />
                <MetricCard label="Marketing Val" value={`${clientForm.currencyType || '₹'}${stats.marketingVal.toLocaleString()}`} sub="Growth Strategy" icon={Zap} color="text-purple-600" bg="bg-purple-50" />
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
                        <DialogContent className="max-w-5xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-3xl flex flex-col h-[90vh]">
                            <DialogHeader className="p-10 border-b bg-white shrink-0">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Client Provisioning</DialogTitle>
                                <DialogDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Register new strategic account details</DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-10 space-y-12 pb-20">
                                    {/* Section 1: Client Information */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-primary">
                                            <Building2 className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Client Information</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Organization Name</Label>
                                                <Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} placeholder="Full company name" className="h-12 font-bold rounded-xl" />
                                                {suggestedNames.length > 0 && !clientForm.companyName && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase py-1 px-2">Suggestions:</span>
                                                        {suggestedNames.map(n => (
                                                            <button key={n} type="button" onClick={() => setClientForm({...clientForm, companyName: n})} className="text-[8px] font-black uppercase bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all px-2 py-1 rounded-md border border-transparent hover:border-primary/20">{n}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Name</Label>
                                                <Input value={clientForm.clientName} onChange={e => setClientForm({...clientForm, clientName: e.target.value})} placeholder="Primary point of contact name" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry Type</Label>
                                                <Select value={clientForm.category} onValueChange={v => setClientForm({...clientForm, category: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {INDUSTRY_SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Type</Label>
                                                <Select value={clientForm.projectType} onValueChange={v => setClientForm({...clientForm, projectType: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Technical">Technical</SelectItem>
                                                        <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Phone Number</Label>
                                                <Input value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} placeholder="+91 ..." className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Location Details */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-indigo-600">
                                            <MapPin className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Location Details</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Country</Label>
                                                <Select value={clientForm.country} onValueChange={v => setClientForm({...clientForm, country: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">State/Province</Label>
                                                <Input value={clientForm.state} onChange={e => setClientForm({...clientForm, state: e.target.value})} placeholder="State" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">City</Label>
                                                <Input value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value})} placeholder="City" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Organization Address</Label>
                                            <Textarea value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} placeholder="Full street address..." className="rounded-xl min-h-[80px]" />
                                        </div>
                                    </div>

                                    {/* Section 3: Account Details */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-amber-600">
                                            <UserCircle className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Account Details</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Status</Label>
                                                <Select value={clientForm.status} onValueChange={v => setClientForm({...clientForm, status: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Active">Active</SelectItem>
                                                        <SelectItem value="Prospect">Prospect</SelectItem>
                                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Priority Level</Label>
                                                <Select value={clientForm.priority} onValueChange={v => setClientForm({...clientForm, priority: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Strategic">Strategic</SelectItem>
                                                        <SelectItem value="High">High</SelectItem>
                                                        <SelectItem value="Medium">Medium</SelectItem>
                                                        <SelectItem value="Low">Low</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Financial Details */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-emerald-600">
                                            <DollarSign className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Financial Details</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Total Project Value</Label>
                                                <Input type="number" value={clientForm.fullPaymentPrice} onChange={e => setClientForm({...clientForm, fullPaymentPrice: parseFloat(e.target.value) || 0})} placeholder="0.00" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Currency Type</Label>
                                                <Select value={clientForm.currencyType} onValueChange={v => setClientForm({...clientForm, currencyType: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Expected Annual Revenue</Label>
                                                <Input type="number" value={clientForm.expectedAnnualRevenue} onChange={e => setClientForm({...clientForm, expectedAnnualRevenue: parseFloat(e.target.value) || 0})} placeholder="0.00" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Discount Offered (%)</Label>
                                                <Input type="number" value={clientForm.discountOffered} onChange={e => setClientForm({...clientForm, discountOffered: parseFloat(e.target.value) || 0})} placeholder="0" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Project Total Cost</Label>
                                                <Input type="number" value={clientForm.projectTotalCost} disabled className="h-12 font-bold rounded-xl bg-muted/50" />
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Auto-calculated from Value & Discount</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Contract Start Date</Label>
                                                <Input type="date" value={clientForm.contractStartDate} onChange={e => setClientForm({...clientForm, contractStartDate: e.target.value})} className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 5: Team Assignment */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-purple-600">
                                            <Users className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Team Assignment</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Handled By</Label>
                                                <Select value={clientForm.handlingEmployeeId} onValueChange={v => setClientForm({...clientForm, handlingEmployeeId: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Staff Member" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allUsers?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assign to Existing Team</Label>
                                                <Select value={clientForm.assignedTeamId} onValueChange={v => setClientForm({...clientForm, assignedTeamId: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allTeams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Head of Product/Project</Label>
                                                <Select value={clientForm.productHeadId} onValueChange={v => setClientForm({...clientForm, productHeadId: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Head" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allUsers?.filter(u => u.role === 'CEO/Admin' || u.role === 'HR Manager' || u.role === 'Team Lead').map(u => (
                                                            <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 6: Payment Milestones */}
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-emerald-600">
                                                <Receipt className="size-4" />
                                                <h4 className="text-[11px] font-black uppercase tracking-widest">Payment Milestones</h4>
                                            </div>
                                            <Button type="button" onClick={handleAddPaymentRow} className="rounded-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-6">
                                                <Plus className="size-3.5 mr-2" /> Add Milestone
                                            </Button>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            {clientForm.payments?.map((payment, idx) => (
                                                <Card key={payment.id} className="p-6 border-2 border-dashed border-emerald-100 rounded-3xl bg-white shadow-sm relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-4">
                                                        <Button type="button" variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePaymentRow(payment.id)}>
                                                            <Trash2 className="size-5" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Installment Amount</Label>
                                                            <div className="relative">
                                                                <HandCoins className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                                                <Input type="number" value={payment.amount} onChange={e => handlePaymentChange(payment.id, 'amount', e.target.value)} placeholder="0.00" className="pl-10 h-10 rounded-xl font-bold" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Due Date</Label>
                                                            <Input type="date" value={payment.dueDate} onChange={e => handlePaymentChange(payment.id, 'dueDate', e.target.value)} className="h-10 rounded-xl font-bold" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Payment Status</Label>
                                                            <Select value={payment.status} onValueChange={v => handlePaymentChange(payment.id, 'status', v as any)}>
                                                                <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                                                    <SelectItem value="Paid">Paid</SelectItem>
                                                                    <SelectItem value="Overdue">Overdue</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Invoice Number</Label>
                                                            <Input value={payment.invoiceNumber} onChange={e => handlePaymentChange(payment.id, 'invoiceNumber', e.target.value)} placeholder="INV-001" className="h-10 rounded-xl font-bold" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-6 pt-6 border-t border-dashed border-emerald-50">
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Invoice Date</Label>
                                                            <Input type="date" value={payment.invoiceDate} onChange={e => handlePaymentChange(payment.id, 'invoiceDate', e.target.value)} className="h-10 rounded-xl font-bold" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Amount Received</Label>
                                                            <Input type="number" value={payment.amountReceived} onChange={e => handlePaymentChange(payment.id, 'amountReceived', e.target.value)} placeholder="0.00" className="h-10 rounded-xl font-bold text-emerald-600" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Remaining Balance</Label>
                                                            <Input type="number" value={payment.remainingBalance} disabled className="h-10 rounded-xl font-bold bg-muted/30" />
                                                        </div>
                                                        <div className="lg:col-span-2 space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Remarks</Label>
                                                            <Input value={payment.remarks} onChange={e => handlePaymentChange(payment.id, 'remarks', e.target.value)} placeholder="Notes for this payment..." className="h-10 rounded-xl" />
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>

                                        <Separator />
                                        <div className="flex items-center justify-between p-8 bg-white border-2 border-primary/5 rounded-[2rem] shadow-sm">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project Total Cost</p>
                                                <p className="text-3xl font-black text-slate-900 tracking-tighter">{clientForm.currencyType} {Number(clientForm.projectTotalCost).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right space-y-1">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Scheduled Milestones</p>
                                                <p className={cn("text-2xl font-black tracking-tighter", totalCalculatedPayment !== (clientForm.projectTotalCost || 0) ? "text-rose-600" : "text-emerald-600")}>
                                                    {clientForm.currencyType} {totalCalculatedPayment.toLocaleString()}
                                                </p>
                                                {totalCalculatedPayment !== (clientForm.projectTotalCost || 0) && (
                                                    <p className="text-[8px] font-bold text-rose-500 uppercase">Mismatch with Project Total Cost</p>
                                                )}
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
                                        {client.currencyType} {(client.projectTotalCost || client.fullPaymentPrice || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-lg font-black text-[9px] px-3 h-6 border-none uppercase tracking-widest shadow-sm",
                                            client.status === 'Active' ? "bg-emerald-100 text-emerald-700" :
                                            client.status === 'Prospect' ? "bg-blue-100 text-blue-700" :
                                            client.status === 'On Hold' ? "bg-amber-100 text-amber-700" :
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
            </div>

            {/* Account Intelligence Sheet */}
            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[540px] p-0 border-none shadow-3xl overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <SheetHeader className="p-10 pb-8 bg-white border-b shadow-sm relative">
                        <div className="flex items-start justify-between mb-8">
                            <div className="flex items-center gap-6">
                                <div className="size-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-primary/10">
                                    {selectedClient?.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <SheetTitle className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">{selectedClient?.companyName}</SheetTitle>
                                        <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px] font-black h-5 uppercase tracking-widest px-2.5 shadow-sm">{selectedClient?.status}</Badge>
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
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Account Manager</p>
                                <div className="flex items-center gap-2.5">
                                    <Avatar className="size-7 ring-1 ring-border shadow-sm">
                                        <AvatarImage src={selectedClient?.managerAvatar} className="object-cover" />
                                        <AvatarFallback className="text-[8px] font-black bg-muted">{selectedClient?.managerName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.managerName || 'Unassigned'}</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Email</p>
                                <p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.email || 'N/A'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Phone</p>
                                <p className="text-[11px] font-black text-slate-800 uppercase truncate">{selectedClient?.phone || 'N/A'}</p>
                            </div>
                        </div>
                    </SheetHeader>

                    <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                        <div className="px-10 bg-white border-b shrink-0 overflow-x-auto no-scrollbar">
                            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-12 border-none rounded-none">
                                {['Overview', 'Projects', 'Meetings', 'Invoices', 'Documents'].map(tab => (
                                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-black text-[11px] uppercase px-0 pb-5 tracking-widest shadow-none">
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-10 pb-24 space-y-10">
                                <TabsContent value="overview" className="mt-0 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {/* Left: About Client */}
                                        <div className="space-y-6">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">About Client</h4>
                                            <div className="space-y-5">
                                                <DetailLine label="Legal Name" value={selectedClient?.legalBusinessName || selectedClient?.companyName || 'N/A'} />
                                                <DetailLine label="Size" value={selectedClient?.companySize || 'N/A'} />
                                                <DetailLine label="Industry" value={selectedClient?.category || 'N/A'} />
                                                <DetailLine label="Website" value={selectedClient?.website || 'N/A'} isLink />
                                                <DetailLine label="GST Number" value={selectedClient?.gstNumber || 'N/A'} />
                                                <DetailLine label="HQ" value={selectedClient?.hqLocation || 'N/A'} />
                                                <div className="pt-2">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Address</p>
                                                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase">{selectedClient?.address || 'No physical address registered.'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Quick Stats */}
                                        <div className="space-y-6">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Quick Stats</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <StatBox label="Projects" value="4" icon={BriefcaseBusiness} color="bg-emerald-50 text-emerald-600" />
                                                <StatBox label="Meetings" value="27" icon={Users} color="bg-blue-50 text-blue-600" />
                                                <StatBox label="Invoices" value={clientInvoices.length.toString()} icon={ReceiptIndianRupee} color="bg-purple-50 text-purple-600" />
                                                <StatBox label="Priority" value={selectedClient?.priority || 'Medium'} icon={ShieldCheck} color="bg-amber-50 text-amber-600" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mission Notes */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Operational Notes</h4>
                                        </div>
                                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 ring-1 ring-border/50">
                                            <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase italic">"{selectedClient?.notes || 'Strategic partnership protocol initiated. Next milestone delivery expected within current tactical window.'}"</p>
                                            <div className="mt-4 pt-4 border-t border-dashed flex justify-between items-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">- {selectedClient?.managerName} ({format(new Date(), 'dd MMM yyyy')})</p>
                                            </div>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="invoices" className="mt-0 space-y-6">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Account Invoices</h4>
                                    <div className="space-y-4">
                                        {clientInvoices.length > 0 ? clientInvoices.map((inv: any) => (
                                            <div key={inv.id} className="p-6 rounded-2xl bg-white ring-1 ring-border shadow-sm flex items-center justify-between hover:bg-slate-50 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 rounded-xl bg-purple-50 text-purple-600"><ReceiptIndianRupee className="size-5" /></div>
                                                    <div>
                                                        <p className="font-bold text-sm uppercase">{inv.title}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(inv.uploadedAt.toDate(), 'PPP')}</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" asChild><Link href={inv.link} target="_blank"><ExternalLink className="size-4" /></Link></Button>
                                            </div>
                                        )) : (
                                            <div className="py-20 text-center opacity-30">
                                                <ReceiptIndianRupee className="size-12 mx-auto mb-4" />
                                                <p className="font-black uppercase text-[10px]">No invoices logged</p>
                                            </div>
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
        <Card className="border shadow-sm rounded-3xl bg-white p-5 space-y-4 group transition-all hover:shadow-xl ring-1 ring-border/50">
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-105", bg, color)}>
                    <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{label}</p>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 truncate leading-none">{value}</h3>
                </div>
            </div>
            <div className="pt-3 border-t border-dashed border-border/50">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">{sub}</p>
            </div>
        </Card>
    );
}

function DetailLine({ label, value, isLink }: { label: string, value: string, isLink?: boolean }) {
    return (
        <div className="grid grid-cols-5 items-center gap-4">
            <span className="col-span-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={cn(
                "col-span-3 text-[11px] font-black truncate uppercase text-right",
                isLink ? "text-primary underline cursor-pointer" : "text-slate-800"
            )}>
                {value}
            </span>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) {
    return (
        <div className="p-4 bg-white rounded-2xl ring-1 ring-border shadow-sm space-y-3 transition-transform hover:scale-105">
            <div className={cn("p-2 rounded-xl inline-block shadow-sm", color)}>
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
            </div>
        </div>
    );
}
