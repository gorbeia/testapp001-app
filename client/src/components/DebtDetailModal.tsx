import { CreditCard, ChefHat, Calendar, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import type { Credit } from '@shared/schema';

interface DebtDetailModalProps {
  credit: Credit;
  trigger?: React.ReactNode;
}

export function DebtDetailModal({ credit, trigger }: DebtDetailModalProps) {
  const { t } = useLanguage();

  const consumptionAmount = parseFloat(credit.consumptionAmount || '0');
  const reservationAmount = parseFloat(credit.reservationAmount || '0');
  const kitchenAmount = parseFloat(credit.kitchenAmount || '0');
  const totalAmount = parseFloat(credit.totalAmount || '0');

  const debtItems = [
    {
      id: 'consumptions',
      label: t('consumptions') || 'Consumptions',
      amount: consumptionAmount,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: t('consumptionDescription') || 'Products and services consumed'
    },
    {
      id: 'reservations',
      label: t('reservations') || 'Reservations',
      amount: reservationAmount,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: t('reservationDescription') || 'Event and space reservations'
    },
    {
      id: 'kitchen',
      label: t('kitchenCost') || 'Kitchen Costs',
      amount: kitchenAmount,
      icon: ChefHat,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: t('kitchenDescription') || 'Kitchen and equipment usage costs'
    }
  ].filter(item => item.amount > 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('debtDetailsFor')} {credit.month}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status and Total */}
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm text-gray-600">{t('status')}</span>
              <div className="mt-1">
                <Badge variant={credit.status === 'paid' ? 'default' : 'destructive'}>
                  {credit.status === 'paid' ? t('paid') : t('pending')}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">{t('totalAmount')}</span>
              <div className="text-2xl font-bold text-gray-900">
                {totalAmount.toFixed(2)}€
              </div>
            </div>
          </div>

          {/* Debt Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t('debtBreakdown') || 'Debt Breakdown'}</h3>
            
            <div className="space-y-3">
              {debtItems.map((item) => {
                const Icon = item.icon;
                const percentage = totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0;
                
                return (
                  <Card key={item.id} className="border-l-4 border-l-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${item.bgColor}`}>
                            <Icon className={`h-5 w-5 ${item.color}`} />
                          </div>
                          <div>
                            <h4 className="font-medium">{item.label}</h4>
                            <p className="text-sm text-gray-600">{item.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{item.amount.toFixed(2)}€</div>
                          <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{t('calculatedOn') || 'Calculated on'}</span>
              <span className="text-gray-900">
                {new Date(credit.calculatedAt).toLocaleDateString()}
              </span>
            </div>
            {credit.markedAsPaidAt && (
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-gray-600">{t('markedAsPaidOn') || 'Marked as paid on'}</span>
                <span className="text-gray-900">
                  {new Date(credit.markedAsPaidAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
