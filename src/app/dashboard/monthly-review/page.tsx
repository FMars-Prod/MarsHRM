'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Target, CheckCircle2, ShieldCheck, Brain, TrendingUp, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

const RATINGS = [
    { id: 'Excellent', label: 'EXCELLENT', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', desc: 'Exceeded all mission objectives and tactical goals.' },
    { id: 'Good', label: 'GOOD', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', desc: 'Consistent performance with targets achieved.' },
    { id: 'Improving', label: 'IMPROVING', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', desc: 'Positive growth detected, trending towards objectives.' },
    { id: 'In Review', label: 'IN REVIEW', color: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50', desc: 'Current performance levels are being audited.' },
    { id: 'Poor', label: 'POOR', color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', desc: 'Underperformance detected. Urgent intervention required.' },
];

export default function MonthlyReviewPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedRating, setSelectedRating] = React.useState<string | null>(null);
    const [reflection, setReflection] = React.useState("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const userDocRef = React.useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData, isLoading } = useDoc<any>(userDocRef);

    const handleSubmitReview = async () => {
        if (!selectedRating || !userDocRef) {
            toast({ variant: 'destructive', title: "Audit Error", description: "Please select a performance tier." });
            return;
        }

        setIsSubmitting(true);
        try {
            updateDocumentNonBlocking(userDocRef, {
                performanceRating: selectedRating,
                lastReviewDate: serverTimestamp(),
                performanceNotes: reflection.trim() || null
            });
            
            toast({ title: "Performance Stamped", description: "Audit record updated successfully." });
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err) {
            toast({ variant: 'destructive', title: "Sync Failed" });
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Scanning Profile...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <PageHeader title="Mission Audit" description={`Performance self-assessment portal for ${format(new Date(), 'MMMM yyyy')}.`} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white overflow-hidden">
                        <CardHeader className="bg-muted/5 border-b p-8 text-left">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                                <TrendingUp className="size-5" /> Performance Tier
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Select your tactical performance level</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid gap-3">
                                {RATINGS.map(rating => (
                                    <button 
                                        key={rating.id}
                                        onClick={() => setSelectedRating(rating.id)}
                                        className={cn(
                                            "flex items-center justify-between p-5 transition-all text-left group rounded-none border-2",
                                            selectedRating === rating.id 
                                                ? cn("border-primary shadow-lg", rating.bg) 
                                                : "border-transparent bg-muted/20 hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={cn("size-10 rounded-none flex items-center justify-center text-white shadow-sm", rating.color)}>
                                                {selectedRating === rating.id ? <CheckCircle2 className="size-5" /> : <Target className="size-5" />}
                                            </div>
                                            <div>
                                                <p className={cn("font-black text-sm uppercase tracking-tight", selectedRating === rating.id ? rating.text : "text-slate-600")}>{rating.label}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{rating.desc}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("size-4 transition-all", selectedRating === rating.id ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-20")} />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none ring-1 ring-border/50 shadow-xl rounded-none bg-white overflow-hidden">
                        <CardHeader className="bg-muted/5 border-b p-8 text-left">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                                <Brain className="size-5" /> Mission Reflection
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Summary of achievements and bottlenecks</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Self-Review Log</Label>
                                <Textarea 
                                    value={reflection} 
                                    onChange={e => setReflection(e.target.value)}
                                    placeholder="Detail your performance context for this month..." 
                                    className="rounded-none min-h-[160px] bg-muted/5 border-none ring-1 ring-border focus-visible:ring-primary"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-none bg-slate-900 text-white p-8 space-y-6 overflow-hidden relative group text-left">
                        <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <ShieldCheck className="size-48" />
                        </div>
                        <div className="relative z-10 space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Official Identity</p>
                                <h3 className="text-2xl font-black tracking-tighter uppercase">{userData?.firstName} {userData?.lastName}</h3>
                                <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">{userData?.jobTitle}</p>
                            </div>
                            <Separator className="bg-white/10" />
                            <div className="space-y-4 pt-4">
                                <p className="text-xs font-medium opacity-70 leading-relaxed uppercase">By finalizing this audit, you certify that the self-assessment accurately reflects your professional output during this mission cycle.</p>
                                <Button 
                                    onClick={handleSubmitReview} 
                                    disabled={isSubmitting || !selectedRating}
                                    className="w-full h-14 rounded-none bg-primary text-white font-black uppercase text-xs tracking-widest shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2"/> : <CheckCircle2 className="size-4 mr-2" />}
                                    Lock Final Audit
                                </Button>
                                <Button variant="ghost" className="w-full text-[10px] font-bold text-white/40 uppercase hover:text-white" onClick={() => router.back()}>Cancel Protocol</Button>
                            </div>
                        </div>
                    </Card>

                    <div className="p-6 bg-primary/5 border-2 border-dashed border-primary/20 rounded-none space-y-4">
                        <div className="flex items-center gap-3 text-primary">
                            <CheckCircle2 className="size-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Post-Sync Protocol</h4>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed tracking-tight">
                            Ensure you have attended the sync meeting before locking this assessment. Your input is critical for the organizational performance audit.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
