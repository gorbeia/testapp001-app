import { useState, useRef, useEffect } from 'react';
import { Send, Search, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

// todo: remove mock functionality - replace with real API data
const mockContacts = [
  { id: '1', name: 'Mikel Etxeberria', role: 'administratzailea', unread: 2, lastMessage: 'Kaixo! Bihar erreserbatzen?' },
  { id: '2', name: 'Ane Zelaia', role: 'diruzaina', unread: 0, lastMessage: 'Kontuak bidalita' },
  { id: '3', name: 'Jon Agirre', role: 'sotolaria', unread: 1, lastMessage: 'Txakoli berria probatu?' },
  { id: '4', name: 'Miren Urrutia', role: 'arrunta', unread: 0, lastMessage: 'Eskerrik asko!' },
];

const mockMessages: Record<string, Array<{ id: string; senderId: string; content: string; timestamp: string }>> = {
  '1': [
    { id: 'm1', senderId: '1', content: 'Kaixo! Bihar erreserbatzen?', timestamp: '10:30' },
    { id: 'm2', senderId: 'me', content: 'Bai, afaria egiteko pentsatzen genuen', timestamp: '10:32' },
    { id: 'm3', senderId: '1', content: 'Bikaina! Zenbat izango zarete?', timestamp: '10:33' },
    { id: 'm4', senderId: 'me', content: '8 lagun gutxi gorabehera', timestamp: '10:35' },
  ],
  '3': [
    { id: 'm5', senderId: '3', content: 'Txakoli berria probatu duzu?', timestamp: '09:15' },
  ],
};

export function ChatPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedContact, setSelectedContact] = useState<string | null>('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredContacts = mockContacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedContact ? messages[selectedContact] || [] : [];
  const selectedContactInfo = mockContacts.find((c) => c.id === selectedContact);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      default: return t('member');
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;

    const newMessage = {
      id: `m${Date.now()}`,
      senderId: 'me',
      content: messageInput,
      timestamp: new Date().toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [selectedContact]: [...(prev[selectedContact] || []), newMessage],
    }));
    setMessageInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col max-h-[40vh] md:max-h-none">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('search')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-contacts"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact.id)}
                className={`w-full p-3 rounded-md flex items-center gap-3 hover-elevate active-elevate-2 ${
                  selectedContact === contact.id ? 'bg-accent' : ''
                }`}
                data-testid={`contact-${contact.id}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-sm">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{contact.name}</span>
                    {contact.unread > 0 && (
                      <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {contact.unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedContact && selectedContactInfo ? (
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-sm">
                  {getInitials(selectedContactInfo.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{selectedContactInfo.name}</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {getRoleLabel(selectedContactInfo.role)}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.senderId === 'me'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                      data-testid={`message-${message.id}`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-[10px] mt-1 ${
                        message.senderId === 'me' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={t('typeMessage')}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
            <p>Hautatu kontaktu bat mezuak ikusteko</p>
          </div>
        )}
      </div>
    </div>
  );
}
