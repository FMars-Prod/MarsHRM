
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Megaphone, FileText } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import Link from "next/link";
import { Button } from "../ui/button";

type Announcement = {
  title: string;
  content: string;
  publishDate: any;
};

export function AnnouncementsWidget() {
  const firestore = useFirestore();
  const announcementsQuery = useMemoFirebase(
    () => query(collection(firestore, "announcements"), orderBy("publishDate", "desc"), limit(3)),
    [firestore]
  );
  const { data: announcements, isLoading } = useCollection<Announcement>(announcementsQuery);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp.toDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  return (
    <Card className="h-full flex flex-col animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '400ms' }}>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Megaphone className="size-5" />
          Announcements
        </CardTitle>
        <CardDescription>
          The latest company news and updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col space-y-1.5">
                <div className="h-5 w-3/4 rounded-md bg-muted animate-pulse" />
                <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" />
                <div className="h-3 w-1/4 rounded-md bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : announcements && announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((item) => (
              <div key={item.id} className="flex flex-col transition-all duration-300 hover:translate-x-1">
                <span className="font-semibold text-sm">{item.title}</span>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                <span className="text-[10px] text-muted-foreground pt-1">{formatDate(item.publishDate)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
            <FileText className="size-8 mb-2 opacity-50" />
            <p className="text-sm">No announcements yet.</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full bg-white/50" asChild>
          <Link href="/dashboard/announcements">View All</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
