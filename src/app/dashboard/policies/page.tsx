
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
import { policyData } from "@/lib/data";
import { cn } from "@/lib/utils";
import React from "react";
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
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

export default function PoliciesPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  // In a real app, this would be a server action
  const handleAcknowledge = (id: string) => {
    alert(`Acknowledged policy ${id}`);
  };

  return (
    <>
      <PageHeader
        title="Company Policies"
        description="Please review and acknowledge the following company policies."
      >
        {isAdmin && (
           <Dialog>
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
                  <Input id="title" placeholder="e.g., Employee Handbook" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="version" className="text-right">
                    Version
                  </Label>
                  <Input id="version" placeholder="e.g., v1.0" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="content" className="text-right pt-2">
                    Content
                  </Label>
                  <Textarea id="content" placeholder="Enter the full policy text here..." className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Save Policy</Button>
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
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policyData.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell className="font-medium">{policy.title}</TableCell>
                <TableCell>{policy.version}</TableCell>
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
      </div>
    </>
  );
}
