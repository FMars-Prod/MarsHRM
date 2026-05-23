'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, Timestamp } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, ListTodo, Clock, Calendar, User, AlertTriangle, Filter, Check, X, ShieldCheck, Eye, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

type Todo = {
    id: string;
    task: string;
    description?: string;
    completed: boolean;
    createdAt: any;
    completedAt?: any;
    priority: 'low' | 'medium' | 'high';
    assignedBy: string;
    assignedByName: string;
    assignedTo: string;
    dueDate?: any;
};

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
};

export default function TodoPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [viewFilter, setViewFilter] = React.useState<'active' | 'completed'>('active');
    const [selectedTodo, setSelectedTodo] = React.useState<Todo | null>(null);

    // Form States
    const [newTask, setNewTask] = React.useState('');
    const [newDesc, setNewDesc] = React.useState('');
    const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
    const [assignedTo, setAssignedTo] = React.useState<string>('self');
    const [dueDate, setDueDate] = React.useState<string>('');
    const [dueTime, setDueTime] = React.useState<string>('');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc<any>(userDocRef);
    const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<UserData>(usersQuery);

    const todosQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, `users/${user.uid}/todos`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: todos, isLoading } = useCollection<Todo>(todosQuery);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim() || !user || !currentUserData) return;

        const targetUserId = assignedTo === 'self' ? user.uid : assignedTo;
        const targetUser = allUsers?.find(u => u.id === targetUserId);
        const targetUserName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'Fleet Member';
        
        let dueTimestamp = null;
        if (dueDate) {
            const dateStr = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59`;
            dueTimestamp = Timestamp.fromDate(new Date(dateStr));
        }

        const todoPayload = {
            task: newTask.trim(),
            description: newDesc.trim(),
            completed: false,
            createdAt: serverTimestamp(),
            priority,
            assignedBy: user.uid,
            assignedByName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            assignedTo: targetUserId,
            dueDate: dueTimestamp,
        };

        addDocumentNonBlocking(collection(firestore, `users/${targetUserId}/todos`), todoPayload);

        // Reset
        setNewTask('');
        setNewDesc('');
        setDueDate('');
        setDueTime('');
        setIsAddOpen(false);
        toast({ title: "Objective Dispatched", description: assignedTo === 'self' ? "Added to your board." : `Assigned to ${targetUserName}.` });
    };

    const toggleComplete = (todo: Todo) => {
        if (!user) return;
        updateDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, todo.id), {
            completed: !todo.completed,
            completedAt: !todo.completed ? serverTimestamp() : null
        });
    };

    const deleteTask = (id: string) => {
        if (!user) return;
        deleteDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, id));
        toast({ title: "Objective Purged", description: "Record removed from board." });
    };

    const displayTodos = todos?.filter(t => viewFilter === 'completed' ? t.completed : !t.completed) || [];

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <PageHeader title="Mission Objectives" description="Tactical task board with priority-based sticky notes.">
                <div className="flex gap-2">
                    <div className="flex bg-muted/50 p-1 rounded-xl ring-1 ring-border/50">
                        <Button 
                            variant={viewFilter === 'active' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4"
                            onClick={() => setViewFilter('active')}
                        >
                            Active Sector
                        </Button>
                        <Button 
                            variant={viewFilter === 'completed' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4"
                            onClick={() => setViewFilter('completed')}
                        >
                            Archive
                        </Button>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full h-11 px-6 shadow-lg shadow-primary/20">
                                <Plus className="size-4 mr-2" /> Dispatch Mission
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">New Mission Objective</DialogTitle>
                                <DialogDescription>Register a new task on the tactical board.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddTask} className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Objective Title</Label>
                                    <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g., Finalize Q4 Security Audit" className="rounded-xl h-11" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Contextual Details</Label>
                                    <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Provide additional information..." className="rounded-xl min-h-[80px]" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary">Priority Tier</Label>
                                        <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                            <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low Priority</SelectItem>
                                                <SelectItem value="medium">Standard</SelectItem>
                                                <SelectItem value="high">Urgent / High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary">Assign To</Label>
                                        <Select value={assignedTo} onValueChange={setAssignedTo}>
                                            <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="self">Myself</SelectItem>
                                                {isAdmin && allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                                    <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary">Due Date</Label>
                                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary">Target Time</Label>
                                        <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="rounded-xl h-11" />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Dispatch</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            {isLoading ? (
                <div className="py-32 text-center animate-pulse">
                    <Clock className="size-12 mx-auto text-primary/20 mb-4 animate-spin" />
                    <p className="font-black uppercase text-[10px] text-primary/60 tracking-[0.3em]">Syncing Tactical Grid...</p>
                </div>
            ) : displayTodos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {displayTodos.map(todo => (
                        <StickyNote 
                            key={todo.id} 
                            todo={todo} 
                            currentUserId={user?.uid} 
                            onToggle={() => toggleComplete(todo)} 
                            onDelete={() => deleteTask(todo.id)}
                            onOpenDetails={() => setSelectedTodo(todo)}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-40 text-center rounded-[3rem] border-2 border-dashed border-muted/30 flex flex-col items-center justify-center gap-4 opacity-40">
                    <ShieldCheck className="size-16 text-primary/20" />
                    <p className="font-black uppercase text-xs tracking-[0.2em] text-muted-foreground">
                        {viewFilter === 'active' ? "Tactical Grid Clear - No Active Missions" : "Archive Sector Empty"}
                    </p>
                </div>
            )}

            <Dialog open={!!selectedTodo} onOpenChange={o => !o && setSelectedTodo(null)}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                             {selectedTodo && (
                                <Badge className={cn(
                                    "rounded-full text-[8px] font-black uppercase tracking-widest border-none",
                                    selectedTodo.priority === 'high' ? "bg-red-100 text-red-700" :
                                    selectedTodo.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                                    "bg-blue-100 text-blue-700"
                                )}>
                                    {selectedTodo.priority} Priority
                                </Badge>
                             )}
                             {selectedTodo?.completed && (
                                <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[8px] font-black uppercase">Mission Success</Badge>
                             )}
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">{selectedTodo?.task}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-6">
                        {selectedTodo?.description && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Details</Label>
                                <p className="text-sm font-medium leading-relaxed">{selectedTodo.description}</p>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Registered</Label>
                                <p className="text-xs font-bold">{selectedTodo?.createdAt ? format(selectedTodo.createdAt.toDate(), 'PP p') : 'N/A'}</p>
                            </div>
                            {selectedTodo?.dueDate && (
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Target Deadline</Label>
                                    <p className="text-xs font-bold text-primary">{format(selectedTodo.dueDate.toDate(), 'PP p')}</p>
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Assigned By</Label>
                                <div className="flex items-center gap-2">
                                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{selectedTodo?.assignedByName[0]}</div>
                                    <p className="text-xs font-bold">{selectedTodo?.assignedByName}</p>
                                </div>
                            </div>
                            {selectedTodo?.completedAt && (
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-green-600">Completed At</Label>
                                    <p className="text-xs font-black text-green-700">{format(selectedTodo.completedAt.toDate(), 'PP p')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" className="w-full rounded-full h-12 font-black uppercase tracking-widest" onClick={() => setSelectedTodo(null)}>Close Briefing</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StickyNote({ todo, currentUserId, onToggle, onDelete, onOpenDetails }: { todo: Todo, currentUserId?: string, onToggle: () => void, onDelete: () => void, onOpenDetails: () => void }) {
    const isAssignedByOther = todo.assignedBy !== currentUserId;
    
    // Priority Styles
    const styles = {
        high: "bg-[#FEF2F2] border-red-200 text-red-900 ring-red-500/10",
        medium: "bg-[#FFFBEB] border-amber-200 text-amber-900 ring-amber-500/10",
        low: "bg-[#EFF6FF] border-blue-200 text-blue-900 ring-blue-500/10",
        completed: "bg-slate-50 border-slate-200 text-slate-400 opacity-80"
    };

    const currentStyle = todo.completed ? styles.completed : styles[todo.priority];

    return (
        <Card className={cn(
            "relative group border-2 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden cursor-pointer",
            currentStyle
        )} onClick={onOpenDetails}>
            <div className="absolute top-4 right-4 flex gap-1 z-20" onClick={e => e.stopPropagation()}>
                {todo.completed ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
                        <Trash2 className="size-3.5" />
                    </Button>
                ) : (
                    <div className={cn(
                        "size-2 rounded-full animate-pulse",
                        todo.priority === 'high' ? "bg-red-500" : todo.priority === 'medium' ? "bg-amber-500" : "bg-blue-500"
                    )} />
                )}
            </div>

            <CardContent className="p-7 space-y-4">
                <div className="space-y-2">
                    <div className="flex items-start gap-3">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggle(); }}
                            className={cn(
                                "mt-1 size-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 z-20",
                                todo.completed ? "bg-green-500 border-green-500 text-white" : "border-current/20 hover:border-current"
                            )}
                        >
                            {todo.completed && <Check className="size-3" />}
                        </button>
                        <h3 className={cn(
                            "text-base font-black tracking-tight leading-tight",
                            todo.completed && "line-through opacity-50"
                        )}>
                            {todo.task}
                        </h3>
                    </div>
                    {todo.description && !todo.completed && (
                        <p className="text-[11px] font-medium leading-relaxed line-clamp-2 opacity-60">
                            {todo.description}
                        </p>
                    )}
                </div>

                <div className="pt-4 space-y-3 border-t border-current/10">
                    {todo.completed ? (
                        <div className="space-y-1">
                             <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-green-600">
                                <CheckCircle2 className="size-3" /> SUCCESSFUL COMPLETION
                            </div>
                            {todo.completedAt && (
                                <p className="text-[8px] font-bold opacity-60">FINISHED: {format(todo.completedAt.toDate(), 'p, MMM d')}</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {todo.dueDate && (
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                    <Clock className="size-3 opacity-60" />
                                    <span>Due: {format(todo.dueDate.toDate(), 'MMM d, p')}</span>
                                </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                                {isAssignedByOther ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/50 text-[8px] font-black uppercase border border-current/10">
                                        <User className="size-2.5" />
                                        From: {todo.assignedByName.split(' ')[0]}
                                    </div>
                                ) : (
                                    <div className="text-[8px] font-black uppercase tracking-widest opacity-40">Personal Mission</div>
                                )}
                                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="size-3" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
