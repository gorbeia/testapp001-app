import { useState } from 'react';
import { Plus, Search, Package, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockProducts = [
  { id: '1', name: 'Txakoli', price: 8.00, category: 'drinks', stock: 24, minStock: 10 },
  { id: '2', name: 'Garagardoa', price: 2.50, category: 'drinks', stock: 48, minStock: 20 },
  { id: '3', name: 'Ura', price: 1.00, category: 'drinks', stock: 100, minStock: 30 },
  { id: '4', name: 'Kafea', price: 1.50, category: 'drinks', stock: 50, minStock: 25 },
  { id: '5', name: 'Pintxo tortilla', price: 3.00, category: 'food', stock: 20, minStock: 10 },
  { id: '6', name: 'Pintxo jamon', price: 3.50, category: 'food', stock: 5, minStock: 10 },
  { id: '7', name: 'Croissant', price: 2.00, category: 'food', stock: 12, minStock: 8 },
  { id: '8', name: 'Tarta', price: 4.00, category: 'food', stock: 3, minStock: 5 },
  { id: '9', name: 'Patata frijituak', price: 5.00, category: 'food', stock: 30, minStock: 15 },
  { id: '10', name: 'Olibak', price: 2.50, category: 'food', stock: 25, minStock: 10 },
];

export function ProductsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const lowStockProducts = mockProducts.filter((p) => p.stock <= p.minStock);

  const handleCreateProduct = () => {
    toast({
      title: t('success'),
      description: 'Produktua sortua / Producto creado',
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('products')}</h2>
          <p className="text-muted-foreground">Kudeatu produktuak eta stock-a</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-product">
              <Plus className="mr-2 h-4 w-4" />
              {t('newProduct')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newProduct')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Izena / Nombre</Label>
                <Input placeholder="Produktuaren izena..." data-testid="input-product-name" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('price')} (€)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" data-testid="input-product-price" />
                </div>
                <div className="space-y-2">
                  <Label>{t('category')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder={t('category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drinks">{t('drinks')}</SelectItem>
                      <SelectItem value="food">{t('food')}</SelectItem>
                      <SelectItem value="other">{t('other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stock')}</Label>
                  <Input type="number" min="0" placeholder="0" data-testid="input-product-stock" />
                </div>
                <div className="space-y-2">
                  <Label>Stock minimoa</Label>
                  <Input type="number" min="0" placeholder="0" data-testid="input-product-min-stock" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreateProduct} data-testid="button-save-product">
                  {t('save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Stock baxua / Stock bajo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {lowStockProducts.map((p) => p.name).join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTime')}</SelectItem>
            <SelectItem value="drinks">{t('drinks')}</SelectItem>
            <SelectItem value="food">{t('food')}</SelectItem>
            <SelectItem value="other">{t('other')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produktua</TableHead>
              <TableHead>{t('category')}</TableHead>
              <TableHead className="text-right">{t('price')}</TableHead>
              <TableHead className="text-right">{t('stock')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryLabels[product.category]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{product.price.toFixed(2)}€</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {product.stock <= product.minStock && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={product.stock <= product.minStock ? 'text-destructive font-medium' : ''}>
                        {product.stock}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-product-menu-${product.id}`}>
                          <span className="sr-only">Menu</span>
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}
