
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, Timestamp } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, ListTodo, Clock, Calendar, UserPlus, User, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

type Todo = {
    id: string;
    task: string;
    completed: boolean;
    createdAt: any;
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
    
    const [newTask, setNewTask] = React.useState('');
    const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
    const [assignedTo, setAssignedTo] = React.useState<string>('self');
    const [dueDate, setDueDate] = React.useState<string>('');
    const [dueTime, setDueTime] = React.useState<string>('');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc<any>(userDocRef);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: allUsers } = useCollection<UserData>(usersQuery);

    const todosQuery = useMemoFirebase(() => {
        if (!user) return null;
        // Tasks assigned TO the current user
        return query(collection(firestore, `users/${user.uid}/todos`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: todos, isLoading } = useCollection<Todo>(todosQuery);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim() || !user || !currentUserData) return;

        const targetUserId = assignedTo === 'self' ? user.uid : assignedTo;
        const targetUserName = allUsers?.find(u => u.id === targetUserId)?.firstName || 'Fleet Member';
        
        let dueTimestamp = null;
        if (dueDate) {
            const dateStr = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59`;
            dueTimestamp = Timestamp.fromDate(new Date(dateStr));
        }

        const todoPayload = {
            task: newTask.trim(),
            completed: false,
            createdAt: serverTimestamp(),
            priority,
            assignedBy: user.uid,
            assignedByName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            assignedTo: targetUserId,
            dueDate: dueTimestamp,
        };

        addDocumentNonBlocking(collection(firestore, `users/${targetUserId}/todos`), todoPayload);

        setNewTask('');
        setDueDate('');
        setDueTime('');
        toast({ title: "Objective registered.", description: assignedTo === 'self' ? "Added to your list." : `Assigned to ${targetUserName}.` });
    };

    const toggleComplete = (todo: Todo) => {
        if (!user) return;
        updateDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, todo.id), {
            completed: !todo.completed
        });
    };

    const deleteTask = (id: string) => {
        if (!user) return;
        deleteDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, id));
        toast({ title: "Task purged." });
    };

    const activeTodos = todos?.filter(t => !t.completed) || [];
    const completedTodos = todos?.filter(t => t.completed) || [];

    return (
        <div className="space-y-8 max-w-5xl mx-auto animate-fade-in-up pb-20">
            <PageHeader title="Operational To-Do List" description="Track objectives and dispatch tactical assignments across the fleet." />

            <Card className="border-none shadow-xl shadow-primary/5 rounded-[2.5rem] bg-white/80 backdrop-blur-md overflow-hidden">
                <CardContent className="p-8">
                    <form onSubmit={handleAddTask} className="space-y-6">
                        <div className="relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity">
                                <ListTodo className="size-5" />
                            </div>
                            <Input 
                                value={newTask} 
                                onChange={e => setNewTask(e.target.value)} 
                                placeholder="What is the next mission objective?" 
                                className="h-16 pl-14 pr-6 rounded-2xl border-none ring-1 ring-border/50 bg-muted/10 focus-visible:ring-primary/30 transition-all text-lg font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Assign To</Label>
                                <Select value={assignedTo} onValueChange={setAssignedTo}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white ring-1 ring-border/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="self">Myself</SelectItem>
                                        {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Priority</Label>
                                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white ring-1 ring-border/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Due Date</Label>
                                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-12 rounded-xl bg-white ring-1 ring-border/50" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Due Time</Label>
                                <div className="flex gap-2">
                                    <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="h-12 rounded-xl bg-white ring-1 ring-border/50 flex-1" />
                                    <Button type="submit" className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                                        Dispatch
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Tabs defaultValue="active" className="w-full">
                <div className="flex items-center justify-between mb-8 px-4">
                    <TabsList className="bg-white/50 p-1.5 rounded-2xl h-14 ring-1 ring-border/50">
                        <TabsTrigger value="active" className="rounded-xl px-8 h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
                            Active Sector ({activeTodos.length})
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="rounded-xl px-8 h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
                            Archive ({completedTodos.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="active" className="space-y-4 focus-visible:outline-none">
                    {isLoading ? (
                        <div className="py-24 text-center animate-pulse">
                            <Clock className="size-12 mx-auto text-primary/20 mb-4 animate-spin" />
                            <p className="font-black uppercase text-[10px] text-primary/60 tracking-widest">Syncing Satellite Log...</p>
                        </div>
                    ) : activeTodos.length > 0 ? (
                        activeTodos.map(todo => (
                            <TodoItem key={todo.id} todo={todo} currentUserId={user?.uid} onToggle={toggleComplete} onDelete={deleteTask} />
                        ))
                    ) : (
                        <div className="py-32 text-center rounded-[3rem] border-4 border-dashed border-muted/30 flex flex-col items-center justify-center gap-4 opacity-50">
                            <CheckCircle2 className="size-16 text-primary/20" />
                            <p className="font-black uppercase text-sm tracking-widest text-muted-foreground">Tactical Grid Clear</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4 focus-visible:outline-none">
                    {completedTodos.length > 0 ? (
                        completedTodos.map(todo => (
                            <TodoItem key={todo.id} todo={todo} currentUserId={user?.uid} onToggle={toggleComplete} onDelete={deleteTask} />
                        ))
                    ) : (
                        <div className="py-32 text-center rounded-[3rem] border-4 border-dashed border-muted/30 flex flex-col items-center justify-center gap-4 opacity-50">
                            <Clock className="size-16 text-muted-foreground/20" />
                            <p className="font-black uppercase text-sm tracking-widest">Archive Empty</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TodoItem({ todo, currentUserId, onToggle, onDelete }: { todo: Todo, currentUserId?: string, onToggle: (t: Todo) => void, onDelete: (id: string) => void }) {
    const isAssignedByOther = todo.assignedBy !== currentUserId;
    
    const priorityColors = {
        low: 'bg-blue-50 text-blue-600',
        medium: 'bg-yellow-50 text-yellow-700',
        high: 'bg-red-50 text-red-600'
    };

    return (
        <div className={cn(
            "group flex items-center justify-between p-6 rounded-[2rem] bg-white ring-1 ring-border/50 shadow-sm hover:shadow-xl transition-all duration-500",
            todo.completed && "opacity-60 grayscale bg-muted/10 ring-transparent shadow-none"
        )}>
            <div className="flex items-center gap-6 flex-1 min-w-0">
                <button 
                    onClick={() => onToggle(todo)}
                    className={cn(
                        "size-8 rounded-full border-2 flex items-center justify-center transition-all active:scale-75 shrink-0",
                        todo.completed ? "bg-primary border-primary text-white" : "border-muted-foreground/20 hover:border-primary/50"
                    )}
                >
                    {todo.completed ? <CheckCircle2 className="size-5" /> : <div className="size-2 rounded-full bg-primary/0" />}
                </button>
                
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                            "text-base font-bold tracking-tight",
                            todo.completed ? "line-through text-muted-foreground italic" : "text-foreground"
                        )}>
                            {todo.task}
                        </span>
                        {isAssignedByOther && (
                            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-none rounded-full text-[8px] uppercase font-black px-2">
                                <User className="size-2 mr-1" /> From: {todo.assignedByName}
                            </Badge>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline" className={cn("rounded-full text-[8px] font-black uppercase tracking-widest px-3 py-0.5 border-none", priorityColors[todo.priority])}>
                            {todo.priority} Prio
                        </Badge>
                        {todo.dueDate && (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase tracking-tighter">
                                <Calendar className="size-3" />
                                Due: {format(todo.dueDate.toDate(), 'MMM d, p')}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">
                            <Clock className="size-3" />
                            Registered {todo.createdAt ? format(todo.createdAt.toDate(), 'MMM d') : '...'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isAssignedByOther && !todo.completed}
                            className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-destructive hover:bg-red-50 rounded-2xl size-10 disabled:opacity-20"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                                <AlertTriangle className="size-5 text-red-600" />
                                Purge Objective?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium">
                                Are you sure you want to permanently remove this mission objective from the tactical grid? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(todo.id)} className="rounded-full font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700">Confirm Deletion</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
