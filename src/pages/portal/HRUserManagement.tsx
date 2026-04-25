import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { callFunction } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";
import { ChevronLeft, Eye, EyeOff, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";

type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: string | null;
  is_active: boolean | null;
};

interface StaffMember {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
  employment_date: string | null;
  is_activated: boolean;
  created_at: string | null;
  updated_at: string | null;
  profile: StaffProfile | null;
}

interface StaffFormState {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  isActivated: boolean;
  isActive: boolean;
}

const getEmptyStaffForm = (): StaffFormState => ({
  fullName: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  role: "",
  isActivated: true,
  isActive: true,
});

const emptyToNull = (value: string) => (value.trim().length === 0 ? null : value.trim());

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

const HRUserManagement = () => {
  const { profile, token } = useAuth();
  const { toast } = useToast();

  const departmentOptions = useMemo(
    () => [
      "Material Testing",
      "Architectural & Civil",
      "ICT",
      "Electro-Mechanical",
    ],
    [],
  );

  const staffRoles = useMemo(
    () => [
      { value: "super_admin", label: "Super Admin" },
      { value: "hr_staff", label: "HR Staff" },
      { value: "architectural_civil_head", label: "Architectural & Civil Head" },
      { value: "mechanical_head", label: "Mechanical Head" },
      { value: "ict_head", label: "ICT Head" },
      { value: "material_testing_head", label: "Material Testing Head" },
      { value: "marketing_communications", label: "Marketing Communications" },
      { value: "employee", label: "Employee" },
    ],
    [],
  );

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>(getEmptyStaffForm());
  const [staffRoleFilter, setStaffRoleFilter] = useState<string | null>(null);
  const [showRegisteredStaff, setShowRegisteredStaff] = useState(true);

  const fetchStaff = useCallback(
    async (showToast = false, role?: string | null) => {
      if (!token) {
        if (showToast) {
          toast({
            title: "No session",
            description: "Please sign in again to manage staff.",
            variant: "destructive",
          });
        }
        return;
      }

      setStaffLoading(true);
      try {
        const response = await callFunction<{ staff?: StaffMember[] }>(
          "marketing-manage",
          {
            action: "hr-list-staff",
            role: role ?? staffRoleFilter ?? undefined,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        setStaff(response?.staff ?? []);
        if (showToast) {
          toast({
            title: "Staff refreshed",
            description: "Latest staff records loaded.",
          });
        }
      } catch (error: any) {
        console.error("[HRUserManagement] Failed to fetch staff", error);
        toast({
          title: "Failed to load staff",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setStaffLoading(false);
      }
    },
    [toast, token, staffRoleFilter],
  );

  useEffect(() => {
    void fetchStaff(false, staffRoleFilter);
  }, [fetchStaff, staffRoleFilter]);

  const handleStaffInputChange = useCallback((key: keyof StaffFormState, value: string | boolean) => {
    setStaffForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleResetStaffForm = useCallback(() => {
    setActiveStaffId(null);
    setStaffForm(getEmptyStaffForm());
  }, []);

  const handleEditStaff = useCallback(
    (member: StaffMember) => {
      setActiveStaffId(member.id);
      setStaffForm({
        fullName: member.full_name ?? "",
        email: member.email ?? "",
        phone: member.phone ?? "",
        department: member.department ?? "",
        position: member.position ?? "",
        role: member.role ?? "",
        isActivated: Boolean(member.is_activated),
        isActive: Boolean(member.profile?.is_active ?? true),
      });
    },
    [],
  );

  const handleDeleteStaff = useCallback(
    async (member: StaffMember) => {
      if (!token) {
        toast({
          title: "No session",
          description: "Please sign in again to manage staff.",
          variant: "destructive",
        });
        return;
      }

      const confirmed = window.confirm(`Remove ${member.full_name ?? member.email}? This action cannot be undone.`);
      if (!confirmed) return;

      setStaffSubmitting(true);
      try {
        await callFunction(
          "marketing-manage",
          {
            action: "hr-delete-staff",
            staffId: member.id,
            userId: member.user_id,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        setStaff((prev) => prev.filter((row) => row.id !== member.id));
        toast({
          title: "Staff removed",
          description: `${member.full_name ?? member.email} deleted successfully.`,
        });

        if (activeStaffId === member.id) {
          handleResetStaffForm();
        }
      } catch (error: any) {
        toast({
          title: "Delete failed",
          description: error?.message ?? "Unable to remove staff member.",
          variant: "destructive",
        });
      } finally {
        setStaffSubmitting(false);
      }
    },
    [activeStaffId, handleResetStaffForm, toast, token],
  );

  const handleSubmitStaff = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!token) {
        toast({
          title: "No session",
          description: "Please sign in again to manage staff.",
          variant: "destructive",
        });
        return;
      }

      if (!staffForm.fullName || !staffForm.email || !staffForm.role) {
        toast({
          title: "Missing fields",
          description: "Full name, email, and role are required.",
          variant: "destructive",
        });
        return;
      }

      setStaffSubmitting(true);

      try {
        if (activeStaffId) {
          const target = staff.find((row) => row.id === activeStaffId);
          await callFunction(
            "marketing-manage",
            {
              action: "hr-update-staff",
              staffId: activeStaffId,
              userId: target?.user_id,
              fullName: staffForm.fullName,
              email: staffForm.email,
              phone: emptyToNull(staffForm.phone),
              department: emptyToNull(staffForm.department),
              position: emptyToNull(staffForm.position),
              role: staffForm.role,
              isActivated: staffForm.isActivated,
              isActive: staffForm.isActive,
            },
            {
              token,
              useAnonAuth: false,
            },
          );

          setStaff((prev) =>
            prev.map((row) =>
              row.id === activeStaffId
                ? {
                    ...row,
                    full_name: staffForm.fullName,
                    email: staffForm.email,
                    phone: emptyToNull(staffForm.phone),
                    department: emptyToNull(staffForm.department),
                    position: emptyToNull(staffForm.position),
                    role: staffForm.role,
                    is_activated: staffForm.isActivated,
                    profile: row.profile ? { ...row.profile, is_active: staffForm.isActive } : row.profile,
                  }
                : row,
            ),
          );

          toast({
            title: "Staff updated",
            description: `${staffForm.fullName} updated successfully.`,
          });
        } else {
          const response = await callFunction<{ profile?: StaffProfile; password?: string }>(
            "marketing-manage",
            {
              action: "hr-create-staff",
              fullName: staffForm.fullName,
              email: staffForm.email,
              phone: emptyToNull(staffForm.phone),
              role: staffForm.role,
              department: emptyToNull(staffForm.department),
              position: emptyToNull(staffForm.position),
            },
            {
              token,
              useAnonAuth: false,
            },
          );

          await fetchStaff();

          toast({
            title: "Staff registered",
            description: response?.password
              ? `${staffForm.fullName} registered. Default password: ${response.password}`
              : `${staffForm.fullName} registered. Password set to firstName@123.`,
          });
        }

        handleResetStaffForm();
      } catch (error: any) {
        toast({
          title: activeStaffId ? "Update failed" : "Registration failed",
          description: error?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setStaffSubmitting(false);
      }
    },
    [activeStaffId, fetchStaff, handleResetStaffForm, staff, staffForm, toast, token],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/portal/hr">HR Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>User Management</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Register new staff members or update existing accounts.</p>
          </div>

          <Button asChild variant="outline">
            <Link to="/portal/hr">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <span>Manage Staff Accounts</span>
                </CardTitle>
                <CardDescription>
                  Register new staff members or update existing accounts. Passwords are generated automatically and emailed to the user.
                </CardDescription>
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
          </CardHeader>

          <CardContent className="space-y-6">
            <section className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-4 text-lg font-semibold">{activeStaffId ? "Update Staff Member" : "Register Staff Member"}</h3>
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
                    onValueChange={(value) => handleStaffInputChange("department", value === "__none" ? "" : value)}
                  >
                    <SelectTrigger id="staffDepartment">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No department</SelectItem>
                      {departmentOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
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

                <div className="md:col-span-2 flex justify-end gap-2">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegisteredStaff((prev) => !prev)}
                    disabled={staffLoading}
                  >
                    {showRegisteredStaff ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {showRegisteredStaff ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void fetchStaff(true, staffRoleFilter)}
                    disabled={staffLoading}
                  >
                    {staffLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh
                  </Button>
                </div>
              </div>

              {showRegisteredStaff ? (
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
                                {member.position ? (
                                  <span className="text-xs text-muted-foreground">{member.position}</span>
                                ) : null}
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
                                onClick={() => void handleDeleteStaff(member)}
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
              ) : null}

              <p className="text-xs text-muted-foreground">
                Passwords are automatically generated and sent via email when a new staff member is registered.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRUserManagement;
