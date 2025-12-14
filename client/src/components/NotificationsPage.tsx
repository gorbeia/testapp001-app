import { useState, useEffect } from 'react';
import { Check, CheckCheck, Bell, Filter } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/lib/i18n';
import { authFetch } from '@/lib/api';
import { Notification } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';
import { eu, es } from 'date-fns/locale';

export default function NotificationsPage() {
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch notifications with pagination
  const { data: notificationsData, isLoading, refetch } = useQuery({
    queryKey: ['notifications', page, filter, typeFilter, language],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        lang: language,
      });
      
      if (filter !== 'all') {
        params.append('filter', filter);
      }
      
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      const response = await authFetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json() as Promise<{
        notifications: Notification[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>;
    },
  });

  // Refetch when language changes
  useEffect(() => {
    refetch();
  }, [language, refetch]);

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await authFetch('/api/notifications/unread-count');
      if (!response.ok) throw new Error('Failed to fetch unread count');
      return response.json() as Promise<{ count: number }>;
    },
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await authFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json() as Promise<Notification>;
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await authFetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const notifications = notificationsData?.notifications || [];
  const pagination = notificationsData?.pagination;
  const unreadCount = unreadData?.count || 0;
  const locale = language === 'es' ? es : eu;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <Bell className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <div className="h-5 w-5 text-red-500 rounded-full bg-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'success':
        return t('notificationSuccess');
      case 'warning':
        return t('notificationWarning');
      case 'error':
        return t('notificationError');
      default:
        return t('notificationInfo');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale 
    });
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('notifications')}</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 
              ? t('unreadNotifications', { count: unreadCount })
              : t('noUnreadNotifications')
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="unread">{t('unread')}</SelectItem>
              <SelectItem value="read">{t('read')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              <SelectItem value="info">{t('notificationInfo')}</SelectItem>
              <SelectItem value="success">{t('notificationSuccess')}</SelectItem>
              <SelectItem value="warning">{t('notificationWarning')}</SelectItem>
              <SelectItem value="error">{t('notificationError')}</SelectItem>
            </SelectContent>
          </Select>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {t('markAllRead')}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">{t('loading')}</div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('noNotifications')}</h3>
                <p className="text-muted-foreground">{t('noNotificationsDesc')}</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card key={notification.id} className={`transition-all ${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{notification.title}</h3>
                          <Badge variant="outline" className={getTypeColor(notification.type)}>
                            {getNotificationTypeText(notification.type)}
                          </Badge>
                          {!notification.isRead && (
                            <Badge variant="default" className="bg-blue-500">
                              {t('new')}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-muted-foreground mb-3 whitespace-pre-wrap">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {formatTime(notification.createdAt)}
                          </p>
                          
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={markAsReadMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              {t('markAsRead')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            {t('previous')}
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {t('page')} {page} {t('of')} {pagination.pages}
          </span>
          
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === pagination.pages}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
