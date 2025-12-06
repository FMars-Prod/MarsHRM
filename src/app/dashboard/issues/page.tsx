
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { issueData } from "@/lib/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import React from "react";
import { Separator } from "@/components/ui/separator";

type Issue = typeof issueData[0];

export default function IssuesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';

  return (
    <>
      <PageHeader
        title="Issue Reporter"
        description="Log non-emergency issues or view the status of existing ones."
      >
        <Dialog>
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
                <Input id="title" placeholder="e.g., Office AC not working" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea id="description" placeholder="Provide more details..." className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Submit Issue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <Sheet>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issueData.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-medium">{issue.title}</TableCell>
                  <TableCell>{issue.submittedBy}</TableCell>
                  <TableCell>{issue.assignedTo}</TableCell>
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
                        <SheetTrigger asChild>
                          <DropdownMenuItem onClick={() => setSelectedIssue(issue)}>View Details</DropdownMenuItem>
                        </SheetTrigger>
                        {userRole !== 'Member' && (
                          <>
                            <DropdownMenuItem>Update Status</DropdownMenuItem>
                            <DropdownMenuItem>Assign</DropdownMenuItem>
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
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
                    <p className="font-semibold">{selectedIssue.submittedBy}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                    <p className="font-semibold">{selectedIssue.assignedTo}</p>
                </div>
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
                    <p className="text-sm">{/* A full description would go here */}</p>
                </div>
            </div>
            </SheetContent>
        )}
      </Sheet>
    </>
  );
}
