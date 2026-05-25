'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, CheckCircle2, Clock, ChevronRight, ShieldCheck, Target } from 'lucide-react';
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
        return query(
            collection(firestore, `users/${user.uid}/todos`),
            where('completed', '==', false),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [user, firestore]);

    const { data: todos, isLoading } = useCollection<Todo>(todosQuery);

    const handleToggle = (todo: Todo) => {
        if (!user) return;
        updateDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, todo.id), {
            completed: true,
            completedAt: serverTimestamp()
        });
    };

    return (
        <Card className="animate-fade-in-up border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-full flex flex-col font-open-sans">
            <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <Target className="size-5" /> Mission Board
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Active objectives</CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full h-8 px-4 font-black uppercase text-[10px] bg-muted/20 border-none">
                        {todos?.length || 0} ACTIVE
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 flex-1">
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : todos && todos.length > 0 ? (
                    <ScrollArea className="h-full pr-4 -mr-4">
                        <div className="space-y-3">
                            {todos.map(todo => (
                                <div key={todo.id} className="group flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-transparent hover:border-border/50 hover:bg-white hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => handleToggle(todo)}
                                            className="size-5 rounded-full border-2 border-primary/20 flex items-center justify-center hover:border-primary hover:bg-primary/10 transition-all"
                                        >
                                            <div className="size-2 rounded-full bg-primary opacity-0 group-hover:opacity-20" />
                                        </button>
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-xs truncate max-w-[120px]">{todo.task}</p>
                                            {todo.priority === 'high' && (
                                                <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Urgent</span>
                                            )}
                                        </div>
                                    </div>
                                    {todo.dueDate && (
                                        <span className="text-[8px] font-mono font-bold opacity-40 uppercase">
                                            {format(todo.dueDate.toDate(), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-20 opacity-30 grayscale">
                        <ShieldCheck className="size-12 mb-4" />
                        <p className="font-black uppercase text-[10px] tracking-[0.3em]">Grid Clear</p>
                    </div>
                )}
            </CardContent>
            <div className="p-8 pt-0 mt-auto">
                <Button variant="outline" className="w-full rounded-full h-11 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50" asChild>
                    <Link href="/dashboard/todo">Manage All <ChevronRight className="size-3 ml-2 opacity-50" /></Link>
                </Button>
            </div>
        </Card>
    );
}