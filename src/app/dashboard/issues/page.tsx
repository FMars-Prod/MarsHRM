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
import { PlusCircle, MoreHorizontal, Trash2, Ticket, CheckCircle2, Clock, Activity, ShieldCheck, UserCheck, Lock, X, Eye } from "lucide-react";
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
    toast({ title: "Ticket Submitted" });
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
    toast({ title: `Status set to ${newStatus}` });
  };

  const handleDeleteTicket = (ticketId: string) => {
      const ticket = tickets?.find(t => t.id === ticketId);
      if (!ticket) return;

      const isOwner = ticket.employeeId === user?.uid;

      if (isOwner || isAdminOrHR) {
          deleteDocumentNonBlocking(doc(firestore, 'issue_reports', ticketId));
          toast({ title: isOwner ? "Ticket Cancelled" : "Ticket Deleted" });
          setSelectedTicket(null);
      } else {
          toast({ variant: 'destructive', title: 'Action Denied', description: 'Authorization required.' });
      }
  };

  return (
    <>
      <PageHeader title="Support Centre" description="Need assistance? Submit a ticket below.">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none shadow-lg h-11"><PlusCircle className="mr-2 size-4" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-none">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">Submit Ticket</DialogTitle>
                <DialogDescription>Let us know how we can assist you.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="grid gap-6 py-4">
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Subject</Label>
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's the issue?" className="rounded-none" />
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
                        <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Provide details..." className="rounded-none min-h-[120px]" />
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
                <TableHead className="text-[10px] font-black uppercase py-4 px-6">Ticket</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase py-4 px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse uppercase font-black text-xs opacity-20">Syncing...</TableCell></TableRow>
              ) : tickets?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-30">No tickets found.</TableCell></TableRow>
              ) : tickets?.map((t) => (
                <TableRow key={t.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                  <TableCell className="font-bold py-4 px-6 uppercase text-sm tracking-tight">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] rounded-none font-bold uppercase">{t.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-none text-[10px] font-black uppercase", t.status === 'Open' ? 'text-red-600 border-red-200 bg-red-50/50' : t.status === 'In Progress' ? 'text-yellow-600 border-yellow-200 bg-yellow-50/50' : 'text-green-600 border-green-200 bg-green-50/50')}>
                        {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none border-none shadow-2xl p-2 w-56 text-left">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 px-3 py-2">Mission Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setSelectedTicket(t)} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5">
                            <Eye className="size-4 text-primary"/> View Ticket
                        </DropdownMenuItem>
                        
                        {isAdminOrHR ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black uppercase px-3 py-2 opacity-60">Admin Controls</DropdownMenuLabel>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="rounded-none font-black text-xs uppercase gap-3 py-3 px-3">
                                        <Activity className="size-4 text-primary" /> Set Status
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="rounded-none border-none shadow-2xl p-2">
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Open')} className="rounded-none font-black text-xs uppercase py-3">Open</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'In Progress')} className="rounded-none font-black text-xs uppercase py-3">In Progress</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(t.id, 'Resolved')} className="rounded-none font-black text-xs uppercase py-3">Resolved</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </>
                        ) : (
                            <DropdownMenuItem className="opacity-40 grayscale pointer-events-none text-[9px] font-black uppercase tracking-widest px-3 py-3">
                                <Lock className="mr-2 size-3"/> Admin Managed
                            </DropdownMenuItem>
                        )}

                        {(isAdminOrHR || t.employeeId === user?.uid) && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive rounded-none font-black text-xs uppercase gap-3 py-3 px-3 hover:bg-red-50">
                                        <Trash2 className="size-4" /> 
                                        {t.employeeId === user?.uid ? "Cancel Ticket" : "Delete Ticket"}
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                    <AlertDialogHeader className="text-left">
                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">
                                            {t.employeeId === user?.uid ? "Cancel Ticket?" : "Delete Ticket?"}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">This action will permanently remove the record from the support registry.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-8 gap-3">
                                        <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Keep Record</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTicket(t.id)} className="bg-red-600 text-white rounded-none font-bold uppercase text-[10px] h-11 px-6 hover:bg-red-700 shadow-lg shadow-red-600/20">
                                            Confirm
                                        </AlertDialogAction>
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
        <SheetContent className="rounded-none border-none shadow-3xl flex flex-col sm:max-w-md p-0 overflow-hidden">
            <SheetHeader className="p-8 pb-6 border-b shrink-0 text-left bg-white shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-none text-[8px] font-black uppercase tracking-widest">{selectedTicket?.category}</Badge>
                </div>
                <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900">Ticket Details</SheetTitle>
                <SheetDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Ref: {selectedTicket?.id.slice(0,8).toUpperCase()}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 bg-muted/5">
              <div className="p-8 space-y-8 pb-20 text-left">
                  <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Subject</p><p className="font-black text-lg uppercase tracking-tight">{selectedTicket?.title}</p></div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</p>
                          <Badge variant="outline" className={cn("rounded-none text-[10px] font-black uppercase border-none px-3 h-6", selectedTicket?.status === 'Open' ? 'bg-red-50 text-red-700' : selectedTicket?.status === 'In Progress' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700')}>
                              {selectedTicket?.status}
                          </Badge>
                      </div>
                      <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</p><p className="font-bold text-sm">{selectedTicket?.submissionDate ? format(selectedTicket.submissionDate.toDate(), 'PP p') : '...'}</p></div>
                  </div>
                  
                  {selectedTicket?.resolvedByName && (
                      <div className="p-4 bg-emerald-50 rounded-none border border-emerald-100 flex items-center gap-4 shadow-sm">
                          <div className="p-2.5 rounded-none bg-emerald-600 text-white shadow-md"><ShieldCheck className="size-5" /></div>
                          <div className="text-left">
                              <p className="text-[9px] font-black uppercase text-emerald-700 tracking-[0.2em]">Resolved By</p>
                              <p className="text-sm font-black text-emerald-900 uppercase">{selectedTicket.resolvedByName}</p>
                          </div>
                      </div>
                  )}

                  <div className="space-y-2 p-6 bg-white ring-1 ring-border shadow-sm rounded-none border-l-4 border-primary">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</p>
                      <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">"{selectedTicket?.description}"</p>
                  </div>
                  
                  <Separator className="opacity-50" />
                  
                  <div className="space-y-3">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Requested By</p>
                      <div className="flex items-center gap-4 p-3 bg-white ring-1 ring-border rounded-none">
                          <div className="size-10 rounded-none bg-primary/10 flex items-center justify-center text-sm font-black text-primary border border-primary/20">{selectedTicket?.submittedBy?.[0]?.toUpperCase()}</div>
                          <div className="min-w-0">
                              <p className="text-sm font-black uppercase tracking-tight truncate">{selectedTicket?.submittedBy}</p>
                              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Fleet ID: {selectedTicket?.employeeId.slice(0,8).toUpperCase()}</p>
                          </div>
                      </div>
                  </div>
              </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
