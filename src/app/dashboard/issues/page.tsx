"use client";

import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, orderBy, query } from "firebase/firestore";
import React from "react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";

type IssueStatus = "Open" | "In Progress" | "Resolved";

type Issue = {
  title: string;
  description: string;
  status: IssueStatus;
  employeeId: string;
  submittedBy: string;
  submissionDate: any;
  issueType: string;
};

type IssueWithId = WithId<Issue>;

export default function IssuesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedIssue, setSelectedIssue] = React.useState<IssueWithId | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const issuesQuery = useMemoFirebase(
      () => query(collection(firestore, "issue_reports"), orderBy("submissionDate", "desc")),
      [firestore]
  );
  const { data: issues, isLoading } = useCollection<Issue>(issuesQuery);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newDescription, setNewDescription] = React.useState('');


  const handleStatusChange = (issueId: string, newStatus: IssueStatus) => {
    const issueRef = doc(firestore, 'issue_reports', issueId);
    updateDocumentNonBlocking(issueRef, { status: newStatus });
  };

  const handleCreateIssue = () => {
    if (!newTitle || !newDescription || !user || !userData) {
        toast({ variant: "destructive", title: "Missing fields" });
        return;
    }
    const issuePayload = {
        title: newTitle,
        description: newDescription,
        status: "Open" as IssueStatus,
        employeeId: user.uid,
        submittedBy: `${(userData as any).firstName} ${(userData as any).lastName}`,
        submissionDate: serverTimestamp(),
        issueType: "General",
    }
    addDocumentNonBlocking(collection(firestore, 'issue_reports'), issuePayload);
    toast({ title: "Issue Submitted" });
    setIsCreateDialogOpen(false);
    setNewTitle('');
    setNewDescription('');
  }

  const handleDeleteIssue = (issueId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'issue_reports', issueId));
    toast({ title: "Issue Deleted", description: "The issue has been removed." });
  };

  const issueData = isAdmin ? issues : issues?.filter(issue => issue.employeeId === user?.uid);

  return (
    <>
      <PageHeader
        title="Issue Reporter"
        description="Log non-emergency issues or view the status of existing ones."
        className="animate-fade-in-up"
      >
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2" />
              Report New Issue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report a New Issue</DialogTitle>
              <DialogDescription>
                Describe the issue you're encountering.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Office AC not working" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea id="description" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Provide more details..." className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateIssue}>Submit Issue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <Sheet onOpenChange={(isOpen) => !isOpen && setSelectedIssue(null)}>
        <div className="border rounded-lg overflow-x-auto animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '100ms' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {isAdmin && <TableHead>Submitted By</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading issues...</TableCell></TableRow>
              ) : (issueData || []).map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-medium">{issue.title}</TableCell>
                  {isAdmin && <TableCell>{issue.submittedBy}</TableCell>}
                  <TableCell>
                    <Badge variant="outline"
                      className={cn(
                          issue.status === 'Open' && 'text-red-600 border-red-600/50',
                          issue.status === 'In Progress' && 'text-yellow-600 border-yellow-600/50',
                          issue.status === 'Resolved' && 'text-green-600 border-green-600/50'
                      )}
                    >{issue.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <SheetTrigger asChild>
                          <DropdownMenuItem onClick={() => setSelectedIssue(issue)}>View Details</DropdownMenuItem>
                        </SheetTrigger>
                        {isAdmin && (
                          <>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Update Status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => handleStatusChange(issue.id, 'Open')}>Open</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(issue.id, 'In Progress')}>In Progress</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(issue.id, 'Resolved')}>Resolved</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                             <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this issue report.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteIssue(issue.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {selectedIssue && (
            <SheetContent>
            <SheetHeader>
                <SheetTitle>Issue Details</SheetTitle>
                <SheetDescription>
                    Review the details of the reported issue.
                </SheetDescription>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="space-y-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Title</p>
                    <p className="font-semibold">{selectedIssue.title}</p>
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
                      <p className="font-semibold">{selectedIssue.submittedBy}</p>
                  </div>
                )}
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="outline"
                      className={cn(
                          selectedIssue.status === 'Open' && 'text-red-600 border-red-600/50',
                          selectedIssue.status === 'In Progress' && 'text-yellow-600 border-yellow-600/50',
                          selectedIssue.status === 'Resolved' && 'text-green-600 border-green-600/50'
                      )}
                    >{selectedIssue.status}</Badge>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedIssue.description}</p>
                </div>
            </div>
            </SheetContent>
        )}
      </Sheet>
    </>
  );
}
