
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
import { Badge } from "@/components/ui/badge";
import { Check, BookOpen, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, query, orderBy } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";

type Policy = {
  title: string;
  content: string;
  effectiveDate: any;
  authorId: string;
};

type PolicyWithStatus = WithId<Policy> & { status: "Acknowledged" | "Pending Acknowledgment" };

export default function PoliciesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const policiesQuery = useMemoFirebase(
    () => query(collection(firestore, "policies"), orderBy("effectiveDate", "desc")),
    [firestore]
  );
  const { data: policies, isLoading: isLoadingPolicies } = useCollection<Policy>(policiesQuery);

  const acknowledgmentsQuery = useMemoFirebase(
    () => user ? collection(firestore, `users/${user.uid}/policy_acknowledgments`) : null,
    [user, firestore]
  );
  const { data: acknowledgments, isLoading: isLoadingAcks } = useCollection(acknowledgmentsQuery);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');

  const handleAcknowledge = (policyId: string) => {
    if (!user) return;
    const ackRef = doc(firestore, `users/${user.uid}/policy_acknowledgments`, policyId);
    setDocumentNonBlocking(ackRef, { 
        policyId,
        acknowledgmentDate: serverTimestamp() 
    }, { merge: true });
    toast({ title: "Policy Acknowledged" });
  };

  const handleCreatePolicy = () => {
    if (!newTitle || !newContent || !user) {
      toast({ variant: "destructive", title: "Missing fields" });
      return;
    }
    const policyPayload = {
      title: newTitle,
      content: newContent,
      effectiveDate: serverTimestamp(),
      authorId: user.uid,
    };
    addDocumentNonBlocking(collection(firestore, 'policies'), policyPayload);
    toast({ title: "Policy Created", description: "The new policy is now available." });
    setIsCreateDialogOpen(false);
    setNewTitle('');
    setNewContent('');
  }

  const acknowledgedPolicyIds = React.useMemo(() => {
    if (!acknowledgments) return new Set<string>();
    return new Set(acknowledgments.map(ack => ack.id));
  }, [acknowledgments]);

  const allPolicies: PolicyWithStatus[] = (policies || []).map(p => ({
    ...p,
    status: acknowledgedPolicyIds.has(p.id) ? 'Acknowledged' : 'Pending Acknowledgment'
  }));

  const isLoading = isLoadingPolicies || isLoadingAcks;

  return (
    <>
      <PageHeader
        title="Company Policies"
        description="Please review and acknowledge the following company policies."
      >
        {isAdmin && (
           <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2" />
                Create Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Policy</DialogTitle>
                <DialogDescription>
                  Enter the details for the new policy document.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Title
                  </Label>
                  <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Employee Handbook" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="content" className="text-right pt-2">
                    Content
                  </Label>
                  <Textarea id="content" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Enter the full policy text here..." className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreatePolicy}>Save Policy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Title</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading policies...</TableCell></TableRow>
            ) : allPolicies.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell className="font-medium">{policy.title}</TableCell>
                <TableCell>{policy.effectiveDate ? new Date(policy.effectiveDate.toDate()).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant="outline"
                    className={cn(
                        policy.status === 'Acknowledged' && 'text-green-600 border-green-600/50',
                        policy.status === 'Pending Acknowledgment' && 'text-yellow-600 border-yellow-600/50'
                    )}
                  >{policy.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {policy.status === 'Pending Acknowledgment' ? (
                    <Button onClick={() => handleAcknowledge(policy.id)}>
                      <Check className="mr-2" />
                      Read & Acknowledge
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <BookOpen className="mr-2" />
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && allPolicies.length === 0 && (
            <div className="text-center p-10 text-muted-foreground">No policies found.</div>
        )}
      </div>
    </>
  );
}
