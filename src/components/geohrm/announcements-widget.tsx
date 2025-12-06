"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { announcements } from "@/lib/data";

export function AnnouncementsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Megaphone className="size-5" />
          Announcements
        </CardTitle>
        <CardDescription>
          Stay up-to-date with the latest company news.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {announcements.map((item) => (
            <div key={item.id} className="flex flex-col">
              <span className="font-semibold">{item.title}</span>
              <p className="text-sm text-muted-foreground">{item.content}</p>
              <span className="text-xs text-muted-foreground pt-1">{item.date}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
