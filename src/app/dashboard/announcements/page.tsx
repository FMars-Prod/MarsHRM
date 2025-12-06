
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
import { Check, BookOpen, Eye } from "lucide-react";
import { announcements } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Announcement = (typeof announcements)[0] & { status: "Read" | "Unread" };

export default function AnnouncementsPage() {
  const [announcementStatus, setAnnouncementStatus] = React.useState<
    Record<string, "Read" | "Unread">
  >({});
  const [selectedAnnouncement, setSelectedAnnouncement] =
    React.useState<Announcement | null>(null);

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
      <Sheet>
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
                  <TableCell className="font-medium">
                    {announcement.title}
                  </TableCell>
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
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAnnouncement(announcement);
                          if (announcement.status === "Unread") {
                            handleMarkAsRead(announcement.id);
                          }
                        }}
                      >
                        <Eye className="mr-2" />
                        {announcement.status === "Unread"
                          ? "View & Acknowledge"
                          : "View"}
                      </Button>
                    </SheetTrigger>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {selectedAnnouncement && (
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedAnnouncement.title}</SheetTitle>
              <SheetDescription>
                Published on {selectedAnnouncement.date}
              </SheetDescription>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </p>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
