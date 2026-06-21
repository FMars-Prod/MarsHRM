'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where } from 'firebase/firestore';
import { Users, Plus, Trash2, Edit, Search, ExternalLink, ShieldCheck, Globe, Building2, Mail, Phone, MoreHorizontal, Filter, Download, UserCheck, Briefcase, Zap } from 'lucide-react';
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
import Image from 'next/image';
import Link from 'next/link';

type Client = {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    status: 'Active' | 'Inactive' | 'Lead' | 'Archived';
    category: 'Premium' | 'Standard' | 'Enterprise';
    logoUrl?: string;
    address?: string;
    website?: string;
    createdAt?: any;
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
        name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Standard', address: '', website: ''
    });

    // Access Control
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isAuthorized = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    // Data Fetching
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('name', 'asc')), [firestore]);
    const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

    const filteredClients = React.useMemo(() => {
        if (!clients) return [];
        return clients.filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [clients, searchQuery]);

    const handleSaveClient = async () => {
        if (!clientForm.name || !clientForm.companyName) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }

        if (editingClient) {
            updateDocumentNonBlocking(doc(firestore, 'clients', editingClient.id), clientForm);
            toast({ title: 'Client record updated' });
        } else {
            const payload = { ...clientForm, createdAt: serverTimestamp() };
            addDocumentNonBlocking(collection(firestore, 'clients'), payload);
            toast({ title: 'New client registered' });
        }
        setIsAddOpen(false);
        setEditingClient(null);
        setClientForm({ name: '', companyName: '', email: '', phone: '', status: 'Active', category: 'Standard', address: '', website: '' });
    };

    const handleDeleteClient = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'clients', id));
        toast({ title: 'Client purged from registry' });
    };

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center opacity-30 grayscale">
                <ShieldCheck className="size-20 mb-4" />
                <p className="font-black uppercase text-sm tracking-[0.3em]">Access Restricted</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-xs">This terminal is limited to Executive Tier personnel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up font-jakarta">
            <PageHeader title="Client Portfolio" description="Global registry of strategic business partnerships and accounts.">
                <div className="flex gap-2">
                    <Button variant="outline" className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm ring-1 ring-border/50">
                        <Download className="size-4 mr-2" /> Export
                    </Button>
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) setEditingClient(null); setIsAddOpen(o); }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-none h-11 px-8 shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest">
                                <Plus className="size-4 mr-2" /> Register Client
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-2xl p-0 border-none shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                            <DialogHeader className="p-8 border-b bg-white shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingClient ? 'Reconfigure Account' : 'New Account Provisioning'}</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Register strategic account details</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-8 space-y-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Point of Contact</Label>
                                            <Input value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="e.g., John Smith" className="rounded-none h-12 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Organization Name</Label>
                                            <Input value={clientForm.companyName} onChange={e => setClientForm({...clientForm, companyName: e.target.value})} placeholder="e.g., Tech Global Corp" className="rounded-none h-12 font-bold" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Contact Email</Label>
                                            <Input value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} placeholder="john@company.com" className="rounded-none h-12 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Phone Number</Label>
                                            <Input value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} placeholder="+1 234..." className="rounded-none h-12 font-bold" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Status Tier</Label>
                                            <Select value={clientForm.status} onValueChange={v => setClientForm({...clientForm, status: v as any})}>
                                                <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-none">
                                                    <SelectItem value="Active">Active</SelectItem>
                                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                                    <SelectItem value="Lead">Lead</SelectItem>
                                                    <SelectItem value="Archived">Archived</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Client Classification</Label>
                                            <Select value={clientForm.category} onValueChange={v => setClientForm({...clientForm, category: v as any})}>
                                                <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-none">
                                                    <SelectItem value="Premium">Premium</SelectItem>
                                                    <SelectItem value="Standard">Standard</SelectItem>
                                                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Office Address</Label>
                                        <Input value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} placeholder="Full physical address" className="rounded-none h-12 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Digital Presence (URL)</Label>
                                        <Input value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value})} placeholder="https://..." className="rounded-none h-12 font-bold" />
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-white shrink-0">
                                <Button onClick={handleSaveClient} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">Finalize Registry Protocol</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Partners" value={clients?.length || 0} icon={Users} color="text-indigo-600" />
                <MetricCard label="Active Accounts" value={clients?.filter(c => c.status === 'Active').length || 0} icon={UserCheck} color="text-emerald-600" />
                <MetricCard label="Tactical Leads" value={clients?.filter(c => c.status === 'Lead').length || 0} icon={Zap} color="text-amber-600" />
                <MetricCard label="Enterprise Units" value={clients?.filter(c => c.category === 'Enterprise').length || 0} icon={Building2} color="text-rose-600" />
            </div>

            {/* Main Registry Terminal */}
            <Card className="border-none shadow-xl rounded-none bg-white overflow-hidden ring-1 ring-border/50">
                <CardHeader className="bg-muted/10 border-b p-6 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary">Global Client Registry</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">High-fidelity strategic account management</CardDescription>
                    </div>
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                        <Input 
                            placeholder="Filter registry..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-10 pl-10 rounded-none bg-white border-none ring-1 ring-border/50 font-bold text-xs uppercase" 
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 px-8">Organization</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6">Representative</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6">Classification</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6">Status</TableHead>
                                    <TableHead className="text-right font-black uppercase tracking-widest text-[9px] py-6 px-8">Command</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Scanning Registry...</TableCell></TableRow>
                                ) : filteredClients.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No accounts detected in current sector.</TableCell></TableRow>
                                ) : filteredClients.map(client => (
                                    <TableRow key={client.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                        <TableCell className="py-6 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-none bg-primary/10 flex items-center justify-center font-black text-primary text-xs shadow-sm ring-1 ring-primary/20">
                                                    {client.companyName[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm uppercase tracking-tight leading-none">{client.companyName}</span>
                                                    {client.website && <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-2">{client.website.replace('https://', '')}</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs uppercase">{client.name}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground opacity-60 mt-1">{client.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 align-middle">
                                            <Badge variant="outline" className={cn(
                                                "rounded-none font-black text-[8px] uppercase tracking-[0.2em] border-none px-3 h-6",
                                                client.category === 'Premium' ? "bg-purple-100 text-purple-700" : 
                                                client.category === 'Enterprise' ? "bg-indigo-100 text-indigo-700" : "bg-muted text-muted-foreground"
                                            )}>
                                                {client.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-6 align-middle">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("size-2 rounded-full", 
                                                    client.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 
                                                    client.status === 'Lead' ? 'bg-amber-500' : 'bg-slate-400'
                                                )} />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">{client.status}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 px-8 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="size-9 rounded-none hover:bg-primary/5 text-primary" onClick={() => setSelectedClient(client)}>
                                                    <ExternalLink className="size-4" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-9 rounded-none hover:bg-muted"><MoreHorizontal className="size-4.5" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-none border-none shadow-2xl p-2 w-56">
                                                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 px-3 py-2">Mission Control</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => { setEditingClient(client); setClientForm(client); setIsAddOpen(true); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                                                            <Edit className="size-4 text-primary" /> Edit Account
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={e => e.preventDefault()} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-red-50 text-destructive">
                                                                    <Trash2 className="size-4" /> Purge Registry
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Purge Account?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">This will permanently remove "{client.companyName}" from the strategic registry.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="mt-8 gap-3">
                                                                    <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Abort</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Confirm Purge</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
                <SheetContent className="rounded-none border-none shadow-2xl w-full sm:max-w-xl p-0 overflow-hidden flex flex-col">
                    <SheetHeader className="p-10 border-b bg-white shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="size-20 rounded-none bg-primary/10 flex items-center justify-center font-black text-primary text-3xl shadow-xl ring-2 ring-primary/20">
                                {selectedClient?.companyName[0]}
                            </div>
                            <div className="space-y-1">
                                <SheetTitle className="text-3xl font-black uppercase tracking-tighter text-primary leading-none">{selectedClient?.companyName}</SheetTitle>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{selectedClient?.category} Account Intelligence</p>
                            </div>
                        </div>
                    </SheetHeader>
                    <ScrollArea className="flex-1 bg-muted/5">
                        <div className="p-10 space-y-12">
                            <div className="grid grid-cols-2 gap-8">
                                <DetailItem icon={Users} label="Strategic Lead" value={selectedClient?.name || 'N/A'} />
                                <DetailItem icon={Building2} label="Account Type" value={selectedClient?.category || 'N/A'} />
                                <DetailItem icon={Mail} label="Official Email" value={selectedClient?.email || 'N/A'} />
                                <DetailItem icon={Phone} label="Contact Signal" value={selectedClient?.phone || 'N/A'} />
                            </div>
                            <Separator className="opacity-50" />
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3"><Globe className="size-4" /> Digital Asset</h4>
                                    <div className="p-6 bg-white border-2 border-dashed border-border group hover:border-primary/40 transition-all shadow-sm">
                                        <p className="text-sm font-bold uppercase tracking-tight truncate mb-4">{selectedClient?.website || 'No website registered.'}</p>
                                        {selectedClient?.website && (
                                            <Button asChild variant="outline" className="rounded-none h-10 w-full font-black uppercase text-[9px] tracking-widest">
                                                <Link href={selectedClient.website} target="_blank">Access Live Asset</Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3"><MapPin className="size-4" /> HQ Location</h4>
                                    <div className="p-6 bg-white border-2 border-dashed border-border shadow-sm">
                                        <p className="text-sm font-medium leading-relaxed italic text-foreground/70 uppercase">"{selectedClient?.address || 'No physical address provisioned.'}"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-10 border-t bg-white shrink-0">
                        <Button variant="outline" onClick={() => setSelectedClient(null)} className="w-full h-14 rounded-none font-black uppercase text-[12px] tracking-[0.3em] shadow-lg">Just Close Terminal</Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
    return (
        <Card className="border-none shadow-sm rounded-none bg-white p-6 space-y-4 ring-1 ring-border/50 group hover:shadow-xl transition-all duration-500">
            <div className="flex justify-between items-start">
                <div className={cn("p-3 rounded-none shadow-sm transition-transform group-hover:scale-110", color, "bg-muted/10")}>
                    <Icon className="size-5" />
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Live</Badge>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1.5">{label}</p>
                <h3 className="text-3xl font-black tracking-tighter leading-none">{value}</h3>
            </div>
        </Card>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 opacity-40">
                <Icon className="size-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-sm font-black uppercase tracking-tight text-foreground/90">{value}</p>
        </div>
    );
}

function Separator({ className }: { className?: string }) {
    return <div className={cn("h-px bg-border", className)} />;
}
