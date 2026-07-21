"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function EventsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/dashboard/announcements?tab=events");
    }, [router]);

    return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest">Relocating to Company Feed...</p>
        </div>
    );
}