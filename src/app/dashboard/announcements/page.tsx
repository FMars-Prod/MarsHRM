
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
import { Eye, PlusCircle } from "lucide-react";
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
import { useUser, useFirestore, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, serverTimestamp, orderBy, query } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";

type Announcement = { 
  title: string;
  content: string;
  publishDate: any; 
  authorId: string;
};

type AnnouncementWithStatus = WithId<Announcement> & { status: "Read" | "Unread" };

export default function AnnouncementsPage() {
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

  const announcementsQuery = useMemoFirebase(
    () => query(collection(firestore, "announcements"), orderBy("publishDate", "desc")),
    [firestore]
  );
  const { data: announcements, isLoading } = useCollection<Announcement>(announcementsQuery);

  const [announcementStatus, setAnnouncementStatus] = React.useState<
    Record<string, "Read" | "Unread">
  >({});
  const [selectedAnnouncement, setSelectedAnnouncement] =
    React.useState<AnnouncementWithStatus | null>(null);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");

  const handleMarkAsRead = (id: string) => {
    setAnnouncementStatus((prev) => ({ ...prev, [id]: "Read" }));
  };

  const handleCreateAnnouncement = () => {
    if (!newTitle || !newContent || !user) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please provide a title and content for the announcement.",
      });
      return;
    }
    const newAnnouncement = {
      title: newTitle,
      content: newContent,
      publishDate: serverTimestamp(),
      authorId: user.uid
    };
    
    addDocumentNonBlocking(collection(firestore, 'announcements'), newAnnouncement);
    
    toast({
      title: "Announcement Published",
      description: "Your announcement is now live for all employees.",
    });
    setIsCreateDialogOpen(false);
    setNewTitle("");
    setNewContent("");
  };

  const allAnnouncements: AnnouncementWithStatus[] = (announcements || []).map((ann) => ({
    ...ann,
    status: announcementStatus[ann.id] || "Unread",
  }));

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <>
      <PageHeader
        title="Company Announcements"
        description="Stay up-to-date with the latest company news and updates."
      >
        {isAdmin && (
           <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Announcement</DialogTitle>
                <DialogDescription>
                  This will be visible to all employees.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g., Company Picnic!" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea id="content" placeholder="Enter the announcement details..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateAnnouncement}>Publish</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading announcements...
                  </TableCell>
                </TableRow>
              ) : allAnnouncements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No announcements found.
                  </TableCell>
                </TableRow>
              ) : (
                allAnnouncements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">
                      {announcement.title}
                    </TableCell>
                    <TableCell>{formatDate(announcement.publishDate)}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {selectedAnnouncement && (
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedAnnouncement.title}</SheetTitle>
              <SheetDescription>
                Published on {formatDate(selectedAnnouncement.publishDate)}
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

    