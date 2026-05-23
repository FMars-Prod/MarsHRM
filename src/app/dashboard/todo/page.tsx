
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, Timestamp } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, ListTodo, Clock, Calendar as CalendarIcon, User, AlertTriangle, Filter, Check, X, ShieldCheck, Eye, Info, CheckCircle, Palette, LayoutGrid, ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, isToday, isBefore, startOfDay, addDays, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
    colorId?: string;
};

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
};

const TASK_COLORS = [
    { id: 'rose', bg: 'bg-[#FEF2F2]', border: 'border-rose-200', text: 'text-rose-900', ring: 'ring-rose-500/10', circle: 'bg-rose-500' },
    { id: 'amber', bg: 'bg-[#FFFBEB]', border: 'border-amber-200', text: 'text-amber-900', ring: 'ring-amber-500/10', circle: 'bg-amber-500' },
    { id: 'sky', bg: 'bg-[#EFF6FF]', border: 'border-sky-200', text: 'text-sky-900', ring: 'ring-sky-500/10', circle: 'bg-sky-500' },
    { id: 'emerald', bg: 'bg-[#F0FDF4]', border: 'border-emerald-200', text: 'text-emerald-900', ring: 'ring-emerald-500/10', circle: 'bg-emerald-500' },
    { id: 'violet', bg: 'bg-[#FAF5FF]', border: 'border-violet-200', text: 'text-violet-900', ring: 'ring-violet-500/10', circle: 'bg-violet-500' },
    { id: 'flamingo', bg: 'bg-[#FDF2F8]', border: 'border-pink-200', text: 'text-pink-900', ring: 'ring-pink-500/10', circle: 'bg-pink-500' },
    { id: 'indigo', bg: 'bg-[#EEF2FF]', border: 'border-indigo-200', text: 'text-indigo-900', ring: 'ring-indigo-500/10', circle: 'bg-indigo-500' },
    { id: 'teal', bg: 'bg-[#F0FDFA]', border: 'border-teal-200', text: 'text-teal-900', ring: 'ring-teal-500/10', circle: 'bg-teal-500' },
];

export default function TodoPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [viewMode, setViewMode] = React.useState<'grid' | 'calendar'>('grid');
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [viewFilter, setViewFilter] = React.useState<'active' | 'completed'>('active');
    const [selectedTodo, setSelectedTodo] = React.useState<Todo | null>(null);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    
    // Calendar Specific States
    const [currentMonthDate, setCurrentMonthDate] = React.useState(new Date());
    const [detailedDay, setDetailedDay] = React.useState<Date | null>(null);

    // Form States
    const [newTask, setNewTask] = React.useState('');
    const [newDesc, setNewDesc] = React.useState('');
    const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
    const [selectedColorId, setSelectedColorId] = React.useState<string>(TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)].id);
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
            colorId: selectedColorId,
            assignedBy: user.uid,
            assignedByName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            assignedTo: targetUserId,
            dueDate: dueTimestamp,
        };

        addDocumentNonBlocking(collection(firestore, `users/${targetUserId}/todos`), todoPayload);

        setNewTask('');
        setNewDesc('');
        setDueDate('');
        setDueTime('');
        setSelectedColorId(TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)].id);
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

    const deleteTasks = (ids: string[]) => {
        if (!user) return;
        ids.forEach(id => {
            deleteDocumentNonBlocking(doc(firestore, `users/${user.uid}/todos`, id));
        });
        setSelectedIds([]);
        toast({ title: "Objectives Purged", description: `${ids.length} records removed from board.` });
    };

    const displayTodos = todos?.filter(t => viewFilter === 'completed' ? t.completed : !t.completed) || [];
    
    const activeCount = todos?.filter(t => !t.completed).length || 0;
    const archiveCount = todos?.filter(t => t.completed).length || 0;

    const groupedTodos = React.useMemo(() => {
        const today = startOfDay(new Date());
        const groups: { title: string; items: Todo[] }[] = [
            { title: "Overdue", items: [] },
            { title: "Today", items: [] },
            { title: "Upcoming / Someday", items: [] }
        ];

        displayTodos.forEach(todo => {
            if (!todo.dueDate) {
                groups[2].items.push(todo);
                return;
            }
            const due = todo.dueDate.toDate();
            if (isBefore(due, today)) {
                groups[0].items.push(todo);
            } else if (isToday(due)) {
                groups[1].items.push(todo);
            } else {
                groups[2].items.push(todo);
            }
        });

        return groups.filter(g => g.items.length > 0);
    }, [displayTodos]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    // Calendar UI Grid Logic
    const calendarDays = React.useMemo(() => {
        const monthStart = startOfMonth(currentMonthDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonthDate]);

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <PageHeader title="Mission Objectives" description="Tactical task board with priority-based sticky notes.">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex bg-muted/50 p-1 rounded-full ring-1 ring-border/50">
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-full font-black uppercase text-[9px] tracking-widest px-4 h-9"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="size-3 mr-2" /> Grid
                        </Button>
                        <Button 
                            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-full font-black uppercase text-[9px] tracking-widest px-4 h-9"
                            onClick={() => setViewMode('calendar')}
                        >
                            <CalendarDays className="size-3 mr-2" /> Calendar
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-8 hidden sm:block" />

                    {selectedIds.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="rounded-full h-11 px-6 shadow-lg animate-fade-in-up">
                                    <Trash2 className="size-4 mr-2" /> Delete Selected ({selectedIds.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black uppercase tracking-tighter">Confirm Purge</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently remove {selectedIds.length} records from your tactical grid. This action is irreversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-full font-bold text-xs uppercase">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteTasks(selectedIds)} className="rounded-full font-bold text-xs uppercase bg-red-600">Purge Data</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    <div className="flex bg-muted/50 p-1 rounded-xl ring-1 ring-border/50">
                        <Button 
                            variant={viewFilter === 'active' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4"
                            onClick={() => { setViewFilter('active'); setSelectedIds([]); }}
                        >
                            Active Sector ({activeCount})
                        </Button>
                        <Button 
                            variant={viewFilter === 'completed' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4"
                            onClick={() => { setViewFilter('completed'); setSelectedIds([]); }}
                        >
                            Archive ({archiveCount})
                        </Button>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full h-11 px-6 shadow-lg shadow-primary/20">
                                <Plus className="size-4 mr-2" /> Dispatch Mission
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-lg p-0 overflow-hidden">
                            <DialogHeader className="p-8 pb-0">
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">New Mission Objective</DialogTitle>
                                <DialogDescription>Register a new task on the tactical board.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddTask} className="flex flex-col h-full max-h-[85vh]">
                                <ScrollArea className="flex-1 px-8 py-6">
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Objective Title</Label>
                                            <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g., Finalize Q4 Security Audit" className="rounded-xl h-11" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Contextual Details</Label>
                                            <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Provide additional information..." className="rounded-xl min-h-[80px]" />
                                        </div>

                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Palette className="size-3" /> Select Tactical Theme</Label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {TASK_COLORS.map(color => (
                                                    <button 
                                                        key={color.id}
                                                        type="button"
                                                        onClick={() => setSelectedColorId(color.id)}
                                                        className={cn(
                                                            "h-12 rounded-xl border-2 transition-all flex items-center justify-center group",
                                                            color.id === selectedColorId ? "border-primary scale-105 shadow-md" : "border-transparent",
                                                            color.bg
                                                        )}
                                                    >
                                                        {color.id === selectedColorId && <CheckCircle2 className="size-4 text-primary" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Priority Tier</Label>
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
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign To</Label>
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
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Due Date</Label>
                                                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl h-11" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Target Time</Label>
                                                <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="rounded-xl h-11" />
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <div className="p-8 pt-0 mt-auto">
                                    <Button type="submit" className="w-full rounded-full h-14 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Dispatch</Button>
                                </div>
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
            ) : viewMode === 'calendar' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">{format(currentMonthDate, 'MMMM yyyy')}</h2>
                            <div className="flex bg-white rounded-full ring-1 ring-border/50 p-1">
                                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}><ChevronLeft className="size-4"/></Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}><ChevronRight className="size-4"/></Button>
                            </div>
                        </div>
                        <Badge variant="outline" className="rounded-full font-black uppercase text-[10px] h-9 px-4 bg-white">Monthly Command Hub</Badge>
                    </div>

                    <Card className="border-none ring-1 ring-border/50 rounded-[2.5rem] bg-white/50 backdrop-blur-sm shadow-xl overflow-hidden">
                        <div className="grid grid-cols-7 bg-muted/30 border-b">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fr', 'Sat'].map(day => (
                                <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {calendarDays.map((date, i) => {
                                const dayTasks = todos?.filter(t => t.dueDate && isSameDay(t.dueDate.toDate(), date)) || [];
                                const isCurrentMonth = format(date, 'M') === format(currentMonthDate, 'M');
                                const activeTasks = dayTasks.filter(t => !t.completed).length;
                                const finishedTasks = dayTasks.filter(t => t.completed).length;

                                return (
                                    <div 
                                        key={i} 
                                        className={cn(
                                            "min-h-[120px] p-3 border-r border-b border-border/30 hover:bg-white transition-all cursor-pointer group flex flex-col gap-2 relative",
                                            !isCurrentMonth && "bg-muted/10 opacity-40 grayscale",
                                            isToday(date) && "bg-primary/10 ring-2 ring-primary inset-0 z-10"
                                        )}
                                        onClick={() => setDetailedDay(date)}
                                    >
                                        <span className={cn(
                                            "text-xs font-black",
                                            isToday(date) ? "text-primary scale-125 block mb-1" : "text-muted-foreground/40"
                                        )}>
                                            {format(date, 'd')}
                                        </span>
                                        
                                        <div className="flex flex-col gap-1 mt-auto">
                                            {activeTasks > 0 && (
                                                <Badge className="bg-primary text-white text-[8px] font-black uppercase h-4 px-1.5 rounded-sm w-fit border-none">
                                                    {activeTasks} Active
                                                </Badge>
                                            )}
                                            {finishedTasks > 0 && (
                                                <Badge className="bg-primary/40 text-primary-foreground text-[8px] font-black uppercase h-4 px-1.5 rounded-sm w-fit border-none">
                                                    {finishedTasks} Fin
                                                </Badge>
                                            )}
                                            <div className="flex flex-wrap gap-0.5 mt-1">
                                                {dayTasks.slice(0, 8).map(t => {
                                                    const theme = TASK_COLORS.find(c => c.id === t.colorId) || TASK_COLORS[0];
                                                    return (
                                                        <div key={t.id} className={cn("size-1 rounded-full", theme.circle)} />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <Dialog open={!!detailedDay} onOpenChange={o => !o && setDetailedDay(null)}>
                        <DialogContent className="rounded-[2rem] sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl">
                            <DialogHeader className="p-6 pb-4">
                                <div className="flex items-center justify-between w-full">
                                    <div className="space-y-1">
                                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Daily Briefing</DialogTitle>
                                        <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                            {detailedDay ? format(detailedDay, 'PPPP') : ''}
                                        </DialogDescription>
                                    </div>
                                    <Badge variant="outline" className="rounded-full h-8 px-4 font-black uppercase text-[9px] bg-primary/5 text-primary border-primary/20">
                                        {todos?.filter(t => detailedDay && t.dueDate && isSameDay(t.dueDate.toDate(), detailedDay)).length || 0} Missions
                                    </Badge>
                                </div>
                            </DialogHeader>
                            <ScrollArea className="h-[350px] px-6 py-4 bg-secondary/5">
                                <div className="space-y-4 pb-6">
                                    {todos?.filter(t => detailedDay && t.dueDate && isSameDay(t.dueDate.toDate(), detailedDay)).length ? (
                                        todos.filter(t => detailedDay && t.dueDate && isSameDay(t.dueDate.toDate(), detailedDay)).map(todo => (
                                            <Card 
                                                key={todo.id} 
                                                className={cn(
                                                    "border-none ring-1 ring-border/50 rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between group bg-white",
                                                    todo.completed && "opacity-60 grayscale"
                                                )}
                                                onClick={() => setSelectedTodo(todo)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div 
                                                        className={cn(
                                                            "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                            todo.completed ? "bg-green-600 border-green-600 text-white" : "border-muted-foreground/20"
                                                        )}
                                                        onClick={(e) => { e.stopPropagation(); toggleComplete(todo); }}
                                                    >
                                                        {todo.completed && <Check className="size-3" />}
                                                    </div>
                                                    <div>
                                                        <p className={cn("font-bold text-sm", todo.completed && "line-through")}>{todo.task}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge className={cn(
                                                                "text-[8px] font-black uppercase px-2 py-0 border-none rounded-full",
                                                                todo.priority === 'high' ? "bg-red-100 text-red-700" :
                                                                todo.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                                                                "bg-blue-100 text-blue-700"
                                                            )}>
                                                                {todo.priority} Priority
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center flex flex-col items-center justify-center gap-3 opacity-30 grayscale">
                                            <ListTodo className="size-10" />
                                            <p className="font-black uppercase text-[10px] tracking-[0.2em]">Tactical Grid Clear</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="p-6 pt-4 border-t bg-white">
                                <Button variant="outline" className="w-full rounded-full h-12 font-black uppercase text-[10px] tracking-widest shadow-md" onClick={() => setDetailedDay(null)}>Acknowledge Schedule</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : displayTodos.length > 0 ? (
                <div className="space-y-12">
                    {groupedTodos.map(group => (
                        <div key={group.title} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground shrink-0">{group.title} ({group.items.length})</h3>
                                <Separator className="flex-1 opacity-50" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {group.items.map(todo => (
                                    <StickyNote 
                                        key={todo.id} 
                                        todo={todo} 
                                        currentUserId={user?.uid} 
                                        isSelected={selectedIds.includes(todo.id)}
                                        onSelect={() => toggleSelect(todo.id)}
                                        onToggle={() => toggleComplete(todo)} 
                                        onDelete={() => deleteTasks([todo.id])}
                                        onOpenDetails={() => setSelectedTodo(todo)}
                                    />
                                ))}
                            </div>
                        </div>
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
                <DialogContent className="rounded-[3rem] sm:max-w-md p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-4">
                             {selectedTodo && (
                                <Badge className={cn(
                                    "rounded-full text-[9px] font-black uppercase tracking-widest border-none px-3 py-1",
                                    selectedTodo.priority === 'high' ? "bg-red-100 text-red-700" :
                                    selectedTodo.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                                    "bg-blue-100 text-blue-700"
                                )}>
                                    {selectedTodo.priority} Priority
                                </Badge>
                             )}
                             {selectedTodo?.completed && (
                                <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[9px] font-black uppercase px-3 py-1">Mission Success</Badge>
                             )}
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary leading-tight">{selectedTodo?.task}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-8">
                        {selectedTodo?.description && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contextual Briefing</Label>
                                <p className="text-sm font-medium leading-relaxed italic text-foreground/80">"{selectedTodo.description}"</p>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Intelligence Sync</Label>
                                <p className="text-xs font-bold">{selectedTodo?.createdAt ? format(selectedTodo.createdAt.toDate(), 'PP p') : 'N/A'}</p>
                            </div>
                            {selectedTodo?.dueDate && (
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Tactical Deadline</Label>
                                    <p className="text-xs font-black text-primary uppercase">{format(selectedTodo.dueDate.toDate(), 'PP p')}</p>
                                </div>
                            )}
                        </div>

                        <Separator className="opacity-50" />

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Command Source</Label>
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary border border-primary/20">{selectedTodo?.assignedByName[0]}</div>
                                    <p className="text-sm font-bold text-foreground/80">{selectedTodo?.assignedByName}</p>
                                </div>
                            </div>
                            {selectedTodo?.completedAt && (
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-green-600 tracking-widest">Mission Finish</Label>
                                    <p className="text-xs font-black text-green-700">{format(selectedTodo.completedAt.toDate(), 'PP p')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" className="w-full rounded-full h-14 font-black uppercase tracking-widest shadow-lg border-2" onClick={() => setSelectedTodo(null)}>Conclude Briefing</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StickyNote({ todo, currentUserId, isSelected, onSelect, onToggle, onDelete, onOpenDetails }: any) {
    const isAssignedByOther = todo.assignedBy !== currentUserId;
    
    const theme = TASK_COLORS.find(c => c.id === todo.colorId) || 
                  (todo.priority === 'high' ? TASK_COLORS[0] : todo.priority === 'medium' ? TASK_COLORS[1] : TASK_COLORS[2]);

    const completedStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-80";

    return (
        <Card className={cn(
            "relative group border-2 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden cursor-pointer",
            todo.completed ? completedStyle : cn(theme.bg, theme.border, theme.text, theme.ring),
            isSelected && "ring-2 ring-primary ring-offset-2 scale-[0.98]"
        )} onClick={onOpenDetails}>
            
            <div className="absolute top-5 right-5 flex items-center gap-2 z-20" onClick={e => e.stopPropagation()}>
                <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-5 w-5 rounded-lg border-2 border-current/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                {todo.completed && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
                        <Trash2 className="size-3.5" />
                    </Button>
                )}
            </div>

            <CardContent className="p-8 space-y-4">
                <div className="space-y-2">
                    <div className="flex items-start gap-4">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggle(); }}
                            className={cn(
                                "mt-1.5 size-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 z-20",
                                todo.completed ? "bg-green-600 border-green-600 text-white" : "border-current/20 hover:border-current"
                            )}
                        >
                            {todo.completed && <Check className="size-3.5" />}
                        </button>
                        <h3 className={cn(
                            "text-lg font-black tracking-tight leading-tight",
                            todo.completed && "line-through opacity-50"
                        )}>
                            {todo.task}
                        </h3>
                    </div>
                    {todo.description && !todo.completed && (
                        <p className="text-xs font-medium leading-relaxed line-clamp-2 opacity-60 pl-10">
                            {todo.description}
                        </p>
                    )}
                </div>

                <div className="pt-6 space-y-4 border-t border-current/10 ml-10">
                    {todo.completed ? (
                        <div className="space-y-1">
                             <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-green-600">
                                <CheckCircle2 className="size-3" /> FINISHED
                            </div>
                            {todo.completedAt && (
                                <p className="text-[9px] font-bold opacity-60">STAMPED: {format(todo.completedAt.toDate(), 'p, MMM d')}</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {todo.dueDate && (
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                    <Clock className="size-3 opacity-60" />
                                    <span className={cn(isBefore(todo.dueDate.toDate(), new Date()) && "text-red-600")}>Due: {format(todo.dueDate.toDate(), 'MMM d, p')}</span>
                                </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                                {isAssignedByOther ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/50 text-[9px] font-black uppercase border border-current/10">
                                        <User className="size-3" />
                                        {todo.assignedByName.split(' ')[0]}
                                    </div>
                                ) : (
                                    <div className="text-[9px] font-black uppercase tracking-widest opacity-40">Self Assigned Task</div>
                                )}
                                <Eye className="size-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
