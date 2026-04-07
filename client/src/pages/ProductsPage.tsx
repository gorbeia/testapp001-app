import { useState, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { getErrorMessage } from "@/lib/errors";
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ErrorDisplay } from "@/components/ErrorBoundary";

// Define Category type for frontend
type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

// API helper function
const authFetch = async (url: string, options: globalThis.RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

export function ProductsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });

  // Fetch products and categories from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          authFetch("/api/products"),
          authFetch("/api/categories"),
        ]);

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData);
        } else {
          throw new Error("Failed to fetch products");
        }

        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData);
        } else {
          const errorText = await categoriesResponse.text();
          console.error("Categories API error:", errorText);
          throw new Error(`Failed to fetch categories: ${errorText}`);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => {
    const stock = parseInt(p.stock);
    const minStock = parseInt(p.minStock);
    return stock <= minStock;
  });

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
    stock: "",
    unit: "unit",
    minStock: "",
    supplier: "",
    isActive: true,
  });

  const [editProduct, setEditProduct] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
    unit: "unit",
    minStock: "",
    supplier: "",
    isActive: true,
  });

  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [adjustForm, setAdjustForm] = useState({
    type: "adjustment" as "adjustment" | "damage",
    quantityInput: "",
    reason: "",
  });

  const handleCreateProduct = async () => {
    try {
      const response = await authFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        const createdProduct = await response.json();
        setProducts([...products, createdProduct]);
        toast({
          title: "Produktua sortua",
          description: `${newProduct.name} ondo sortu da`,
        });

        // Reset form
        setNewProduct({
          name: "",
          description: "",
          categoryId: "",
          price: "",
          stock: "",
          unit: "unit",
          minStock: "",
          supplier: "",
          isActive: true,
        });
        setIsDialogOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create product");
      }
    } catch (error: unknown) {
      console.error("Error creating product:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Produktua ezin izan da sortu",
        variant: "destructive",
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
        method: "DELETE",
      });

      if (response.ok) {
        setProducts(products.filter(p => p.id !== deleteConfirm.product!.id));
        toast({
          title: "Produktua ezabatua",
          description: `${deleteConfirm.product.name} ondo ezabatu da`,
        });
        setDeleteConfirm({ open: false, product: null });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete product");
      }
    } catch (error: unknown) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Produktua ezin izan da ezabatu",
        variant: "destructive",
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ open: false, product: null });
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct({
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId || "",
      price: product.price,
      unit: product.unit,
      minStock: product.minStock,
      supplier: product.supplier || "",
      isActive: product.isActive,
    });
    setEditDialog({ open: true, product });
  };

  const openAdjustStock = (product: Product) => {
    setAdjustForm({ type: "adjustment", quantityInput: "", reason: "" });
    setAdjustDialog({ open: true, product });
  };

  const submitAdjustStock = async () => {
    if (!adjustDialog.product) return;
    const raw = parseInt(adjustForm.quantityInput, 10);
    if (Number.isNaN(raw) || adjustForm.reason.trim() === "") {
      toast({
        title: t("error"),
        description: t("stockAdjustFormInvalid"),
        variant: "destructive",
      });
      return;
    }
    let quantity: number;
    if (adjustForm.type === "damage") {
      quantity = -Math.abs(raw);
    } else {
      quantity = raw;
    }

    try {
      const response = await authFetch(`/api/products/${adjustDialog.product.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          type: adjustForm.type,
          quantity,
          reason: adjustForm.reason.trim(),
        }),
      });

      if (response.ok) {
        const updated = await authFetch("/api/products");
        if (updated.ok) {
          setProducts(await updated.json());
        }
        toast({ title: t("stockAdjustSuccess") });
        setAdjustDialog({ open: false, product: null });
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || t("stockAdjustFailed"));
      }
    } catch (e: unknown) {
      toast({
        title: t("error"),
        description: getErrorMessage(e) || t("stockAdjustFailed"),
        variant: "destructive",
      });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editDialog.product) return;

    try {
      const response = await authFetch(`/api/products/${editDialog.product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editProduct.name,
          description: editProduct.description || undefined,
          categoryId: editProduct.categoryId,
          price: editProduct.price,
          unit: editProduct.unit,
          minStock: editProduct.minStock,
          supplier: editProduct.supplier || undefined,
          isActive: editProduct.isActive,
        }),
      });

      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts(products.map(p => (p.id === editDialog.product!.id ? updatedProduct : p)));
        toast({
          title: "Produktua eguneratua",
          description: `${editProduct.name} ondo eguneratu da`,
        });
        setEditDialog({ open: false, product: null });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update product");
      }
    } catch (error: unknown) {
      console.error("Error updating product:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Produktua ezin izan da eguneratu",
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    setEditDialog({ open: false, product: null });
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
            <h2 className="text-2xl font-bold">{t("products")}</h2>
            <p className="text-muted-foreground">{t("manageProductsAndStock")}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" asChild data-testid="link-stock-changes">
              <Link href="/stock-aldaketak">
                <ClipboardList className="mr-2 h-4 w-4" />
                {t("stockChanges")}
              </Link>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-product" aria-label="Produktu berria sortu">
                <Plus className="mr-2 h-4 w-4" />
                {t("newProduct")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("newProduct")}</DialogTitle>
                <DialogDescription>Sortu produktu berri bat sistema honentzat.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t("name")}</Label>
                  <Input
                    placeholder="Produktuaren izena..."
                    aria-label="Produktuaren izena"
                    value={newProduct.name}
                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                    data-testid="input-product-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("productDescription")}</Label>
                  <Input
                    placeholder="Produktuaren deskribapena..."
                    aria-label="Produktuaren deskribapena"
                    value={newProduct.description}
                    onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("productCategory")}</Label>
                    <Select
                      value={newProduct.categoryId}
                      onValueChange={value => setNewProduct({ ...newProduct, categoryId: value })}
                    >
                      <SelectTrigger
                        data-testid="select-product-category"
                        aria-label="Hautatu produktuaren kategoria"
                      >
                        <SelectValue placeholder="Hautatu kategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="loading" disabled>
                            Kategoriak kargatzen...
                          </SelectItem>
                        ) : (
                          categories.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
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
                      aria-label="Produktuaren prezioa eurotan"
                      value={newProduct.price}
                      onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                      data-testid="input-product-price"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("productStock")}</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      aria-label="Produktuaren stock kopurua"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                      data-testid="input-product-stock"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("productUnit")}</Label>
                    <Select
                      value={newProduct.unit}
                      onValueChange={value => setNewProduct({ ...newProduct, unit: value })}
                    >
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
                    <Label>{t("minStock")}</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      aria-label="Stock minimoaren alerta mugaria"
                      value={newProduct.minStock}
                      onChange={e => setNewProduct({ ...newProduct, minStock: e.target.value })}
                      data-testid="input-product-min-stock"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("supplier")}</Label>
                  <Input
                    placeholder="Hornitzailearen izena..."
                    aria-label="Hornitzailearen izena"
                    value={newProduct.supplier}
                    onChange={e => setNewProduct({ ...newProduct, supplier: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    aria-label="Ezeztatu produktu berria"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleCreateProduct}
                    data-testid="button-save-product"
                    aria-label="Gorde produktu berria"
                  >
                    {t("save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {lowStockProducts.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t("lowStock")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lowStockProducts.map(p => p.name).join(", ")}
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
              placeholder={`${t("search")}...`}
              aria-label="Bilatu produktuak izenez"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-products"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-full sm:w-48"
              data-testid="select-filter-category"
              aria-label="Iragazi produktuak kategoriaz"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("name")}</TableHead>
                  <TableHead scope="col">{t("category")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("stock")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("price")}</TableHead>
                  <TableHead scope="col" className="w-12"></TableHead>
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
                  filteredProducts.map(product => {
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
                                <p className="text-sm text-muted-foreground">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categories.find(c => c.id === product.categoryId)?.name ||
                              "Kategoria ezezaguna"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isLowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            <span className={isLowStock ? "text-destructive font-medium" : ""}>
                              {stock} {product.unit}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {parseFloat(product.price).toFixed(2)}€
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-product-menu-${product.id}`}
                                aria-label={`Produktuaren menua: ${product.name}`}
                              >
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
                                {t("edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openAdjustStock(product)}
                                data-testid={`menu-adjust-stock-${product.id}`}
                              >
                                <ClipboardList className="mr-2 h-4 w-4" />
                                {t("adjustStock")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteProduct(product)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t("delete")}
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
        <Dialog open={editDialog.open} onOpenChange={open => !open && cancelEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editProduct")}</DialogTitle>
              <DialogDescription>Editatu produktuaren informazioa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input
                  placeholder="Produktuaren izena..."
                  aria-label="Editatu produktuaren izena"
                  value={editProduct.name}
                  onChange={e => setEditProduct({ ...editProduct, name: e.target.value })}
                  data-testid="input-edit-product-name"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("productDescription")}</Label>
                <Input
                  placeholder="Produktuaren deskribapena..."
                  aria-label="Editatu produktuaren deskribapena"
                  value={editProduct.description}
                  onChange={e => setEditProduct({ ...editProduct, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("productCategory")}</Label>
                  <Select
                    value={editProduct.categoryId}
                    onValueChange={value => setEditProduct({ ...editProduct, categoryId: value })}
                  >
                    <SelectTrigger
                      data-testid="select-edit-product-category"
                      aria-label="Editatu produktuaren kategoria"
                    >
                      <SelectValue placeholder="Hautatu kategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Kategoriak kargatzen...
                        </SelectItem>
                      ) : (
                        categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
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
                    aria-label="Editatu produktuaren prezioa eurotan"
                    value={editProduct.price}
                    onChange={e => setEditProduct({ ...editProduct, price: e.target.value })}
                    data-testid="input-edit-product-price"
                  />
                </div>
              </div>

              {editDialog.product && (
                <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 p-3">
                  <span className="font-medium text-foreground">{t("productStock")}: </span>
                  {editDialog.product.stock} {editDialog.product.unit}
                  <span className="block mt-2">{t("stockUseAdjustNotPut")}</span>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("productUnit")}</Label>
                  <Select
                    value={editProduct.unit}
                    onValueChange={value => setEditProduct({ ...editProduct, unit: value })}
                  >
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
                  <Label>{t("minStock")}</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    aria-label="Editatu stock minimoaren alerta mugaria"
                    value={editProduct.minStock}
                    onChange={e => setEditProduct({ ...editProduct, minStock: e.target.value })}
                    data-testid="input-edit-product-min-stock"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("supplier")}</Label>
                <Input
                  placeholder="Hornitzailearen izena..."
                  aria-label="Editatu hornitzailearen izena"
                  value={editProduct.supplier}
                  onChange={e => setEditProduct({ ...editProduct, supplier: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  aria-label="Ezeztatu produktuaren edizioa"
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleUpdateProduct}
                  data-testid="button-update-product"
                  aria-label="Eguneratu produktua"
                >
                  {t("update")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={adjustDialog.open}
          onOpenChange={open => !open && setAdjustDialog({ open: false, product: null })}
        >
          <DialogContent data-testid="dialog-adjust-stock">
            <DialogHeader>
              <DialogTitle>{t("adjustStock")}</DialogTitle>
              <DialogDescription>
                {adjustDialog.product
                  ? `${adjustDialog.product.name} — ${t("productStock")}: ${adjustDialog.product.stock} ${adjustDialog.product.unit}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("type")}</Label>
                <Select
                  value={adjustForm.type}
                  onValueChange={v =>
                    setAdjustForm({
                      ...adjustForm,
                      type: v as "adjustment" | "damage",
                    })
                  }
                >
                  <SelectTrigger data-testid="select-adjust-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">{t("stockTypeAdjustment")}</SelectItem>
                    <SelectItem value="damage">{t("stockTypeDamage")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("quantity")}</Label>
                <Input
                  type="number"
                  data-testid="input-adjust-quantity"
                  value={adjustForm.quantityInput}
                  onChange={e =>
                    setAdjustForm({ ...adjustForm, quantityInput: e.target.value })
                  }
                  aria-label={t("quantity")}
                />
                <p className="text-xs text-muted-foreground">
                  {adjustForm.type === "damage"
                    ? t("stockDamagePositiveHint")
                    : t("stockQuantityDelta")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("reason")}</Label>
                <Input
                  data-testid="input-adjust-reason"
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder={t("reason")}
                  aria-label={t("reason")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAdjustDialog({ open: false, product: null })}
                >
                  {t("cancel")}
                </Button>
                <Button onClick={() => void submitAdjustStock()} data-testid="button-apply-adjust">
                  {t("applyAdjustStock")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirm.open} onOpenChange={open => !open && cancelDelete()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteProduct")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmDeleteProduct").replace("{name}", deleteConfirm.product?.name || "")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={cancelDelete}
                aria-label="Ezeztatu produktuaren ezabapena"
              >
                Utzi
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteProduct}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                aria-label="Berretsi produktuaren ezabapena"
              >
                Ezabatu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
}
