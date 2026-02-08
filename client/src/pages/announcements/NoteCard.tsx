import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es, eu } from "date-fns/locale";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Oharrak } from "./types";

interface NoteCardProps {
  note: Oharrak;
  isAdmin: boolean;
  onEdit: (note: Oharrak) => void;
  onDelete: (noteId: string) => void;
  onToggleActive: (note: Oharrak) => void;
}

export function NoteCard({ note, isAdmin, onEdit, onDelete, onToggleActive }: NoteCardProps) {
  const { t, language } = useLanguage();
  const locale = language === "eu" ? eu : es;

  return (
    <Card className={!note.isActive ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl">{note.title}</CardTitle>
            <div className="flex items-center space-x-2 mt-2">
              {isAdmin && (
                <Badge variant={note.isActive ? "default" : "secondary"}>
                  {note.isActive ? t("active") : t("inactive")}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {format(new Date(note.createdAt), "PPP", { locale })}
              </span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => onToggleActive(note)}>
                {note.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(note)}>
                <Edit className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. La nota "{note.title}" será eliminada
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(note.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{note.content}</p>
      </CardContent>
    </Card>
  );
}
