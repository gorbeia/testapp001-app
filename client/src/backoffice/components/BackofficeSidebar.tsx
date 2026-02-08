import { useLocation, Link } from 'wouter';
import { useState, useEffect } from 'react';
import {
  Building2,
  LogOut,
  Users,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { authFetch } from '@/lib/api';

// Helper to get backoffice token
const getBackofficeCookie = (): string | null => {
  const match = document.cookie.match(/(^|;)\s*backoffice-token=([^;]+)/);
  return match ? match[2] : null;
};

export function BackofficeSidebar() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const [superadminName, setSuperadminName] = useState<string | null>(null);
  const [superadminEmail, setSuperadminEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadSuperadminInfo = async () => {
      try {
        const response = await authFetch('/api/backoffice/me');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setSuperadminName(data.name);
            setSuperadminEmail(data.email);
          }
        }
      } catch (error) {
        console.error('Error loading superadmin info for sidebar:', error);
      }
    };

    // Only load if we have a backoffice token
    if (getBackofficeCookie()) {
      loadSuperadminInfo();
    }
  }, []);

  const handleNavigation = (href: string) => {
    // On mobile, close the sidebar after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/backoffice/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      document.cookie = 'backoffice-token=; path=/; max-age=0';
      window.location.href = '/elkarteapp/kudeaketa';
    }
  };

  const menuItems = [
    { title: t('societies'), url: '/elkarteapp/kudeaketa/societies', icon: Building2 },
    { title: t('superadmins'), url: '/elkarteapp/kudeaketa/superadmins', icon: Users },
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
            <span className="text-primary-foreground font-bold text-sm">SA</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Backoffice</h1>
            <p className="text-xs text-muted-foreground">Multi-Society Admin</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link 
                      href={item.url} 
                      onClick={() => handleNavigation(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {superadminName || 'Superadmin'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {superadminEmail || 'admin@backoffice.com'}
            </p>
            <Badge variant="default" className="text-[10px] px-1.5 py-0 mt-1">
              Superadmin
            </Badge>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover-elevate active-elevate-2 rounded-md"
            title="Logout"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
