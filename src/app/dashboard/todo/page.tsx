
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, ListTodo, Clock, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Todo = {
    id: string;
    task: string;
    completed: boolean;
    createdAt: any;
    priority: 'low' | 'medium' | 'high';
};

export default function TodoPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newTask, setNewTask] = React.useState('');
    const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');

    const todosQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, `users/${user.uid}/todos`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: todos, isLoading } = useCollection<Todo>(todosQuery);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim() || !user) return;

        addDocumentNonBlocking(collection(firestore, `users/${user.uid}/todos`), {
            task: newTask.trim(),
            completed: false,
            createdAt: serverTimestamp(),
            priority,
        });

        setNewTask('');
        toast({ title: "Objective registered." });
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
        <div className="space-y-8 max-w-4xl mx-auto animate-fade-in-up">
            <PageHeader title="Operational To-Do List" description="Track and manage your tactical objectives and daily deliverables." />

            <Card className="border-none shadow-xl shadow-primary/5 rounded-[2.5rem] bg-white/80 backdrop-blur-md p-2">
                <CardContent className="p-6">
                    <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity">
                                <ListTodo className="size-5" />
                            </div>
                            <Input 
                                value={newTask} 
                                onChange={e => setNewTask(e.target.value)} 
                                placeholder="What is your next high-impact goal?" 
                                className="h-16 pl-14 pr-6 rounded-[1.5rem] border-none ring-1 ring-border/50 bg-muted/10 focus-visible:ring-primary/30 transition-all text-base font-medium placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <div className="flex gap-4">
                            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                <SelectTrigger className="w-[140px] h-16 rounded-[1.5rem] border-none ring-1 ring-border/50 bg-white shadow-sm font-black uppercase text-[10px] tracking-widest">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button type="submit" className="h-16 px-10 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all">
                                Add Task
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Tabs defaultValue="active" className="w-full">
                <div className="flex items-center justify-between mb-8 px-4">
                    <TabsList className="bg-white/50 p-1.5 rounded-2xl h-14 ring-1 ring-border/50 shadow-inner">
                        <TabsTrigger value="active" className="rounded-xl px-8 h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
                            Active Sector ({activeTodos.length})
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="rounded-xl px-8 h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
                            Archive ({completedTodos.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="active" className="space-y-4 focus-visible:outline-none">
                    {isLoading ? (
                        <div className="py-24 text-center animate-pulse flex flex-col items-center gap-4">
                            <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <p className="font-black uppercase text-[10px] text-primary/60 tracking-[0.3em]">Syncing Strategy...</p>
                        </div>
                    ) : activeTodos.length > 0 ? (
                        activeTodos.map(todo => (
                            <TodoItem key={todo.id} todo={todo} onToggle={toggleComplete} onDelete={deleteTask} />
                        ))
                    ) : (
                        <div className="py-32 text-center rounded-[3rem] border-4 border-dashed border-muted/30 flex flex-col items-center justify-center gap-6 group">
                            <div className="p-8 rounded-full bg-muted/10 group-hover:scale-110 transition-transform duration-500">
                                <CheckCircle2 className="size-16 text-primary opacity-10" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black uppercase text-sm tracking-widest text-muted-foreground">Tactical Grid Clear</p>
                                <p className="text-xs text-muted-foreground/60">No pending objectives for this sector.</p>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4 focus-visible:outline-none">
                    {completedTodos.length > 0 ? (
                        completedTodos.map(todo => (
                            <TodoItem key={todo.id} todo={todo} onToggle={toggleComplete} onDelete={deleteTask} />
                        ))
                    ) : (
                        <div className="py-32 text-center rounded-[3rem] border-4 border-dashed border-muted/30 flex flex-col items-center justify-center gap-6 opacity-30">
                            <Clock className="size-16" />
                            <p className="font-black uppercase text-sm tracking-widest">Archive Empty</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TodoItem({ todo, onToggle, onDelete }: { todo: Todo, onToggle: (t: Todo) => void, onDelete: (id: string) => void }) {
    const priorityColors = {
        low: 'bg-blue-50 text-blue-600 border-blue-100',
        medium: 'bg-yellow-50 text-yellow-700 border-yellow-100',
        high: 'bg-red-50 text-red-600 border-red-100'
    };

    return (
        <div className={cn(
            "group flex items-center justify-between p-6 rounded-[2rem] bg-white ring-1 ring-border/50 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1",
            todo.completed && "opacity-60 grayscale bg-muted/10 ring-transparent shadow-none hover:translate-y-0"
        )}>
            <div className="flex items-center gap-6 flex-1 min-w-0">
                <button 
                    onClick={() => onToggle(todo)}
                    className={cn(
                        "size-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 active:scale-75 shrink-0",
                        todo.completed ? "bg-primary border-primary text-white scale-110" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                    )}
                >
                    {todo.completed ? <CheckCircle2 className="size-5" /> : <div className="size-2 rounded-full bg-primary/0" />}
                </button>
                <div className="flex flex-col min-w-0">
                    <span className={cn(
                        "text-base font-bold tracking-tight transition-all duration-500",
                        todo.completed ? "line-through text-muted-foreground italic font-medium" : "text-foreground"
                    )}>
                        {todo.task}
                    </span>
                    <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline" className={cn("rounded-full text-[8px] font-black uppercase tracking-widest px-3 py-0.5 border-none", priorityColors[todo.priority])}>
                            {todo.priority} Prio
                        </Badge>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">
                            <Clock className="size-3" />
                            {todo.createdAt ? format(todo.createdAt.toDate(), 'MMM d, p') : 'Syncing...'}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onDelete(todo.id)}
                    className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-destructive hover:bg-red-50 rounded-2xl size-10"
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        </div>
    );
}
