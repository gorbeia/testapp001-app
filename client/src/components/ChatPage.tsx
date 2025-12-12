import { useState, useRef, useEffect } from 'react';
import { Send, Search, MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { authFetch } from '@/lib/api';
import { format } from 'date-fns';
import { es, eu } from 'date-fns/locale';
import { useSocket } from '@/hooks/useSocket';

interface ChatRoom {
  id: string;
  user1Id: string;
  user2Id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  unread: number;
  lastMessage: {
    content: string;
    createdAt: string;
  } | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  messageType: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  senderName: string;
  senderRole: string;
}

// Browser-compatible UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export function ChatPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { socket, connected, joinRoom, leaveRoom } = useSocket();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [recentlySentMessages, setRecentlySentMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatRooms();
  }, []);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('new-message', (message: ChatMessage) => {
      if (message.roomId === selectedRoom) {
        setMessages(prev => {
          // Check if this message was recently sent from this tab
          const isRecentlySent = recentlySentMessages.has(message.id);
          const messageExists = prev.some(m => m.id === message.id);
          
          if (!messageExists && !isRecentlySent) {
            return [...prev, message];
          }
          
          // Remove from recently sent set after processing
          if (isRecentlySent) {
            setRecentlySentMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(message.id);
              return newSet;
            });
          }
          
          return prev;
        });
        
        // Always scroll when a message is received, even if it's filtered out
        // This ensures the receiving tab scrolls to show the message
        setTimeout(() => {
          const scrollContainer = messagesEndRef.current?.parentElement;
          if (scrollContainer) {
            const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 50;
            if (isAtBottom) {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }, 100);
      }
      // Update chat rooms to show new last message
      fetchChatRooms();
    });

    // Listen for message notifications
    socket.on('new-message-notification', (data: any) => {
      console.log('New message notification:', data);
      // Update chat rooms to show unread count
      fetchChatRooms();
    });

    return () => {
      socket.off('new-message');
      socket.off('new-message-notification');
    };
  }, [socket, selectedRoom]);

  // Join/leave chat rooms based on selection
  useEffect(() => {
    if (!selectedRoom || !socket) return;

    joinRoom(selectedRoom);
    
    return () => {
      if (socket) {
        leaveRoom(selectedRoom);
      }
    };
  }, [selectedRoom]);

  const fetchChatRooms = async () => {
    try {
      const response = await authFetch('/api/chat/rooms');
      if (response.ok) {
        const data = await response.json();
        // Sort by most recent (lastMessageAt descending, then createdAt descending)
        const sortedRooms = data.sort((a: any, b: any) => {
          // If both have lastMessageAt, sort by that
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          }
          // If only one has lastMessageAt, prioritize the one with messages
          if (a.lastMessageAt && !b.lastMessageAt) return -1;
          if (!a.lastMessageAt && b.lastMessageAt) return 1;
          // If neither has messages, sort by creation date
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setChatRooms(sortedRooms);
        if (sortedRooms.length > 0 && !selectedRoom) {
          setSelectedRoom(sortedRooms[0].id);
        }
      } else {
        console.error('Failed to fetch chat rooms:', response.status);
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom);
    }
  }, [selectedRoom]);

  const fetchMessages = async (roomId: string) => {
    try {
      setMessagesLoading(true);
      const response = await authFetch(`/api/chat/rooms/${roomId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        console.error('Failed to fetch messages:', response.status);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom) return;

    // Generate UUID in frontend using browser-compatible method
    const messageId = generateUUID();
    
    // Add to recently sent set to prevent duplicate from WebSocket
    setRecentlySentMessages(prev => new Set(prev).add(messageId));
    
    // Add message immediately with the generated UUID
    const tempMessage: ChatMessage = {
      id: messageId,
      roomId: selectedRoom,
      senderId: user?.id || '',
      content: messageInput.trim(),
      messageType: 'text',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      senderName: user?.name || user?.email || 'You',
      senderRole: user?.function || 'bazkidea',
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setMessageInput('');
    
    try {
      const response = await authFetch(`/api/chat/rooms/${selectedRoom}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: messageId,
          content: messageInput.trim(),
          messageType: 'text',
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        // Replace temp message with server response (has proper timestamps)
        setMessages(prev => 
          prev.map(m => m.id === messageId ? newMessage : m)
        );
        
        // Refresh chat rooms to update last message and maintain sorting
        fetchChatRooms();
      } else {
        // Remove temp message if send failed
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setRecentlySentMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });
        setMessageInput(messageInput.trim()); // Restore input
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message if send failed
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setRecentlySentMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      setMessageInput(messageInput.trim()); // Restore input
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await authFetch('/api/users/available-for-chat');
      if (response.ok) {
        const data = await response.json();
        // Filter out users who already have conversations
        const existingUserIds = chatRooms.map(room => room.otherUserId);
        const availableUsers = data.filter((u: any) => !existingUserIds.includes(u.id));
        setAvailableUsers(availableUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleStartConversation = async (otherUserId: string) => {
    try {
      const response = await authFetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otherUserId }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        // Add new room at the top and refresh to maintain proper sorting
        fetchChatRooms();
        setSelectedRoom(newRoom.id);
        setNewConversationOpen(false);
        fetchMessages(newRoom.id);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  useEffect(() => {
    if (newConversationOpen) {
      fetchAvailableUsers();
    }
  }, [newConversationOpen]);

  const filteredRooms = chatRooms.filter((room) =>
    room.otherUserName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRoomInfo = chatRooms.find((r) => r.id === selectedRoom);

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') {
      return '??';
    }
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = (user: any) => {
    return user.name || user.username || 'Unknown User';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'administratzailea': return t('administrator');
      case 'diruzaina': return t('treasurer');
      case 'sotolaria': return t('cellarman');
      default: return t('member');
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('eu-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('eu-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages change, but only if user is at bottom already
    // This prevents auto-scroll when user is scrolling up to read older messages
    const scrollContainer = messagesEndRef.current?.parentElement;
    if (scrollContainer) {
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 50;
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Hitzapenak kargatzen...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col max-h-[40vh] md:max-h-none">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('search')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
            <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
              <DialogTrigger asChild>
                <Button size="icon" data-testid="button-new-conversation">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Hasi solasaldi berria</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {usersLoading ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground">Erabiltzaileak kargatzen...</div>
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground">
                        Ez dago erabiltzailerik solasaldi berri bat hasteko
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableUsers.map((availableUser) => (
                        <button
                          key={availableUser.id}
                          onClick={() => handleStartConversation(availableUser.id)}
                          className="w-full p-3 rounded-md flex items-center gap-3 hover-elevate active-elevate-2 text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-xs">
                              {getInitials(getDisplayName(availableUser))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{getDisplayName(availableUser)}</div>
                            <div className="text-xs text-muted-foreground">
                              {getRoleLabel(availableUser.role || 'member')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {connected ? 'Konektatua' : 'Deskonektatua'}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredRooms.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Ez da hitzapenik aurkitu</p>
              </div>
            ) : (
              filteredRooms.map((room, index) => (
                <button
                  key={`room-${room.id}-${room.otherUserId}-${index}`}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`w-full p-3 rounded-md flex items-center gap-3 hover-elevate active-elevate-2 ${
                    selectedRoom === room.id ? 'bg-accent' : ''
                  }`}
                  data-testid={`room-${room.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-sm">
                      {getInitials(room.otherUserName || 'Unknown')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {room.otherUserName || 'Unknown User'}
                      </span>
                      {room.unread > 0 && (
                        <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                          {room.unread}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {room.lastMessage?.content || 'Ez da mezurik'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {room.lastMessageAt && formatLastMessageTime(room.lastMessageAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedRoom && selectedRoomInfo ? (
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-sm">
                  {getInitials(selectedRoomInfo.otherUserName || 'Unknown')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {selectedRoomInfo.otherUserName || 'Unknown User'}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {getRoleLabel(selectedRoomInfo.otherUserRole || 'member')}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-muted-foreground">Mezuak kargatzen...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>Ez da mezurik oraindik</p>
                      <p className="text-sm">Hasi solasaldia mezu bat bidaliz!</p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${selectedRoom}-${message.id}-${message.createdAt}-${index}`}
                        className={`flex ${
                          message.senderId === user?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.senderId === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                          data-testid={`message-${selectedRoom}-${message.id}`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              message.senderId === user?.id
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatMessageTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Idatzi zure mezua..."
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
            <p>Hautatu hitzapen bat mezuak ikusteko</p>
          </div>
        )}
      </div>
    </div>
  );
}
