'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, ShieldCheck, ChevronRight } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

type Todo = {
    id: string;
    task: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    dueDate?: any;
    colorId?: string;
};

export function TodoWidget() {
    const { user } = useUser();
    const firestore = useFirestore();

    const todosQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, `users/${user.uid}/todos`), where('completed', '==', false), orderBy('createdAt', 'desc'), limit(5));
    }, [user, firestore]);

    const { data: todos, isLoading } = useCollection<Todo>(todosQuery);

    const handleToggle = (todo: Todo) => {
        if (!user) return;
        updateDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, todo.id), { completed: true, completedAt: serverTimestamp() });
    };

    return (
        <Card className="animate-fade-in-up border-none shadow-sm rounded-none bg-white overflow-hidden h-full flex flex-col">
            <CardHeader className="p-6 pb-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <Target className="size-4" /> Task Board
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pending tasks</CardDescription>
                    </div>
                    {todos && todos.length > 0 && <Badge className="bg-primary text-white font-black text-[9px] rounded-none">{todos.length}</Badge>}
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 flex-1">
                {isLoading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="h-12 rounded-none bg-muted animate-pulse" />))}</div>
                ) : todos && todos.length > 0 ? (
                    <ScrollArea className="h-full pr-3 -mr-3">
                        <div className="space-y-2">
                            {todos.map(todo => (
                                <div key={todo.id} className="group flex items-center justify-between p-2.5 rounded-none bg-muted/20 border border-transparent hover:border-border/50 hover:bg-white hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => handleToggle(todo)} className="size-4 rounded-none border-2 border-primary/20 flex items-center justify-center hover:border-primary transition-all">
                                            <div className="size-1.5 rounded-none bg-primary opacity-0 group-hover:opacity-20" />
                                        </button>
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-xs truncate max-w-[120px]">{todo.task}</p>
                                            {todo.priority === 'high' && <span className="text-[8px] font-black text-red-600 uppercase">Urgent</span>}
                                        </div>
                                    </div>
                                    {todo.dueDate && <span className="text-[8px] font-mono font-bold opacity-30 uppercase">{format(todo.dueDate.toDate(), 'MMM d')}</span>}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 opacity-30">
                        <ShieldCheck className="size-10 mb-2" />
                        <p className="font-black uppercase text-[10px] tracking-widest">No active tasks</p>
                    </div>
                )}
            </CardContent>
            <div className="p-6 pt-0 mt-auto">
                <Button variant="outline" className="w-full rounded-none h-9 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50" asChild>
                    <Link href="/dashboard/todo">Manage All <ChevronRight className="size-3 ml-1.5 opacity-50" /></Link>
                </Button>
            </div>
        </Card>
    );
}
