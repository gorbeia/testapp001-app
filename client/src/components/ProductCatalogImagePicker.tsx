import { useState } from "react";
import { PRODUCT_CATALOG_IMAGES } from "@shared/product-catalog-images";
import type { Product } from "@shared/schema";
import { authFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, ImageIcon, Loader2 } from "lucide-react";

type BaseProps = {
  collapsible?: boolean;
};

type CreateProps = BaseProps & {
  mode: "create";
  selectedPath: string | null;
  disabled?: boolean;
  onChange: (path: string | null) => void;
};

type EditProps = BaseProps & {
  mode: "edit";
  productId: string;
  selectedPath: string | null;
  disabled?: boolean;
  onUpdated: (product: Product) => void;
};

export type ProductCatalogImagePickerProps = CreateProps | EditProps;

export function ProductCatalogImagePicker(props: ProductCatalogImagePickerProps) {
  const { disabled = false, selectedPath, collapsible = false } = props;
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(!collapsible);

  const labelFor = (nameEu: string, nameEs: string) => (language === "es" ? nameEs : nameEu);

  const onTileClick = async (path: string) => {
    if (disabled || busyPath) return;

    if (props.mode === "create") {
      props.onChange(selectedPath === path ? null : path);
      return;
    }

    if (selectedPath === path) return;

    setBusyPath(path);
    try {
      const response = await authFetch(`/api/products/${props.productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: path }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || t("error"));
      }
      props.onUpdated(data as Product);
    } catch (err) {
      console.error(err);
      toast({
        title: t("error"),
        description: getErrorMessage(err) || t("error"),
        variant: "destructive",
      });
    } finally {
      setBusyPath(null);
    }
  };

  const grid = (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {PRODUCT_CATALOG_IMAGES.map(item => {
        const selected = selectedPath === item.path;
        const busyHere = busyPath === item.path;
        return (
          <button
            key={item.path}
            type="button"
            disabled={disabled || Boolean(busyPath)}
            title={labelFor(item.nameEu, item.nameEs)}
            aria-label={labelFor(item.nameEu, item.nameEs)}
            aria-pressed={selected}
            data-testid={`catalog-image-${item.path.replace(/\//g, "-")}`}
            onClick={() => onTileClick(item.path)}
            className={cn(
              "relative rounded-md border overflow-hidden aspect-square p-0 bg-muted/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "ring-2 ring-primary border-primary",
              (disabled || busyPath) && "opacity-60"
            )}
          >
            <img src={item.path} alt="" className="w-full h-full object-cover" loading="lazy" />
            {busyHere ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  if (collapsible) {
    return (
      <div className="space-y-2" data-testid="product-catalog-image-picker">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          {selectedPath ? (
            <img src={selectedPath} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
          ) : (
            <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="flex-1 text-muted-foreground">{t("productCatalogImagesLabel")}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </button>
        {isOpen && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("productCatalogImagesHint")}</p>
            {grid}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="product-catalog-image-picker">
      <Label className="text-muted-foreground">{t("productCatalogImagesLabel")}</Label>
      <p className="text-xs text-muted-foreground">{t("productCatalogImagesHint")}</p>
      {grid}
    </div>
  );
}
