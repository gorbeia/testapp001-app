import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { UpcomingReservation } from './api';

interface UpcomingReservationsProps {
  reservations: UpcomingReservation[];
  totalCount: number;
  eventTypeLabels: Record<string, string>;
}

export function UpcomingReservations({ reservations, totalCount, eventTypeLabels }: UpcomingReservationsProps) {
  const { t } = useLanguage();
  const hasMore = totalCount > reservations.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('reservations')} - Hurrengoak
        </CardTitle>
        <CardDescription>Datozen erreserbak</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 rounded-md bg-muted/50"
              data-testid={`reservation-item-${reservation.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{reservation.member}</p>
                <p className="text-xs text-muted-foreground">
                  {reservation.date} - {reservation.time}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {reservation.table}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {eventTypeLabels[reservation.type] || reservation.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {reservation.guests} {t('guests')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="pt-2">
            <Link href="/reservations">
              <Button variant="outline" size="sm" className="w-full">
                {t('viewAllReservations')} ({totalCount} {t('total')})
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
