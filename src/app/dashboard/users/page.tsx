
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Eye } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Link from "next/link";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";


type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  jobTitle: z.string().min(1, "Job title is required"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(['Member', 'Team Lead', 'HR Manager', 'CEO/Admin']),
});

type UserFormValues = z.infer<typeof userSchema>;

type UserData = UserFormValues & { id: string };

export default function UsersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserData | null>(null);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading } = useCollection<UserData>(usersQuery);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: currentUserData } = useDoc(userDocRef);
  const currentUserRole = (currentUserData as any)?.role;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      jobTitle: "",
      department: "",
      role: "Member",
    },
  });

  const resetDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    form.reset();
  };

  const handleEditUser = (userToEdit: UserData) => {
    setEditingUser(userToEdit);
    form.reset(userToEdit);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = (userToDelete: UserData) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const userDocRef = doc(firestore, 'users', userToDelete.id);
    batch.delete(userDocRef);
    
    if (userToDelete.role === 'CEO/Admin') {
        batch.delete(doc(firestore, 'roles_ceo', userToDelete.id));
        batch.delete(doc(firestore, 'roles_admin', userToDelete.id));
    } else if (userToDelete.role === 'HR Manager') {
        batch.delete(doc(firestore, 'roles_hr_agent', userToDelete.id));
    } else if (userToDelete.role === 'Team Lead') {
        batch.delete(doc(firestore, 'roles_team_lead', userToDelete.id));
    }
    
    batch.commit().then(() => {
        toast({ title: "User Deleted", description: "The user has been removed." });
    }).catch(e => {
        toast({ variant: "destructive", title: "Error", description: e.message });
    });
  };

  const onSubmit = async (values: UserFormValues) => {
    if (!firestore) return;

    try {
        if (editingUser) {
            // Update user logic
            const userDocRef = doc(firestore, 'users', editingUser.id);
            await updateDocumentNonBlocking(userDocRef, values);
            toast({ title: "User Updated", description: "User details have been saved." });
        } else {
            // Create user logic - NOTE: This only creates a Firestore record, not a Firebase Auth user.
            const newUserId = doc(collection(firestore, 'temp')).id;
            const userDocRef = doc(firestore, 'users', newUserId);
            const newUserPayload = {
              id: newUserId,
              employeeId: newUserId,
              hireDate: new Date().toISOString(),
              ...values
            }
            
            const batch = writeBatch(firestore);
            batch.set(userDocRef, newUserPayload);

            if (values.role === 'CEO/Admin') {
                batch.set(doc(firestore, 'roles_ceo', newUserId), { employeeId: newUserId });
                batch.set(doc(firestore, 'roles_admin', newUserId), { employeeId: newUserId });
            } else if (values.role === 'HR Manager') {
                batch.set(doc(firestore, 'roles_hr_agent', newUserId), { employeeId: newUserId });
            } else if (values.role === 'Team Lead') {
                batch.set(doc(firestore, 'roles_team_lead', newUserId), { employeeId: newUserId });
            }

            await batch.commit();

            toast({ title: "User Created", description: "The new user has been added." });
        }
        resetDialog();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Operation Failed", description: error.message });
    }
  };

  const canModify = (role: Role) => {
      if (currentUserRole !== 'CEO/Admin') return false;
      return !['CEO/Admin', 'HR Manager'].includes(role);
  }

  return (
    <>
      <PageHeader
        title="Manage Users"
        description="View, add, and manage all users in the system."
      >
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <PlusCircle className="mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update the details for this user." : "Fill in the form to create a new user."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="jobTitle" render={({ field }) => (
                        <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="department" render={({ field }) => (
                        <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Member">Member</SelectItem>
                                <SelectItem value="Team Lead">Team Lead</SelectItem>
                                <SelectItem value="HR Manager">HR Manager</SelectItem>
                                <SelectItem value="CEO/Admin">CEO/Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" onClick={resetDialog}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving...' : 'Save User'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">Loading users...</TableCell></TableRow>
            ) : users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                <TableCell>{user.jobTitle}</TableCell>
                <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                       <DropdownMenuItem asChild>
                          <Link href={`/dashboard/users/${user.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </Link>
                       </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditUser(user)} disabled={!canModify(user.role)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteUser(user)} disabled={!canModify(user.role)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
