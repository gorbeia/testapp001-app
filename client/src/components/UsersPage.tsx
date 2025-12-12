import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, MoreHorizontal, Link2, UserX, UserCheck } from 'lucide-react';

type UsersPageUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  function: string;
  phone: string;
  iban: string | null;
  linkedMember: string | null;
  isActive: boolean;
};

export function UsersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState<UsersPageUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsersPageUser | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const editNameRef = useRef<HTMLInputElement | null>(null);
  const editPhoneRef = useRef<HTMLInputElement | null>(null);
  const editIbanRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Fetch all users (including inactive) with status parameter
        const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
        const response = await authFetch(`/api/users${statusParam}`);
        if (!response.ok) return;
        const data: {
          id: string;
          username: string;
          password: string;
          name: string | null;
          role: string | null;
          function: string | null;
          phone: string | null;
          iban: string | null;
          linkedMemberId: string | null;
          linkedMemberName: string | null;
          isActive: boolean;
        }[] = await response.json();

        setUsers((prev) => {
          const existingEmails = new Set(prev.map((u) => u.email.toLowerCase()));
          const mapped: UsersPageUser[] = data
            .filter((dbUser) => !existingEmails.has(dbUser.username.toLowerCase()))
            .map((dbUser) => ({
              id: dbUser.id,
              name: dbUser.name ?? dbUser.username,
              email: dbUser.username,
              role: dbUser.role ?? 'bazkidea',
              function: dbUser.function ?? 'arrunta',
              phone: dbUser.phone ?? '',
              iban: dbUser.iban ?? null,
              linkedMember: dbUser.linkedMemberName,
              isActive: dbUser.isActive,
            }));

          return [...prev, ...mapped];
        });
      } catch {
        // ignore errors for now
      }
    };

    void loadUsers();
  }, [statusFilter]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && u.isActive) || 
                          (statusFilter === 'inactive' && !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleLabel = (role: string) => {
    return role === 'bazkidea' ? t('member') : t('companion');
  };

  const getFunctionLabel = (func: string) => {
    switch (func) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      default: return t('regular');
    }
  };

  const handleOpenEditUser = (user: UsersPageUser) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const payload = {
      name: editNameRef.current?.value.trim() || editingUser.name,
      phone: editPhoneRef.current?.value.trim() || editingUser.phone,
      iban: editIbanRef.current?.value.trim() ?? editingUser.iban ?? null,
    };

    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const updated = await response.json() as {
        id: string;
        username: string;
        name: string | null;
        role: string | null;
        function: string | null;
        phone: string | null;
        iban: string | null;
        linkedMemberName: string | null;
        isActive: boolean;
      };

      const updatedUser: UsersPageUser = {
        id: updated.id,
        name: updated.name ?? updated.username,
        email: updated.username,
        role: updated.role ?? editingUser.role,
        function: updated.function ?? editingUser.function,
        phone: updated.phone ?? '',
        iban: updated.iban ?? null,
        linkedMember: updated.linkedMemberName ?? editingUser.linkedMember,
        isActive: updated.isActive,
      };

      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      toast({
        title: t('success'),
        description: `${updatedUser.name} (${updatedUser.email})`,
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch {
      toast({
        title: t('error'),
        description: 'Ezin izan da erabiltzailea eguneratu',
        variant: 'destructive',
      });
    }
  };

  const handleToggleUserStatus = async (user: UsersPageUser) => {
    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(user.id)}/toggle-active`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle user status');
      }

      const updated = await response.json() as {
        id: string;
        username: string;
        name: string | null;
        role: string | null;
        function: string | null;
        phone: string | null;
        iban: string | null;
        linkedMemberName: string | null;
        isActive: boolean;
      };

      const updatedUser: UsersPageUser = {
        id: updated.id,
        name: updated.name ?? updated.username,
        email: updated.username,
        role: updated.role ?? user.role,
        function: updated.function ?? user.function,
        phone: updated.phone ?? '',
        iban: updated.iban ?? null,
        linkedMember: updated.linkedMemberName ?? user.linkedMember,
        isActive: updated.isActive,
      };

      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      toast({
        title: t('success'),
        description: `${updatedUser.name} ${updatedUser.isActive ? 'aktibatua' : 'desaktibatua'}`,
      });
    } catch {
      toast({
        title: t('error'),
        description: 'Ezin izan da erabiltzailearen egoera aldatu',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (user: UsersPageUser) => {
    const confirmed = window.confirm(t('confirmDeleteUser'));
    if (!confirmed) return;

    try {
      const response = await authFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));

      toast({
        title: t('success'),
        description: `${user.name} (${user.email})`,
      });
    } catch {
      toast({
        title: t('error'),
        description: 'Ezin izan da erabiltzailea ezabatu',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateUser = async () => {
    const name = nameInputRef.current?.value.trim() ?? '';
    const email = emailInputRef.current?.value.trim().toLowerCase() ?? '';

    if (!email) {
      toast({
        title: t('error'),
        description: t('email') + ' is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password: 'demo' }),
      });

      if (!response.ok) {
        toast({
          title: t('error'),
          description: 'Ezin izan da erabiltzailea sortu',
          variant: 'destructive',
        });
        return;
      }

      const created: { id: number; username: string; password: string } = await response.json();

      const newUser: UsersPageUser = {
        id: String(created.id),
        name: name || created.username,
        email: created.username,
        role: 'bazkidea',
        function: 'arrunta',
        phone: '',
        iban: null,
        linkedMember: null,
        isActive: true,
      };

      setUsers((prev) => [...prev, newUser]);

      toast({
        title: t('success'),
        description: 'Erabiltzailea sortua / Usuario creado',
      });
      setIsDialogOpen(false);
    } catch {
      toast({
        title: t('error'),
        description: 'Ezin izan da erabiltzailea sortu',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('users')}</h2>
          <p className="text-muted-foreground">{t('manageUsers')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-user">
              <Plus className="mr-2 h-4 w-4" />
              {t('newUser')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('newUser')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Izena / Nombre</Label>
                  <Input
                    placeholder="Izena..."
                    data-testid="input-user-name"
                    ref={nameInputRef}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    placeholder="email@txokoa.eus"
                    data-testid="input-user-email"
                    ref={emailInputRef}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('phone')}</Label>
                  <Input placeholder="+34..." data-testid="input-user-phone" />
                </div>
                <div className="space-y-2">
                  <Label>{t('role')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-user-role">
                      <SelectValue placeholder={t('role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bazkidea">{t('member')}</SelectItem>
                      <SelectItem value="laguna">{t('companion')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('function')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-user-function">
                      <SelectValue placeholder={t('function')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arrunta">{t('regular')}</SelectItem>
                      <SelectItem value="administratzailea">{t('administrator')}</SelectItem>
                      <SelectItem value="diruzaina">{t('treasurer')}</SelectItem>
                      <SelectItem value="sotolaria">{t('cellarman')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('linkedMember')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-linked-member">
                      <SelectValue placeholder="Aukeratu..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Inor ez</SelectItem>
                      {users.filter(u => u.role === 'bazkidea').map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('iban')}</Label>
                <Input placeholder="ES00 0000 0000 0000 0000 0000" data-testid="input-user-iban" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreateUser} data-testid="button-save-user">
                  {t('save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {editingUser && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('edit')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Izena / Nombre</Label>
                    <Input
                      defaultValue={editingUser.name}
                      ref={editNameRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('email')}</Label>
                    <Input value={editingUser.email} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('phone')}</Label>
                    <Input defaultValue={editingUser.phone} ref={editPhoneRef} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('role')}</Label>
                    <Select defaultValue={editingUser.role} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bazkidea">{t('member')}</SelectItem>
                        <SelectItem value="laguna">{t('companion')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('function')}</Label>
                    <Select defaultValue={editingUser.function} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arrunta">{t('regular')}</SelectItem>
                        <SelectItem value="administratzailea">{t('administrator')}</SelectItem>
                        <SelectItem value="diruzaina">{t('treasurer')}</SelectItem>
                        <SelectItem value="sotolaria">{t('cellarman')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('linkedMember')}</Label>
                    <Input value={editingUser.linkedMember ?? ''} disabled />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('iban')}</Label>
                  <Input
                    defaultValue={editingUser.iban ?? ''}
                    ref={editIbanRef}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingUser(null);
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleUpdateUser}>
                    {t('save')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t('search')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTime')}</SelectItem>
            <SelectItem value="bazkidea">{t('member')}</SelectItem>
            <SelectItem value="laguna">{t('companion')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Egoera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Guztiak</SelectItem>
            <SelectItem value="active">Aktiboak</SelectItem>
            <SelectItem value="inactive">Inaktiboak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('function')}</TableHead>
              <TableHead>Egoera</TableHead>
              <TableHead>{t('phone')}</TableHead>
              <TableHead>{t('linkedMember')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
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
                    <Badge variant={user.role === 'bazkidea' ? 'default' : 'secondary'}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getFunctionLabel(user.function)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'destructive'} className="gap-1">
                      {user.isActive ? (
                        <><UserCheck className="h-3 w-3" /> Aktibo</>
                      ) : (
                        <><UserX className="h-3 w-3" /> Inaktibo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{user.phone}</TableCell>
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
                        <Button variant="ghost" size="icon" data-testid={`button-user-menu-${user.id}`}>
                          <span className="sr-only">Menu</span>
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
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                          {user.isActive ? (
                            <><UserX className="mr-2 h-4 w-4" /> Desaktibatu</>
                          ) : (
                            <><UserCheck className="mr-2 h-4 w-4" /> Aktibatu</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('delete')}
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
  );
}
