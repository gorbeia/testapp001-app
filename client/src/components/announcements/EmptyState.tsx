import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  isAdmin: boolean;
}

export function EmptyState({ isAdmin }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-32">
        <div className="text-center">
          <p className="text-muted-foreground">No hay notas disponibles</p>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">Crea tu primera nota usando el botón de arriba</p>
          ) : (
            <p className="text-sm text-muted-foreground">Los administradores pueden crear notas</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
