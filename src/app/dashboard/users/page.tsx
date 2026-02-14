

"use client";

import * as React from "react";
import { use } from "react";
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, Eye, EyeOff, ChevronDown } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";


type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  jobTitle: z.string().min(1, "Job title is required"),
  department: z.string().min(1, "Department is required"),
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
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

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
      jobTitle: "",
      department: "",
      role: "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: undefined,
      homeLongitude: undefined,
      homeLocationRangeKm: 0.5,
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
      jobTitle: "",
      department: "",
      role: "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: undefined,
      homeLongitude: undefined,
      homeLocationRangeKm: 0.5,
      isWfhAllowed: false,
    });
  };

  const handleEditUser = (userToEdit: UserData) => {
    setEditingUser(userToEdit);
    form.reset({
      firstName: userToEdit.firstName || "",
      lastName: userToEdit.lastName || "",
      email: userToEdit.email || "",
      jobTitle: userToEdit.jobTitle || "",
      department: userToEdit.department || "",
      role: userToEdit.role || "Member",
      password: "",
      confirmPassword: "",
      homeLatitude: (userToEdit as any).homeLatitude || undefined,
      homeLongitude: (userToEdit as any).homeLongitude || undefined,
      homeLocationRangeKm: (userToEdit as any).homeLocationRangeKm === 0 ? 0 : (userToEdit as any).homeLocationRangeKm || 0.5,
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
     if (currentUserRole === 'CEO/Admin' && userToDelete.id === currentUser.uid) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot delete your own CEO account." });
        return;
    }
     if (currentUserRole !== 'CEO/Admin' && userToDelete.role === 'CEO/Admin') {
        toast({ variant: "destructive", title: "Permission Denied", description: "Only the CEO can manage the CEO account." });
        return;
    }
     if (!canModify(userToDelete.role)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete this user." });
        return;
    }

    // Note: This does not delete the Firebase Auth user. That would require a backend function.
    const batch = writeBatch(firestore);
    const userDocRef = doc(firestore, 'users', userToDelete.id);
    batch.delete(userDocRef);
    
    // Delete from all potential role collections
    batch.delete(doc(firestore, 'roles_ceo', userToDelete.id));
    batch.delete(doc(firestore, 'roles_admin', userToDelete.id));
    batch.delete(doc(firestore, 'roles_hr_agent', userToDelete.id));
    batch.delete(doc(firestore, 'roles_team_lead', userToDelete.id));
    
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
            // Update user logic
            if (!canModify(editingUser.role) || !canModify(values.role)) {
                 toast({ variant: "destructive", title: "Permission Denied", description: "You cannot modify this user's role." });
                 return;
            }
            
            const batch = writeBatch(firestore);
            const userDocRef = doc(firestore, 'users', editingUser.id);
            const { password, confirmPassword, email, ...updateData } = values; // Exclude email from update
            batch.update(userDocRef, updateData);

            // Handle role change
            if (editingUser.role !== values.role) {
                // Delete old role docs
                batch.delete(doc(firestore, 'roles_ceo', editingUser.id));
                batch.delete(doc(firestore, 'roles_admin', editingUser.id));
                batch.delete(doc(firestore, 'roles_hr_agent', editingUser.id));
                batch.delete(doc(firestore, 'roles_team_lead', editingUser.id));
                
                // Add new role docs
                if (values.role === 'CEO/Admin') {
                    batch.set(doc(firestore, 'roles_ceo', editingUser.id), { employeeId: editingUser.id });
                    batch.set(doc(firestore, 'roles_admin', editingUser.id), { employeeId: editingUser.id });
                } else if (values.role === 'HR Manager') {
                    batch.set(doc(firestore, 'roles_hr_agent', editingUser.id), { employeeId: editingUser.id });
                } else if (values.role === 'Team Lead') {
                    batch.set(doc(firestore, 'roles_team_lead', editingUser.id), { employeeId: editingUser.id });
                }
            }
            
            await batch.commit();
            toast({ title: "User Updated", description: "User details have been saved." });

        } else {
            // Create user logic
            if (!values.password) {
              form.setError("password", { type: "manual", message: "Password is required for new users." });
              return;
            }
            
            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const newUserId = userCredential.user.uid;

            const userDocRef = doc(firestore, 'users', newUserId);
            const { password, confirmPassword, ...userData } = values;
            
            const newUserPayload = {
              id: newUserId,
              employeeId: newUserId,
              hireDate: new Date().toISOString(),
              ...userData,
              homeLocationRangeKm: values.homeLocationRangeKm || 0.5,
              isWfhAllowed: values.isWfhAllowed || false,
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
  
    const handleBulkWfhUpdate = async (enable: boolean) => {
        if (selectedUserIds.length === 0) return;
        const batch = writeBatch(firestore);
        selectedUserIds.forEach(userId => {
            const userRef = doc(firestore, 'users', userId);
            batch.update(userRef, { isWfhAllowed: enable });
        });
        await batch.commit();
        toast({
            title: "Bulk Update Successful",
            description: `${selectedUserIds.length} users have been updated.`
        });
        setSelectedUserIds([]);
    };

  const canModify = (targetRole: Role) => {
      if (currentUserRole === 'CEO/Admin') return true;
      if (currentUserRole === 'HR Manager' && targetRole !== 'CEO/Admin') return true;
      return false;
  }
  
  const canAddUser = currentUserRole === 'CEO/Admin' || currentUserRole === 'HR Manager';

  return (
    <>
      <PageHeader
        title="Manage Users"
        description="View, add, and manage all users in the system."
      >
        <div className="flex gap-2">
            {selectedUserIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Bulk Actions ({selectedUserIds.length})
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Apply to selected users</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleBulkWfhUpdate(true)}>
                    Enable Work From Home
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkWfhUpdate(false)}>
                    Disable Work From Home
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                              <Input 
                                  type="email" 
                                  {...field} 
                                  placeholder="john.doe@example.com"
                                  readOnly={!!editingUser}
                                  disabled={!!editingUser}
                                  className={editingUser ? "cursor-not-allowed bg-muted/50" : ""}
                              />
                          </FormControl>
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
                  <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={editingUser?.id === currentUser?.uid || !canModify(field.value)}>
                              <FormControl>
                                  <SelectTrigger>
                                      <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="Member">Member</SelectItem>
                                  <SelectItem value="Team Lead">Team Lead</SelectItem>
                                  <SelectItem value="HR Manager">HR Manager</SelectItem>
                                  {currentUserRole === 'CEO/Admin' && <SelectItem value="CEO/Admin">CEO/Admin</SelectItem>}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Password {editingUser ? '(Optional)' : ''}</FormLabel>
                              <div className="relative">
                                  <FormControl>
                                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                                  </FormControl>
                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                                      {showPassword ? <EyeOff /> : <Eye />}
                                  </Button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <div className="relative">
                              <FormControl>
                                  <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                              </FormControl>
                               <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                                  </Button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  {(currentUserRole === 'CEO/Admin' || currentUserRole === 'HR Manager') && (
                    <>
                        <Separator className="my-4"/>
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">Work From Home Settings</h4>
                             <FormField control={form.control} name="isWfhAllowed" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Allow Work From Home</FormLabel>
                                        <FormDescription>
                                            Let this user clock in from home.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="homeLatitude" render={({ field }) => (
                                    <FormItem><FormLabel>Home Latitude</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="homeLongitude" render={({ field }) => (
                                    <FormItem><FormLabel>Home Longitude</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <FormField control={form.control} name="homeLocationRangeKm" render={({ field }) => (
                                <FormItem><FormLabel>Home Clock-in Range (km)</FormLabel><FormControl><Input type="number" min="0" step="0.1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </>
                  )}
                  <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" onClick={resetDialog}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? 'Saving...' : 'Save User'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" disabled={!canAddUser}>
            <Link href="/dashboard/users/bulk">Bulk Create</Link>
          </Button>
        </div>
      </PageHeader>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedUserIds.length > 0 && users ? selectedUserIds.length === users.length : false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedUserIds(users?.map(u => u.id) || []);
                    } else {
                      setSelectedUserIds([]);
                    }
                  }}
                  aria-label="Select all rows"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Loading users...</TableCell></TableRow>
            ) : users?.map((user) => (
              <TableRow key={user.id} data-state={selectedUserIds.includes(user.id) && "selected"}>
                <TableCell>
                  <Checkbox
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUserIds(prev => [...prev, user.id]);
                      } else {
                        setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                      }
                    }}
                    aria-label={`Select row for ${user.firstName}`}
                  />
                </TableCell>
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
                      <DropdownMenuItem 
                        onClick={() => handleDeleteUser(user)} 
                        disabled={
                            user.id === currentUser?.uid ||
                            (currentUserRole !== 'CEO/Admin' && user.role === 'CEO/Admin')
                        } 
                        className="text-destructive"
                       >
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
