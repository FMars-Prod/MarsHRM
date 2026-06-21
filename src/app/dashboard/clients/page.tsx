'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where } from 'firebase/firestore';
import { 
    Users, Plus, Trash2, Edit, Search, ExternalLink, ShieldCheck, 
    Globe, Building2, Mail, Phone, MoreHorizontal, Filter, Download, 
    UserCheck, Briefcase, Zap, MapPin, ChevronRight, FileText, 
    Calendar, Clock, CheckCircle2, MessageSquare, ListTodo, X, LayoutGrid
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
import Link from 'next/link';

type Client = {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    status: 'Active' | 'Inactive' | 'Lead' | 'Archived';
    category: string; // Industry
    logoUrl?: string;
    address?: string;
    website?: string;
    createdAt?: any;
    // Mock fields to match image UI
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
        name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', address: '', website: ''
    });

    // Access Control
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    // Data Fetching
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: rawClients, isLoading } = useCollection<Client>(clientsQuery);

    const clients = React.useMemo(() => {
        if (!rawClients) return [];
        // Add some mock metadata to match the image UI exactly
        return rawClients.map(c => ({
            ...c,
            managerName: c.managerName || 'John Smith',
            managerAvatar: c.managerAvatar || '',
            projectsCount: c.projectsCount || Math.floor(Math.random() * 8) + 1,
            lastActivity: c.lastActivity || 'Today'
        }));
    }, [rawClients]);

    const filteredClients = React.useMemo(() => {
        return clients.filter(c => 
            c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [clients, searchQuery]);

    const handleSaveClient = async () => {
        if (!clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Organization Name Required' });
            return;
        }

        if (editingClient) {
            updateDocumentNonBlocking(doc(firestore, 'clients', editingClient.id), clientForm);
            toast({ title: 'Record Updated' });
        } else {
            const payload = { ...clientForm, createdAt: serverTimestamp() };
            addDocumentNonBlocking(collection(firestore, 'clients'), payload);
            toast({ title: 'Client Provisioned' });
        }
        setIsAddOpen(false);
        setEditingClient(null);
        setClientForm({ name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Manufacturing', address: '', website: '' });
    };

    const handleDeleteClient = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'clients', id));
        toast({ title: 'Record Purged' });
        setSelectedClient(null);
    };

    if (!isAuthorized) {
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
        <div className="space-y-8 animate-fade-in-up pb-20">
            <div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-1">Clients</h1>
                <p className="text-sm font-medium text-muted-foreground">Manage and track your client relationships</p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Clients" value="142" trend="+ 12%" isUp={true} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <MetricCard label="Active Clients" value="118" trend="+ 8%" isUp={true} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50" />
                <MetricCard label="Projects in Progress" value="87" trend="+ 5%" isUp={true} icon={Briefcase} color="text-orange-600" bg="bg-orange-50" />
                <MetricCard label="Overdue Invoices" value="12" trend="- 3%" isUp={false} icon={MessageSquare} color="text-purple-600" bg="bg-purple-50" />
            </div>

            {/* Main Terminal */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search clients..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-muted/30 border-none ring-1 ring-border/50"
                            />
                        </div>
                        <Button variant="outline" className="h-11 px-4 gap-2">
                            <Filter className="size-4" /> Filter
                        </Button>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) setEditingClient(null); setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
                                <Plus className="size-4" /> Add Client
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-3xl p-10">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Client Provisioning</DialogTitle>
                                <DialogDescription>Register new strategic account details</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Organization Name</Label>
                                        <Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} placeholder="ABC Pvt Ltd" className="h-12 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Industry Sector</Label>
                                        <Input value={clientForm.category} onChange={e => setClientForm({...clientForm, category: e.target.value})} placeholder="e.g., Manufacturing" className="h-12 font-bold" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Official Website</Label>
                                        <Input value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value})} placeholder="www.abc.com" className="h-12 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Point of Contact</Label>
                                        <Input value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="Full Name" className="h-12 font-bold" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Office Address</Label>
                                    <Input value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} placeholder="Full physical address" className="h-12 font-bold" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSaveClient} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700">Finalize Registry</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30 border-y">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14 px-6">Client Name</TableHead>
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14">Industry</TableHead>
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14">Account Manager</TableHead>
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14">Projects</TableHead>
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14">Status</TableHead>
                                <TableHead className="font-bold text-[11px] text-slate-500 uppercase h-14">Last Activity</TableHead>
                                <TableHead className="h-14"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center animate-pulse text-sm font-bold text-muted-foreground uppercase tracking-widest">Scanning Registry...</TableCell></TableRow>
                            ) : filteredClients.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground italic font-medium">No strategic accounts detected.</TableCell></TableRow>
                            ) : filteredClients.map(client => (
                                <TableRow key={client.id} className="border-b group hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedClient(client)}>
                                    <TableCell className="py-5 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs">
                                                {client.companyName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-[13px] text-slate-900">{client.companyName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[13px] text-slate-600 font-medium">{client.category}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="size-7">
                                                <AvatarFallback className="text-[10px] font-black">{client.managerName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[13px] font-medium text-slate-700">{client.managerName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[13px] font-bold text-slate-800">{client.projectsCount}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-lg font-bold text-[11px] px-3 h-7 border-none",
                                            client.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {client.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-[13px] text-slate-500 font-medium">{client.lastActivity}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="size-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl p-2 w-48">
                                                <DropdownMenuItem onClick={() => { setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="font-bold text-xs gap-3 py-2.5">
                                                    <Edit className="size-4 text-blue-600" /> Edit Record
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="font-bold text-xs gap-3 py-2.5 text-rose-600">
                                                            <Trash2 className="size-4" /> Purge Account
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[2rem]">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="font-black text-2xl tracking-tighter">Purge Account?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will permanently remove "{client.companyName}" from the strategic registry.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-8">
                                                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="rounded-xl bg-rose-600">Confirm Purge</AlertDialogAction>
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
                
                <div className="p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">Showing 1 to {filteredClients.length} of {clients.length} clients</p>
                    <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="size-8 rounded-lg"><ChevronRight className="size-4 rotate-180"/></Button>
                        <Button variant="secondary" size="sm" className="h-8 w-8 rounded-lg bg-blue-600 text-white font-bold">1</Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg font-bold">2</Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg font-bold">3</Button>
                        <span className="px-2 self-center text-muted-foreground">...</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg font-bold">18</Button>
                        <Button variant="outline" size="icon" className="size-8 rounded-lg"><ChevronRight className="size-4"/></Button>
                    </div>
                </div>
            </div>

            {/* Account Intelligence Sheet */}
            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="w-full sm:max-w-[480px] p-0 border-none shadow-2xl overflow-hidden flex flex-col bg-[#F8FAFC]">
                    <div className="p-8 pb-6 bg-white border-b">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-lg shadow-inner">
                                    {selectedClient?.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-black tracking-tight text-slate-900">{selectedClient?.companyName}</h3>
                                        <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-bold h-5 uppercase">Active</Badge>
                                    </div>
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{selectedClient?.category} • Since Jan 2023</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedClient(null)}><X className="size-5"/></Button>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <DetailCol label="Account Manager" value={selectedClient?.managerName || 'John Smith'} />
                            <DetailCol label="Email" value={selectedClient?.email || 'N/A'} />
                            <DetailCol label="Phone" value={selectedClient?.phone || 'N/A'} />
                        </div>

                        <Tabs defaultValue="overview" className="mt-8">
                            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-8 border-b rounded-none">
                                {['Overview', 'Projects', 'Meetings', 'Invoices', 'Documents'].map(tab => (
                                    <TabsTrigger key={tab} value={tab.toLowerCase()} className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 font-bold text-xs uppercase px-0 pb-4 tracking-tight shadow-none">
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8 pb-20">
                            {/* About Section */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-7 space-y-6">
                                    <h4 className="text-sm font-bold text-slate-900">About Client</h4>
                                    <div className="space-y-4">
                                        <InfoLine label="Industry" value={selectedClient?.category || 'N/A'} />
                                        <InfoLine label="Website" value={selectedClient?.website || 'N/A'} isLink />
                                        <InfoLine label="GST Number" value="27ABCDE1234F1Z5" />
                                        <InfoLine label="Address" value={selectedClient?.address || 'N/A'} />
                                        <Button variant="link" className="text-blue-600 p-0 h-auto font-bold text-xs">View More</Button>
                                    </div>
                                </div>
                                <div className="md:col-span-5 space-y-4">
                                    <h4 className="text-sm font-bold text-slate-900">Quick Stats</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatBox icon={Briefcase} label="Projects" value="4" color="text-emerald-600" bg="bg-emerald-50" />
                                        <StatBox icon={Calendar} label="Meetings" value="27" color="text-blue-600" bg="bg-blue-50" />
                                        <StatBox icon={FileText} label="Invoices" value="18" color="text-purple-600" bg="bg-purple-50" />
                                        <StatBox icon={Clock} label="Pending" value="2" color="text-orange-600" bg="bg-orange-50" />
                                    </div>
                                </div>
                            </div>

                            {/* Activity Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-slate-900">Recent Activities</h4>
                                        <Button variant="link" className="text-blue-600 p-0 h-auto text-[11px] font-bold">View All</Button>
                                    </div>
                                    <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                        <ActivityItem icon={DollarSign} title="Invoice INV-018 has been paid" time="Today, 10:30 AM" color="bg-emerald-500" />
                                        <ActivityItem icon={Users} title="Meeting completed - Project Review" time="Today, 09:15 AM" color="bg-blue-500" />
                                        <ActivityItem icon={Plus} title="New document uploaded - Agreement.pdf" time="Yesterday, 04:45 PM" color="bg-purple-500" />
                                        <ActivityItem icon={Zap} title="Project Website Revamp has been updated" time="Yesterday, 11:20 AM" color="bg-orange-500" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-slate-900">Upcoming</h4>
                                    <div className="space-y-3">
                                        <UpcomingItem date="16" month="MAY" title="Project Review Meeting" time="10:00 AM" color="text-blue-600" />
                                        <UpcomingItem date="20" month="MAY" title="Invoice INV-021 Due" time="02:00 PM" color="text-rose-600" />
                                        <UpcomingItem date="25" month="MAY" title="Contract Renewal" time="11:00 AM" color="text-emerald-600" />
                                        <Button variant="link" className="w-full text-blue-600 text-[11px] font-bold mt-2">View Calendar</Button>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-900">Notes</h4>
                                    <Button variant="ghost" size="icon" className="size-6"><Edit className="size-3.5"/></Button>
                                </div>
                                <div className="p-4 bg-white rounded-xl border shadow-sm">
                                    <p className="text-[13px] leading-relaxed text-slate-600 font-medium">
                                        Client is happy with the progress. Next milestone delivery expected by end of May.
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase">- John Smith (12 May 2025)</p>
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
        <Card className="border shadow-sm rounded-2xl bg-white p-6 space-y-4 group transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
                <div className={cn("p-3.5 rounded-xl shadow-sm", bg, color)}>
                    <Icon className="size-5" />
                </div>
                <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1">{label}</p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900">{value}</h3>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                <span className={cn("text-[11px] font-black", isUp ? "text-emerald-600" : "text-rose-600")}>
                    {isUp ? '↑' : '↓'} {trend}
                </span>
                <span className="text-[10px] font-medium text-slate-400">vs last month</span>
            </div>
        </Card>
    );
}

function DetailCol({ label, value }: { label: string, value: string }) {
    return (
        <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-xs font-bold text-slate-800">{value}</p>
        </div>
    );
}

function InfoLine({ label, value, isLink }: { label: string, value: string, isLink?: boolean }) {
    return (
        <div className="grid grid-cols-3 gap-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
            <span className={cn(
                "col-span-2 text-[12px] font-bold truncate",
                isLink ? "text-blue-600 underline cursor-pointer" : "text-slate-800"
            )}>
                {value}
            </span>
        </div>
    );
}

function StatBox({ icon: Icon, label, value, color, bg }: any) {
    return (
        <div className={cn("p-3 rounded-xl border flex flex-col gap-1.5 transition-all hover:shadow-sm bg-white")}>
            <div className={cn("p-1.5 rounded-lg w-fit", bg, color)}>
                <Icon className="size-3.5" />
            </div>
            <div>
                <p className="text-[13px] font-black text-slate-900">{value}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
            </div>
        </div>
    );
}

function ActivityItem({ icon: Icon, title, time, color }: any) {
    return (
        <div className="flex items-start gap-4 relative z-10">
            <div className={cn("size-4 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm", color)}>
                <Icon className="size-2.5" />
            </div>
            <div className="space-y-1 min-w-0">
                <p className="text-[12px] font-bold text-slate-700 leading-tight">{title}</p>
                <p className="text-[10px] font-medium text-slate-400">{time}</p>
            </div>
        </div>
    );
}

function UpcomingItem({ date, month, title, time, color }: any) {
    return (
        <div className="flex items-center gap-4 p-3 bg-white rounded-xl border shadow-sm group hover:border-blue-200 transition-all">
            <div className="flex flex-col items-center justify-center shrink-0 w-10 text-center border-r pr-4">
                <span className={cn("text-sm font-black leading-none", color)}>{date}</span>
                <span className="text-[8px] font-black text-slate-400 tracking-tighter mt-1">{month}</span>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-700 truncate">{title}</p>
                <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock className="size-2.5" /> {time}
                </p>
            </div>
        </div>
    );
}
