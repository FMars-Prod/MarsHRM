
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trash, Edit, MoreHorizontal, UserCheck, AlertCircle, Trash2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { collection, query, doc, writeBatch, getDocs, where } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    teamId?: string | null;
    avatar?: string;
    jobTitle: string;
};

type Team = {
    id: string;
    name: string;
    teamLeadId: string;
    supervisorId?: string;
    memberIds: string[];
};

export default function TeamsPage() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTeam, setEditingTeam] = React.useState<WithId<Team> | null>(null);
    const [teamName, setTeamName] = React.useState("");
    const [teamLeadId, setTeamLeadId] = React.useState<string | undefined>();
    const [supervisorId, setSupervisorId] = React.useState<string | undefined>("unassigned");
    const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
    const [selectedTeamForSheet, setSelectedTeamForSheet] = React.useState<WithId<Team> | null>(null);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
    
    const { data: currentUserData } = useDoc<any>(useMemoFirebase(() => currentUser ? doc(firestore, "users", currentUser.uid) : null, [currentUser, firestore]));
    const canManageAllTeams = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';
    
    const getTeamLeadName = (leadId: string) => {
        const lead = users?.find(u => u.id === leadId);
        return lead ? `${lead.firstName} ${lead.lastName}` : 'N/A';
    }

    const getSupervisorName = (sId?: string) => {
        if (!sId || sId === 'unassigned') return 'General Oversight';
        const sup = users?.find(u => u.id === sId);
        return sup ? `${sup.firstName} ${sup.lastName}` : 'General Oversight';
    }

    const handleCreateOrUpdateTeam = async () => {
        if (!teamName || !teamLeadId) {
            toast({ variant: 'destructive', title: 'Missing Fields' });
            return;
        }

        const batch = writeBatch(firestore);
        const allMemberIdsForTeam = Array.from(new Set([teamLeadId, ...selectedMemberIds]));
        const finalSupervisorId = supervisorId === 'unassigned' ? null : supervisorId;

        if (editingTeam) {
            const teamRef = doc(firestore, 'teams', editingTeam.id);
            batch.update(teamRef, { 
                name: teamName, 
                teamLeadId: teamLeadId, 
                supervisorId: finalSupervisorId,
                memberIds: allMemberIdsForTeam 
            });
            editingTeam.memberIds?.filter(id => !allMemberIdsForTeam.includes(id)).forEach(id => batch.update(doc(firestore, 'users', id), { teamId: null }));
            allMemberIdsForTeam.forEach(memberId => batch.update(doc(firestore, 'users', memberId), { teamId: editingTeam.id }));
            toast({ title: 'Team Configuration Updated' });
        } else {
            const newTeamRef = doc(collection(firestore, 'teams'));
            batch.set(newTeamRef, { 
                id: newTeamRef.id, 
                name: teamName, 
                teamLeadId: teamLeadId, 
                supervisorId: finalSupervisorId, 
                memberIds: allMemberIdsForTeam 
            });
            allMemberIdsForTeam.forEach(memberId => batch.update(doc(firestore, 'users', memberId), { teamId: newTeamRef.id }));
            toast({ title: 'New Team Unit Dispatched' });
        }
        await batch.commit();
        setIsDialogOpen(false);
        setEditingTeam(null);
        setTeamName("");
        setTeamLeadId(undefined);
        setSupervisorId("unassigned");
        setSelectedMemberIds([]);
    }

    const handleDeleteTeam = async (teamId: string) => {
        const batch = writeBatch(firestore);
        const teamRef = doc(firestore, 'teams', teamId);
        
        const q = query(collection(firestore, 'users'), where('teamId', '==', teamId));
        const snap = await getDocs(q);
        snap.docs.forEach(uDoc => {
            batch.update(uDoc.ref, { teamId: null });
        });

        batch.delete(teamRef);
        await batch.commit();
        toast({ title: "Team Dissolved", description: "All members have been unassigned." });
    }

    const isUrl = (str?: string) => str && str.startsWith('http');

    const potentialSupervisors = React.useMemo(() => {
        return users?.filter(u => u.role === 'CEO/Admin' || u.role === 'HR Manager') || [];
    }, [users]);

    return (
        <TooltipProvider delayDuration={0}>
        <>
            <PageHeader title="Organizational Units" description="Manage tactical team associations and leadership hierarchies.">
                {canManageAllTeams && (
                    <Button onClick={() => setIsDialogOpen(true)} className="rounded-none h-11 shadow-lg bg-primary text-white font-black uppercase text-[10px] tracking-widest px-6">
                      <PlusCircle className="mr-2" /> Add Team
                    </Button>
                )}
            </PageHeader>
            <div className="border-none ring-1 ring-border/50 rounded-none overflow-hidden bg-white shadow-xl">
                <Table>
                    <TableHeader className="bg-muted/10 border-b">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 px-6">Team Unit</TableHead>
                            <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Lead Strategist</TableHead>
                            <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Primary Supervisor</TableHead>
                            <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Fleet Size</TableHead>
                            <TableHead className="text-right font-black uppercase tracking-widest text-[10px] py-6 px-8">Control</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teamsLoading ? (<TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse uppercase font-black text-sm text-muted-foreground tracking-[0.3em]">Syncing Units...</TableCell></TableRow>) : teams?.length === 0 ? (
                             <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[11px] tracking-widest opacity-30">No tactical teams currently deployed.</TableCell></TableRow>
                        ) : teams?.map(team => (
                            <TableRow key={team.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                <TableCell className="font-black text-base uppercase tracking-tight py-6 px-6">{team.name}</TableCell>
                                <TableCell className="font-bold text-xs text-primary uppercase">{getTeamLeadName(team.teamLeadId)}</TableCell>
                                <TableCell className="font-bold text-[10px] uppercase text-muted-foreground opacity-60">{getSupervisorName(team.supervisorId)}</TableCell>
                                <TableCell><Badge variant="secondary" className="rounded-none font-black text-[10px] px-3">{team.memberIds.length} Units</Badge></TableCell>
                                <TableCell className="text-right px-8">
                                    <div className="flex justify-end items-center gap-2">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none text-primary hover:bg-primary/5 transition-all" onClick={() => setSelectedTeamForSheet(team)}>
                                                    <Users className="size-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-sidebar text-white text-[10px] font-black uppercase rounded-none">Review Fleet</TooltipContent>
                                        </Tooltip>

                                        {canManageAllTeams && (
                                            <>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none text-primary hover:bg-primary/5 transition-all" onClick={() => { 
                                                            setEditingTeam(team); 
                                                            setTeamName(team.name); 
                                                            setTeamLeadId(team.teamLeadId); 
                                                            setSupervisorId(team.supervisorId || "unassigned");
                                                            setSelectedMemberIds(team.memberIds.filter(id => id !== team.teamLeadId)); 
                                                            setIsDialogOpen(true); 
                                                        }}>
                                                            <Edit className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-sidebar text-white text-[10px] font-black uppercase rounded-none">Reconfigure Unit</TooltipContent>
                                                </Tooltip>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none text-destructive hover:bg-red-50 transition-all">
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Dissolve tactical unit?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">This action will unassign all members from "{team.name}" immediately. This cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-8 gap-3">
                                                            <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Confirm Dissolution</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={!!selectedTeamForSheet} onOpenChange={o => !o && setSelectedTeamForSheet(null)}>
                <SheetContent className="rounded-none border-none shadow-2xl w-full sm:max-w-md p-0 overflow-hidden flex flex-col">
                    <SheetHeader className="p-6 border-b bg-white shrink-0">
                      <SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{selectedTeamForSheet?.name} Fleet</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-3 pb-20">
                            {selectedTeamForSheet?.memberIds.map(memberId => {
                                const member = users?.find(u => u.id === memberId);
                                if (!member) return null;
                                return (
                                    <Link href={`/dashboard/users/${member.id}`} key={memberId} className="flex items-center gap-4 p-4 rounded-none hover:bg-primary/5 transition-colors border group shadow-sm">
                                        <Avatar className="size-12 rounded-none ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                            {member.avatar ? (
                                                isUrl(member.avatar) ? (
                                                    <AvatarImage src={member.avatar} className="object-cover rounded-none" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center bg-primary/10 font-black">{member.avatar}</div>
                                                )
                                            ) : <AvatarFallback className="rounded-none font-black">{member.firstName?.[0]}</AvatarFallback>}
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm uppercase tracking-tight truncate group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{member.jobTitle}</p>
                                        </div>
                                        {memberId === selectedTeamForSheet.teamLeadId && <Badge className="bg-primary/10 text-primary border-none rounded-none text-[8px] font-black uppercase tracking-widest px-2.5 h-5">Lead</Badge>}
                                    </Link>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="rounded-none sm:max-w-lg p-8 border-none shadow-2xl">
                    <DialogHeader className="text-left">
                      <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingTeam ? 'Reconfigure Unit' : 'Dispatch New Team'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Unit Designation</Label>
                          <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g., Tactical Growth Division" className="rounded-none h-12 font-bold text-sm" />
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <ShieldCheck className="size-3" /> Primary Supervisor (Level 1/2)
                            </Label>
                            <Select value={supervisorId} onValueChange={setSupervisorId}>
                                <SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select Supervisor" /></SelectTrigger>
                                <SelectContent className="rounded-none">
                                    <SelectItem value="unassigned">General Oversight (Default)</SelectItem>
                                    {potentialSupervisors.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role === 'CEO/Admin' ? 'CEO' : 'Admin'})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Lead Strategist</Label>
                            <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                                <SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select leader" /></SelectTrigger>
                                <SelectContent className="rounded-none">{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Fleet Selection</Label>
                            <ScrollArea className="h-48 rounded-none border p-4 bg-muted/10">
                                <div className="space-y-2">
                                    {users?.map(member => (
                                        <div key={member.id} className="flex items-center gap-3 p-3 bg-white border border-transparent hover:border-primary/20 transition-all">
                                            <Checkbox id={`m-${member.id}`} checked={selectedMemberIds.includes(member.id)} onCheckedChange={c => setSelectedMemberIds(p => c ? [...p, member.id] : p.filter(i => i !== member.id))} className="rounded-none" />
                                            <Label htmlFor={`m-${member.id}`} className={cn("font-bold text-xs uppercase cursor-pointer flex-1", member.teamId && member.teamId !== editingTeam?.id && "text-muted-foreground opacity-50")}>
                                                {member.firstName} {member.lastName}
                                            </Label>
                                            {member.teamId && member.teamId !== editingTeam?.id ? (
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-none bg-muted/50 rounded-none h-4">Assigned</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-none bg-green-50 text-green-600 rounded-none h-4">Ready</Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateOrUpdateTeam} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Deployment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
        </TooltipProvider>
    );
}
