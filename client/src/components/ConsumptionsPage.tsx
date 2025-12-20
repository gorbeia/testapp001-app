import { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, X, Search, Receipt, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Product } from '@shared/schema';

// API helper function
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth:token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function ConsumptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosingAccount, setIsClosingAccount] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  const categoryLabels: Record<string, string> = {
    edariak: 'Edariak',
    janariak: 'Janariak',
    opilekuak: 'Opilekuak',
    kafea: 'Kafea',
    bestelakoak: 'Bestelakoak',
  };

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await authFetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          // Only show active products
          setProducts(data.filter((product: Product) => product.isActive));
        } else {
          throw new Error('Failed to fetch products');
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Error',
          description: 'Produktuak ezin izan dira kargatu',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [toast]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: parseFloat(product.price), 
        quantity: 1 
      }];
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
    setShowConfirmDialog(true);
  };

  const confirmCloseAccount = async () => {
    setShowConfirmDialog(false);
    setIsClosingAccount(true);

    try {
      // Create consumption session
      const consumptionResponse = await authFetch('/api/consumptions', {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Bar kontsumoa',
        }),
      });

      if (!consumptionResponse.ok) {
        throw new Error('Failed to create consumption');
      }

      const consumption = await consumptionResponse.json();

      // Add items to consumption
      const itemsResponse = await authFetch(`/api/consumptions/${consumption.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: null,
          })),
        }),
      });

      if (!itemsResponse.ok) {
        throw new Error('Failed to add consumption items');
      }

      const itemsResult = await itemsResponse.json();

      // Close the consumption
      const closeResponse = await authFetch(`/api/consumptions/${consumption.id}/close`, {
        method: 'POST',
      });

      if (!closeResponse.ok) {
        throw new Error('Failed to close consumption');
      }

      toast({
        title: t('success'),
        description: `Kontua itxita: ${cartTotal.toFixed(2)}€ / Cuenta cerrada: ${cartTotal.toFixed(2)}€`,
      });
      
      // Refresh products to update stock levels
      const productsResponse = await authFetch('/api/products');
      if (productsResponse.ok) {
        const data = await productsResponse.json();
        setProducts(data.filter((product: Product) => product.isActive));
      }
      
      setCart([]);
    } catch (error: any) {
      console.error('Error saving consumption:', error);
      toast({
        title: 'Error',
        description: error.message || 'Kontsumoa ezin izan da gorde',
        variant: 'destructive',
      });
    } finally {
      setIsClosingAccount(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]" data-testid="bar-page">
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">{t('consumptions')}</h2>
            <p className="text-muted-foreground">{t('manageConsumptions')}</p>
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
              {['all', 'edariak', 'janariak'].map((cat) => (
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
            {loading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Kargatzen...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Ez da produkturik aurkitu
              </div>
            ) : (
              filteredProducts.map((product) => {
                const stock = parseInt(product.stock);
                const minStock = parseInt(product.minStock);
                const isLowStock = stock <= minStock;
                
                return (
                  <Card
                    key={product.id}
                    className="hover-elevate"
                    data-testid={`product-card`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <span className="font-medium text-sm">{product.name}</span>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {categoryLabels[product.category] || product.category}
                          </Badge>
                          <span className="font-bold">{parseFloat(product.price).toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {t('stock')}: {stock} {product.unit}
                          </span>
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              Baxua
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="w-full mt-2"
                          data-testid="button-add-to-cart"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Gehitu
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card flex flex-col lg:max-h-none">
        {/* Cart Header with Handle - Always Visible */}
        <div className="p-4 border-b lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <h3 className="font-semibold">{t('cart')}</h3>
              {cartCount > 0 && (
                <Badge variant="secondary" data-testid="cart-count">
                  {cartCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCartExpanded(!isCartExpanded)}
              className="h-8 w-8 p-0"
              data-testid="cart-expand-toggle"
            >
              {isCartExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
          {cart.length > 0 && (
            <div className="flex justify-between items-center mt-2">
              <span className="font-medium text-sm">{t('total')}:</span>
              <span className="font-bold">{cartTotal.toFixed(2)}€</span>
            </div>
          )}
        </div>

        {/* Desktop Cart Header */}
        <div className="p-4 border-b hidden lg:block">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('cart')}
            {cartCount > 0 && (
              <Badge variant="secondary" className="ml-auto" data-testid="cart-count">
                {cartCount}
              </Badge>
            )}
          </h3>
        </div>

        {/* Collapsible Cart Content - Mobile Only */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out ${isCartExpanded ? 'max-h-96' : 'max-h-0'} overflow-hidden`}>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm" data-testid="mobile-cart-empty">{t('cartEmpty')}</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    data-testid={`mobile-cart-item-${item.productId}`}
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
                        data-testid={`mobile-button-decrease-quantity-${item.productId}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.productId, 1)}
                        data-testid={`mobile-button-increase-quantity-${item.productId}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFromCart(item.productId)}
                        data-testid={`mobile-button-remove-${item.productId}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Desktop Cart Content - Always Visible */}
        <div className="hidden lg:block">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm" data-testid="desktop-cart-empty">{t('cartEmpty')}</p>
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
                        data-testid={`button-decrease-quantity-${item.productId}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.productId, 1)}
                        data-testid={`button-increase-quantity-${item.productId}`}
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
        </div>

        {/* Cart Footer - Mobile (Collapsible) */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out ${isCartExpanded ? 'block' : 'hidden'}`}>
          <div className="p-4 border-t">
            <Button
              className="w-full"
              disabled={cart.length === 0 || isClosingAccount}
              onClick={handleCloseAccount}
              data-testid="mobile-button-close-account"
            >
              <Receipt className="mr-2 h-4 w-4" />
              {isClosingAccount ? 'Gordetzen...' : t('closeAccount')}
            </Button>
          </div>
        </div>

        {/* Cart Footer - Desktop */}
        <div className="hidden lg:block p-4 border-t mt-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="font-medium">{t('total')}:</span>
            <span className="text-xl font-bold">{cartTotal.toFixed(2)}€</span>
          </div>
          <Button
            className="w-full"
            disabled={cart.length === 0 || isClosingAccount}
            onClick={handleCloseAccount}
            data-testid="button-close-account"
          >
            <Receipt className="mr-2 h-4 w-4" />
            {isClosingAccount ? 'Gordetzen...' : t('closeAccount')}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl" data-testid="confirmation-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('confirmConsumption')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Member and Total Info */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('idea')}</p>
                  <p className="text-lg font-bold" data-testid="member-name">{user?.name || user?.email || 'Ezezaguna'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">{t('total')}</p>
                  <p className="text-2xl font-bold text-primary" data-testid="total-amount">{cartTotal.toFixed(2)}€</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">{t('products')}</h3>
              <ScrollArea className="h-48 border rounded-md">
                <Table data-testid="confirmation-items-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-center">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('unitPrice')}</TableHead>
                      <TableHead className="text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.price.toFixed(2)}€</TableCell>
                        <TableCell className="font-medium text-right">
                          {(item.price * item.quantity).toFixed(2)}€
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Final Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t('total')}:</span>
                <span className="text-2xl font-bold text-primary">{cartTotal.toFixed(2)}€</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isClosingAccount}
              data-testid="button-cancel-consumption"
            >
              Utzi
            </Button>
            <Button
              onClick={confirmCloseAccount}
              disabled={isClosingAccount}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-consumption"
            >
              <Receipt className="mr-2 h-4 w-4" />
              {isClosingAccount ? 'Gordetzen...' : 'Baieztatu eta Gorde'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
