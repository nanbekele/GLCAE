import { ReactNode, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffManagement, StaffMember } from "@/hooks/useStaffManagement";

const staffStatusBadge = (member: StaffMember) => {
  const badgeClass = member.is_activated ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
  const label = member.is_activated ? "Activated" : "Pending";
  const profileStatus = member.profile?.is_active === false ? "Inactive" : null;

  return (
    <div className="flex flex-col gap-1">
      <Badge className={badgeClass}>{label}</Badge>
      {profileStatus ? <Badge variant="outline">{profileStatus}</Badge> : null}
    </div>
  );
};

export interface UserManagementDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UserManagementDialog: React.FC<UserManagementDialogProps> = ({ trigger, open: controlledOpen, onOpenChange }) => {
  const {
    staff,
    staffLoading,
    staffSubmitting,
    staffForm,
    staffRoleFilter,
    setStaffRoleFilter,
    staffRoles,
    activeStaffId,
    fetchStaff,
    handleStaffInputChange,
    handleResetStaffForm,
    handleEditStaff,
    handleDeleteStaff,
    handleSubmitStaff,
  } = useStaffManagement();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const dialogOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      handleResetStaffForm();
    }

    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (dialogOpen) {
      void fetchStaff(false, staffRoleFilter);
    }
  }, [dialogOpen, fetchStaff, staffRoleFilter]);

  const triggerButton = useMemo(() => {
    if (!trigger) return null;
    return <DialogTrigger asChild>{trigger}</DialogTrigger>;
  }, [trigger]);

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {triggerButton}
      <DialogContent className="max-w-20xl w-[100vw] lg:w-[95vw]">
        <DialogHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck size={20} />
                <span>Manage Staff Accounts</span>
              </DialogTitle>
              <DialogDescription>
                Register new staff members or update existing accounts. Passwords are generated automatically and emailed to the user.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="staffRoleFilter" className="text-sm font-medium">
                Filter by role
              </Label>
              <Select
                value={staffRoleFilter ?? "all"}
                onValueChange={(value) => {
                  const nextValue = value === "all" ? null : value;
                  setStaffRoleFilter(nextValue);
                  void fetchStaff(true, nextValue);
                }}
              >
                <SelectTrigger id="staffRoleFilter" className="w-48">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {staffRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-2">
          <section className="rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-4 text-lg font-semibold">
              {activeStaffId ? "Update Staff Member" : "Register Staff Member"}
            </h3>
            <form onSubmit={handleSubmitStaff} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="staffFullName">Full Name</Label>
                <Input
                  id="staffFullName"
                  value={staffForm.fullName}
                  onChange={(event) => handleStaffInputChange("fullName", event.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  value={staffForm.email}
                  onChange={(event) => handleStaffInputChange("email", event.target.value)}
                  placeholder="jane.doe@example.com"
                  required
                  disabled={Boolean(activeStaffId)}
                />
              </div>
              <div>
                <Label htmlFor="staffRole">Role</Label>
                <Select value={staffForm.role || undefined} onValueChange={(value) => handleStaffInputChange("role", value)}>
                  <SelectTrigger id="staffRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staffPhone">Phone</Label>
                <Input
                  id="staffPhone"
                  value={staffForm.phone}
                  onChange={(event) => handleStaffInputChange("phone", event.target.value)}
                  placeholder="+251-900-000000"
                />
              </div>
              <div>
                <Label htmlFor="staffDepartment">Department</Label>
                <Select
                  value={staffForm.department || undefined}
                  onValueChange={(value) => handleStaffInputChange("department", value)}
                >
                  <SelectTrigger id="staffDepartment">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Architectural & Civil">Architectural & Civil</SelectItem>
                    <SelectItem value="ICT">ICT</SelectItem>
                    <SelectItem value="Electro-Mechanical">Electro-Mechanical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staffPosition">Position</Label>
                <Input
                  id="staffPosition"
                  value={staffForm.position}
                  onChange={(event) => handleStaffInputChange("position", event.target.value)}
                  placeholder="e.g. HR Manager"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="staffActivated" className="flex items-center gap-2 text-sm">
                  <input
                    id="staffActivated"
                    type="checkbox"
                    checked={staffForm.isActivated}
                    onChange={(event) => handleStaffInputChange("isActivated", event.target.checked)}
                    className="h-4 w-4"
                    disabled={!activeStaffId}
                  />
                  Activated
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="staffActive" className="flex items-center gap-2 text-sm">
                  <input
                    id="staffActive"
                    type="checkbox"
                    checked={staffForm.isActive}
                    onChange={(event) => handleStaffInputChange("isActive", event.target.checked)}
                    className="h-4 w-4"
                    disabled={!activeStaffId}
                  />
                  Active profile
                </Label>
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                {activeStaffId ? (
                  <Button type="button" variant="outline" onClick={handleResetStaffForm}>
                    Cancel Edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={staffSubmitting}>
                  {staffSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {activeStaffId ? "Saving changes..." : "Registering..."}
                    </>
                  ) : activeStaffId ? (
                    "Save Changes"
                  ) : (
                    "Register Staff"
                  )}
                </Button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Registered Staff</h3>
              <Button variant="secondary" size="sm" onClick={() => fetchStaff(true, staffRoleFilter)} disabled={staffLoading}>
                {staffLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        {staffLoading ? "Loading staff..." : "No staff members yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    staff.map((member) => (
                      <TableRow key={member.id} className={cn(activeStaffId === member.id && "bg-muted/50")}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{member.full_name ?? member.email}</span>
                            {member.position ? <span className="text-xs text-muted-foreground">{member.position}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell>{member.department ?? "—"}</TableCell>
                        <TableCell>{staffStatusBadge(member)}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStaff(member)}
                            disabled={staffSubmitting}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStaff(member)}
                            disabled={staffSubmitting}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Passwords are automatically generated and sent via email when a new staff member is registered.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserManagementDialog;
