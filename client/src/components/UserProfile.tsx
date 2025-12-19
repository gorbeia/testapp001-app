import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { authFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, CreditCard, Users, User as UserIcon, Edit2, Save, X } from 'lucide-react';

export function UserProfile() {
  const { t } = useLanguage();
  const { user: authUser, updateUser } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    iban: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) return;

      try {
        // Use the authenticated user data directly
        setUser(authUser);
        setEditForm({
          name: authUser.name || '',
          phone: authUser.phone || '',
          iban: authUser.iban || '',
        });
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [authUser]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center text-red-500">{t('error')}</div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'bazkidea': return t('member');
      case 'laguna': return t('companion');
      default: return role || 'Unknown';
    }
  };

  const getFunctionLabel = (func: string) => {
    switch (func) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      case 'arrunta': return t('regular');
      default: return func || 'None';
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
        iban: user.iban || '',
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    
    try {
      const response = await authFetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone || null,
          iban: editForm.iban || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      updateUser(updatedUser);
      setIsEditing(false);
      
      toast({
        title: t('profileUpdated'),
        description: t('profileUpdatedSuccessfully'),
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: t('error'),
        description: error.message || t('errorUpdatingProfile'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: t('error'),
        description: t('passwordsDoNotMatch'),
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: t('error'),
        description: t('passwordMinLength'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await authFetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to change password');
      }

      toast({
        title: t('passwordChanged'),
        description: t('passwordUpdatedSuccessfully'),
      });

      // Reset password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: t('error'),
        description: error.message || t('errorChangingPassword'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('profile')}</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {getRoleLabel(user.role)}
                </Badge>
                {user.function !== 'arrunta' && (
                  <Badge variant="outline">
                    {getFunctionLabel(user.function)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {t('contactInformation')}
            </h3>
            
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('email')}</p>
                  <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                </div>
              </div>

              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('fullName')}</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder={t('fullName')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('phone')}</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder={t('phone')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iban">{t('iban')}</Label>
                    <Input
                      id="iban"
                      value={editForm.iban}
                      onChange={(e) => setEditForm({ ...editForm, iban: e.target.value })}
                      placeholder={t('iban')}
                    />
                  </div>
                </>
              ) : (
                <>
                  {user.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t('phone')}</p>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                      </div>
                    </div>
                  )}

                  {user.iban && (
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t('iban')}</p>
                        <p className="text-sm text-muted-foreground font-mono">{user.iban}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Linked Member Information */}
          {user.linkedMemberName && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('linkedMember')}
              </h3>
              
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm">
                    {getInitials(user.linkedMemberName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.linkedMemberName}</p>
                  <p className="text-sm text-muted-foreground">{t('member')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? t('saving') : t('save')}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="gap-2">
                  <X className="h-4 w-4" />
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleEdit} className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  {t('edit')}
                </Button>
                <Button variant="outline" onClick={() => setIsChangingPassword(true)} className="gap-2">
                  {t('changePasswordAction')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      {isChangingPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {t('changePasswordAction')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('currentPasswordLabel')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder={t('currentPasswordLabel')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('newPasswordLabel')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder={t('newPasswordLabel')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder={t('confirmPasswordLabel')}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handlePasswordChange} className="gap-2">
                <Save className="h-4 w-4" />
                {t('changePasswordAction')}
              </Button>
              <Button variant="outline" onClick={() => setIsChangingPassword(false)} className="gap-2">
                <X className="h-4 w-4" />
                {t('cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
