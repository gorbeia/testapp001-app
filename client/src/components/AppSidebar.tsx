import { useLocation, Link } from 'wouter';
import {
  Calendar,
  ShoppingCart,
  CreditCard,
  Megaphone,
  MessageCircle,
  Users,
  Package,
  Home,
  Building2,
  FileSpreadsheet,
  LogOut,
  Receipt,
  Table as TableIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasAdminAccess, hasTreasurerAccess, hasCellarmanAccess } from '@/lib/auth';

export function AppSidebar() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const getRoleBadgeVariant = () => {
    if (!user) return 'secondary';
    switch (user.function) {
      case 'administratzailea': return 'default';
      case 'diruzaina': return 'default';
      case 'sotolaria': return 'default';
      default: return 'secondary';
    }
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.role === 'laguna') return t('companion');
    switch (user.function) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      default: return t('member');
    }
  };

  const menuItems = [
    { title: t('dashboard'), url: '/', icon: Home },
    { title: t('consumptions'), url: '/kontsumoak', icon: ShoppingCart },
    { title: t('reservations'), url: '/erreserbak', icon: Calendar },
    { title: t('myReservations'), url: '/nire-erreserbak', icon: Calendar },
    { title: t('myConsumptions'), url: '/nire-konsumoak', icon: Receipt },
    { title: t('credits'), url: '/nire-zorrak', icon: CreditCard },
    { title: t('announcements'), url: '/oharrak', icon: Megaphone },
    { title: t('chat'), url: '/txata', icon: MessageCircle },
  ];

  const adminMenuItems = [
    ...(hasAdminAccess(user) ? [{ title: t('users'), url: '/erabiltzaileak', icon: Users }] : []),
    ...(hasAdminAccess(user) ? [{ title: t('consumptionList'), url: '/kontsumoak-zerrenda', icon: Receipt }] : []),
    ...(hasAdminAccess(user) ? [{ title: t('adminCredits'), url: '/zorrak', icon: CreditCard }] : []),
    ...(hasCellarmanAccess(user) ? [{ title: t('products'), url: '/produktuak', icon: Package }] : []),
    ...(hasTreasurerAccess(user) ? [
      { title: t('society'), url: '/elkartea', icon: Building2 },
      ...(hasAdminAccess(user) ? [{ title: t('tables'), url: '/mahaiak', icon: TableIcon }] : []),
      { title: t('sepaExport'), url: '/sepa', icon: FileSpreadsheet },
    ] : []),
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">GT</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">{t('appName')}</h1>
            <p className="text-xs text-muted-foreground">Sociedad Gastronómica</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item: any) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.url.replace('/', '') || 'home'}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Kudeaketa</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-${item.url.replace('/', '')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        {user && (
          <div className="flex items-center gap-3">
            <Link href="/profila" className="flex items-center gap-3 flex-1 min-w-0 hover-elevate active-elevate-2 rounded-md p-1 -m-1" data-testid="link-profile">
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
