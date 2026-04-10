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

type StockModeUi = "auto" | "manual" | "none";
type ProductPurposeUi = "sale" | "internal" | "both";
type ProductRow = Product & { recipeLineCount?: number };
type RecipeLineDraft = { tempId: string; ingredientProductId: string; quantity: string };

function normalizeStockMode(product: Pick<Product, "stockMode">): StockModeUi {
  const m = product.stockMode ?? "auto";
  if (m === "manual" || m === "none") return m;
  return "auto";
}

function normalizePurpose(p: Product["purpose"]): ProductPurposeUi {
  if (p === "internal" || p === "both") return p;
  return "sale";
}

function parseStockDisplay(stock: string, minStock: string): { stock: number; minStock: number } {
  const s = parseFloat(stock);
  const m = parseFloat(minStock);
  return { stock: s, minStock: m };
}
import { ErrorFallback } from "@/components/ErrorBoundary";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
import { useAuth } from "@/lib/auth";
import { ImageUpload } from "@/components/ImageUpload";
import { productImageSrc, thumbFilenameFromImageUrl } from "@/lib/image-urls";

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
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; product: ProductRow | null }>(
    {
      open: false,
      product: null,
    }
  );
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: ProductRow | null }>({
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
    if (normalizeStockMode(p) === "none") return false;
    const { stock, minStock } = parseStockDisplay(p.stock, p.minStock);
    if (Number.isNaN(stock) || Number.isNaN(minStock)) return false;
    return stock <= minStock;
  });

  const bulkParentCandidates = products.filter(
    p => p.parentProductId == null || p.parentProductId === ""
  );

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
    stock: "",
    unit: "unit",
    stockMode: "auto" as StockModeUi,
    minStock: "",
    supplier: "",
    isActive: true,
    purpose: "sale" as ProductPurposeUi,
    parentProductId: "",
    parentUnitsPerSale: "",
  });
  const [newRecipeLines, setNewRecipeLines] = useState<RecipeLineDraft[]>([]);

  const [editProduct, setEditProduct] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
    unit: "unit",
    stockMode: "auto" as StockModeUi,
    minStock: "",
    supplier: "",
    isActive: true,
    purpose: "sale" as ProductPurposeUi,
    parentProductId: "",
    parentUnitsPerSale: "",
  });
  const [editRecipeLines, setEditRecipeLines] = useState<RecipeLineDraft[]>([]);

  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; product: ProductRow | null }>({
    open: false,
    product: null,
  });
  const [adjustForm, setAdjustForm] = useState({
    type: "adjustment" as "adjustment" | "damage",
    quantityInput: "",
    reason: "",
  });

  const handleCreateProduct = async () => {
    const hasParent = Boolean(newProduct.parentProductId.trim());
    const hasRecipe = newRecipeLines.some(
      l => l.ingredientProductId.trim() && l.quantity.trim() !== ""
    );
    if (hasParent && hasRecipe) {
      toast({
        title: t("error"),
        description: t("recipeMutuallyExclusive"),
        variant: "destructive",
      });
      return;
    }
    const mode = hasRecipe ? "none" : newProduct.stockMode;
    const payload: Record<string, unknown> = {
      name: newProduct.name,
      description: newProduct.description || undefined,
      categoryId: newProduct.categoryId,
      price: newProduct.price,
      unit: newProduct.unit,
      stockMode: mode,
      isActive: newProduct.isActive,
      purpose: newProduct.purpose,
      ...(hasParent
        ? {
            parentProductId: newProduct.parentProductId.trim(),
            parentUnitsPerSale: newProduct.parentUnitsPerSale.trim() || undefined,
          }
        : {}),
      ...(mode === "none"
        ? { stock: "0", minStock: "0" }
        : {
            stock: newProduct.stock || "0",
            minStock: newProduct.minStock || "0",
            supplier: newProduct.supplier.trim() ? newProduct.supplier.trim() : undefined,
          }),
    };
    try {
      const response = await authFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const createdProduct = (await response.json()) as ProductRow;
        let finalProduct = createdProduct;
        if (hasRecipe) {
          const lines = newRecipeLines
            .filter(l => l.ingredientProductId.trim() && l.quantity.trim() !== "")
            .map(l => ({
              ingredientProductId: l.ingredientProductId.trim(),
              quantity: l.quantity.trim(),
            }));
          if (lines.length > 0) {
            const recipeRes = await authFetch(`/api/products/${createdProduct.id}/recipe`, {
              method: "PUT",
              body: JSON.stringify({ lines }),
            });
            if (!recipeRes.ok) {
              const err = await recipeRes.json().catch(() => ({}));
              throw new Error(err.message || "Failed to save recipe");
            }
            finalProduct = { ...createdProduct, recipeLineCount: lines.length };
          }
        }
        setProducts([...products, finalProduct]);
        toast({
          title: "Produktua sortua",
          description: `${newProduct.name} ondo sortu da`,
        });

        setNewProduct({
          name: "",
          description: "",
          categoryId: "",
          price: "",
          stock: "",
          unit: "unit",
          stockMode: "auto",
          minStock: "",
          supplier: "",
          isActive: true,
          purpose: "sale",
          parentProductId: "",
          parentUnitsPerSale: "",
        });
        setNewRecipeLines([]);
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

  const handleDeleteProduct = (product: ProductRow) => {
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

  const handleEditProduct = async (product: ProductRow) => {
    setEditProduct({
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId || "",
      price: product.price,
      unit: product.unit,
      stockMode: normalizeStockMode(product),
      minStock: product.minStock,
      supplier: product.supplier || "",
      isActive: product.isActive,
      purpose: normalizePurpose(product.purpose ?? "sale"),
      parentProductId: product.parentProductId ?? "",
      parentUnitsPerSale: product.parentUnitsPerSale ?? "",
    });
    let lines: RecipeLineDraft[] = [];
    try {
      const res = await authFetch(`/api/products/${product.id}/recipe`);
      if (res.ok) {
        const data = (await res.json()) as {
          lines: { ingredientProductId: string; quantity: string }[];
        };
        lines = data.lines.map((l, i) => ({
          tempId: `e-${i}-${l.ingredientProductId}`,
          ingredientProductId: l.ingredientProductId,
          quantity: l.quantity,
        }));
      }
    } catch {
      /* ignore */
    }
    setEditRecipeLines(lines);
    setEditDialog({ open: true, product });
  };

  const openAdjustStock = (product: ProductRow) => {
    if (normalizeStockMode(product) === "none") {
      toast({
        title: t("error"),
        description: t("stockAdjustNotForNone"),
        variant: "destructive",
      });
      return;
    }
    setAdjustForm({ type: "adjustment", quantityInput: "", reason: "" });
    setAdjustDialog({ open: true, product });
  };

  const submitAdjustStock = async () => {
    if (!adjustDialog.product) return;
    const raw = parseFloat(adjustForm.quantityInput);
    if (!Number.isFinite(raw) || adjustForm.reason.trim() === "") {
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

    const hasParent = Boolean(editProduct.parentProductId.trim());
    const hasRecipe = editRecipeLines.some(
      l => l.ingredientProductId.trim() && l.quantity.trim() !== ""
    );
    if (hasParent && hasRecipe) {
      toast({
        title: t("error"),
        description: t("recipeMutuallyExclusive"),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await authFetch(`/api/products/${editDialog.product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editProduct.name,
          description: editProduct.description || undefined,
          categoryId: editProduct.categoryId,
          price: editProduct.price,
          unit: editProduct.unit,
          stockMode: hasRecipe ? "none" : editProduct.stockMode,
          minStock: hasRecipe || editProduct.stockMode === "none" ? "0" : editProduct.minStock,
          supplier:
            hasRecipe || editProduct.stockMode === "none"
              ? undefined
              : editProduct.supplier?.trim() || undefined,
          isActive: editProduct.isActive,
          purpose: editProduct.purpose,
          ...(hasParent
            ? {
                parentProductId: editProduct.parentProductId.trim(),
                parentUnitsPerSale: editProduct.parentUnitsPerSale.trim() || undefined,
              }
            : { parentProductId: null, parentUnitsPerSale: null }),
        }),
      });

      if (response.ok) {
        let updatedProduct = (await response.json()) as ProductRow;
        const lines = editRecipeLines
          .filter(l => l.ingredientProductId.trim() && l.quantity.trim() !== "")
          .map(l => ({
            ingredientProductId: l.ingredientProductId.trim(),
            quantity: l.quantity.trim(),
          }));
        const recipeRes = await authFetch(`/api/products/${editDialog.product.id}/recipe`, {
          method: "PUT",
          body: JSON.stringify({ lines }),
        });
        if (!recipeRes.ok) {
          const err = await recipeRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to save recipe");
        }
        updatedProduct = { ...updatedProduct, recipeLineCount: lines.length };
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
    return <AccessDeniedOrError error={error} cardLayout />;
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

                  <div className="space-y-2">
                    <Label>{t("productPurpose")}</Label>
                    <Select
                      value={newProduct.purpose}
                      onValueChange={value =>
                        setNewProduct({
                          ...newProduct,
                          purpose: value as ProductPurposeUi,
                        })
                      }
                    >
                      <SelectTrigger data-testid="select-new-product-purpose">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">{t("productPurposeSale")}</SelectItem>
                        <SelectItem value="internal">{t("productPurposeInternal")}</SelectItem>
                        <SelectItem value="both">{t("productPurposeBoth")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("productPurposeHint")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("stockMode")}</Label>
                    <Select
                      value={newProduct.stockMode}
                      onValueChange={value =>
                        setNewProduct({
                          ...newProduct,
                          stockMode: value as StockModeUi,
                        })
                      }
                    >
                      <SelectTrigger data-testid="select-new-product-stock-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("stockModeAuto")}</SelectItem>
                        <SelectItem value="manual">{t("stockModeManual")}</SelectItem>
                        <SelectItem value="none">{t("stockModeNone")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {newProduct.stockMode === "auto" && t("stockModeAutoHint")}
                      {newProduct.stockMode === "manual" && t("stockModeManualHint")}
                      {newProduct.stockMode === "none" && t("stockModeNoneHint")}
                    </p>
                  </div>

                  {newProduct.stockMode !== "none" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("productStock")}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
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
                            <SelectItem value="ml">ml</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("minStock")}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          aria-label="Stock minimoaren alerta mugaria"
                          value={newProduct.minStock}
                          onChange={e => setNewProduct({ ...newProduct, minStock: e.target.value })}
                          data-testid="input-product-min-stock"
                        />
                      </div>
                    </div>
                  )}

                  {newProduct.stockMode === "none" && (
                    <div className="space-y-2">
                      <Label>{t("productUnit")}</Label>
                      <Select
                        value={newProduct.unit}
                        onValueChange={value => setNewProduct({ ...newProduct, unit: value })}
                      >
                        <SelectTrigger data-testid="select-new-product-unit-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">Unitatea</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="l">L</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newProduct.stockMode !== "none" && (
                    <div className="space-y-2">
                      <Label>{t("supplier")}</Label>
                      <Input
                        placeholder="Hornitzailearen izena..."
                        aria-label="Hornitzailearen izena"
                        value={newProduct.supplier}
                        onChange={e => setNewProduct({ ...newProduct, supplier: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-3 border-t pt-4">
                    <Label>{t("productParentLabel")}</Label>
                    <Select
                      value={newProduct.parentProductId || "__none__"}
                      onValueChange={value =>
                        setNewProduct({
                          ...newProduct,
                          parentProductId: value === "__none__" ? "" : value,
                          parentUnitsPerSale: value === "__none__" ? "" : newProduct.parentUnitsPerSale,
                        })
                      }
                    >
                      <SelectTrigger data-testid="select-new-product-parent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("productParentNone")}</SelectItem>
                        {bulkParentCandidates
                          .filter(p => (p.recipeLineCount ?? 0) === 0)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {newProduct.parentProductId ? (
                      <div className="space-y-2">
                        <Label>{t("parentUnitsPerSaleLabel")}</Label>
                        <Input
                          value={newProduct.parentUnitsPerSale}
                          onChange={e =>
                            setNewProduct({ ...newProduct, parentUnitsPerSale: e.target.value })
                          }
                          placeholder="100"
                          data-testid="input-new-parent-units-per-sale"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("parentUnitsPerSaleHint")}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <Label>{t("recipeSectionTitle")}</Label>
                    {newRecipeLines.map(line => (
                      <div key={line.tempId} className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[140px] space-y-1">
                          <span className="text-xs text-muted-foreground">{t("recipeIngredient")}</span>
                          <Select
                            value={line.ingredientProductId || "__pick__"}
                            onValueChange={value =>
                              setNewRecipeLines(
                                newRecipeLines.map(l =>
                                  l.tempId === line.tempId
                                    ? {
                                        ...l,
                                        ingredientProductId: value === "__pick__" ? "" : value,
                                      }
                                    : l
                                )
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("recipeIngredient")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__pick__">—</SelectItem>
                              {bulkParentCandidates
                                .filter(p => (p.recipeLineCount ?? 0) === 0)
                                .map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <span className="text-xs text-muted-foreground">{t("recipeQuantity")}</span>
                          <Input
                            value={line.quantity}
                            onChange={e =>
                              setNewRecipeLines(
                                newRecipeLines.map(l =>
                                  l.tempId === line.tempId ? { ...l, quantity: e.target.value } : l
                                )
                              )
                            }
                            placeholder="1"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("delete")}
                          onClick={() =>
                            setNewRecipeLines(newRecipeLines.filter(l => l.tempId !== line.tempId))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setNewRecipeLines([
                          ...newRecipeLines,
                          {
                            tempId: `n-${Date.now()}`,
                            ingredientProductId: "",
                            quantity: "1",
                          },
                        ])
                      }
                    >
                      {t("addRecipeLine")}
                    </Button>
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
                      onClick={() => void handleCreateProduct()}
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
                  <TableHead scope="col" className="text-right">
                    {t("stock")}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("price")}
                  </TableHead>
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
                    const mode = normalizeStockMode(product);
                    const { stock: stockNum, minStock: minNum } = parseStockDisplay(
                      product.stock,
                      product.minStock
                    );
                    const isLowStock =
                      mode !== "none" &&
                      !Number.isNaN(stockNum) &&
                      !Number.isNaN(minNum) &&
                      stockNum <= minNum;
                    const productThumb =
                      user?.societyId && product.imageUrl
                        ? (productImageSrc(
                            user.societyId,
                            thumbFilenameFromImageUrl(product.imageUrl)
                          ) ?? productImageSrc(user.societyId, product.imageUrl))
                        : undefined;

                    return (
                      <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {productThumb ? (
                                <img
                                  src={productThumb}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{product.name}</span>
                                {mode === "manual" && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    {t("stockModeBadgeManual")}
                                  </Badge>
                                )}
                                {mode === "none" && (
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {t("stockModeBadgeNone")}
                                  </Badge>
                                )}
                                {normalizePurpose(product.purpose ?? "sale") === "internal" && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    {t("badgeInternal")}
                                  </Badge>
                                )}
                                {product.parentProductId && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    {t("badgePortion")}
                                  </Badge>
                                )}
                                {(product.recipeLineCount ?? 0) > 0 && (
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {t("badgeComposite")}
                                  </Badge>
                                )}
                              </div>
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
                            {mode === "none" ? (
                              <span className="text-muted-foreground">{t("stockNotTracked")}</span>
                            ) : (
                              <>
                                {isLowStock && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                                <span className={isLowStock ? "text-destructive font-medium" : ""}>
                                  {product.stock} {product.unit}
                                </span>
                              </>
                            )}
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
                              <DropdownMenuItem onClick={() => void handleEditProduct(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                {t("edit")}
                              </DropdownMenuItem>
                              {mode !== "none" && (
                                <DropdownMenuItem
                                  onClick={() => openAdjustStock(product)}
                                  data-testid={`menu-adjust-stock-${product.id}`}
                                >
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  {t("adjustStock")}
                                </DropdownMenuItem>
                              )}
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

              {editDialog.product && user?.societyId ? (
                <ImageUpload
                  societyId={user.societyId}
                  entity="product-image"
                  entityId={editDialog.product.id}
                  label={t("productImageLabel")}
                  description={t("productImageHint")}
                  currentFilename={editDialog.product.imageUrl}
                  thumbFilename={thumbFilenameFromImageUrl(editDialog.product.imageUrl)}
                  disabled={!user.societyId}
                  onUploaded={filename => {
                    const p = editDialog.product!;
                    const updated = { ...p, imageUrl: filename };
                    setEditDialog({ ...editDialog, product: updated });
                    setProducts(prev => prev.map(x => (x.id === updated.id ? updated : x)));
                  }}
                  onRemoved={() => {
                    const p = editDialog.product!;
                    const updated = { ...p, imageUrl: null };
                    setEditDialog({ ...editDialog, product: updated });
                    setProducts(prev => prev.map(x => (x.id === updated.id ? updated : x)));
                  }}
                />
              ) : null}

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

              <div className="space-y-2">
                <Label>{t("productPurpose")}</Label>
                <Select
                  value={editProduct.purpose}
                  onValueChange={value =>
                    setEditProduct({
                      ...editProduct,
                      purpose: value as ProductPurposeUi,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-edit-product-purpose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{t("productPurposeSale")}</SelectItem>
                    <SelectItem value="internal">{t("productPurposeInternal")}</SelectItem>
                    <SelectItem value="both">{t("productPurposeBoth")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("productPurposeHint")}</p>
              </div>

              <div className="space-y-2">
                <Label>{t("stockMode")}</Label>
                <Select
                  value={editProduct.stockMode}
                  onValueChange={value =>
                    setEditProduct({
                      ...editProduct,
                      stockMode: value as StockModeUi,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-edit-product-stock-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("stockModeAuto")}</SelectItem>
                    <SelectItem value="manual">{t("stockModeManual")}</SelectItem>
                    <SelectItem value="none">{t("stockModeNone")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {editProduct.stockMode === "auto" && t("stockModeAutoHint")}
                  {editProduct.stockMode === "manual" && t("stockModeManualHint")}
                  {editProduct.stockMode === "none" && t("stockModeNoneHint")}
                </p>
              </div>

              {editDialog.product &&
                (editProduct.stockMode === "none" ? (
                  <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 p-3">
                    {t("stockNotTracked")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 p-3">
                    <span className="font-medium text-foreground">{t("productStock")}: </span>
                    {editDialog.product.stock} {editDialog.product.unit}
                    <span className="block mt-2">{t("stockUseAdjustNotPut")}</span>
                    {editProduct.stockMode === "manual" && (
                      <span className="block mt-2 text-xs">{t("stockModeManualHint")}</span>
                    )}
                  </p>
                ))}

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
                      <SelectItem value="ml">ml</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editProduct.stockMode !== "none" && (
                  <div className="space-y-2">
                    <Label>{t("minStock")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      aria-label="Editatu stock minimoaren alerta mugaria"
                      value={editProduct.minStock}
                      onChange={e => setEditProduct({ ...editProduct, minStock: e.target.value })}
                      data-testid="input-edit-product-min-stock"
                    />
                  </div>
                )}
              </div>

              {editProduct.stockMode !== "none" && (
                <div className="space-y-2">
                  <Label>{t("supplier")}</Label>
                  <Input
                    placeholder="Hornitzailearen izena..."
                    aria-label="Editatu hornitzailearen izena"
                    value={editProduct.supplier}
                    onChange={e => setEditProduct({ ...editProduct, supplier: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <Label>{t("productParentLabel")}</Label>
                <Select
                  value={editProduct.parentProductId || "__none__"}
                  onValueChange={value =>
                    setEditProduct({
                      ...editProduct,
                      parentProductId: value === "__none__" ? "" : value,
                      parentUnitsPerSale: value === "__none__" ? "" : editProduct.parentUnitsPerSale,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-edit-product-parent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("productParentNone")}</SelectItem>
                    {bulkParentCandidates
                      .filter(
                        p =>
                          (p.recipeLineCount ?? 0) === 0 && p.id !== editDialog.product?.id
                      )
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editProduct.parentProductId ? (
                  <div className="space-y-2">
                    <Label>{t("parentUnitsPerSaleLabel")}</Label>
                    <Input
                      value={editProduct.parentUnitsPerSale}
                      onChange={e =>
                        setEditProduct({ ...editProduct, parentUnitsPerSale: e.target.value })
                      }
                      data-testid="input-edit-parent-units-per-sale"
                    />
                    <p className="text-xs text-muted-foreground">{t("parentUnitsPerSaleHint")}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label>{t("recipeSectionTitle")}</Label>
                {editRecipeLines.map(line => (
                  <div key={line.tempId} className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <span className="text-xs text-muted-foreground">{t("recipeIngredient")}</span>
                      <Select
                        value={line.ingredientProductId || "__pick__"}
                        onValueChange={value =>
                          setEditRecipeLines(
                            editRecipeLines.map(l =>
                              l.tempId === line.tempId
                                ? {
                                    ...l,
                                    ingredientProductId: value === "__pick__" ? "" : value,
                                  }
                                : l
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("recipeIngredient")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__pick__">—</SelectItem>
                          {bulkParentCandidates
                            .filter(
                              p =>
                                (p.recipeLineCount ?? 0) === 0 &&
                                p.id !== editDialog.product?.id
                            )
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <span className="text-xs text-muted-foreground">{t("recipeQuantity")}</span>
                      <Input
                        value={line.quantity}
                        onChange={e =>
                          setEditRecipeLines(
                            editRecipeLines.map(l =>
                              l.tempId === line.tempId ? { ...l, quantity: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("delete")}
                      onClick={() =>
                        setEditRecipeLines(editRecipeLines.filter(l => l.tempId !== line.tempId))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditRecipeLines([
                      ...editRecipeLines,
                      {
                        tempId: `e-${Date.now()}`,
                        ingredientProductId: "",
                        quantity: "1",
                      },
                    ])
                  }
                >
                  {t("addRecipeLine")}
                </Button>
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
                  onClick={() => void handleUpdateProduct()}
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
                  step="any"
                  data-testid="input-adjust-quantity"
                  value={adjustForm.quantityInput}
                  onChange={e => setAdjustForm({ ...adjustForm, quantityInput: e.target.value })}
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
