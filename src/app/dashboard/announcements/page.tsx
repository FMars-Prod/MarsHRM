
"use client";

import * as React from "react";
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
import { announcements } from "@/lib/data";
import { cn } from "@/lib/utils";

type Announcement = (typeof announcements)[0] & { status: "Read" | "Unread" };

export default function AnnouncementsPage() {
  const [announcementStatus, setAnnouncementStatus] = React.useState<
    Record<string, "Read" | "Unread">
  >({});

  const handleMarkAsRead = (id: string) => {
    setAnnouncementStatus((prev) => ({ ...prev, [id]: "Read" }));
  };

  const allAnnouncements: Announcement[] = announcements.map((ann) => ({
    ...ann,
    status: announcementStatus[ann.id] || "Unread",
  }));

  return (
    <>
      <PageHeader
        title="Company Announcements"
        description="Stay up-to-date with the latest company news and updates."
      />
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allAnnouncements.map((announcement) => (
              <TableRow key={announcement.id}>
                <TableCell className="font-medium">{announcement.title}</TableCell>
                <TableCell>{announcement.date}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      announcement.status === "Read" &&
                        "text-green-600 border-green-600/50",
                      announcement.status === "Unread" &&
                        "text-yellow-600 border-yellow-600/50"
                    )}
                  >
                    {announcement.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {announcement.status === "Unread" ? (
                    <Button onClick={() => handleMarkAsRead(announcement.id)}>
                      <Check className="mr-2" />
                      Mark as Read
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <BookOpen className="mr-2" />
                      Viewed
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
