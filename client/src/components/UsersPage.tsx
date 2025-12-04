import { useState } from 'react';
import { Plus, Search, Users, Link2, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockUsers = [
  { id: '1', name: 'Mikel Etxeberria', email: 'mikel@txokoa.eus', role: 'bazkidea', function: 'administratzailea', phone: '+34 943 123 456', iban: 'ES91 2100 0418 4502 0005 1332', linkedMember: null },
  { id: '2', name: 'Ane Zelaia', email: 'ane@txokoa.eus', role: 'bazkidea', function: 'diruzaina', phone: '+34 943 234 567', iban: 'ES91 2100 0418 4502 0005 1333', linkedMember: null },
  { id: '3', name: 'Jon Agirre', email: 'jon@txokoa.eus', role: 'bazkidea', function: 'sotolaria', phone: '+34 943 345 678', iban: 'ES91 2100 0418 4502 0005 1334', linkedMember: null },
  { id: '4', name: 'Miren Urrutia', email: 'miren@txokoa.eus', role: 'bazkidea', function: 'arrunta', phone: '+34 943 456 789', iban: 'ES91 2100 0418 4502 0005 1335', linkedMember: null },
  { id: '5', name: 'Andoni Garcia', email: 'andoni@txokoa.eus', role: 'laguna', function: 'arrunta', phone: '+34 943 567 890', iban: null, linkedMember: 'Miren Urrutia' },
  { id: '6', name: 'Iñaki Mendizabal', email: 'inaki@txokoa.eus', role: 'bazkidea', function: 'arrunta', phone: '+34 943 678 901', iban: 'ES91 2100 0418 4502 0005 1336', linkedMember: null },
];

export function UsersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredUsers = mockUsers.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateUser = () => {
    toast({
      title: t('success'),
      description: 'Erabiltzailea sortua / Usuario creado',
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('users')}</h2>
          <p className="text-muted-foreground">Kudeatu bazkideak eta lagunak</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Izena / Nombre</Label>
                  <Input placeholder="Izena..." data-testid="input-user-name" />
                </div>
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input type="email" placeholder="email@txokoa.eus" data-testid="input-user-email" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                      {mockUsers.filter(u => u.role === 'bazkidea').map(u => (
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
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Izena</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('function')}</TableHead>
              <TableHead>{t('phone')}</TableHead>
              <TableHead>{t('linkedMember')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
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
      </Card>
    </div>
  );
}
