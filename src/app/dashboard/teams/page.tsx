
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trash, Edit, MoreHorizontal, UserCheck, AlertCircle, Trash2, ShieldCheck, Search, X, Check } from "lucide-react";
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
    teamLeadId?: string | null;
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
    const [teamLeadId, setTeamLeadId] = React.useState<string | undefined>("unassigned");
    const [supervisorId, setSupervisorId] = React.useState<string | undefined>("unassigned");
    const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = React.useState("");
    const [selectedTeamForSheet, setSelectedTeamForSheet] = React.useState<WithId<Team> | null>(null);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
    
    const { data: currentUserData } = useDoc<any>(useMemoFirebase(() => currentUser ? doc(firestore, "users", currentUser.uid) : null, [currentUser, firestore]));
    const canManageAllTeams = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';
    
    const getTeamLeadName = (leadId?: string | null) => {
        if (!leadId || leadId === 'unassigned') return 'No Lead Assigned';
        const lead = users?.find(u => u.id === leadId);
        return lead ? `${lead.firstName} ${lead.lastName}` : 'N/A';
    }

    const getSupervisorName = (sId?: string) => {
        if (!sId || sId === 'unassigned') return 'General Oversight';
        const sup = users?.find(u => u.id === sId);
        return sup ? `${sup.firstName} ${sup.lastName}` : 'General Oversight';
    }

    const handleCreateOrUpdateTeam = async () => {
        if (!teamName) {
            toast({ variant: 'destructive', title: 'Missing Team Name' });
            return;
        }

        const batch = writeBatch(firestore);
        const finalLeadId = teamLeadId === 'unassigned' ? null : teamLeadId;
        const allMemberIdsForTeam = Array.from(new Set(finalLeadId ? [finalLeadId, ...selectedMemberIds] : selectedMemberIds));
        const finalSupervisorId = supervisorId === 'unassigned' ? null : supervisorId;

        if (editingTeam) {
            const teamRef = doc(firestore, 'teams', editingTeam.id);
            batch.update(teamRef, { 
                name: teamName, 
                teamLeadId: finalLeadId, 
                supervisorId: finalSupervisorId,
                memberIds: allMemberIdsForTeam 
            });
            
            // We no longer exclusively assign teamId to user because they can be in multiple teams
            // But we can keep it as a 'primary' team for legacy if needed. 
            // For now, we rely on the Team entity's memberIds as the source of truth.
            
            toast({ title: 'Team Configuration Updated' });
        } else {
            const newTeamRef = doc(collection(firestore, 'teams'));
            batch.set(newTeamRef, { 
                id: newTeamRef.id, 
                name: teamName, 
                teamLeadId: finalLeadId, 
                supervisorId: finalSupervisorId, 
                memberIds: allMemberIdsForTeam 
            });
            toast({ title: 'New Team Unit Dispatched' });
        }
        await batch.commit();
        setIsDialogOpen(false);
        setEditingTeam(null);
        setTeamName("");
        setTeamLeadId("unassigned");
        setSupervisorId("unassigned");
        setSelectedMemberIds([]);
        setMemberSearchQuery("");
    }

    const handleDeleteTeam = async (teamId: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'teams', teamId));
        toast({ title: "Team Deleted", description: "The team has been removed from the registry." });
    }

    const isUrl = (str?: string) => str && str.startsWith('http');

    const potentialSupervisors = React.useMemo(() => {
        return users?.filter(u => u.role === 'CEO/Admin' || u.role === 'HR Manager') || [];
    }, [users]);

    const filteredMembers = React.useMemo(() => {
        if (!users) return [];
        return users.filter(u => 
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
            u.jobTitle.toLowerCase().includes(memberSearchQuery.toLowerCase())
        );
    }, [users, memberSearchQuery]);

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
                                <TableCell><Badge variant="secondary" className="rounded-none font-black text-[10px] px-3">{team.memberIds?.length || 0} Units</Badge></TableCell>
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
                                                            setTeamLeadId(team.teamLeadId || "unassigned"); 
                                                            setSupervisorId(team.supervisorId || "unassigned");
                                                            setSelectedMemberIds(team.memberIds || []); 
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
                                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Delete Team?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">Are you sure you want to delete this team? All members will be removed from the team registry.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-8 gap-3">
                                                            <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Delete</AlertDialogAction>
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
                            {selectedTeamForSheet?.memberIds?.map(memberId => {
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

            <Dialog open={isDialogOpen} onOpenChange={(o) => { if(!o) { setEditingTeam(null); setTeamName(""); setTeamLeadId("unassigned"); setSupervisorId("unassigned"); setSelectedMemberIds([]); setMemberSearchQuery(""); } setIsDialogOpen(o); }}>
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
                                    {potentialSupervisors.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Lead Strategist (Optional)</Label>
                            <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                                <SelectTrigger className="rounded-none h-12 font-bold text-sm bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select leader" /></SelectTrigger>
                                <SelectContent className="rounded-none">
                                    <SelectItem value="unassigned">No Lead (Self-Managed)</SelectItem>
                                    {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Fleet Roster</Label>
                                <Badge variant="outline" className="rounded-none text-[8px] font-black uppercase px-2">{selectedMemberIds.length} Selected</Badge>
                            </div>
                            
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                <Input 
                                    placeholder="Search Fleet members..." 
                                    value={memberSearchQuery}
                                    onChange={e => setMemberSearchQuery(e.target.value)}
                                    className="pl-10 h-10 rounded-none bg-muted/20 border-none ring-1 ring-border/50 text-xs font-bold uppercase"
                                />
                            </div>

                            <ScrollArea className="h-56 rounded-none border p-2 bg-muted/10">
                                <div className="space-y-1">
                                    {filteredMembers.map(member => (
                                        <div key={member.id} className={cn(
                                            "flex items-center gap-3 p-3 transition-all border border-transparent",
                                            selectedMemberIds.includes(member.id) ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white hover:border-primary/20"
                                        )}>
                                            <Checkbox 
                                                id={`m-${member.id}`} 
                                                checked={selectedMemberIds.includes(member.id)} 
                                                onCheckedChange={c => setSelectedMemberIds(p => c ? [...p, member.id] : p.filter(i => i !== member.id))} 
                                                className="rounded-none" 
                                            />
                                            <Label htmlFor={`m-${member.id}`} className="font-bold text-xs uppercase cursor-pointer flex-1 flex items-center gap-3">
                                                <Avatar className="size-6 rounded-none border">
                                                    <AvatarImage src={member.avatar} />
                                                    <AvatarFallback className="text-[8px] font-black">{member.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className={cn(selectedMemberIds.includes(member.id) ? "text-primary" : "text-foreground")}>{member.firstName} {member.lastName}</span>
                                                    <span className="text-[8px] opacity-40 leading-none">{member.jobTitle}</span>
                                                </div>
                                            </Label>
                                            {selectedMemberIds.includes(member.id) && <Check className="size-3 text-primary" />}
                                        </div>
                                    ))}
                                    {filteredMembers.length === 0 && (
                                        <div className="py-10 text-center opacity-20 uppercase font-black text-[9px] tracking-widest">No matching personnel</div>
                                    )}
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
