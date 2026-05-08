
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { Plus, Trash2, CalendarDays, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Holiday = { date: any; title: string; description: string; };

export default function HolidaysPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [newH, setNewH] = React.useState({ date: '', title: '', description: '' });

    const holidaysQuery = useMemoFirebase(() => query(collection(firestore, 'holidays'), orderBy('date', 'asc')), [firestore]);
    const { data: holidays, isLoading } = useCollection<Holiday>(holidaysQuery);

    const handleAdd = () => {
        if (!newH.date || !newH.title) return;
        addDocumentNonBlocking(collection(firestore, 'holidays'), {
            date: new Date(newH.date),
            title: newH.title,
            description: newH.description
        });
        setIsAddOpen(false);
        setNewH({ date: '', title: '', description: '' });
        toast({ title: 'Holiday Registered' });
    };

    const handleCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            const lines = content.split('\n').slice(1);
            lines.forEach(l => {
                const [date, title, desc] = l.split(',');
                if (date && title) {
                    addDocumentNonBlocking(collection(firestore, 'holidays'), {
                        date: new Date(date.trim()),
                        title: title.trim(),
                        description: desc?.trim() || ''
                    });
                }
            });
            toast({ title: 'Bulk Import Complete' });
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Holiday Registry" description="Declare company-wide holidays and priority leave events.">
                <div className="flex gap-2">
                    <Input type="file" className="hidden" id="csv-h" accept=".csv" onChange={handleCsv} />
                    <Button variant="outline" className="rounded-full" onClick={() => document.getElementById('csv-h')?.click()}>
                        <Upload className="size-4 mr-2" /> Import CSV
                    </Button>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild><Button className="rounded-full"><Plus className="size-4 mr-2"/> Declare Holiday</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Register Priority Holiday</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2"><Label>Date</Label><Input type="date" value={newH.date} onChange={e => setNewH({...newH, date: e.target.value})} /></div>
                                <div className="space-y-2"><Label>Title</Label><Input value={newH.title} onChange={e => setNewH({...newH, title: e.target.value})} /></div>
                                <div className="space-y-2"><Label>Description</Label><Input value={newH.description} onChange={e => setNewH({...newH, description: e.target.value})} /></div>
                            </div>
                            <Button onClick={handleAdd} className="w-full">Register</Button>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            <Card className="border-none ring-1 ring-border/50 shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Event</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={4} className="h-32 text-center">Syncing calendar...</TableCell></TableRow> : holidays?.map(h => (
                                <TableRow key={h.id}>
                                    <TableCell className="font-bold">{h.date && isValid(h.date.toDate()) ? format(h.date.toDate(), 'PPP') : '...'}</TableCell>
                                    <TableCell className="font-bold">{h.title}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{h.description}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'holidays', h.id))} className="text-destructive"><Trash2 className="size-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
