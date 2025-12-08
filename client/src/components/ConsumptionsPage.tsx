import { useState } from 'react';
import { Plus, Minus, ShoppingCart, X, Search, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockProducts = [
  { id: '1', name: 'Txakoli', price: 8.00, category: 'drinks', stock: 24 },
  { id: '2', name: 'Garagardoa', price: 2.50, category: 'drinks', stock: 48 },
  { id: '3', name: 'Ura', price: 1.00, category: 'drinks', stock: 100 },
  { id: '4', name: 'Kafea', price: 1.50, category: 'drinks', stock: 50 },
  { id: '5', name: 'Pintxo tortilla', price: 3.00, category: 'food', stock: 20 },
  { id: '6', name: 'Pintxo jamon', price: 3.50, category: 'food', stock: 15 },
  { id: '7', name: 'Croissant', price: 2.00, category: 'food', stock: 12 },
  { id: '8', name: 'Tarta', price: 4.00, category: 'food', stock: 8 },
  { id: '9', name: 'Patata frijituak', price: 5.00, category: 'food', stock: 30 },
  { id: '10', name: 'Olibak', price: 2.50, category: 'food', stock: 25 },
];

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function ConsumptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);

  const categoryLabels: Record<string, string> = {
    drinks: t('drinks'),
    food: t('food'),
    other: t('other'),
  };

  const filteredProducts = mockProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: typeof mockProducts[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCloseAccount = () => {
    if (cart.length === 0) return;
    toast({
      title: t('success'),
      description: `Kontua itxita: ${cartTotal.toFixed(2)}€ / Cuenta cerrada: ${cartTotal.toFixed(2)}€`,
    });
    setCart([]);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">{t('consumptions')}</h2>
            <p className="text-muted-foreground">Erregistratu kontsumoak</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('search')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'drinks', 'food'].map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  data-testid={`button-filter-${cat}`}
                >
                  {cat === 'all' ? t('allTime') : categoryLabels[cat]}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => addToCart(product)}
                data-testid={`card-product-${product.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2">
                    <span className="font-medium text-sm">{product.name}</span>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabels[product.category]}
                      </Badge>
                      <span className="font-bold">{product.price.toFixed(2)}€</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t('stock')}: {product.stock}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card flex flex-col max-h-[50vh] lg:max-h-none">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('cart')}
            {cartCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {cartCount}
              </Badge>
            )}
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Saskia hutsik dago</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                  data-testid={`cart-item-${item.productId}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.price.toFixed(2)}€ x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.productId, -1)}
                      data-testid={`button-decrease-${item.productId}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.productId, 1)}
                      data-testid={`button-increase-${item.productId}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFromCart(item.productId)}
                      data-testid={`button-remove-${item.productId}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="font-medium">{t('total')}:</span>
            <span className="text-xl font-bold">{cartTotal.toFixed(2)}€</span>
          </div>
          <Button
            className="w-full"
            disabled={cart.length === 0}
            onClick={handleCloseAccount}
            data-testid="button-close-account"
          >
            <Receipt className="mr-2 h-4 w-4" />
            {t('closeAccount')}
          </Button>
        </div>
      </div>
    </div>
  );
}
