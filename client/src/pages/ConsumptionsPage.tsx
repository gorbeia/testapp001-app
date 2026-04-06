import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Minus,
  ShoppingCart,
  X,
  Search,
  Receipt,
  ChevronUp,
  ChevronDown,
  Beer,
  Utensils,
  Coffee,
  ChefHat,
  Wallet,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import type { Product } from "@shared/schema";
import { societyAllowsCashPayment } from "@shared/schema";

const PENDING_PAYMENTS_FILTER = "pending_payments";

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case "Beer":
      return Beer;
    case "Utensils":
      return Utensils;
    case "Coffee":
      return Coffee;
    case "ChefHat":
      return ChefHat;
    default:
      return Utensils;
  }
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

type PendingReservation = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  totalAmount: string;
};

type PendingSubscription = {
  creditId: string;
  month: string;
  amount: string;
};

type CartLine =
  | {
      kind: "product";
      lineId: string;
      productId: string;
      name: string;
      price: number;
      quantity: number;
    }
  | {
      kind: "reservation";
      lineId: string;
      reservationId: string;
      name: string;
      price: number;
      quantity: 1;
    }
  | {
      kind: "subscription";
      lineId: string;
      month: string;
      creditId: string;
      name: string;
      price: number;
      quantity: 1;
    };

async function errorMessageFromResponse(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    if (data?.issues) {
      return `${fallback}: ${JSON.stringify(data.issues)}`;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function ConsumptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashEnabled, setCashEnabled] = useState(false);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState<PendingSubscription[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [isClosingAccount, setIsClosingAccount] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  const loadPendingCashItems = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await authFetch("/api/me/pending-cash-items");
      if (!res.ok) {
        setPendingReservations([]);
        setPendingSubscriptions([]);
        return;
      }
      const data = await res.json();
      setPendingReservations(data.reservations ?? []);
      setPendingSubscriptions(data.subscriptions ?? []);
    } catch {
      setPendingReservations([]);
      setPendingSubscriptions([]);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsResponse, categoriesResponse, societyResponse] = await Promise.all([
          authFetch("/api/products"),
          authFetch("/api/categories"),
          authFetch("/api/societies/user"),
        ]);

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData.filter((product: Product) => product.isActive));
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

        if (societyResponse.ok) {
          const society = await societyResponse.json();
          const allow = societyAllowsCashPayment(society.paymentMethods);
          setCashEnabled(allow);
          if (!allow) {
            setPendingReservations([]);
            setPendingSubscriptions([]);
          }
        } else {
          setCashEnabled(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: t("errorTitle"),
          description: t("productsLoadFailed"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast, t]);

  useEffect(() => {
    if (cashEnabled) {
      loadPendingCashItems();
    }
  }, [cashEnabled, loadPendingCashItems]);

  useEffect(() => {
    if (!cashEnabled && categoryFilter === PENDING_PAYMENTS_FILTER) {
      setCategoryFilter("all");
    }
  }, [cashEnabled, categoryFilter]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const q = searchTerm.toLowerCase();
  const filteredPendingReservations = pendingReservations.filter(
    r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      parseFloat(r.totalAmount).toFixed(2).includes(q)
  );
  const filteredPendingSubscriptions = pendingSubscriptions.filter(
    s => s.month.includes(q) || s.amount.toString().includes(q)
  );

  const showPendingGrid = categoryFilter === PENDING_PAYMENTS_FILTER && cashEnabled;
  const pendingGridEmpty =
    !loadingPending &&
    filteredPendingReservations.length === 0 &&
    filteredPendingSubscriptions.length === 0;

  const addToCartProduct = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(
        (item): item is Extract<CartLine, { kind: "product" }> =>
          item.kind === "product" && item.productId === product.id
      );
      if (existing) {
        return prev.map(item =>
          item.kind === "product" && item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          kind: "product",
          lineId: product.id,
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: 1,
        },
      ];
    });
  };

  const addReservationToCart = (r: PendingReservation) => {
    const price = parseFloat(r.totalAmount);
    if (!Number.isFinite(price) || price <= 0) return;
    const lineId = `res:${r.id}`;
    setCart(prev => {
      if (prev.some(item => item.lineId === lineId)) return prev;
      return [
        ...prev,
        {
          kind: "reservation",
          lineId,
          reservationId: r.id,
          name: r.name,
          price,
          quantity: 1,
        },
      ];
    });
  };

  const addSubscriptionToCart = (s: PendingSubscription) => {
    const price = parseFloat(s.amount);
    if (!Number.isFinite(price) || price <= 0) return;
    const lineId = `sub:${s.month}`;
    setCart(prev => {
      if (prev.some(item => item.lineId === lineId)) return prev;
      return [
        ...prev,
        {
          kind: "subscription",
          lineId,
          month: s.month,
          creditId: s.creditId,
          name: `${t("pendingPaymentSubscriptionBadge")} — ${s.month}`,
          price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (lineId: string, delta: number) => {
    setCart(prev => {
      const line = prev.find(l => l.lineId === lineId);
      if (!line) return prev;
      if (line.kind !== "product") {
        if (delta < 0) {
          return prev.filter(l => l.lineId !== lineId);
        }
        return prev;
      }
      return prev
        .map(item =>
          item.lineId === lineId && item.kind === "product"
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter(item => (item.kind === "product" ? item.quantity > 0 : true));
    });
  };

  const removeFromCart = (lineId: string) => {
    setCart(prev => prev.filter(item => item.lineId !== lineId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const productLines = cart.filter((l): l is Extract<CartLine, { kind: "product" }> => l.kind === "product");
  const reservationLines = cart.filter(
    (l): l is Extract<CartLine, { kind: "reservation" }> => l.kind === "reservation"
  );
  const subscriptionLines = cart.filter(
    (l): l is Extract<CartLine, { kind: "subscription" }> => l.kind === "subscription"
  );

  const handleCloseAccount = () => {
    if (cart.length === 0) return;
    setShowConfirmDialog(true);
  };

  const confirmCloseAccount = async () => {
    setShowConfirmDialog(false);
    setIsClosingAccount(true);

    try {
      if (productLines.length > 0) {
        const consumptionResponse = await authFetch("/api/consumptions", {
          method: "POST",
          body: JSON.stringify({
            notes: "Bar kontsumoa",
          }),
        });

        if (!consumptionResponse.ok) {
          throw new Error(
            await errorMessageFromResponse(consumptionResponse, "Failed to create consumption")
          );
        }

        const consumption = await consumptionResponse.json();

        const itemsResponse = await authFetch(`/api/consumptions/${consumption.id}/items`, {
          method: "POST",
          body: JSON.stringify({
            items: productLines.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              notes: null,
            })),
          }),
        });

        if (!itemsResponse.ok) {
          throw new Error(
            await errorMessageFromResponse(itemsResponse, "Failed to add consumption items")
          );
        }

        const closeResponse = await authFetch(`/api/consumptions/${consumption.id}/close`, {
          method: "POST",
        });

        if (!closeResponse.ok) {
          throw new Error(
            await errorMessageFromResponse(closeResponse, "Failed to close consumption")
          );
        }
      }

      if (reservationLines.length > 0 || subscriptionLines.length > 0) {
        const cashRes = await authFetch("/api/me/cash-settlements", {
          method: "POST",
          body: JSON.stringify({
            reservationIds: reservationLines.map(l => l.reservationId),
            subscriptionMonths: subscriptionLines.map(l => l.month),
          }),
        });
        if (!cashRes.ok) {
          throw new Error(
            await errorMessageFromResponse(cashRes, "Failed to record cash settlements")
          );
        }
      }

      if (productLines.length > 0 && reservationLines.length + subscriptionLines.length > 0) {
        toast({
          title: t("success"),
          description: t("cashAndConsumptionSaved", { amount: cartTotal.toFixed(2) }),
        });
      } else if (productLines.length > 0) {
        toast({
          title: t("success"),
          description: t("accountClosed", { amount: cartTotal.toFixed(2) }),
        });
      } else {
        toast({
          title: t("success"),
          description: t("cashSettlementSaved", { amount: cartTotal.toFixed(2) }),
        });
      }

      const productsResponse = await authFetch("/api/products");
      if (productsResponse.ok) {
        const data = await productsResponse.json();
        setProducts(data.filter((product: Product) => product.isActive));
      }

      setCart([]);
      if (cashEnabled) {
        await loadPendingCashItems();
      }
    } catch (error: unknown) {
      console.error("Error saving consumption:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || t("consumptionSaveError"),
        variant: "destructive",
      });
    } finally {
      setIsClosingAccount(false);
    }
  };

  const pendingCategoryColor = "#64748b";

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]" data-testid="bar-page">
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">{t("consumptions")}</h2>
            <p className="text-muted-foreground">{t("manageConsumptions")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t("search")}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                key="all"
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter("all")}
                data-testid="button-filter-all"
              >
                {t("allTime")}
              </Button>
              {categories.map(category => {
                const IconComponent = getCategoryIcon(category.icon);
                return (
                  <Button
                    key={category.id}
                    variant={categoryFilter === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(category.id)}
                    data-testid={`button-filter-${category.id}`}
                    className={categoryFilter === category.id ? "" : "border-2"}
                    style={{
                      borderColor: categoryFilter === category.id ? undefined : category.color,
                      backgroundColor: categoryFilter === category.id ? category.color : undefined,
                      color: categoryFilter === category.id ? "white" : category.color,
                    }}
                  >
                    <IconComponent className="mr-1 h-3 w-3" />
                    {category.name}
                  </Button>
                );
              })}
              {cashEnabled && (
                <Button
                  variant={categoryFilter === PENDING_PAYMENTS_FILTER ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter(PENDING_PAYMENTS_FILTER);
                    void loadPendingCashItems();
                  }}
                  data-testid="button-filter-pending-payments"
                  className={categoryFilter === PENDING_PAYMENTS_FILTER ? "" : "border-2"}
                  style={{
                    borderColor:
                      categoryFilter === PENDING_PAYMENTS_FILTER ? undefined : pendingCategoryColor,
                    backgroundColor:
                      categoryFilter === PENDING_PAYMENTS_FILTER
                        ? pendingCategoryColor
                        : undefined,
                    color: categoryFilter === PENDING_PAYMENTS_FILTER ? "white" : pendingCategoryColor,
                  }}
                >
                  <Wallet className="mr-1 h-3 w-3" />
                  {t("pendingPaymentsCategory")}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loading || (showPendingGrid && loadingPending) ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {t("loading")}
              </div>
            ) : showPendingGrid ? (
              pendingGridEmpty ? (
                <div
                  className="col-span-full text-center py-8 text-muted-foreground"
                  data-testid="pending-payments-empty"
                >
                  {t("noPendingCashItems")}
                </div>
              ) : (
                <>
                  {filteredPendingReservations.map(r => (
                    <Card
                      key={r.id}
                      className="hover-elevate"
                      data-testid={`pending-card-reservation-${r.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <span className="font-medium text-sm line-clamp-2">{r.name}</span>
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1 inline" />
                              {t("pendingPaymentReservationBadge")}
                            </Badge>
                            <span className="font-bold">
                              {parseFloat(r.totalAmount).toFixed(2)}€
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              addReservationToCart(r);
                            }}
                            className="w-full mt-2"
                            data-testid={`button-add-reservation-${r.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t("addToCart")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredPendingSubscriptions.map(s => (
                    <Card
                      key={s.creditId}
                      className="hover-elevate"
                      data-testid={`pending-card-subscription-${s.month}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <span className="font-medium text-sm">
                            {t("pendingPaymentSubscriptionBadge")} — {s.month}
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {t("pendingPaymentSubscriptionBadge")}
                            </Badge>
                            <span className="font-bold">{parseFloat(s.amount).toFixed(2)}€</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              addSubscriptionToCart(s);
                            }}
                            className="w-full mt-2"
                            data-testid={`button-add-subscription-${s.month}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t("addToCart")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {t("noProductsFound")}
              </div>
            ) : (
              filteredProducts.map(product => {
                const stock = parseInt(product.stock);
                const minStock = parseInt(product.minStock);
                const isLowStock = stock <= minStock;

                return (
                  <Card key={product.id} className="hover-elevate" data-testid="product-card">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <span className="font-medium text-sm">{product.name}</span>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {categories.find(c => c.id === product.categoryId)?.name ||
                              t("unknownCategory")}
                          </Badge>
                          <span className="font-bold">{parseFloat(product.price).toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {t("stock")}: {stock} {product.unit}
                          </span>
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              {t("lowStock")}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            addToCartProduct(product);
                          }}
                          className="w-full mt-2"
                          data-testid="button-add-to-cart"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {t("addToCart")}
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

      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card flex flex-col lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16 lg:self-start">
        <div className="p-4 border-b lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <h3 className="font-semibold">{t("cart")}</h3>
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
              <span className="font-medium text-sm">{t("total")}:</span>
              <span className="font-bold">{cartTotal.toFixed(2)}€</span>
            </div>
          )}
        </div>

        <div className="p-4 border-b hidden lg:block">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t("cart")}
            {cartCount > 0 && (
              <Badge variant="secondary" className="ml-auto" data-testid="cart-count">
                {cartCount}
              </Badge>
            )}
          </h3>
        </div>

        <div
          className={`lg:hidden transition-all duration-300 ease-in-out ${isCartExpanded ? "max-h-96" : "max-h-0"} overflow-hidden`}
        >
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm" data-testid="mobile-cart-empty">
                    {t("cartEmpty")}
                  </p>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.lineId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    data-testid={`mobile-cart-item-${item.lineId}`}
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
                        onClick={() => updateQuantity(item.lineId, -1)}
                        data-testid={`mobile-button-decrease-quantity-${item.lineId}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.lineId, 1)}
                        disabled={item.kind !== "product"}
                        data-testid={`mobile-button-increase-quantity-${item.lineId}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFromCart(item.lineId)}
                        data-testid={`mobile-button-remove-${item.lineId}`}
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

        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm" data-testid="desktop-cart-empty">
                    {t("cartEmpty")}
                  </p>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.lineId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    data-testid={`cart-item-${item.lineId}`}
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
                        onClick={() => updateQuantity(item.lineId, -1)}
                        data-testid={`button-decrease-quantity-${item.lineId}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.lineId, 1)}
                        disabled={item.kind !== "product"}
                        data-testid={`button-increase-quantity-${item.lineId}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFromCart(item.lineId)}
                        data-testid={`button-remove-${item.lineId}`}
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

        <div
          className={`lg:hidden transition-all duration-300 ease-in-out ${isCartExpanded ? "block" : "hidden"}`}
        >
          <div className="p-4 border-t">
            <Button
              className="w-full"
              disabled={cart.length === 0 || isClosingAccount}
              onClick={handleCloseAccount}
              data-testid="mobile-button-close-account"
            >
              <Receipt className="mr-2 h-4 w-4" />
              {isClosingAccount ? t("cashSaving") : t("closeAccount")}
            </Button>
          </div>
        </div>

        <div className="hidden lg:block p-4 border-t mt-auto shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="font-medium">{t("total")}:</span>
            <span className="text-xl font-bold">{cartTotal.toFixed(2)}€</span>
          </div>
          <Button
            className="w-full"
            disabled={cart.length === 0 || isClosingAccount}
            onClick={handleCloseAccount}
            data-testid="button-close-account"
          >
            <Receipt className="mr-2 h-4 w-4" />
            {isClosingAccount ? t("cashSaving") : t("closeAccount")}
          </Button>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl" data-testid="confirmation-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("confirmConsumption")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("idea")}</p>
                  <p className="text-lg font-bold" data-testid="member-name">
                    {user?.name || user?.email || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">{t("total")}</p>
                  <p className="text-2xl font-bold text-primary" data-testid="total-amount">
                    {cartTotal.toFixed(2)}€
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">{t("confirmationProductsAndPayments")}</h3>
              <ScrollArea className="h-48 border rounded-md">
                <Table data-testid="confirmation-items-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead className="text-center">{t("quantity")}</TableHead>
                      <TableHead className="text-right">{t("unitPrice")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.lineId} data-testid={`confirmation-row-${item.lineId}`}>
                        <TableCell className="font-medium">
                          {item.kind === "product"
                            ? item.name
                            : `${item.name} (${item.kind === "reservation" ? t("pendingPaymentReservationBadge") : t("pendingPaymentSubscriptionBadge")})`}
                        </TableCell>
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

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t("total")}:</span>
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
              {t("cancel")}
            </Button>
            <Button
              onClick={confirmCloseAccount}
              disabled={isClosingAccount}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-consumption"
            >
              <Receipt className="mr-2 h-4 w-4" />
              {isClosingAccount ? t("cashSaving") : t("confirmAndSaveConsumption")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
