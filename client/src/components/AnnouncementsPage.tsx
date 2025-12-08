import { useState } from 'react';
import { Plus, Megaphone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n';
import { useAuth, canPostAnnouncements } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockAnnouncements = [
  {
    id: '1',
    title: 'Aste Nagusiko ospakizuna',
    content: 'Abenduaren 15ean Aste Nagusiko afaria ospatuko dugu. Erreserbatu zuen tokia!',
    author: 'Mikel Etxeberria',
    authorRole: 'administratzailea',
    date: '2024-12-04',
  },
  {
    id: '2',
    title: 'Txakolin berria iritsi da',
    content: 'Getariako txakolin berria dugu bodegan. Txanda ona etorri da aurten. Probatzera animatu!',
    author: 'Jon Agirre',
    authorRole: 'sotolaria',
    date: '2024-12-03',
  },
  {
    id: '3',
    title: 'Hilabeteko kontuak',
    content: 'Azaroko kontuak pasatuko dira. Mesedez, ziurtatu zuen kontuan saldo nahikoa dagoela.',
    author: 'Ane Zelaia',
    authorRole: 'diruzaina',
    date: '2024-12-01',
  },
  {
    id: '4',
    title: 'Sukaldeko ekipamendua',
    content: 'Labea konponduta dago. Erreserba guztietan erabili daiteke berriro.',
    author: 'Jon Agirre',
    authorRole: 'sotolaria',
    date: '2024-11-28',
  },
];

export function AnnouncementsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const canPost = canPostAnnouncements(user);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      default: return t('member');
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

  const handleCreateAnnouncement = () => {
    if (!title.trim() || !content.trim()) return;
    toast({
      title: t('success'),
      description: 'Oharra argitaratua / Anuncio publicado',
    });
    setTitle('');
    setContent('');
    setIsDialogOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('announcements')}</h2>
          <p className="text-muted-foreground">Elkartearen oharrak eta albisteak</p>
        </div>
        {canPost && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-announcement">
                <Plus className="mr-2 h-4 w-4" />
                {t('newAnnouncement')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('newAnnouncement')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Izenburua / Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Idatzi izenburua..."
                    data-testid="input-announcement-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Edukia / Contenido</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Idatzi mezua..."
                    rows={5}
                    data-testid="textarea-announcement-content"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleCreateAnnouncement}
                    disabled={!title.trim() || !content.trim()}
                    data-testid="button-publish-announcement"
                  >
                    Argitaratu
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {mockAnnouncements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('noResults')}</p>
            </CardContent>
          </Card>
        ) : (
          mockAnnouncements.map((announcement) => (
            <Card key={announcement.id} data-testid={`card-announcement-${announcement.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-accent text-sm">
                        {getInitials(announcement.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{announcement.author}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {getRoleLabel(announcement.authorRole)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {announcement.date}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{announcement.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
