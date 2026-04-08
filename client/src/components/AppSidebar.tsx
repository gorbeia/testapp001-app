import { useLocation, Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ShoppingCart,
  CreditCard,
  Megaphone,
  Users,
  Package,
  Home,
  Building2,
  FileSpreadsheet,
  LogOut,
  Receipt,
  Table as TableIcon,
  CreditCard as SubscriptionIcon,
  Palette,
  List,
  Landmark,
  ClipboardList,
  Truck,
  ClipboardCheck,
  ChevronRight,
  Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { useAuth, userCan } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import { authFetch } from "@/lib/api";
import { societyAllowsBankTransferPrepayment } from "@shared/schema";
import { deriveSocietyAcronym } from "@shared/society-acronym";
import { cn } from "@/lib/utils";
import { ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT } from "@/lib/society-events";

type NavItem = { title: string; url: string; icon: LucideIcon };

type NavSubGroup = {
  id: string;
  labelKey:
    | "sidebarNavPeopleAndOps"
    | "sidebarNavInventory"
    | "sidebarNavFinance"
    | "sidebarNavSpaceAndCatalog"
    | "sidebarNavSocietySettings";
  icon: LucideIcon;
  items: NavItem[];
};

export function AppSidebar() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const [societyName, setSocietyName] = useState<string | null>(null);
  const [societyAcronym, setSocietyAcronym] = useState("?");
  const [societyShortDescription, setSocietyShortDescription] = useState<string | null>(null);
  const [societySepaMode, setSocietySepaMode] = useState<string | null>(null);
  const [allowsBankTransferPrepayment, setAllowsBankTransferPrepayment] = useState(true);

  useEffect(() => {
    const loadSociety = async () => {
      try {
        const response = await authFetch("/api/societies/user");
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.name === "string") {
            setSocietyName(data.name);
            const stored = typeof data.acronym === "string" ? data.acronym.trim() : "";
            const derived = deriveSocietyAcronym(data.name);
            const circle = (stored || derived || "?").toUpperCase().slice(0, 3);
            setSocietyAcronym(circle);
          }
          const sd = data?.shortDescription;
          setSocietyShortDescription(
            typeof sd === "string" && sd.trim() !== "" ? sd.trim() : null
          );
          if (data && typeof data.sepaMode === "string") {
            setSocietySepaMode(data.sepaMode);
          } else {
            setSocietySepaMode("monthly");
          }
          setAllowsBankTransferPrepayment(societyAllowsBankTransferPrepayment(data.paymentMethods));
        }
      } catch (error) {
        console.error("Error loading society for sidebar:", error);
      }
    };

    void loadSociety();
    const onProfileUpdated = () => void loadSociety();
    window.addEventListener(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, []);

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const getRoleBadgeVariant = () => {
    if (!user) return "secondary";
    switch (user.accessRole) {
      case "admin":
        return "default";
      case "treasurer":
        return "default";
      case "cellarman":
        return "default";
      default:
        return "secondary";
    }
  };

  const getRoleLabel = () => {
    if (!user) return "";
    if (user.membershipType === "companion") return t("companion");
    switch (user.accessRole) {
      case "admin":
        return t("administrator");
      case "treasurer":
        return t("treasurer");
      case "cellarman":
        return t("cellarman");
      default:
        return t("member");
    }
  };

  const menuItems: NavItem[] = [
    { title: t("dashboard"), url: "/", icon: Home },
    { title: t("consumptions"), url: "/kontsumoak", icon: ShoppingCart },
    { title: t("reservations"), url: "/erreserbak", icon: Calendar },
    { title: t("myReservations"), url: "/nire-erreserbak", icon: Calendar },
    { title: t("myConsumptions"), url: "/nire-konsumoak", icon: Receipt },
    ...(societySepaMode !== "disabled"
      ? [{ title: t("credits"), url: "/nire-zorrak", icon: CreditCard } as NavItem]
      : []),
    { title: t("myMovements"), url: "/nire-mugimenduak", icon: List },
    ...(userCan(user, Permission.NOTES_MANAGE)
      ? [{ title: t("announcements"), url: "/oharrak", icon: Megaphone } as NavItem]
      : []),
  ];

  const managementGroups: NavSubGroup[] = useMemo(() => {
    const peopleItems: NavItem[] = [
      ...(userCan(user, Permission.USERS_MANAGE)
        ? [{ title: t("users"), url: "/erabiltzaileak", icon: Users }]
        : []),
      ...(userCan(user, Permission.RESERVATIONS_REGISTRY)
        ? [{ title: t("reservationsManagement"), url: "/admin-erreserbak", icon: Calendar }]
        : []),
      ...(userCan(user, Permission.CONSUMPTIONS_ADMIN)
        ? [{ title: t("consumptionList"), url: "/kontsumoak-zerrenda", icon: Receipt }]
        : []),
      ...(userCan(user, Permission.CREDITS_VIEW) && societySepaMode !== "disabled"
        ? [{ title: t("adminCredits"), url: "/zorrak", icon: CreditCard }]
        : []),
    ];

    const inventoryItems: NavItem[] = userCan(user, Permission.PRODUCTS_MANAGE)
      ? [
          { title: t("products"), url: "/produktuak", icon: Package },
          { title: t("stockChanges"), url: "/stock-aldaketak", icon: ClipboardList },
          { title: t("supplies"), url: "/hornidurak", icon: Truck },
          { title: t("stockTake"), url: "/inbentarioa", icon: ClipboardCheck },
        ]
      : [];

    const financeItems: NavItem[] = [
      ...(userCan(user, Permission.SEPA_EXPORT) && societySepaMode !== "disabled"
        ? [{ title: t("sepaExport"), url: "/sepa", icon: FileSpreadsheet }]
        : []),
      ...(userCan(user, Permission.MOVEMENTS_VIEW)
        ? [
            { title: t("adminMovements"), url: "/mugimenduak", icon: List },
            { title: t("societyAccounting"), url: "/kontabilitatea", icon: Calculator },
          ]
        : []),
      ...(userCan(user, Permission.BANK_TRANSFERS_MANAGE) && allowsBankTransferPrepayment
        ? [{ title: t("bankTransfersMenu"), url: "/transferentziak", icon: Landmark }]
        : []),
    ];

    const groups: NavSubGroup[] = [];
    if (peopleItems.length > 0) {
      groups.push({
        id: "mgmt-people",
        labelKey: "sidebarNavPeopleAndOps",
        icon: Users,
        items: peopleItems,
      });
    }
    if (inventoryItems.length > 0) {
      groups.push({
        id: "mgmt-inventory",
        labelKey: "sidebarNavInventory",
        icon: Package,
        items: inventoryItems,
      });
    }
    if (financeItems.length > 0) {
      groups.push({
        id: "mgmt-finance",
        labelKey: "sidebarNavFinance",
        icon: Landmark,
        items: financeItems,
      });
    }
    return groups;
  }, [user, t, societySepaMode, allowsBankTransferPrepayment]);

  const configurationGroups: NavSubGroup[] = useMemo(() => {
    const spaceItems: NavItem[] = [
      ...(userCan(user, Permission.TABLES_MANAGE)
        ? [{ title: t("tables"), url: "/mahaiak", icon: TableIcon }]
        : []),
      ...(userCan(user, Permission.CATEGORIES_MANAGE)
        ? [{ title: t("productCategories"), url: "/kategoriak", icon: Palette }]
        : []),
    ];
    const societyItems: NavItem[] = [
      ...(userCan(user, Permission.SUBSCRIPTIONS_MANAGE)
        ? [{ title: t("subscriptionTypes"), url: "/subscriptions", icon: SubscriptionIcon }]
        : []),
      ...(userCan(user, Permission.SOCIETY_MANAGE)
        ? [{ title: t("society"), url: "/elkartea", icon: Building2 }]
        : []),
    ];

    const groups: NavSubGroup[] = [];
    if (spaceItems.length > 0) {
      groups.push({
        id: "cfg-space",
        labelKey: "sidebarNavSpaceAndCatalog",
        icon: TableIcon,
        items: spaceItems,
      });
    }
    if (societyItems.length > 0) {
      groups.push({
        id: "cfg-society",
        labelKey: "sidebarNavSocietySettings",
        icon: Building2,
        items: societyItems,
      });
    }
    return groups;
  }, [user, t]);

  const [submenuOpen, setSubmenuOpen] = useState<Record<string, boolean | undefined>>({});

  const isSubgroupOpen = (group: NavSubGroup) => {
    const v = submenuOpen[group.id];
    if (v !== undefined) return v;
    return group.items.some(i => i.url === location);
  };

  const setSubgroupOpen = (id: string, open: boolean) => {
    setSubmenuOpen(prev => ({ ...prev, [id]: open }));
  };

  const navTestId = (url: string) => `link-${url.replace("/", "") || "home"}`;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm" aria-hidden>
              {societyAcronym}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{societyName || t("appName")}</h1>
            {societyShortDescription ? (
              <p className="text-xs text-muted-foreground line-clamp-2">{societyShortDescription}</p>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link
                        href={item.url}
                        data-testid={`link-${item.url.replace("/", "") || "home"}`}
                        onClick={() => handleNavigation()}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {managementGroups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("management")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementGroups.map(group => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={group.id}>
                        <SidebarMenuButton asChild isActive={location === item.url}>
                          <Link
                            href={item.url}
                            data-testid={navTestId(item.url)}
                            onClick={() => handleNavigation()}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const GroupIcon = group.icon;
                  return (
                    <Collapsible
                      key={group.id}
                      asChild
                      open={isSubgroupOpen(group)}
                      onOpenChange={open => setSubgroupOpen(group.id, open)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            type="button"
                            data-testid={`sidebar-submenu-trigger-${group.id}`}
                          >
                            <GroupIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t(group.labelKey)}</span>
                            <ChevronRight
                              className={cn(
                                "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                                isSubgroupOpen(group) && "rotate-90"
                              )}
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {group.items.map(item => {
                              const ItemIcon = item.icon;
                              return (
                                <SidebarMenuSubItem key={item.url}>
                                  <SidebarMenuSubButton asChild isActive={location === item.url}>
                                    <Link
                                      href={item.url}
                                      data-testid={navTestId(item.url)}
                                      onClick={() => handleNavigation()}
                                    >
                                      <ItemIcon className="h-4 w-4" />
                                      <span>{item.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {configurationGroups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("configuration")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configurationGroups.map(group => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={group.id}>
                        <SidebarMenuButton asChild isActive={location === item.url}>
                          <Link
                            href={item.url}
                            data-testid={navTestId(item.url)}
                            onClick={() => handleNavigation()}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const GroupIcon = group.icon;
                  return (
                    <Collapsible
                      key={group.id}
                      asChild
                      open={isSubgroupOpen(group)}
                      onOpenChange={open => setSubgroupOpen(group.id, open)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            type="button"
                            data-testid={`sidebar-submenu-trigger-${group.id}`}
                          >
                            <GroupIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t(group.labelKey)}</span>
                            <ChevronRight
                              className={cn(
                                "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                                isSubgroupOpen(group) && "rotate-90"
                              )}
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {group.items.map(item => {
                              const ItemIcon = item.icon;
                              return (
                                <SidebarMenuSubItem key={item.url}>
                                  <SidebarMenuSubButton asChild isActive={location === item.url}>
                                    <Link
                                      href={item.url}
                                      data-testid={navTestId(item.url)}
                                      onClick={() => handleNavigation()}
                                    >
                                      <ItemIcon className="h-4 w-4" />
                                      <span>{item.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        {user && (
          <div className="flex items-center gap-3">
            <Link
              href="/profila"
              className="flex items-center gap-3 flex-1 min-w-0 hover-elevate active-elevate-2 rounded-md p-1 -m-1"
              data-testid="link-profile"
              onClick={() => handleNavigation()}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs bg-accent">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <Badge variant={getRoleBadgeVariant()} className="text-[10px] px-1.5 py-0">
                  {getRoleLabel()}
                </Badge>
              </div>
            </Link>
            <button
              onClick={logout}
              className="p-2 hover-elevate active-elevate-2 rounded-md"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
