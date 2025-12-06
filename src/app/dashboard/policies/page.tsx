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
import { Check, BookOpen } from "lucide-react";
import { policyData } from "@/lib/data";
import { cn } from "@/lib/utils";

export default function PoliciesPage() {
  // In a real app, this would be a server action
  const handleAcknowledge = (id: string) => {
    alert(`Acknowledged policy ${id}`);
  };

  return (
    <>
      <PageHeader
        title="Company Policies"
        description="Please review and acknowledge the following company policies."
      />
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
