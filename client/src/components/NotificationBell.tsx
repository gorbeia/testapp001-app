import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { authFetch } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { eu, es } from "date-fns/locale";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread count
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await authFetch("/api/notifications/unread-count");
      if (!response.ok) throw new Error("Failed to fetch unread count");
      return response.json() as Promise<{ count: number }>;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch recent notifications
  const { data: recentNotifications = [], refetch: refetchRecent } = useQuery({
    queryKey: ["notifications", "recent", language],
    queryFn: async () => {
      const response = await authFetch(`/api/notifications/recent?lang=${language}`);
      if (!response.ok) throw new Error("Failed to fetch recent notifications");
      return response.json() as Promise<Notification[]>;
    },
    enabled: isOpen,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await authFetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json() as Promise<Notification>;
    },
    onSuccess: () => {
      refetchRecent();
      refetchUnreadCount();
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await authFetch("/api/notifications/mark-all-read", {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      refetchRecent();
      refetchUnreadCount();
    },
  });

  const unreadCount = unreadData?.count || 0;
  const locale = language === "es" ? es : eu;

  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale,
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          <Bell className="h-5 w-5" />
          <Badge
            variant={unreadCount > 0 ? "destructive" : "secondary"}
            className={`absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center transition-all ${
              unreadCount > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3">
          <div className="font-semibold">{t("notifications")}</div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {t("markAllRead")}
            </Button>
          )}
        </div>

        <Separator />

        <ScrollArea className="h-96">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">{t("noNotifications")}</div>
          ) : (
            recentNotifications.map(notification => (
              <DropdownMenuItem key={notification.id} className="p-3 cursor-pointer" asChild>
                <Link
                  href={notification.referenceId ? "/oharrak" : "/jakinarazpenak"}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{notification.title}</p>
                        {!notification.isRead && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          markAsReadMutation.mutate(notification.id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>

        <Separator />

        <DropdownMenuItem asChild>
          <Link
            to="/jakinarazpenak"
            className="p-3 text-center text-sm font-medium text-primary"
            onClick={() => setIsOpen(false)}
          >
            {t("viewAllNotifications")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
