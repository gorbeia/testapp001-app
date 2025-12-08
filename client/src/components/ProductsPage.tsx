import { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
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

export function ProductsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });

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
          setProducts(data);
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

  const lowStockProducts = products.filter((p) => {
    const stock = parseInt(p.stock);
    const minStock = parseInt(p.minStock);
    return stock <= minStock;
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    unit: 'unit',
    minStock: '',
    supplier: '',
    isActive: true,
  });

  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    unit: 'unit',
    minStock: '',
    supplier: '',
    isActive: true,
  });

  const handleCreateProduct = async () => {
    try {
      const response = await authFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        const createdProduct = await response.json();
        setProducts([...products, createdProduct]);
        toast({
          title: 'Produktua sortua',
          description: `${newProduct.name} ondo sortu da`,
        });
        
        // Reset form
        setNewProduct({
          name: '',
          description: '',
          category: '',
          price: '',
          stock: '',
          unit: 'unit',
          minStock: '',
          supplier: '',
          isActive: true,
        });
        setIsDialogOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create product');
      }
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Produktua ezin izan da sortu',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteConfirm({ open: true, product });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm.product) return;
    
    try {
      const response = await authFetch(`/api/products/${deleteConfirm.product.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProducts(products.filter(p => p.id !== deleteConfirm.product!.id));
        toast({
          title: 'Produktua ezabatua',
          description: `${deleteConfirm.product.name} ondo ezabatu da`,
        });
        setDeleteConfirm({ open: false, product: null });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete product');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Produktua ezin izan da ezabatu',
        variant: 'destructive',
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ open: false, product: null });
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct({
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
      minStock: product.minStock,
      supplier: product.supplier || '',
      isActive: product.isActive,
    });
    setEditDialog({ open: true, product });
  };

  const handleUpdateProduct = async () => {
    if (!editDialog.product) return;
    
    try {
      const response = await authFetch(`/api/products/${editDialog.product.id}`, {
        method: 'PUT',
        body: JSON.stringify(editProduct),
      });

      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts(products.map(p => p.id === editDialog.product!.id ? updatedProduct : p));
        toast({
          title: 'Produktua eguneratua',
          description: `${editProduct.name} ondo eguneratu da`,
        });
        setEditDialog({ open: false, product: null });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update product');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Produktua ezin izan da eguneratu',
        variant: 'destructive',
      });
    }
  };

  const cancelEdit = () => {
    setEditDialog({ open: false, product: null });
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
              <DialogTitle>Produktu Berria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Izena</Label>
                <Input 
                  placeholder="Produktuaren izena..." 
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  data-testid="input-product-name" 
                />
              </div>

              <div className="space-y-2">
                <Label>Deskribapena</Label>
                <Input 
                  placeholder="Produktuaren deskribapena..." 
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder="Hautatu kategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edariak">Edariak</SelectItem>
                      <SelectItem value="janariak">Janariak</SelectItem>
                      <SelectItem value="opilekuak">Opilekuak</SelectItem>
                      <SelectItem value="kafea">Kafea</SelectItem>
                      <SelectItem value="bestelakoak">Bestelakoak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prezioa (€)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder="0.00" 
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    data-testid="input-product-price" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="0" 
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    data-testid="input-product-stock" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unitatea</Label>
                  <Select value={newProduct.unit} onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit">Unitatea</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="l">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stock minimoa</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="0" 
                    value={newProduct.minStock}
                    onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })}
                    data-testid="input-product-min-stock" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hornitzailea</Label>
                <Input 
                  placeholder="Hornitzailearen izena..." 
                  value={newProduct.supplier}
                  onChange={(e) => setNewProduct({ ...newProduct, supplier: e.target.value })}
                />
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
            <SelectItem value="all">Guztiak</SelectItem>
            <SelectItem value="edariak">Edariak</SelectItem>
            <SelectItem value="janariak">Janariak</SelectItem>
            <SelectItem value="opilekuak">Opilekuak</SelectItem>
            <SelectItem value="kafea">Kafea</SelectItem>
            <SelectItem value="bestelakoak">Bestelakoak</SelectItem>
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Kargatzen...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Ez da emaitzik aurkitu
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const stock = parseInt(product.stock);
                const minStock = parseInt(product.minStock);
                const isLowStock = stock <= minStock;
                
                return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <span className="font-medium">{product.name}</span>
                          {product.description && (
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabels[product.category] || product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{parseFloat(product.price).toFixed(2)}€</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isLowStock && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={isLowStock ? 'text-destructive font-medium' : ''}>
                          {stock} {product.unit}
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
                          <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && cancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produktua Editatu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Izena</Label>
              <Input 
                placeholder="Produktuaren izena..." 
                value={editProduct.name}
                onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                data-testid="input-edit-product-name" 
              />
            </div>

            <div className="space-y-2">
              <Label>Deskribapena</Label>
              <Input 
                placeholder="Produktuaren deskribapena..." 
                value={editProduct.description}
                onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select value={editProduct.category} onValueChange={(value) => setEditProduct({ ...editProduct, category: value })}>
                  <SelectTrigger data-testid="select-edit-product-category">
                    <SelectValue placeholder="Hautatu kategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edariak">Edariak</SelectItem>
                    <SelectItem value="janariak">Janariak</SelectItem>
                    <SelectItem value="opilekuak">Opilekuak</SelectItem>
                    <SelectItem value="kafea">Kafea</SelectItem>
                    <SelectItem value="bestelakoak">Bestelakoak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prezioa (€)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  placeholder="0.00" 
                  value={editProduct.price}
                  onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
                  data-testid="input-edit-product-price" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input 
                  type="number" 
                  min="0" 
                  placeholder="0" 
                  value={editProduct.stock}
                  onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })}
                  data-testid="input-edit-product-stock" 
                />
              </div>
              <div className="space-y-2">
                <Label>Unitatea</Label>
                <Select value={editProduct.unit} onValueChange={(value) => setEditProduct({ ...editProduct, unit: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unitatea</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="l">L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock minimoa</Label>
                <Input 
                  type="number" 
                  min="0" 
                  placeholder="0" 
                  value={editProduct.minStock}
                  onChange={(e) => setEditProduct({ ...editProduct, minStock: e.target.value })}
                  data-testid="input-edit-product-min-stock" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hornitzailea</Label>
              <Input 
                placeholder="Hornitzailearen izena..." 
                value={editProduct.supplier}
                onChange={(e) => setEditProduct({ ...editProduct, supplier: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={cancelEdit}>
                {t('cancel')}
              </Button>
              <Button onClick={handleUpdateProduct} data-testid="button-update-product">
                {t('update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produktua Ezabatu</AlertDialogTitle>
            <AlertDialogDescription>
              Ziur zaude "{deleteConfirm.product?.name}" produktua ezabatu nahi duzula? Ekintza hau ezin da desegin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Utzi</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ezabatu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
