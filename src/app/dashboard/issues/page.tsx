
"use client";

import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Ticket, CheckCircle2, Clock, Activity, ShieldCheck, UserCheck, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, orderBy, query, where } from "firebase/firestore";
import React from "react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WithId } from "@/firebase/firestore/use-collection";

type TicketStatus = "Open" | "In Progress" | "Resolved";

type SupportTicket = {
  title: string;
  description: string;
  status: TicketStatus;
  employeeId: string;
  submittedBy: string;
  submissionDate: any;
  category: string;
  lastUpdatedDate?: any;
  resolvedByName?: string;
};

const CATEGORIES = ["Mac Laptop Issue", "Windows Laptop Issue", "Chair Broken", "ID Card Broken", "Others"];

export default function TicketsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedTicket, setSelectedTicket] = React.useState<WithId<SupportTicket> | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newDescription, setNewDescription] = React.useState('');
  const [newCategory, setNewCategory] = React.useState(CATEGORIES[0]);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdminOrHR = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const ticketsQuery = useMemoFirebase(() => {
      if (!user) return null;
      const base = collection(firestore, "issue_reports");
      if (isAdminOrHR) return query(base, orderBy("submissionDate", "desc"));
      return query(base, where("employeeId", "==", user.uid), orderBy("submissionDate", "desc"));
  }, [firestore, user, isAdminOrHR]);

  const { data: tickets, isLoading } = useCollection<SupportTicket>(ticketsQuery);

  const handleCreateTicket = () => {
    if (!newTitle || !newDescription || !user || !userData) {
        toast({ variant: "destructive", title: "Missing fields" });
        return;
    }
    const payload = {
        title: newTitle,
        description: newDescription,
        status: "Open" as TicketStatus,
        employeeId: user.uid,
        submittedBy: `${(userData as any).firstName} ${(userData as any).lastName}`,
        submissionDate: serverTimestamp(),
        category: newCategory,
    }
    addDocumentNonBlocking(collection(firestore, 'issue_reports'), payload);
    toast({ title: "Ticket Logged" });
    setIsCreateDialogOpen(false);
    setNewTitle('');
    setNewDescription('');
  }

  const handleUpdateStatus = (ticketId: string, newStatus: TicketStatus) => {
    if (!isAdminOrHR) return;
    const ticketRef = doc(firestore, 'issue_reports', ticketId);
    const updateData: any = {
      status: newStatus,
      lastUpdatedDate: serverTimestamp()
    };

    if (newStatus === 'Resolved' && userData) {
        updateData.resolvedByName = `${(userData as any).firstName} ${(userData as any).lastName}`;
    }

    updateDocumentNonBlocking(ticketRef, updateData);
    toast({ title: `Ticket status updated to ${newStatus}` });
  };

  const handleDeleteTicket = (ticketId: string) => {
      const ticket = tickets?.find(t => t.id === ticketId);
      if (!ticket) return;

      const isOwner = ticket.employeeId === user?.uid;
      const isResolved = ticket.status === 'Resolved';

      if ((isOwner && isResolved) || isAdminOrHR) {
          deleteDocumentNonBlocking(doc(firestore, 'issue_reports', ticketId));
          toast({ title: "Ticket Record Deleted" });
          setSelectedTicket(null);
      } else {
          toast({ variant: 'destructive', title: 'Action Denied', description: 'Tickets can only be deleted once verified as Resolved.' });
      }
  };

  return (
    <>
      <PageHeader title="Support Desk" description="Log hardware or facility tickets for rapid resolution.">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg h-11"><PlusCircle className="mr-2 size-4" /> Open New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase">Technical Support Desk</DialogTitle>
                <DialogDescription>Submit a maintenance or hardware request.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Ticket Subject</Label>
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Screen flickers periodically" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Category</Label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setNewCategory(cat)} className={cn("px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all", newCategory === cat ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50")}>{cat}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Contextual Description</Label>
                        <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Provide specific details of the issue..." className="rounded-xl min-h-[120px]" />
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={handleCreateTicket} className="rounded-full">Dispatch Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      
      <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">Ticket</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center">Scanning dispatch log...</TableCell></TableRow>
              ) : tickets?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-bold">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] rounded-full">{t.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full text-[10px] font-black", t.status === 'Open' ? 'text-red-600 border-red-200' : t.status === 'In Progress' ? 'text-yellow-600 border-yellow-200' : 'text-green-600 border-green-200')}>
                        {t.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedTicket(t)}><Ticket className="mr-2 size-4"/> View Ticket</DropdownMenuItem>
                        
                        {isAdminOrHR ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black uppercase">Management Controls</DropdownMenuLabel>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><Activity className="mr-2 size-4" /> Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Open')}>Open</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'In Progress')}>In Progress</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Resolved')}>Resolved</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </>
                        ) : (
                            <DropdownMenuItem className="opacity-40 grayscale pointer-events-none text-[9px] font-black uppercase tracking-widest">
                                <Lock className="mr-2 size-3"/> HR Managed Sector
                            </DropdownMenuItem>
                        )}

                        {(isAdminOrHR || (t.employeeId === user?.uid && t.status === 'Resolved')) && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 size-4" /> Purge Record</DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Purge Support Ticket?</AlertDialogTitle>
                                        <AlertDialogDescription>Resolution has been verified. This will permanently remove the ticket from the tactical log.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTicket(t.id)} className="bg-red-600 text-white rounded-full font-bold uppercase text-[10px]">Confirm Purge</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </div>

      <Sheet open={!!selectedTicket} onOpenChange={o => !o && setSelectedTicket(null)}>
        <SheetContent className="rounded-l-3xl border-none shadow-2xl flex flex-col sm:max-w-md p-0">
            <SheetHeader className="p-8 pb-6 border-b shrink-0">
                <SheetTitle className="text-xl font-black uppercase tracking-tighter">Support Ticket Details</SheetTitle>
                <SheetDescription>Reference ID: {selectedTicket?.id.slice(0,8)}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-6 pb-20">
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Subject</p><p className="font-bold">{selectedTicket?.title}</p></div>
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Classification</p><p className="font-bold">{selectedTicket?.category}</p></div>
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Status</p>
                      <Badge variant="outline" className={cn("rounded-full text-[10px] font-black", selectedTicket?.status === 'Open' ? 'text-red-600 border-red-200' : selectedTicket?.status === 'In Progress' ? 'text-yellow-600 border-yellow-200' : 'text-green-600 border-green-200')}>
                          {selectedTicket?.status.toUpperCase()}
                      </Badge>
                  </div>
                  
                  {selectedTicket?.resolvedByName && (
                      <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-green-600 text-white"><ShieldCheck className="size-4" /></div>
                          <div>
                              <p className="text-[9px] font-black uppercase text-green-700">Resolution Authenticated By</p>
                              <p className="text-sm font-bold text-green-900">{selectedTicket.resolvedByName}</p>
                          </div>
                      </div>
                  )}

                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Description</p><p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">{selectedTicket?.description}</p></div>
                  
                  <Separator />
                  
                  <div className="space-y-1">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Submitted By</p>
                      <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">{selectedTicket?.submittedBy[0]}</div>
                          <p className="text-sm font-bold">{selectedTicket?.submittedBy}</p>
                      </div>
                  </div>
              </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
