'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where, collectionGroup, getDocs, limit } from 'firebase/firestore';
import { 
    Users, Plus, Trash2, Edit, Search, ExternalLink, ShieldCheck, 
    Globe, Building2, Mail, Phone, MoreHorizontal, Filter, Download, 
    UserCheck, Briefcase, Zap, MapPin, ChevronRight, FileText, 
    Calendar, Clock, CheckCircle2, MessageSquare, ListTodo, X, LayoutGrid,
    DollarSign, BriefcaseBusiness, UserPlus, IndianRupee, Layers, UserCircle2, Loader2, TrendingUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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

    // Data Fetching for Dropdowns
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams'), orderBy('name', 'asc')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);

    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    // Business Reports Data Sourcing (Experimental)
    const [suggestedClients, setSuggestedClients] = React.useState<string[]>([]);
    React.useEffect(() => {
        const fetchReportSuggestions = async () => {
            if (!isAddOpen || !firestore) return;
            try {
                // Fetch reports to find client names mentioned in "clientWin" or similar
                const reportsSnap = await getDocs(query(collectionGroup(firestore, 'reports'), limit(50)));
                const names = new Set<string>();
                reportsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.clientWin && data.clientWin !== 'NIL') {
                        // Very basic extraction: first few words might be a company name
                        const match = data.clientWin.match(/([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)/);
                        if (match) names.add(match[1]);
                    }
                });
                setSuggestedClients(Array.from(names));
            } catch (e) {
                console.warn("Could not fetch suggestions", e);
            }
        };
        fetchReportSuggestions();
    }, [isAddOpen, firestore]);

    const clients = React.useMemo(() => {
        if (!rawClients) return [];
        return rawClients.map(c => {
            const manager = allUsers?.find((u: any) => u.id === c.handlingEmployeeId);
            return {
                ...c,
                managerName: manager ? `${manager.firstName} ${manager.lastName}` : (c.managerName || 'Unassigned'),
                managerAvatar: manager?.avatar || '',
                projectsCount: c.projectsCount || 0,
                lastActivity: c.lastActivity || 'No recent activity'
            };
        });
    }, [rawClients, allUsers]);

    const filteredClients = React.useMemo(() => {
        return clients.filter(c => 
            c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [clients, searchQuery]);

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

    // Calculate dynamic full payment
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
            fullPaymentPrice: totalCalculatedPayment,
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
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-1">Clients</h1>
                    <p className="text-sm font-medium text-muted-foreground">Strategic partnership and account directory</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="h-11 px-4 gap-2 rounded-xl bg-white shadow-sm">
                        <Download className="size-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Partners" value={clients.length} trend="+ 12%" isUp={true} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <MetricCard label="Active Accounts" value={clients.filter(c => c.status === 'Active').length} trend="+ 8%" isUp={true} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50" />
                <MetricCard label="Technical Units" value={clients.filter(c => c.projectType === 'Technical').length} trend="+ 5%" isUp={true} icon={BriefcaseBusiness} color="text-orange-600" bg="bg-orange-50" />
                <MetricCard label="Revenue Potential" value={`₹${clients.reduce((a,c) => a + (c.fullPaymentPrice || 0), 0).toLocaleString()}`} trend="Aggregate" isUp={true} icon={DollarSign} color="text-purple-600" bg="bg-purple-50" />
            </div>

            {/* Main Terminal */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden ring-1 ring-border/50">
                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search clients..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-muted/30 border-none ring-1 ring-border/50 rounded-xl"
                            />
                        </div>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) { setEditingClient(null); resetForm(); } setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-primary/20">
                                <Plus className="size-4" /> Provision Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col h-[90vh]">
                            <DialogHeader className="p-10 border-b bg-white shrink-0">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Client Provisioning</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Register new strategic account details</DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-10 space-y-12 pb-20">
                                    {/* Section 1: Identity */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-primary">
                                            <Building2 className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Organization Identity</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Organization Name</Label>
                                                <Input list="suggested-clients" value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} placeholder="e.g., ABC Tech Solutions" className="h-12 font-bold rounded-xl" />
                                                <datalist id="suggested-clients">
                                                    {suggestedClients.map(name => <option key={name} value={name} />)}
                                                </datalist>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry Sector</Label>
                                                <Input value={clientForm.category} onChange={e => setClientForm({...clientForm, category: e.target.value})} placeholder="e.g., Manufacturing" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product Needed</Label>
                                                <Input value={clientForm.productNeeded} onChange={e => setClientForm({...clientForm, productNeeded: e.target.value})} placeholder="e.g., Mobile ERP Suite" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Status</Label>
                                                <Select value={clientForm.status} onValueChange={v => setClientForm({...clientForm, status: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Active">Active Partner</SelectItem>
                                                        <SelectItem value="Lead">Tactical Lead</SelectItem>
                                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                                        <SelectItem value="Archived">Archived</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: POC Details */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-primary">
                                            <UserCircle2 className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Point of Contact</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Representative Name</Label>
                                                <Input value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="Full Name" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Position/Role</Label>
                                                <Input value={clientForm.pocPosition} onChange={e => setClientForm({...clientForm, pocPosition: e.target.value})} placeholder="e.g., Managing Director" className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</Label>
                                                <Input value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} placeholder="poc@organization.com" className="h-12 font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                                                <Input value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} placeholder="+91 ..." className="h-12 font-bold rounded-xl" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Handling & Deployment */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-primary">
                                            <Layers className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Internal Deployment</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Handled By (Employee/Intern)</Label>
                                                <Select value={clientForm.handlingEmployeeId} onValueChange={v => setClientForm({...clientForm, handlingEmployeeId: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Staff" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allUsers?.map((u: any) => (
                                                            <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.jobTitle})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Classification</Label>
                                                <Select value={clientForm.projectType} onValueChange={v => setClientForm({...clientForm, projectType: v as any})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Technical">Technical Sprint</SelectItem>
                                                        <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            {clientForm.projectType === 'Technical' ? (
                                                <div className="space-y-2 animate-fade-in-up">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Assign to Existing Team</Label>
                                                    <Select value={clientForm.assignedTeamId} onValueChange={v => setClientForm({...clientForm, assignedTeamId: v})}>
                                                        <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                                        <SelectContent>
                                                            {allTeams?.map((t: any) => (
                                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 animate-fade-in-up">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Marketing Deployment Note</Label>
                                                    <Input placeholder="Strategy details..." className="h-12 font-bold rounded-xl" />
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Head of Product/Project</Label>
                                                <Select value={clientForm.productHeadId} onValueChange={v => setClientForm({...clientForm, productHeadId: v})}>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Head" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allUsers?.filter((u:any) => u.role !== 'Member').map((u: any) => (
                                                            <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Financial Structure */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-emerald-600">
                                            <DollarSign className="size-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Financial Structure</h4>
                                        </div>
                                        <div className="p-6 bg-white border-2 border-dashed border-emerald-100 rounded-3xl space-y-6">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Milestone Calculation</Label>
                                                <Button type="button" size="sm" onClick={handleAddPaymentRow} className="rounded-full h-8 bg-emerald-600 text-white text-[9px] font-bold">
                                                    <Plus className="size-3 mr-1" /> Add Milestone
                                                </Button>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                {clientForm.payments?.map((payment, idx) => (
                                                    <div key={payment.id} className="flex gap-4 items-center animate-fade-in-up">
                                                        <div className="flex-1">
                                                            <div className="relative">
                                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                                                                <Input 
                                                                    type="number" 
                                                                    value={payment.amount} 
                                                                    onChange={e => handlePaymentChange(payment.id, 'amount', e.target.value)} 
                                                                    placeholder="Amount" 
                                                                    className="pl-8 h-11 rounded-xl font-black" 
                                                                />
                                                            </div>
                                                        </div>
                                                        <Select value={payment.status} onValueChange={v => handlePaymentChange(payment.id, 'status', v as any)}>
                                                            <SelectTrigger className="w-32 h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Pending">Pending</SelectItem>
                                                                <SelectItem value="Paid">Paid</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {clientForm.payments!.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => handleRemovePaymentRow(payment.id)}>
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <Separator />
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Contract Value</p>
                                                    <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{totalCalculatedPayment.toLocaleString()}</p>
                                                </div>
                                                <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[10px] uppercase h-8 px-4">Milestone Basis</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="p-10 border-t bg-white shrink-0">
                                <Button onClick={handleSaveClient} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20">Finalize Registry</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10 border-y">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 px-6 tracking-widest">Client Identity</TableHead>
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 tracking-widest">Industry</TableHead>
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 tracking-widest">Account Manager</TableHead>
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 tracking-widest">Classification</TableHead>
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 tracking-widest">Status</TableHead>
                                <TableHead className="font-black text-[9px] text-slate-500 uppercase h-14 tracking-widest">Activity</TableHead>
                                <TableHead className="h-14"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center animate-pulse text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Scanning Strategic Registry...</TableCell></TableRow>
                            ) : filteredClients.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground italic font-medium uppercase text-[10px] tracking-widest opacity-30">No active partnerships detected.</TableCell></TableRow>
                            ) : filteredClients.map(client => (
                                <TableRow key={client.id} className="border-b group hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedClient(client)}>
                                    <TableCell className="py-6 px-6">
                                        <div className="flex items-center gap-4">
                                            <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                                                {client.companyName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="font-black text-sm text-slate-900 uppercase tracking-tight leading-none block">{client.companyName}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{client.productNeeded || 'Standard Suite'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[11px] text-slate-600 font-bold uppercase tracking-tight">{client.category}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2.5">
                                            <Avatar className="size-8 ring-1 ring-border shadow-sm">
                                                <AvatarImage src={client.managerAvatar} className="object-cover" />
                                                <AvatarFallback className="text-[9px] font-black bg-muted">{client.managerName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-bold text-slate-700">{client.managerName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-lg font-black text-[9px] px-3 h-6 border-none uppercase tracking-widest",
                                            client.projectType === 'Technical' ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                        )}>
                                            {client.projectType || 'General'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("size-2 rounded-full", client.status === 'Active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300")} />
                                            <span className="font-black text-[10px] text-slate-800 uppercase tracking-widest">{client.status}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{client.lastActivity}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="size-4.5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl p-2 w-52 border-none shadow-2xl">
                                                <DropdownMenuItem onClick={() => { setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="font-black text-[10px] uppercase tracking-widest gap-3 py-3 px-3">
                                                    <Edit className="size-4 text-primary" /> Edit Record
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="font-black text-[10px] uppercase tracking-widest gap-3 py-3 px-3 text-rose-600 hover:bg-rose-50">
                                                            <Trash2 className="size-4" /> Purge Partner
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="font-black text-2xl tracking-tighter uppercase text-primary">Purge Account?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">This will permanently remove "{client.companyName}" from the strategic partner directory. This protocol is irreversible.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-8 gap-3">
                                                            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="rounded-xl font-bold uppercase text-[10px] h-11 px-6 bg-rose-600 hover:bg-rose-700">Confirm Purge</AlertDialogAction>
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
                
                <div className="p-8 border-t flex flex-col sm:flex-row items-center justify-between gap-6 bg-muted/5">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Audit Registry: {filteredClients.length} of {clients.length} strategic partners</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="size-9 rounded-xl border-none ring-1 ring-border shadow-sm"><ChevronRight className="size-4 rotate-180"/></Button>
                        <Button variant="secondary" size="sm" className="h-9 w-9 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20">1</Button>
                        <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl font-black text-xs">2</Button>
                        <Button variant="outline" size="icon" className="size-9 rounded-xl border-none ring-1 ring-border shadow-sm"><ChevronRight className="size-4"/></Button>
                    </div>
                </div>
            </div>

            {/* Account Intelligence Sheet */}
            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[540px] p-0 border-none shadow-2xl overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <div className="p-10 pb-8 bg-white border-b shadow-sm">
                        <div className="flex items-start justify-between mb-8">
                            <div className="flex items-center gap-6">
                                <div className="size-20 rounded-full bg-primary/5 flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-primary/10">
                                    {selectedClient?.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <h3 className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">{selectedClient?.companyName}</h3>
                                        <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black h-5 uppercase tracking-widest px-2.5 shadow-sm">Active</Badge>
                                    </div>
                                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">{selectedClient?.category} Unit • Provisioned {selectedClient?.createdAt ? format(selectedClient.createdAt.toDate ? selectedClient.createdAt.toDate() : new Date(selectedClient.createdAt), 'MMM yyyy') : 'N/A'}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => setSelectedClient(null)}><X className="size-5"/></Button>
                        </div>

                        <div className="grid grid-cols-3 gap-8 p-6 bg-muted/10 rounded-3xl border border-dashed border-border/50">
                            <DetailCol label="Strategist" value={selectedClient?.managerName || 'Unassigned'} />
                            <DetailCol label="Official Email" value={selectedClient?.email || 'N/A'} />
                            <DetailCol label="Phone Signal" value={selectedClient?.phone || 'N/A'} />
                        </div>

                        <Tabs defaultValue="overview" className="mt-10">
                            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-10 border-b rounded-none overflow-x-auto no-scrollbar">
                                {['Overview', 'Milestones', 'Meetings', 'Contracts', 'Intelligence'].map(tab => (
                                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-black text-[10px] uppercase px-0 pb-4 tracking-widest shadow-none">
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-10 space-y-12 pb-24">
                            {/* Mission Classification */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                <div className="md:col-span-7 space-y-8">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <Briefcase className="size-3.5 text-primary" /> Profile Brief
                                    </h4>
                                    <div className="space-y-5">
                                        <InfoLine label="Product" value={selectedClient?.productNeeded || 'Enterprise Suite'} />
                                        <InfoLine label="Project Tier" value={selectedClient?.projectType || 'General'} />
                                        <InfoLine label="HQ Website" value={selectedClient?.website || 'N/A'} isLink />
                                        <InfoLine label="Reference ID" value={`#REF-${selectedClient?.id.slice(0, 8).toUpperCase()}`} />
                                        <div className="pt-2">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Operational HQ</p>
                                            <div className="p-5 bg-white rounded-2xl ring-1 ring-border shadow-sm flex items-start gap-3">
                                                <MapPin className="size-4 text-primary mt-0.5" />
                                                <p className="text-xs font-bold leading-relaxed text-slate-600 uppercase italic">"{selectedClient?.address || 'No physical address registered.'}"</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-5 space-y-6">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <TrendingUp className="size-3.5 text-primary" /> Velocity
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <StatBox icon={Zap} label="Growth" value="4.2x" color="text-emerald-600" bg="bg-emerald-50" />
                                        <StatBox icon={Users} label="Stakeholders" value="12" color="text-blue-600" bg="bg-blue-50" />
                                        <StatBox icon={FileText} label="Invoices" value="08" color="text-purple-600" bg="bg-purple-50" />
                                        <StatBox icon={Clock} label="Days Active" value="142" color="text-orange-600" bg="bg-orange-50" />
                                    </div>
                                </div>
                            </div>

                            {/* Strategic Milestones */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <DollarSign className="size-3.5 text-primary" /> Payment Milestones
                                    </h4>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total: ₹{selectedClient?.fullPaymentPrice?.toLocaleString()}</p>
                                </div>
                                <div className="space-y-4">
                                    {selectedClient?.payments?.map((p, i) => (
                                        <div key={p.id} className="flex items-center justify-between p-5 bg-white rounded-2xl ring-1 ring-border shadow-sm group hover:ring-primary/20 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="size-9 rounded-xl bg-muted/20 flex items-center justify-center font-black text-[10px] text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">0{i+1}</div>
                                                <span className="font-black text-sm text-slate-800 tracking-tight uppercase leading-none">Milestone {i+1}</span>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="font-black text-sm text-slate-900">₹{parseFloat(p.amount).toLocaleString()}</span>
                                                <Badge className={cn(
                                                    "rounded-lg font-black text-[8px] uppercase tracking-widest border-none px-3 h-6",
                                                    p.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                )}>{p.status}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedClient?.payments || selectedClient.payments.length === 0) && (
                                        <div className="py-10 text-center opacity-20 italic text-sm font-bold uppercase tracking-widest">No financial milestones provisioned.</div>
                                    )}
                                </div>
                            </div>

                            {/* Timeline Intelligence */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Recent Signals</h4>
                                        <Button variant="link" className="text-primary p-0 h-auto text-[10px] font-black uppercase tracking-widest">Audit All</Button>
                                    </div>
                                    <div className="space-y-8 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                        <ActivityItem icon={DollarSign} title="Invoice Milestone 01 Verified" time="Today, 10:30 AM" color="bg-emerald-500" />
                                        <ActivityItem icon={Users} title="Stakeholder Alignment Meeting" time="Yesterday, 09:15 AM" color="bg-blue-500" />
                                        <ActivityItem icon={FileText} title="Tactical Briefing Synced" time="2 days ago" color="bg-purple-500" />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Upcoming Windows</h4>
                                    <div className="space-y-4">
                                        <UpcomingItem date="16" month="MAY" title="Sprint Alignment Window" time="10:00 AM" color="text-primary" />
                                        <UpcomingItem date="20" month="MAY" title="Revenue Milestone 02 Due" time="02:00 PM" color="text-rose-600" />
                                        <UpcomingItem date="25" month="MAY" title="Account Status Audit" time="11:00 AM" color="text-emerald-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function MetricCard({ label, value, trend, isUp, icon: Icon, color, bg }: any) {
    return (
        <Card className="border shadow-sm rounded-2xl bg-white p-6 space-y-4 group transition-all hover:shadow-xl ring-1 ring-border/50">
            <div className="flex items-center gap-4">
                <div className={cn("p-3.5 rounded-2xl shadow-sm transition-transform group-hover:scale-105", bg, color)}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">{label}</p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 truncate">{value}</h3>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-dashed border-border/50">
                <span className={cn("text-[10px] font-black tracking-widest uppercase", isUp ? "text-emerald-600" : "text-rose-600")}>
                    {isUp ? '↑' : '↓'} {trend}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Industrial Velocity</span>
            </div>
        </Card>
    );
}

function DetailCol({ label, value }: { label: string, value: string }) {
    return (
        <div className="space-y-2">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className="text-xs font-black text-slate-800 uppercase truncate">{value}</p>
        </div>
    );
}

function InfoLine({ label, value, isLink }: { label: string, value: string, isLink?: boolean }) {
    return (
        <div className="grid grid-cols-3 gap-6 items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={cn(
                "col-span-2 text-[11px] font-bold truncate uppercase",
                isLink ? "text-primary underline cursor-pointer" : "text-slate-800"
            )}>
                {value}
            </span>
        </div>
    );
}

function StatBox({ icon: Icon, label, value, color, bg }: any) {
    return (
        <div className={cn("p-4 rounded-2xl ring-1 ring-border shadow-sm flex flex-col gap-3 transition-all hover:shadow-md bg-white group")}>
            <div className={cn("p-2.5 rounded-xl w-fit shadow-sm transition-transform group-hover:scale-110", bg, color)}>
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-xl font-black text-slate-900 tracking-tighter">{value}</p>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function ActivityItem({ icon: Icon, title, time, color }: any) {
    return (
        <div className="flex items-start gap-5 relative z-10">
            <div className={cn("size-5 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5 shadow-lg", color)}>
                <Icon className="size-2.5" />
            </div>
            <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-black text-slate-800 leading-tight uppercase tracking-tight">{title}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{time}</p>
            </div>
        </div>
    );
}

function UpcomingItem({ date, month, title, time, color }: any) {
    return (
        <div className="flex items-center gap-5 p-4 bg-white rounded-2xl ring-1 ring-border shadow-sm group hover:ring-primary/20 transition-all cursor-default">
            <div className="flex flex-col items-center justify-center shrink-0 w-12 text-center border-r border-dashed pr-5">
                <span className={cn("text-lg font-black leading-none", color)}>{date}</span>
                <span className="text-[9px] font-black text-muted-foreground tracking-tighter mt-1">{month}</span>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{title}</p>
                <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest mt-1">
                    <Clock className="size-2.5" /> {time}
                </p>
            </div>
        </div>
    );
}
