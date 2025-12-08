
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { PlusCircle, Users, Trash, Edit, MoreHorizontal, User, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { collection, query, doc, writeBatch } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    teamId?: string | null;
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
    
    const { data: currentUserData } = useDoc(useMemoFirebase(() => currentUser ? doc(firestore, "users", currentUser.uid) : null, [currentUser, firestore]));
    const userRole = (currentUserData as any)?.role;
    const canManageAllTeams = userRole === 'HR Manager' || userRole === 'CEO/Admin';

    const getTeamLeadName = (leadId: string) => {
        const lead = users?.find(u => u.id === leadId);
        return lead ? `${lead.firstName} ${lead.lastName}` : 'N/A';
    }

    const resetDialog = () => {
        setIsDialogOpen(false);
        setEditingTeam(null);
        setTeamName("");
        setTeamLeadId(undefined);
        setSelectedMemberIds([]);
    }

    const handleCreateOrUpdateTeam = async () => {
        if (!teamName || !teamLeadId) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please provide a team name and a leader.' });
            return;
        }

        const batch = writeBatch(firestore);
        
        const allMemberIdsForTeam = Array.from(new Set([teamLeadId, ...selectedMemberIds]));
        
        if (editingTeam) {
            const teamRef = doc(firestore, 'teams', editingTeam.id);
            batch.update(teamRef, { name: teamName, teamLeadId: teamLeadId, memberIds: allMemberIdsForTeam });
            
            const originalMembers = editingTeam.memberIds || [];
            const removedMembers = originalMembers.filter(id => !allMemberIdsForTeam.includes(id));
            removedMembers.forEach(memberId => {
                const userRef = doc(firestore, 'users', memberId);
                batch.update(userRef, { teamId: null });
            });

            allMemberIdsForTeam.forEach(memberId => {
                const userRef = doc(firestore, 'users', memberId);
                batch.update(userRef, { teamId: editingTeam.id });
            });
            
            toast({ title: 'Team Updated' });

        } else {
            const newTeamRef = doc(collection(firestore, 'teams'));
            batch.set(newTeamRef, { id: newTeamRef.id, name: teamName, teamLeadId: teamLeadId, memberIds: allMemberIdsForTeam });

            allMemberIdsForTeam.forEach(memberId => {
                const userRef = doc(firestore, 'users', memberId);
                batch.update(userRef, { teamId: newTeamRef.id });
            });

            toast({ title: 'Team Created' });
        }
        
        await batch.commit();
        resetDialog();
    }

    const handleOpenEditDialog = (team: WithId<Team>) => {
        setEditingTeam(team);
        setTeamName(team.name);
        setTeamLeadId(team.teamLeadId);
        setSelectedMemberIds(team.memberIds.filter(id => id !== team.teamLeadId) || []);
        setIsDialogOpen(true);
    }
    
    const handleDeleteTeam = async (team: WithId<Team>) => {
        const batch = writeBatch(firestore);
        const teamRef = doc(firestore, 'teams', team.id);
        
        (team.memberIds || []).forEach(memberId => {
            const userRef = doc(firestore, 'users', memberId);
            batch.update(userRef, { teamId: null });
        });
        
        batch.delete(teamRef);
        await batch.commit();
        toast({ title: 'Team Deleted', description: 'The team has been removed and members are unassigned.' });
    }

    const availableMembersForSelection = users?.filter(u => 
        u.role === 'Member' && (!u.teamId || (editingTeam && u.teamId === editingTeam.id))
    );

    const potentialLeads = users?.filter(u => {
        const isTeamLeadRole = u.role === 'Team Lead';
        if (!isTeamLeadRole) return false;

        const isAlreadyLeadOfAnotherTeam = teams?.some(team => team.id !== editingTeam?.id && team.teamLeadId === u.id);
        
        return !isAlreadyLeadOfAnotherTeam;
    });

    return (
        <>
            <PageHeader title="Manage Teams" description="Create and organize your teams.">
                {canManageAllTeams && (
                    <Dialog open={isDialogOpen} onOpenChange={open => !open && resetDialog()}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setIsDialogOpen(true)}>
                                <PlusCircle className="mr-2" /> Add Team
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>{editingTeam ? 'Edit Team' : 'Create New Team'}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="team-name">Team Name</Label>
                                    <Input id="team-name" value={teamName} onChange={e => setTeamName(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="team-lead">Team Leader</Label>
                                    <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                                        <SelectTrigger><SelectValue placeholder="Select a leader" /></SelectTrigger>
                                        <SelectContent>
                                            {potentialLeads?.map(lead => (
                                                <SelectItem key={lead.id} value={lead.id}>{lead.firstName} {lead.lastName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Team Members</Label>
                                    <ScrollArea className="h-40 rounded-md border">
                                        <div className="p-2 space-y-1">
                                            {availableMembersForSelection?.map(member => (
                                                <div key={member.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-muted">
                                                    <Checkbox
                                                        id={`member-${member.id}`}
                                                        checked={selectedMemberIds.includes(member.id)}
                                                        onCheckedChange={checked => {
                                                            setSelectedMemberIds(prev => checked ? [...prev, member.id] : prev.filter(id => id !== member.id));
                                                        }}
                                                    />
                                                    <Label htmlFor={`member-${member.id}`} className="font-normal flex-1 cursor-pointer">{member.firstName} {member.lastName}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleCreateOrUpdateTeam}>Save Team</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>
            <Sheet open={!!selectedTeamForSheet} onOpenChange={(isOpen) => !isOpen && setSelectedTeamForSheet(null)}>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Team Name</TableHead>
                                <TableHead>Team Leader</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamsLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading teams...</TableCell></TableRow>
                            ) : (teams || []).map(team => {
                                const isTeamLead = currentUser?.uid === team.teamLeadId;
                                return (
                                <TableRow key={team.id}>
                                    <TableCell className="font-medium">{team.name}</TableCell>
                                    <TableCell>{getTeamLeadName(team.teamLeadId)}</TableCell>
                                    <TableCell>{team.memberIds.length}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => setSelectedTeamForSheet(team)}>
                                                    <Users className="mr-2 h-4 w-4"/> View Members
                                                </DropdownMenuItem>
                                                {(canManageAllTeams || isTeamLead) && (
                                                    <DropdownMenuItem onClick={() => handleOpenEditDialog(team)}>
                                                        <Edit className="mr-2 h-4 w-4"/> Edit Team
                                                    </DropdownMenuItem>
                                                )}
                                                {canManageAllTeams && (
                                                    <DropdownMenuItem onClick={() => handleDeleteTeam(team)} className="text-destructive">
                                                        <Trash className="mr-2 h-4 w-4"/> Delete Team
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
                {selectedTeamForSheet && (
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>{selectedTeamForSheet.name}</SheetTitle>
                            <SheetDescription>Members of this team.</SheetDescription>
                        </SheetHeader>
                        <div className="py-4">
                            {selectedTeamForSheet.memberIds.map(memberId => {
                                const member = users?.find(u => u.id === memberId);
                                if (!member) return null;
                                const isLead = memberId === selectedTeamForSheet.teamLeadId;
                                return (
                                    <div key={memberId} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                                        <Avatar>
                                            <AvatarFallback>{member.firstName?.[0]}{member.lastName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.firstName} {member.lastName} {isLead && <span className="text-xs text-muted-foreground">(Lead)</span>}</p>
                                            <p className="text-sm text-muted-foreground">{member.role}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </SheetContent>
                )}
            </Sheet>
        </>
    );
}
