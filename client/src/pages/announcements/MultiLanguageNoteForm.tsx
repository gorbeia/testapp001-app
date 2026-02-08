import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode, useState } from "react";
import { useLanguage } from "@/lib/i18n";

interface NoteMessage {
  language: "eu" | "es";
  title: string;
  content: string;
}

interface MultiLanguageNoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: {
    messages: NoteMessage[];
    isActive: boolean;
  };
  setFormData: (data: { messages: NoteMessage[]; isActive: boolean }) => void;
  isEditing?: boolean;
  children?: ReactNode;
}

export function MultiLanguageNoteForm({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isEditing = false,
  children,
}: MultiLanguageNoteFormProps) {
  const { t } = useLanguage();

  const updateMessage = (language: "eu" | "es", field: "title" | "content", value: string) => {
    const updatedMessages = formData.messages.map(msg =>
      msg.language === language ? { ...msg, [field]: value } : msg
    );
    setFormData({ ...formData, messages: updatedMessages });
  };

  const getMessage = (language: "eu" | "es") => {
    return (
      formData.messages.find(msg => msg.language === language) || {
        language,
        title: "",
        content: "",
      }
    );
  };

  const euMessage = getMessage("eu");
  const esMessage = getMessage("es");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editNote") : t("createNewNote")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <Tabs defaultValue="eu" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="eu">Euskara (EU)</TabsTrigger>
              <TabsTrigger value="es">Español (ES)</TabsTrigger>
            </TabsList>

            <TabsContent value="eu" className="space-y-4">
              <div>
                <Label htmlFor="eu-title">Izenburua *</Label>
                <Input
                  id="eu-title"
                  value={euMessage.title}
                  onChange={e => updateMessage("eu", "title", e.target.value)}
                  placeholder="Oharraren izenburua"
                  required
                />
              </div>
              <div>
                <Label htmlFor="eu-content">Edukia *</Label>
                <Textarea
                  id="eu-content"
                  value={euMessage.content}
                  onChange={e => updateMessage("eu", "content", e.target.value)}
                  placeholder="Oharraren edukia"
                  rows={6}
                  required
                />
              </div>
            </TabsContent>

            <TabsContent value="es" className="space-y-4">
              <div>
                <Label htmlFor="es-title">Título *</Label>
                <Input
                  id="es-title"
                  value={esMessage.title}
                  onChange={e => updateMessage("es", "title", e.target.value)}
                  placeholder="Título de la nota"
                  required
                />
              </div>
              <div>
                <Label htmlFor="es-content">Contenido *</Label>
                <Textarea
                  id="es-content"
                  value={esMessage.content}
                  onChange={e => updateMessage("es", "content", e.target.value)}
                  placeholder="Contenido de la nota"
                  rows={6}
                  required
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={isEditing ? "edit-isActive" : "isActive"}
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor={isEditing ? "edit-isActive" : "isActive"}>{t("active")}</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit">{isEditing ? t("updateNote") : t("createNote")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
