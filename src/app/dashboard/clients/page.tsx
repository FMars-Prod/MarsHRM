'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, getDocs, limit } from 'firebase/firestore';
import { 
    Users, Plus, Trash2, Edit, Search, ExternalLink, 
    Building2, Filter, Download, 
    Zap, MapPin, X, 
    DollarSign, BriefcaseBusiness, IndianRupee, 
    CheckCircle2, Clock, MoreHorizontal, Video,
    UserCircle, ListChecks, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, isAfter, isBefore } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';

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
    industryType: string;
    serviceType: 'Technical' | 'Digital Marketing';
    email: string;
    phone: string;
    country: string;
    state: string;
    city: string;
    address: string;
    status: 'Active' | 'Prospect' | 'On Hold' | 'Inactive' | 'Archived';
    priority: 'Strategic' | 'High' | 'Medium' | 'Low';
    totalProjectValue: number;
    currencyType: string;
    expectedAnnualRevenue: number;
    discountOffered: number;
    projectTotalCost: number;
    contractStartDate: string;
    handlingEmployeeId: string;
    assignedTeamId: string;
    productHeadId: string;
    payments: PaymentInstallment[];
    createdAt: any;
    gstNumber?: string;
    website?: string;
    companySize?: string;
    notes?: string;
    managerName?: string;
    managerAvatar?: string;
    logoUrl?: string;
};

const INDUSTRY_TYPES = [
    "Manufacturing", "IT & Software", "Finance", "Healthcare", "Education", "Retail", "Real Estate", "Automotive", "Logistics", "Energy", "Other"
];

const CURRENCIES = ["₹", "$", "€", "£", "AED", "SGD"];

const COMPANY_SIZES = [
    "1-10 Employees", "11-50 Employees", "51-200 Employees", "201-500 Employees", "501-1000 Employees", "1000+ Employees"
];

const COUNTRIES = ["India", "United States", "United Kingdom", "United Arab Emirates", "Singapore", "Australia", "Canada", "Germany"];

export default function ClientsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const deepLinkClientId = searchParams.get('clientId');

    const [dateFilter, setDateFilter] = React.useState<string>("all-time");
    const [rankBy, setRankBy] = React.useState<'price' | 'services'>('price');

    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [editingClient, setEditingClient] = React.useState<Client | null>(null);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [tableFilter, setTableFilter] = React.useState<string>("all");

    const [clientForm, setClientForm] = React.useState<Partial<Client>>({
        companyName: '', clientName: '', legalBusinessName: '', industryType: 'Manufacturing', serviceType: 'Technical',
        email: '', phone: '', country: 'India', state: '', city: '', address: '', 
        status: 'Active', priority: 'Medium', companySize: '1-10 Employees',
        totalProjectValue: 0, currencyType: '₹', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
        contractStartDate: format(new Date(), 'yyyy-MM-dd'),
        handlingEmployeeId: '', assignedTeamId: '', productHeadId: '',
        gstNumber: '', website: '', notes: '',
        logoUrl: '',
        payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '0', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const isPrivileged = userData?.role === 'HR Manager' || userData?.role === 'CEO/Admin' || userData?.role === 'CEO/MD';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    const dateRange = React.useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today': start = startOfDay(now); end = endOfDay(now); break;
            case 'this-week': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfDay(now); break;
            case 'this-month': start = startOfMonth(now); end = endOfDay(now); break;
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
                c.industryType?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(c => c.status === statusFilter);
        }

        if (tableFilter === 'revenue') {
            filtered = filtered.filter(c => (c.payments?.some(p => p.status === 'Paid')));
        } else if (tableFilter === 'pipeline') {
            filtered = filtered.filter(c => (c.payments?.some(p => p.status !== 'Paid')));
        }

        return filtered.map(c => {
            const manager = allUsers?.find((u: any) => u.id === c.handlingEmployeeId);
            return {
                ...c,
                managerName: manager ? `${manager.firstName} ${manager.lastName}` : (c.managerName || 'Unassigned'),
                managerAvatar: manager?.avatar || '',
            };
        });
    }, [rawClients, allUsers, searchQuery, statusFilter, dateRange, tableFilter]);

    const stats = React.useMemo(() => {
        let collected = 0;
        let pending = 0;
        let technicalVal = 0;
        let marketingVal = 0;

        filteredClients.forEach(c => {
            const clientTotal = c.projectTotalCost || c.totalProjectValue || 0;
            if (c.serviceType === 'Technical') technicalVal += clientTotal;
            if (c.serviceType === 'Digital Marketing') marketingVal += clientTotal;

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
            if (rankBy === 'price') return (b.projectTotalCost || 0) - (a.projectTotalCost || 0);
            return (b.payments?.length || 0) - (a.payments?.length || 0);
        }).slice(0, 5);
    }, [filteredClients, rankBy]);

    const handleSaveClient = async () => {
        if (!clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Name Required' });
            return;
        }

        const payload = {
            ...clientForm,
            totalProjectValue: Number(clientForm.totalProjectValue) || 0,
            projectTotalCost: Number(clientForm.projectTotalCost) || 0,
            createdAt: editingClient ? editingClient.createdAt : serverTimestamp(),
        };

        if (editingClient) {
            updateDocumentNonBlocking(doc(firestore, 'clients', editingClient.id), payload);
            toast({ title: 'Client Updated' });
        } else {
            addDocumentNonBlocking(collection(firestore, 'clients'), payload);
            toast({ title: 'Client Added' });
        }
        setIsAddOpen(false);
        setEditingClient(null);
        resetForm();
    };

    const resetForm = () => {
        setClientForm({
            companyName: '', clientName: '', legalBusinessName: '', industryType: 'Manufacturing', serviceType: 'Technical',
            email: '', phone: '', country: 'India', state: '', city: '', address: '', 
            status: 'Active', priority: 'Medium', companySize: '1-10 Employees',
            totalProjectValue: 0, currencyType: '₹', expectedAnnualRevenue: 0, discountOffered: 0, projectTotalCost: 0,
            contractStartDate: format(new Date(), 'yyyy-MM-dd'),
            handlingEmployeeId: '', assignedTeamId: '', productHeadId: '',
            gstNumber: '', website: '', notes: '', logoUrl: '',
            payments: [{ id: Math.random().toString(36).substr(2, 9), amount: '0', status: 'Pending', dueDate: '', invoiceNumber: '', invoiceDate: '', amountReceived: '0', remainingBalance: '0', remarks: '' }]
        });
    };

    const handleExportCsv = () => {
        if (filteredClients.length === 0) {
            toast({ variant: 'destructive', title: 'No Data' });
            return;
        }
        const headers = ["Client", "Contact", "Email", "Phone", "Status", "Priority", "Project Value", "Type", "Joined"];
        const rows = filteredClients.map(c => [
            `"${c.companyName}"`, `"${c.clientName || ''}"`, c.email, c.phone, c.status, c.priority || 'Medium',
            `${c.currencyType}${c.projectTotalCost || 0}`, c.serviceType || 'N/A',
            c.createdAt ? format(c.createdAt.toDate(), 'PPP') : 'N/A'
        ]);
        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Clients_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Export Complete' });
    };

    const moneyCollected = React.useMemo(() => {
        if (!selectedClient?.payments) return 0;
        return selectedClient.payments.reduce((acc, p) => acc + (parseFloat(p.amountReceived || '0') || 0), 0);
    }, [selectedClient]);

    const totalProjectValue = selectedClient?.projectTotalCost || 0;
    const progressPercent = totalProjectValue > 0 ? (moneyCollected / totalProjectValue) * 100 : 0;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta text-left">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-left">
                <div className="text-left">
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-1 uppercase">Clients</h1>
                    <p className="text-sm font-medium text-muted-foreground uppercase text-[10px] tracking-widest opacity-60">Account directory & Mission pipeline.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center text-left">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[160px] rounded-full h-11 bg-white shadow-sm border-none ring-1 ring-border/50 text-[10px] font-black uppercase">
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
                    <Button variant="outline" onClick={handleExportCsv} className="h-11 px-6 gap-2 rounded-full bg-white shadow-sm border-none ring-1 ring-border/50 font-bold uppercase text-[10px] tracking-widest text-left">
                        <Download className="size-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
                <MetricCard label="Total Clients" value={filteredClients.length} trend="Total" up={true} icon={Users} color="text-blue-600" bg="bg-blue-50" onClick={() => setTableFilter('all')} active={tableFilter === 'all'} />
                <MetricCard label="Money Got" value={`₹${stats.collected.toLocaleString()}`} trend="Confirmed" up={true} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" valueColor="text-emerald-600" onClick={() => setTableFilter('revenue')} active={tableFilter === 'revenue'} />
                <MetricCard label="In Pipeline" value={`₹${stats.pending.toLocaleString()}`} trend="Pending" up={false} icon={Clock} color="text-amber-600" bg="bg-amber-50" onClick={() => setTableFilter('pipeline')} active={tableFilter === 'pipeline'} />
                <MetricCard label="Technical Val" value={`₹${stats.technicalVal.toLocaleString()}`} trend="Active" up={true} icon={BriefcaseBusiness} color="text-indigo-600" bg="bg-indigo-50" />
                <MetricCard label="Marketing Val" value={`₹${stats.marketingVal.toLocaleString()}`} trend="Active" up={true} icon={Zap} color="text-purple-600" bg="bg-purple-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                <div className="lg:col-span-8 bg-white rounded-none border shadow-sm overflow-hidden ring-1 ring-border/50 text-left">
                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-b text-left">
                        <div className="flex flex-1 w-full gap-2 text-left">
                            <div className="relative flex-1 text-left">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-12 h-11 bg-muted/20 border-none ring-1 ring-border/50 rounded-none text-left" />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] h-11 rounded-none bg-muted/20 border-none ring-1 ring-border/50 text-[10px] font-black uppercase"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Prospect">Prospect</SelectItem>
                                    <SelectItem value="On Hold">On Hold</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-11 px-8 rounded-none font-black uppercase text-[11px] tracking-widest gap-2 shadow-xl shadow-primary/20">
                                    <Plus className="size-4" /> Add Client
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden border-none shadow-3xl h-[90vh] flex flex-col text-left text-left">
                                <DialogHeader className="p-10 border-b bg-white text-left">
                                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary text-left">New Client Form</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="flex-1 bg-muted/5 p-10 text-left">
                                    <div className="space-y-12 text-left">
                                        <div className="space-y-6 text-left">
                                            <div className="flex items-center gap-3 text-primary text-left"><UserCircle className="size-4" /><h4 className="text-[11px] font-black uppercase tracking-widest text-left">Client Info</h4></div>
                                            <div className="grid grid-cols-2 gap-8 text-left">
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Organization</Label><Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} className="h-11 rounded-none text-left" /></div>
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Contact Name</Label><Input value={clientForm.clientName} onChange={e => setClientForm({...clientForm, clientName: e.target.value})} className="h-11 rounded-none text-left" /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8 text-left">
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Industry</Label>
                                                    <Select value={clientForm.industryType} onValueChange={v => setClientForm({...clientForm, industryType: v})}>
                                                        <SelectTrigger className="h-11 rounded-none"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{INDUSTRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Service</Label>
                                                    <Select value={clientForm.serviceType} onValueChange={v => setClientForm({...clientForm, serviceType: v as any})}>
                                                        <SelectTrigger className="h-11 rounded-none text-left"><SelectValue /></SelectTrigger>
                                                        <SelectContent><SelectItem value="Technical">Technical</SelectItem><SelectItem value="Digital Marketing">Digital Marketing</SelectItem></SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 bg-white border-2 border-dashed border-primary/20 rounded-none space-y-8 text-left text-left">
                                            <div className="flex items-center gap-3 text-emerald-600 text-left"><DollarSign className="size-4" /><h4 className="text-[11px] font-black uppercase tracking-widest text-left">Financials</h4></div>
                                            <div className="grid grid-cols-3 gap-6 text-left">
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Project Value</Label><Input type="number" value={clientForm.totalProjectValue} onChange={e => setClientForm({...clientForm, totalProjectValue: parseFloat(e.target.value) || 0})} className="h-11 rounded-none font-bold text-emerald-600 text-left" /></div>
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Currency</Label>
                                                    <Select value={clientForm.currencyType} onValueChange={v => setClientForm({...clientForm, currencyType: v})}>
                                                        <SelectTrigger className="h-11 rounded-none text-left"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-left">Start Date</Label><Input type="date" value={clientForm.contractStartDate} onChange={e => setClientForm({...clientForm, contractStartDate: e.target.value})} className="h-11 rounded-none text-left" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <div className="p-10 border-t bg-white shrink-0 text-left">
                                    <Button onClick={handleSaveClient} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Save Client</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="overflow-x-auto text-left">
                        <Table>
                            <TableHeader className="bg-muted/10 border-y">
                                <TableRow>
                                    <TableHead className="font-black text-[10px] uppercase h-16 px-8 tracking-widest">Client</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest">Value</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest">Status</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase h-16 tracking-widest text-right px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse text-xs font-black text-muted-foreground uppercase">Loading...</TableCell></TableRow>
                                ) : filteredClients.map(client => (
                                    <TableRow key={client.id} className="border-b group hover:bg-slate-50 cursor-pointer text-left" onClick={() => setSelectedClient(client)}>
                                        <TableCell className="py-8 px-8 text-left">
                                            <div className="flex items-center gap-5 text-left">
                                                <div className="size-12 rounded-none bg-primary/10 flex items-center justify-center text-primary font-black text-sm overflow-hidden text-left">
                                                    {client.logoUrl ? (
                                                        <img src={client.logoUrl} className="size-full object-contain" alt={client.companyName} />
                                                    ) : client.companyName.slice(0,2).toUpperCase()}
                                                </div>
                                                <div className="space-y-1 text-left">
                                                    <span className="font-black text-[15px] uppercase tracking-tight block text-left">{client.companyName}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-left">{client.industryType}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-black text-sm text-emerald-600 text-left">
                                            {client.currencyType}{client.projectTotalCost?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <Badge className={cn("rounded-none font-black text-[9px] px-3 h-6 border-none uppercase tracking-widest shadow-sm", 
                                                client.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                                                {client.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-8" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10"><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 rounded-none p-2 border-none shadow-3xl text-left">
                                                    <DropdownMenuItem onClick={() => { setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="font-black text-[11px] uppercase gap-3 py-4 px-4 text-left">
                                                        <Edit className="size-4 text-primary" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="font-black text-[11px] uppercase gap-3 py-4 px-4 text-rose-600 text-left" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'clients', client.id))}>
                                                        <Trash2 className="size-4" /> Delete
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

                <div className="lg:col-span-4 space-y-6 text-left text-left">
                    <Card className="border-none shadow-xl rounded-none bg-white overflow-hidden ring-1 ring-border/50 text-left text-left">
                        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between text-left text-left">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 text-left text-left"><Users className="size-4" /> Top Ranked</CardTitle>
                            <div className="flex bg-muted/30 p-1 rounded-none text-left">
                                <button onClick={() => setRankBy('price')} className={cn("px-3 py-1 rounded-none text-[9px] font-black uppercase transition-all", rankBy === 'price' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}>Price</button>
                                <button onClick={() => setRankBy('services')} className={cn("px-3 py-1 rounded-none text-[9px] font-black uppercase transition-all", rankBy === 'services' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}>Services</button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-4 text-left text-left">
                            {topRankedClients.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between group text-left text-left">
                                    <div className="flex items-center gap-3 text-left text-left">
                                        <span className="text-[10px] font-black text-muted-foreground/30 w-4 text-left">#0{i+1}</span>
                                        <div className="size-9 rounded-none bg-muted/20 flex items-center justify-center font-black text-[10px] overflow-hidden text-left">
                                            {c.logoUrl ? <img src={c.logoUrl} className="size-full object-contain" alt="" /> : c.companyName[0]}
                                        </div>
                                        <p className="font-bold text-xs uppercase truncate max-w-[120px] text-left">{c.companyName}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-600 text-left">{rankBy === 'price' ? `${c.currencyType}${c.projectTotalCost?.toLocaleString()}` : `${c.payments?.length || 0}`}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[480px] p-0 border-none shadow-3xl flex flex-col bg-[#F8FAFC] text-left text-left">
                    <SheetHeader className="p-6 pb-2 bg-white border-b shadow-sm shrink-0 text-left text-left">
                        <div className="flex items-center gap-4 mb-4 text-left text-left">
                            <div className="size-14 rounded-none bg-primary/5 flex items-center justify-center text-primary font-black text-lg border-2 border-primary/10 shadow-inner overflow-hidden text-left">
                                {selectedClient?.logoUrl ? (
                                    <img src={selectedClient.logoUrl} className="size-full object-contain" alt="" />
                                ) : selectedClient?.companyName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-left text-left">
                                <div className="flex items-center gap-2 mb-0.5 text-left text-left">
                                    <SheetTitle className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none text-left">{selectedClient?.companyName}</SheetTitle>
                                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black h-4 uppercase px-2 shadow-sm text-left">{selectedClient?.status}</Badge>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-left">{selectedClient?.industryType}</p>
                            </div>
                        </div>
                    </SheetHeader>
                    <ScrollArea className="flex-1 p-6 text-left">
                        <div className="space-y-6 text-left">
                            <DetailRow label="Strategic Value" value={`${selectedClient?.currencyType}${selectedClient?.projectTotalCost?.toLocaleString()}`} isPrice />
                            <DetailRow label="Category" value={selectedClient?.serviceType || 'Technical'} />
                            <DetailRow label="Phone" value={selectedClient?.phone || 'N/A'} />
                            <DetailRow label="Email" value={selectedClient?.email || 'N/A'} />
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function MetricCard({ label, value, trend, up, icon: Icon, color, bg, valueColor, onClick, active }: any) {
    return (
        <Card className={cn("border shadow-sm rounded-none bg-white p-5 space-y-4 group transition-all hover:shadow-xl ring-1 ring-border/50 cursor-pointer text-left", active && "ring-2 ring-primary")} onClick={onClick}>
            <div className="flex items-center gap-4 text-left">
                <div className={cn("p-3 rounded-none shadow-sm transition-transform group-hover:scale-105", bg, color)}><Icon className="size-4" /></div>
                <div className="min-w-0 flex-1 text-left text-left">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5 text-left">{label}</p>
                    <h3 className={cn("text-lg font-black tracking-tighter truncate leading-none text-left", valueColor || "text-slate-900")}>{value}</h3>
                </div>
            </div>
            <div className="pt-3 border-t border-dashed border-border/50 flex items-center justify-between text-left text-left">
                <div className={cn("flex items-center gap-1 text-[10px] font-black text-left", up ? "text-emerald-600" : "text-rose-600")}>
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {trend}
                </div>
            </div>
        </Card>
    );
}

function DetailRow({ label, value, isPrice }: { label: string, value: string, isPrice?: boolean }) {
    return (
        <div className="flex justify-between items-center text-left">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">{label}</span>
            <span className={cn("text-xs font-bold uppercase text-left", isPrice ? "text-emerald-600" : "text-slate-800")}>{value}</span>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) {
    return (
        <div className="p-3 bg-white rounded-none ring-1 ring-border shadow-sm space-y-2 transition-transform hover:scale-105 text-left text-left">
            <div className={cn("p-1.5 rounded-lg inline-block shadow-sm", color)}><Icon className="size-3.5" /></div>
            <div className="text-left text-left">
                <p className="text-base font-black text-slate-900 leading-none text-left">{value}</p>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-0.5 text-left">{label}</p>
            </div>
        </div>
    );
}
