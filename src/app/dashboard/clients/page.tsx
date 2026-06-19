
'use client';
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ClientsPage() {
    return (
        <div className="space-y-6">
            <PageHeader title="Client Management" description="Global registry of strategic business partnerships and accounts." />
            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm py-20 flex flex-col items-center justify-center text-center opacity-30">
                <Construction className="size-16 mb-4 text-primary" />
                <p className="font-black uppercase text-sm tracking-[0.3em]">Operational Readiness: 0%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-xs">Client module under construction. Check system updates for rollout schedule.</p>
            </Card>
        </div>
    );
}
