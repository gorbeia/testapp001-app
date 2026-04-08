import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/api";
import { readJsonOrThrow } from "@/lib/http-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Link2, UserX, UserCheck } from "lucide-react";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { TableFiltersBar } from "@/components/TableFiltersBar";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
import type { SubscriptionType as SubscriptionTypeEntity } from "@shared/schema";
import {
  ROLE_PERMISSIONS,
  type AccessRole,
  type AppPermission,
  type MembershipType,
} from "@shared/permissions";

function balanceAmountClass(b: number) {
  if (b < 0) return "text-destructive";
  if (b > 0) return "text-green-600";
  return "text-muted-foreground";
}

/** Shape of `/api/users` list rows (passwords never returned). */
type UsersApiRow = {
  id: string;
  username: string;
  name: string | null;
  accessRole: AccessRole;
  membershipType: MembershipType;
  phone: string | null;
  iban: string | null;
  linkedMemberId: string | null;
  linkedMemberName: string | null;
  subscriptionTypeId: string | null;
  societyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountBalance?: number;
  subscriptionType: {
    id: string;
    name: string;
    amount: string;
    period: string;
  } | null;
};

const fetchUsers = async (statusFilter?: string): Promise<UsersApiRow[]> => {
  const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
  const response = await authFetch(`/api/users${statusParam}`);
  return readJsonOrThrow<UsersApiRow[]>(response);
};

type SubscriptionPeriodI18nKey = "monthly" | "quarterly" | "yearly" | "custom";

type UsersPageUser = {
  id: string;
  name: string;
  email: string;
  accessRole: AccessRole;
  membershipType: MembershipType;
  phone: string;
  iban: string | null;
  accountBalance: number;
  linkedMember: string | null;
  subscriptionTypeId: string | null;
  subscriptionType?: {
    id: string;
    name: string;
    amount: string;
    period: string;
  } | null;
  isActive: boolean;
};

export function UsersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editingUser, setEditingUser] = useState<UsersPageUser | null>(null);

  // Fetch users with React Query
  const {
    data: rawUsers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users", statusFilter],
    queryFn: () => fetchUsers(statusFilter),
    throwOnError: false,
    staleTime: 0, // Data is stale immediately
    gcTime: 0, // Don't cache results (garbage collection time)
  });

  // Set initial load state when query completes
  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading]);

  // Fetch subscription types for dropdown
  const { data: subscriptionTypes = [] } = useQuery({
    queryKey: ["subscription-types"],
    queryFn: async (): Promise<SubscriptionTypeEntity[]> => {
      const response = await authFetch("/api/subscription-types");
      return readJsonOrThrow<SubscriptionTypeEntity[]>(response);
    },
  });

  const {
    data: societyUser,
    isSuccess: societyFetchSuccess,
    isError: societyError,
  } = useQuery({
    queryKey: ["society-user"],
    queryFn: async () => {
      const res = await authFetch("/api/societies/user");
      return readJsonOrThrow<{ sepaMode?: string }>(res);
    },
    throwOnError: false,
  });

  /** Hide IBAN column only when we know SEPA is disabled; on error or while loading, show IBAN. */
  const showIbanColumn =
    !societyFetchSuccess || societyError || societyUser?.sepaMode !== "disabled";

  // Transform API data to component format
  const users: UsersPageUser[] = rawUsers.map((dbUser: UsersApiRow) => ({
    id: dbUser.id,
    name: dbUser.name ?? dbUser.username,
    email: dbUser.username,
    accessRole: dbUser.accessRole ?? "member",
    membershipType: dbUser.membershipType ?? "full_member",
    phone: dbUser.phone ?? "",
    iban: dbUser.iban ?? null,
    accountBalance: typeof dbUser.accountBalance === "number" ? dbUser.accountBalance : 0,
    linkedMember: dbUser.linkedMemberName,
    subscriptionTypeId: dbUser.subscriptionTypeId ?? null,
    subscriptionType: dbUser.subscriptionType ?? null,
    isActive: dbUser.isActive,
  }));

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const editNameRef = useRef<HTMLInputElement | null>(null);
  const editPhoneRef = useRef<HTMLInputElement | null>(null);
  const editIbanRef = useRef<HTMLInputElement | null>(null);
  const [editMembershipType, setEditMembershipType] = useState<MembershipType>("full_member");
  const [editAccessRole, setEditAccessRole] = useState<AccessRole>("member");
  const [editSubscriptionTypeId, setEditSubscriptionTypeId] = useState<string>("none");

  const [createSubscriptionTypeId, setCreateSubscriptionTypeId] = useState<string>("none");
  const [createMembershipType, setCreateMembershipType] = useState<MembershipType>("full_member");
  const [createAccessRole, setCreateAccessRole] = useState<AccessRole>("member");
  const [createLinkedMemberId, setCreateLinkedMemberId] = useState<string>("none");
  const createPhoneRef = useRef<HTMLInputElement | null>(null);
  const createIbanRef = useRef<HTMLInputElement | null>(null);

  if (isInitialLoad && isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <p>{t("loading")}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <AccessDeniedOrError error={error} />;
  }

  const filteredUsers = users.filter((u: UsersPageUser) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMembership =
      membershipTypeFilter === "all" || u.membershipType === membershipTypeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.isActive) ||
      (statusFilter === "inactive" && !u.isActive);
    return matchesSearch && matchesMembership && matchesStatus;
  });

  const getMembershipTypeLabel = (mt: MembershipType) => {
    return mt === "full_member" ? t("member") : t("companion");
  };

  const getAccessRoleLabel = (ar: AccessRole) => {
    switch (ar) {
      case "admin":
        return t("administrator");
      case "treasurer":
        return t("treasurer");
      case "cellarman":
        return t("cellarman");
      default:
        return t("regular");
    }
  };

  const permissionTranslationKeys: Record<AppPermission, string> = {
    "users.list": "permUsersList",
    "users.manage": "permUsersManage",
    "products.manage": "permProductsManage",
    "categories.manage": "permCategoriesManage",
    "tables.manage": "permTablesManage",
    "subscriptions.manage": "permSubscriptionsManage",
    "reservations.registry": "permReservationsRegistry",
    "reservations.moderate": "permReservationsModerate",
    "reservations.admin": "permReservationsAdmin",
    "consumptions.admin": "permConsumptionsAdmin",
    "credits.view": "permCreditsView",
    "credits.manage": "permCreditsManage",
    "sepa.export": "permSepaExport",
    "movements.view": "permMovementsView",
    "movements.manage": "permMovementsManage",
    "bank-transfers.manage": "permBankTransfersManage",
    "society_transactions.manage": "permSocietyTransactionsManage",
    "notes.manage": "permNotesManage",
    "society.manage": "permSocietyManage",
    "notifications.broadcast": "permNotificationsBroadcast",
    "calendar.manage": "permCalendarManage",
  };

  const handleOpenEditUser = (user: UsersPageUser) => {
    setEditingUser(user);
    setEditMembershipType(user.membershipType);
    setEditAccessRole(user.accessRole);
    setEditSubscriptionTypeId(user.subscriptionTypeId || "none");
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const payload = {
      name: editNameRef.current?.value.trim() || editingUser.name,
      phone: editPhoneRef.current?.value.trim() || editingUser.phone,
      iban: editIbanRef.current?.value.trim() ?? editingUser.iban ?? null,
      membershipType: editMembershipType,
      accessRole: editAccessRole,
      subscriptionTypeId: editSubscriptionTypeId === "none" ? null : editSubscriptionTypeId || null,
    };

    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(editingUser.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      const updated = (await response.json()) as {
        id: string;
        username: string;
        name: string | null;
        accessRole: AccessRole;
        membershipType: MembershipType;
        phone: string | null;
        iban: string | null;
        linkedMemberName: string | null;
        isActive: boolean;
      };

      const updatedUser: UsersPageUser = {
        id: updated.id,
        name: updated.name ?? updated.username,
        email: updated.username,
        accessRole: updated.accessRole ?? editingUser.accessRole,
        membershipType: updated.membershipType ?? editingUser.membershipType,
        phone: updated.phone ?? "",
        iban: updated.iban ?? null,
        accountBalance: editingUser.accountBalance,
        linkedMember: updated.linkedMemberName ?? editingUser.linkedMember,
        subscriptionTypeId: editingUser.subscriptionTypeId,
        subscriptionType: editingUser.subscriptionType,
        isActive: updated.isActive,
      };

      // Invalidate cache to refresh the users list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: t("success"),
        description: `${updatedUser.name} (${updatedUser.email})`,
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch {
      toast({
        title: t("error"),
        description: t("userUpdateFailed"),
        variant: "destructive",
      });
    }
  };

  const handleToggleUserStatus = async (user: UsersPageUser) => {
    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(user.id)}/toggle-active`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle user status");
      }

      const updated = (await response.json()) as {
        id: string;
        username: string;
        name: string | null;
        accessRole: AccessRole;
        membershipType: MembershipType;
        phone: string | null;
        iban: string | null;
        linkedMemberName: string | null;
        isActive: boolean;
      };

      const updatedUser: UsersPageUser = {
        id: updated.id,
        name: updated.name ?? updated.username,
        email: updated.username,
        accessRole: updated.accessRole ?? user.accessRole,
        membershipType: updated.membershipType ?? user.membershipType,
        phone: updated.phone ?? "",
        iban: updated.iban ?? null,
        accountBalance: user.accountBalance,
        linkedMember: updated.linkedMemberName ?? user.linkedMember,
        subscriptionTypeId: user.subscriptionTypeId,
        subscriptionType: user.subscriptionType,
        isActive: updated.isActive,
      };

      // Invalidate cache to refresh the users list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: t("success"),
        description: `${updatedUser.name} ${updatedUser.isActive ? t("userActivated") : t("userDeactivated")}`,
      });
    } catch {
      toast({
        title: t("error"),
        description: t("userStatusToggleFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (user: UsersPageUser) => {
    const confirmed = window.confirm(t("confirmDeleteUser"));
    if (!confirmed) return;

    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        const errorData = response.status === 400 ? await response.json() : null;

        if (errorData?.dependencies) {
          // User has dependencies, show detailed error
          toast({
            title: t("userDeleteTitle"),
            description: errorData.details || "Erabiltzaileak erlazionatutako datuak ditu",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          throw new Error("Failed to delete user");
        }
        return;
      }

      // Invalidate cache to refresh the users list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: t("success"),
        description: `${user.name} (${user.email}) ${t("deleted")}`,
      });
    } catch {
      toast({
        title: t("error"),
        description: t("userDeleteFailed"),
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateUser = async () => {
    const name = nameInputRef.current?.value.trim() ?? "";
    const email = emailInputRef.current?.value.trim().toLowerCase() ?? "";

    if (!email) {
      toast({
        title: t("error"),
        description: t("email") + " is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const phone = createPhoneRef.current?.value.trim() ?? "";
      const ibanRaw = createIbanRef.current?.value.trim();
      const linkedMember =
        createLinkedMemberId === "none"
          ? { linkedMemberId: null as string | null, linkedMemberName: null as string | null }
          : (() => {
              const m = users.find(u => u.id === createLinkedMemberId);
              return {
                linkedMemberId: createLinkedMemberId,
                linkedMemberName: m?.name ?? null,
              };
            })();
      const response = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: email,
          password: "demo",
          name: name || undefined,
          phone: phone || null,
          iban: ibanRaw ? ibanRaw : null,
          membershipType: createMembershipType,
          accessRole: createAccessRole,
          ...linkedMember,
          subscriptionTypeId:
            createSubscriptionTypeId === "none" ? null : createSubscriptionTypeId || null,
        }),
      });

      if (!response.ok) {
        toast({
          title: t("error"),
          description: t("userCreateFailed"),
          variant: "destructive",
        });
        return;
      }

      // Invalidate cache to refresh the users list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: t("success"),
        description: t("userCreated"),
      });
      setIsDialogOpen(false);
    } catch {
      toast({
        title: t("error"),
        description: t("userCreateFailed"),
        variant: "destructive",
      });
    }
  };

  const tableColSpan = 9 + (showIbanColumn ? 1 : 0);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t("users")}</h2>
            <p className="text-muted-foreground">{t("manageUsers")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-user">
                <Plus className="mr-2 h-4 w-4" />
                {t("newUser")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("newUser")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("nameLabel")}</Label>
                    <Input
                      placeholder={t("namePlaceholder")}
                      data-testid="input-user-name"
                      ref={nameInputRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("email")}</Label>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      data-testid="input-user-email"
                      ref={emailInputRef}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("phone")}</Label>
                    <Input
                      placeholder="+34..."
                      data-testid="input-user-phone"
                      ref={createPhoneRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("membershipType")}</Label>
                    <Select
                      value={createMembershipType}
                      onValueChange={v => setCreateMembershipType(v as MembershipType)}
                    >
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue placeholder={t("membershipType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_member">{t("member")}</SelectItem>
                        <SelectItem value="companion">{t("companion")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("accessRole")}</Label>
                    <Select
                      value={createAccessRole}
                      onValueChange={v => setCreateAccessRole(v as AccessRole)}
                    >
                      <SelectTrigger data-testid="select-user-function">
                        <SelectValue placeholder={t("accessRole")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t("regular")}</SelectItem>
                        <SelectItem value="admin">{t("administrator")}</SelectItem>
                        <SelectItem value="treasurer">{t("treasurer")}</SelectItem>
                        <SelectItem value="cellarman">{t("cellarman")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {ROLE_PERMISSIONS[createAccessRole].map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px] font-normal">
                          {t(permissionTranslationKeys[p] as TranslationKey)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("linkedMember")}</Label>
                    <Select value={createLinkedMemberId} onValueChange={setCreateLinkedMemberId}>
                      <SelectTrigger data-testid="select-linked-member">
                        <SelectValue placeholder={t("selectPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noOne")}</SelectItem>
                        {users
                          .filter(u => u.membershipType === "full_member")
                          .map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("iban")}</Label>
                  <Input
                    placeholder="ES00 0000 0000 0000 0000 0000"
                    data-testid="input-user-iban"
                    ref={createIbanRef}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("subscription")}</Label>
                  <Select
                    value={createSubscriptionTypeId}
                    onValueChange={setCreateSubscriptionTypeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectSubscription")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noSubscription")}</SelectItem>
                      {subscriptionTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} - €{type.amount} (
                          {t(type.period as SubscriptionPeriodI18nKey)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleCreateUser} data-testid="button-save-user">
                    {t("save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {editingUser && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t("edit")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("nameLabel")}</Label>
                      <Input defaultValue={editingUser.name} ref={editNameRef} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("email")}</Label>
                      <Input value={editingUser.email} disabled />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("phone")}</Label>
                      <Input defaultValue={editingUser.phone} ref={editPhoneRef} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("membershipType")}</Label>
                      <Select
                        value={editMembershipType}
                        onValueChange={v => setEditMembershipType(v as MembershipType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_member">{t("member")}</SelectItem>
                          <SelectItem value="companion">{t("companion")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("accessRole")}</Label>
                      <Select
                        value={editAccessRole}
                        onValueChange={v => setEditAccessRole(v as AccessRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{t("regular")}</SelectItem>
                          <SelectItem value="admin">{t("administrator")}</SelectItem>
                          <SelectItem value="treasurer">{t("treasurer")}</SelectItem>
                          <SelectItem value="cellarman">{t("cellarman")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <p className="text-xs text-muted-foreground w-full">
                          {t("effectivePermissions")}
                        </p>
                        {ROLE_PERMISSIONS[editAccessRole].map(p => (
                          <Badge key={p} variant="secondary" className="text-[10px] font-normal">
                            {t(permissionTranslationKeys[p] as TranslationKey)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("linkedMember")}</Label>
                      <Input value={editingUser.linkedMember ?? ""} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("iban")}</Label>
                    <Input defaultValue={editingUser.iban ?? ""} ref={editIbanRef} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("subscription")}</Label>
                    <Select
                      value={editSubscriptionTypeId}
                      onValueChange={setEditSubscriptionTypeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectSubscription")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noSubscription")}</SelectItem>
                        {subscriptionTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} - €{type.amount} (
                            {t(type.period as SubscriptionPeriodI18nKey)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditDialogOpen(false);
                        setEditingUser(null);
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button onClick={handleUpdateUser}>{t("save")}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <TableFiltersBar>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t("search")}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
          <Select value={membershipTypeFilter} onValueChange={setMembershipTypeFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="full_member">{t("member")}</SelectItem>
              <SelectItem value="companion">{t("companion")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="active">{t("active")}</SelectItem>
              <SelectItem value="inactive">{t("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </TableFiltersBar>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("membershipType")}</TableHead>
                  <TableHead>{t("accessRole")}</TableHead>
                  <TableHead>{t("subscription")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  {showIbanColumn && <TableHead>{t("iban")}</TableHead>}
                  <TableHead>{t("currentBalance")}</TableHead>
                  <TableHead>{t("linkedMember")}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !isInitialLoad ? (
                  <TableRow>
                    <TableCell
                      colSpan={tableColSpan}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={tableColSpan}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: UsersPageUser) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-accent">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.membershipType === "full_member" ? "default" : "secondary"}
                        >
                          {getMembershipTypeLabel(user.membershipType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getAccessRoleLabel(user.accessRole)}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.subscriptionType ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                              {user.subscriptionType.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              €{user.subscriptionType.amount} (
                              {t(user.subscriptionType.period as SubscriptionPeriodI18nKey)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("noSubscription")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? "default" : "destructive"}
                          className="gap-1"
                        >
                          {user.isActive ? (
                            <>
                              <UserCheck className="h-3 w-3" /> {t("active")}
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3" /> {t("inactive")}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.phone}</TableCell>
                      {showIbanColumn && (
                        <TableCell>
                          {user.iban ? (
                            <div className="flex items-center gap-1 text-sm">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              {user.iban.substring(0, 4)}...
                              {user.iban.substring(user.iban.length - 4)}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                              {t("noIBAN")}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell
                        className={`text-sm font-medium tabular-nums ${balanceAmountClass(user.accountBalance)}`}
                        data-testid={`user-balance-${user.id}`}
                      >
                        {user.accountBalance.toFixed(2)}€
                      </TableCell>
                      <TableCell>
                        {user.linkedMember ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Link2 className="h-3 w-3" />
                            {user.linkedMember}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-user-menu-${user.id}`}
                            >
                              <span className="sr-only">{t("menu")}</span>
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                              {user.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" /> {t("deactivate")}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" /> {t("activate")}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
