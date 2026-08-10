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
import { PlusCircle, MoreHorizontal, Trash2, Ticket, CheckCircle2, Clock, Activity, ShieldCheck, UserCheck, Lock, X } from "lucide-react";
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

const CATEGORIES = ["Technical Support", "Facility Issue", "Furniture Issue", "Others"];

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
    toast({ title: "Ticket Created" });
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
    toast({ title: `Status updated to ${newStatus}` });
  };

  const handleDeleteTicket = (ticketId: string) => {
      const ticket = tickets?.find(t => t.id === ticketId);
      if (!ticket) return;

      const isOwner = ticket.employeeId === user?.uid;
      const isResolved = ticket.status === 'Resolved';

      if ((isOwner && isResolved) || isAdminOrHR) {
          deleteDocumentNonBlocking(doc(firestore, 'issue_reports', ticketId));
          toast({ title: "Ticket deleted" });
          setSelectedTicket(null);
      } else {
          toast({ variant: 'destructive', title: 'Action Denied', description: 'Tickets can only be deleted once Resolved.' });
      }
  };

  return (
    <>
      <PageHeader title="Support Centre" description="Need help with hardware or the office? Submit a ticket below.">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none shadow-lg h-11"><PlusCircle className="mr-2 size-4" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-none">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">Submit Support Ticket</DialogTitle>
                <DialogDescription>Let us know how we can help you today.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="grid gap-6 py-4">
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Title</Label>
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Screen not working" className="rounded-none" />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Category</Label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setNewCategory(cat)} className={cn("px-3 py-1.5 rounded-none text-[10px] font-bold border transition-all", newCategory === cat ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50")}>{cat}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Description</Label>
                        <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Explain the issue in detail..." className="rounded-none min-h-[120px]" />
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-none">Cancel</Button>
              <Button onClick={handleCreateTicket} className="rounded-none">Submit Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      
      <div className="border rounded-none overflow-hidden shadow-sm bg-white/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase py-4">Ticket</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase py-4 px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center">Loading tickets...</TableCell></TableRow>
              ) : tickets?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center opacity-40 italic">No tickets found.</TableCell></TableRow>
              ) : tickets?.map((t) => (
                <TableRow key={t.id} className="border-border/50">
                  <TableCell className="font-bold">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] rounded-none">{t.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-none text-[10px] font-black", t.status === 'Open' ? 'text-red-600 border-red-200' : t.status === 'In Progress' ? 'text-yellow-600 border-yellow-200' : 'text-green-600 border-green-200')}>
                        {t.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-none"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => setSelectedTicket(t)} className="rounded-none"><Ticket className="mr-2 size-4"/> View Ticket</DropdownMenuItem>
                        
                        {isAdminOrHR ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black uppercase px-2 py-1">Admin Controls</DropdownMenuLabel>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="rounded-none"><Activity className="mr-2 size-4" /> Set Status</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="rounded-none">
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Open')} className="rounded-none">Open</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'In Progress')} className="rounded-none">In Progress</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Resolved')} className="rounded-none">Resolved</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </>
                        ) : (
                            <DropdownMenuItem className="opacity-40 grayscale pointer-events-none text-[9px] font-black uppercase tracking-widest rounded-none">
                                <Lock className="mr-2 size-3"/> Admin Managed
                            </DropdownMenuItem>
                        )}

                        {(isAdminOrHR || (t.employeeId === user?.uid && t.status === 'Resolved')) && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive rounded-none"><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Delete Ticket?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently remove the ticket record.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTicket(t.id)} className="bg-red-600 text-white rounded-none font-bold uppercase text-[10px]">Delete</AlertDialogAction>
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
        <SheetContent className="rounded-none border-none shadow-2xl flex flex-col sm:max-w-md p-0">
            <SheetHeader className="p-8 pb-6 border-b shrink-0 text-left">
                <SheetTitle className="text-xl font-black uppercase tracking-tighter">Ticket Details</SheetTitle>
                <SheetDescription>Ref: {selectedTicket?.id.slice(0,8)}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-6 pb-20 text-left">
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Subject</p><p className="font-bold">{selectedTicket?.title}</p></div>
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Category</p><p className="font-bold">{selectedTicket?.category}</p></div>
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Status</p>
                      <Badge variant="outline" className={cn("rounded-none text-[10px] font-black", selectedTicket?.status === 'Open' ? 'text-red-600 border-red-200' : selectedTicket?.status === 'In Progress' ? 'text-yellow-600 border-yellow-200' : 'text-green-600 border-green-200')}>
                          {selectedTicket?.status.toUpperCase()}
                      </Badge>
                  </div>
                  
                  {selectedTicket?.resolvedByName && (
                      <div className="p-4 bg-green-50 rounded-none border border-green-100 flex items-center gap-3">
                          <div className="p-2 rounded-none bg-green-600 text-white"><ShieldCheck className="size-4" /></div>
                          <div className="text-left">
                              <p className="text-[9px] font-black uppercase text-green-700">Resolved By</p>
                              <p className="text-sm font-bold text-green-900">{selectedTicket.resolvedByName}</p>
                          </div>
                      </div>
                  )}

                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Description</p><p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">{selectedTicket?.description}</p></div>
                  
                  <Separator />
                  
                  <div className="space-y-1">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Submitted By</p>
                      <div className="flex items-center gap-2">
                          <div className="size-8 rounded-none bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">{selectedTicket?.submittedBy[0]}</div>
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
