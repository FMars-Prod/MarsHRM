
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { PlusCircle, Users, Trash, Edit, MoreHorizontal, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { collection, query, doc, writeBatch } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    teamId?: string | null;
    avatar?: string;
};

type Team = {
    id: string;
    name: string;
    teamLeadId: string;
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

    const handleCreateOrUpdateTeam = async () => {
        if (!teamName || !teamLeadId) {
            toast({ variant: 'destructive', title: 'Missing Fields' });
            return;
        }

        const batch = writeBatch(firestore);
        const allMemberIdsForTeam = Array.from(new Set([teamLeadId, ...selectedMemberIds]));

        if (editingTeam) {
            const teamRef = doc(firestore, 'teams', editingTeam.id);
            batch.update(teamRef, { name: teamName, teamLeadId: teamLeadId, memberIds: allMemberIdsForTeam });
            editingTeam.memberIds?.filter(id => !allMemberIdsForTeam.includes(id)).forEach(id => batch.update(doc(firestore, 'users', id), { teamId: null }));
            allMemberIdsForTeam.forEach(memberId => batch.update(doc(firestore, 'users', memberId), { teamId: editingTeam.id }));
            toast({ title: 'Team Updated' });
        } else {
            const newTeamRef = doc(collection(firestore, 'teams'));
            batch.set(newTeamRef, { id: newTeamRef.id, name: teamName, teamLeadId: teamLeadId, memberIds: allMemberIdsForTeam });
            allMemberIdsForTeam.forEach(memberId => batch.update(doc(firestore, 'users', memberId), { teamId: newTeamRef.id }));
            toast({ title: 'Team Created' });
        }
        await batch.commit();
        setIsDialogOpen(false);
        setEditingTeam(null);
        setTeamName("");
        setTeamLeadId(undefined);
        setSelectedMemberIds([]);
    }

    return (
        <>
            <PageHeader title="Organizational Units" description="Manage tactical team associations and leadership hierarchies.">
                {canManageAllTeams && (
                    <Button onClick={() => setIsDialogOpen(true)} className="rounded-full h-11"><PlusCircle className="mr-2" /> Add Team</Button>
                )}
            </PageHeader>
            <div className="border rounded-2xl overflow-hidden bg-white/50 ring-1 ring-border/50 shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="font-black uppercase tracking-tighter text-[10px]">Team Unit</TableHead>
                            <TableHead className="font-black uppercase tracking-tighter text-[10px]">Lead Strategist</TableHead>
                            <TableHead className="font-black uppercase tracking-tighter text-[10px]">Fleet Size</TableHead>
                            <TableHead className="text-right font-black uppercase tracking-tighter text-[10px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teamsLoading ? (<TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse">Syncing Units...</TableCell></TableRow>) : teams?.map(team => (
                            <TableRow key={team.id} className="border-border/50">
                                <TableCell className="font-bold py-4">{team.name}</TableCell>
                                <TableCell className="font-medium text-xs text-primary">{getTeamLeadName(team.teamLeadId)}</TableCell>
                                <TableCell><Badge variant="secondary" className="rounded-full font-bold">{team.memberIds.length}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setSelectedTeamForSheet(team)}><Users className="mr-2 h-4 w-4"/> Review Fleet</DropdownMenuItem>
                                            {canManageAllTeams && (<DropdownMenuItem onClick={() => { setEditingTeam(team); setTeamName(team.name); setTeamLeadId(team.teamLeadId); setSelectedMemberIds(team.memberIds.filter(id => id !== team.teamLeadId)); setIsDialogOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Reconfigure</DropdownMenuItem>)}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={!!selectedTeamForSheet} onOpenChange={o => !o && setSelectedTeamForSheet(null)}>
                <SheetContent className="rounded-l-3xl border-none shadow-2xl">
                    <SheetHeader className="pb-6 border-b"><SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{selectedTeamForSheet?.name} Fleet</SheetTitle></SheetHeader>
                    <ScrollArea className="h-full py-6 pr-4">
                        <div className="space-y-3">
                            {selectedTeamForSheet?.memberIds.map(memberId => {
                                const member = users?.find(u => u.id === memberId);
                                if (!member) return null;
                                return (
                                    <Link href={`/dashboard/users/${member.id}`} key={memberId} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/5 transition-colors border group">
                                        <Avatar className="size-10">
                                            {member.avatar ? <span className="text-2xl">{member.avatar}</span> : <AvatarFallback>{member.firstName?.[0]}</AvatarFallback>}
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{member.jobTitle}</p>
                                        </div>
                                        {memberId === selectedTeamForSheet.teamLeadId && <Badge className="bg-primary/10 text-primary border-none rounded-full text-[8px] uppercase">Lead</Badge>}
                                    </Link>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-lg">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">{editingTeam ? 'Reconfigure Unit' : 'Dispatch New Team'}</DialogTitle></DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Unit Designation</Label><Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g., Tactical Growth Division" className="rounded-xl h-11" /></div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Lead Strategist</Label>
                            <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select leader" /></SelectTrigger>
                                <SelectContent>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Fleet Selection</Label>
                            <ScrollArea className="h-40 rounded-2xl border p-4 bg-muted/10">
                                <div className="space-y-2">
                                    {users?.map(member => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                                            <Checkbox id={`m-${member.id}`} checked={selectedMemberIds.includes(member.id)} onCheckedChange={c => setSelectedMemberIds(p => c ? [...p, member.id] : p.filter(i => i !== member.id))} />
                                            <Label htmlFor={`m-${member.id}`} className="font-bold text-sm cursor-pointer">{member.firstName} {member.lastName}</Label>
                                            <span className="text-[9px] text-muted-foreground uppercase ml-auto">{member.jobTitle}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateOrUpdateTeam} className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Deployment</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
