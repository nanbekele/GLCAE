import { FormEvent, useCallback, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/api";

export type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: string | null;
  is_active: boolean | null;
};

export type StaffMember = {
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
};

export type StaffFormState = {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  isActivated: boolean;
  isActive: boolean;
};

export type StaffRoleOption = {
  value: string;
  label: string;
};

const STAFF_ROLE_OPTIONS: StaffRoleOption[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr_staff", label: "HR Staff" },
  { value: "architectural_civil_head", label: "Architectural & Civil Head" },
  { value: "mechanical_head", label: "Mechanical Head" },
  { value: "ict_head", label: "ICT Head" },
  { value: "material_testing_head", label: "Material Testing Head" },
  { value: "marketing_communications", label: "Marketing" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
];

export const getEmptyStaffForm = (): StaffFormState => ({
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

export const useStaffManagement = () => {
  const { token } = useAuth();
  const { toast } = useToast();

  const staffRoles = useMemo(() => STAFF_ROLE_OPTIONS, []);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>(getEmptyStaffForm());
  const [staffRoleFilter, setStaffRoleFilter] = useState<string | null>(null);

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
        console.error("[useStaffManagement] Failed to fetch staff", error);
        toast({
          title: "Failed to load staff",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setStaffLoading(false);
      }
    },
    [token, staffRoleFilter, toast],
  );

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

  const handleEditStaff = useCallback((member: StaffMember) => {
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
  }, []);

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

      const confirmed = window.confirm(
        `Remove ${member.full_name ?? member.email}? This action cannot be undone.`,
      );
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
    [token, toast, activeStaffId, handleResetStaffForm],
  );

  const handleSubmitStaff = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
                    profile: row.profile
                      ? { ...row.profile, is_active: staffForm.isActive }
                      : row.profile,
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
              ? `${staffForm.fullName} registered. Temporary password emailed (${response.password}).`
              : `${staffForm.fullName} registered and notified by email.`,
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
    [
      token,
      toast,
      staffForm,
      activeStaffId,
      staff,
      fetchStaff,
      handleResetStaffForm,
    ],
  );

  return {
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
  } as const;
};
