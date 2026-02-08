import { useState, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Plus, Megaphone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { useAuth, canPostAnnouncements } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ErrorDisplay } from "@/components/ErrorDisplay";

// API helper function
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
}

export function AnnouncementsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const canPost = canPostAnnouncements(user);

  // Fetch announcements from API
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await authFetch("/api/announcements");
        if (response.ok) {
          const data = await response.json();
          setAnnouncements(data);
        } else {
          throw new Error("Failed to fetch announcements");
        }
      } catch (error) {
        console.error("Error fetching announcements:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "administratzailea":
        return t("administrator");
      case "diruzaina":
        return t("treasurer");
      case "sotolaria":
        return t("cellarman");
      default:
        return t("member");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) return;

    try {
      const response = await authFetch("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (response.ok) {
        const newAnnouncement = await response.json();
        setAnnouncements(prev => [newAnnouncement, ...prev]);
        toast({
          title: t("success"),
          description: t("announcementCreated"),
        });
        setTitle("");
        setContent("");
        setIsDialogOpen(false);
      } else {
        throw new Error("Failed to create announcement");
      }
    } catch (error) {
      console.error("Error creating announcement:", error);
      toast({
        title: t("error"),
        description: t("announcementCreateFailed"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <p>{t("loading")}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t("announcements")}</h2>
            <p className="text-muted-foreground">{t("societyNotesAndNews")}</p>
          </div>
          {canPost && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-announcement">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newAnnouncement")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("newAnnouncement")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t("title")}</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={t("titlePlaceholder")}
                      data-testid="input-announcement-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("content")}</Label>
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder={t("contentPlaceholder")}
                      rows={5}
                      data-testid="textarea-announcement-content"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button
                      onClick={handleCreateAnnouncement}
                      disabled={!title.trim() || !content.trim()}
                      data-testid="button-publish-announcement"
                    >
                      {t("publish")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="animate-pulse">
                  <Megaphone className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
                  <p className="text-muted-foreground">{t("loading")}</p>
                </div>
              </CardContent>
            </Card>
          ) : announcements.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("noNotes")}</p>
              </CardContent>
            </Card>
          ) : (
            announcements.map(announcement => (
              <Card key={announcement.id} data-testid={`card-announcement-${announcement.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-accent text-sm">
                          {getInitials(announcement.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-muted-foreground">
                            {announcement.authorName}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {getRoleLabel(announcement.authorRole)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(announcement.createdAt).toLocaleDateString("eu-ES")}
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
    </ErrorBoundary>
  );
}
