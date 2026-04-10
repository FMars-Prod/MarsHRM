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
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Eye, EyeOff, UserPlus } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area";

type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  department: z.string().min(1, "Department is required"),
  employmentType: z.enum(['Intern', 'Employee']),
  role: z.enum(['Member', 'Team Lead', 'HR Manager', 'CEO/Admin']),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  homeLatitude: z.coerce.number().optional(),
  homeLongitude: z.coerce.number().optional(),
  homeLocationRangeKm: z.coerce.number().min(0, "Range cannot be negative.").optional(),
  isWfhAllowed: z.boolean().optional(),
}).refine(data => {
    if (data.password && data.password.length < 6) {
        return false;
    }
    return true;
}, {
    message: "Password must be at least 6 characters long.",
    path: ["password"],
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type UserFormValues = z.infer<typeof userSchema>;
type UserData = UserFormValues & { id: string };

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserData | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading } = useCollection<UserData>(usersQuery);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, "users", currentUser.uid) : null), [currentUser, firestore]);
  const { data: currentUserData } = useDoc(userDocRef);
  const currentUserRole = (currentUserData as any)?.role;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      employmentType: "Intern",
      role: "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: undefined,
      homeLongitude: undefined,
      homeLocationRangeKm: 5,
      isWfhAllowed: false,
    },
  });

  const resetDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    form.reset({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      employmentType: "Intern",
      role: "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: undefined,
      homeLongitude: undefined,
      homeLocationRangeKm: 5,
      isWfhAllowed: false,
    });
  };

  const handleEditUser = (userToEdit: UserData) => {
    setEditingUser(userToEdit);
    form.reset({
      firstName: userToEdit.firstName || "",
      lastName: userToEdit.lastName || "",
      email: userToEdit.email || "",
      phoneNumber: userToEdit.phoneNumber || "",
      jobTitle: userToEdit.jobTitle || "",
      department: userToEdit.department || "",
      employmentType: userToEdit.employmentType || "Intern",
      role: userToEdit.role || "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: (userToEdit as any).homeLatitude || undefined,
      homeLongitude: (userToEdit as any).homeLongitude || undefined,
      homeLocationRangeKm: (userToEdit as any).homeLocationRangeKm === 0 ? 0 : (userToEdit as any).homeLocationRangeKm || 5,
      isWfhAllowed: (userToEdit as any).isWfhAllowed || false,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteUser = async (userToDelete: UserData) => {
    if (!firestore || !currentUser) return;
    if (userToDelete.id === currentUser.uid) {
        toast({ variant: "destructive", title: "Cannot delete yourself." });
        return;
    }
    
    if (!canModify(userToDelete.role)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete this user." });
        return;
    }

    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userToDelete.id);
    batch.delete(userRef);
    
    batch.delete(doc(firestore, 'system_roles_admin', userToDelete.id));
    batch.delete(doc(firestore, 'system_roles_hr', userToDelete.id));
    batch.delete(doc(firestore, 'system_roles_teamlead', userToDelete.id));
    
    await batch.commit().then(() => {
        toast({ title: "User Deleted", description: "The user has been removed." });
    }).catch(e => {
        toast({ variant: "destructive", title: "Error", description: e.message });
    });
  };

  const onSubmit = async (values: UserFormValues) => {
    if (!firestore || !auth) return;
    
    try {
        if (editingUser) {
            if (!canModify(editingUser.role) || !canModify(values.role)) {
                 toast({ variant: "destructive", title: "Permission Denied" });
                 return;
            }
            
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', editingUser.id);
            const { password, confirmPassword, email, ...updateData } = values;

            batch.update(userRef, updateData);

            if (editingUser.role !== values.role) {
                batch.delete(doc(firestore, 'system_roles_admin', editingUser.id));
                batch.delete(doc(firestore, 'system_roles_hr', editingUser.id));
                batch.delete(doc(firestore, 'system_roles_teamlead', editingUser.id));
                
                if (values.role === 'CEO/Admin') {
                    batch.set(doc(firestore, 'system_roles_admin', editingUser.id), { employeeId: editingUser.id });
                } else if (values.role === 'HR Manager') {
                    batch.set(doc(firestore, 'system_roles_hr', editingUser.id), { employeeId: editingUser.id });
                } else if (values.role === 'Team Lead') {
                    batch.set(doc(firestore, 'system_roles_teamlead', editingUser.id), { employeeId: editingUser.id });
                }
            }
            
            await batch.commit();
            toast({ title: "User Updated" });

        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password!);
            const newUserId = userCredential.user.uid;

            const userRef = doc(firestore, 'users', newUserId);
            const { password, confirmPassword, ...userData } = values;
            
            const newUserPayload = {
              id: newUserId,
              employeeId: newUserId,
              hireDate: new Date().toISOString(),
              ...userData,
            };

            const batch = writeBatch(firestore);
            batch.set(userRef, newUserPayload);

            if (values.role === 'CEO/Admin') {
                batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
            } else if (values.role === 'HR Manager') {
                batch.set(doc(firestore, 'system_roles_hr', newUserId), { employeeId: newUserId });
            } else if (values.role === 'Team Lead') {
                batch.set(doc(firestore, 'system_roles_teamlead', newUserId), { employeeId: newUserId });
            }

            await batch.commit();
            toast({ title: "User Created" });
        }
        resetDialog();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Operation Failed", description: error.message });
    }
  };
  
  const canModify = (targetRole: Role) => {
      if (currentUserRole === 'CEO/Admin') return true;
      if (currentUserRole === 'HR Manager' && targetRole !== 'CEO/Admin') return true;
      return false;
  }
  
  const canAddUser = currentUserRole === 'CEO/Admin' || currentUserRole === 'HR Manager';

  return (
    <>
      <PageHeader title="Manage Users" description="View, add, and manage all users in the system.">
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)} disabled={!canAddUser}>
                <PlusCircle className="mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update the details for this user." : "Fill in the form to create a new user."}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] -mx-6">
              <div className="px-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="firstName" render={({ field }) => (
                          <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} placeholder="John" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (
                          <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} placeholder="Doe" /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                              <Input type="email" {...field} placeholder="john.doe@example.com" disabled={!!editingUser} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input {...field} placeholder="+91..." /></FormControl>
                          <FormDescription>Include country code.</FormDescription>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="jobTitle" render={({ field }) => (
                          <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="department" render={({ field }) => (
                          <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Intern">Intern</SelectItem><SelectItem value="Employee">Employee</SelectItem></SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="role" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={editingUser?.id === currentUser?.uid || !canModify(field.value)}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Member">Member</SelectItem>
                                    <SelectItem value="Team Lead">Team Lead</SelectItem>
                                    <SelectItem value="HR Manager">HR Manager</SelectItem>
                                    {currentUserRole === 'CEO/Admin' && <SelectItem value="CEO/Admin">CEO/Admin</SelectItem>}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                  </div>
                  {!editingUser && (
                    <>
                      <FormField control={form.control} name="password" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Password</FormLabel>
                              <div className="relative">
                                  <FormControl><Input type={showPassword ? "text" : "password"} {...field} /></FormControl>
                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <div className="relative">
                                  <FormControl><Input type={showConfirmPassword ? "text" : "password"} {...field} /></FormControl>
                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff /> : <Eye />}</Button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )} />
                    </>
                  )}
                  <DialogFooter className="pt-4">
                    <Button type="submit" disabled={form.formState.isSubmitting}>Save User</Button>
                  </DialogFooter>
                </form>
              </Form>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" disabled={!canAddUser}>
            <Link href="/dashboard/users/bulk"><UserPlus className="mr-2 h-4 w-4" /> Bulk Create</Link>
          </Button>
        </div>
      </PageHeader>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Loading users...</TableCell></TableRow>
            ) : users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                <TableCell><Badge variant="secondary">{user.employmentType}</Badge></TableCell>
                <TableCell>{user.jobTitle}</TableCell>
                <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                       <DropdownMenuItem asChild><Link href={`/dashboard/users/${user.id}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditUser(user)} disabled={!canModify(user.role)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteUser(user)} disabled={user.id === currentUser?.uid || !canModify(user.role)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
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