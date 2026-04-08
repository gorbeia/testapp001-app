import { useRef, useState, type ChangeEvent } from "react";
import { useLanguage } from "@/lib/i18n";
import { authFetchFormData } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ImageUploadEntity } from "@shared/schema";
import { tenantImageSrc } from "@/lib/image-urls";
import { Loader2, Trash2, Upload } from "lucide-react";

export type ImageUploadProps = {
  societyId: string;
  entity: ImageUploadEntity;
  entityId: string;
  label: string;
  description?: string;
  currentFilename: string | null | undefined;
  /** Preferred display URL (thumb); falls back to full image */
  thumbFilename?: string | null;
  disabled?: boolean;
  onUploaded?: (filename: string) => void;
  onRemoved?: () => void;
  /** Square preview in px */
  previewSize?: number;
};

type UploadJson = {
  url?: string;
  thumbUrl?: string;
  message?: string;
};

export function ImageUpload({
  societyId,
  entity,
  entityId,
  label,
  description,
  currentFilename,
  thumbFilename,
  disabled = false,
  onUploaded,
  onRemoved,
  previewSize = 96,
}: ImageUploadProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displaySrc =
    localPreview ??
    tenantImageSrc(
      societyId,
      thumbFilename && thumbFilename.trim() !== "" ? thumbFilename : currentFilename
    );

  const pickFile = () => inputRef.current?.click();

  const revoke = () => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || disabled) return;

    revoke();
    setLocalPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("image", file);
    formData.append("entity", entity);
    formData.append("entityId", entityId);

    setBusy(true);
    try {
      const response = await authFetchFormData("/api/images/upload", formData);
      const data = (await response.json().catch(() => ({}))) as UploadJson;
      if (!response.ok) {
        throw new Error(data.message || t("imageUploadFailed"));
      }
      const url = typeof data.url === "string" ? data.url : "";
      if (!url) throw new Error(t("imageUploadFailed"));
      revoke();
      onUploaded?.(url);
    } catch (err) {
      revoke();
      console.error(err);
      toast({
        title: t("error"),
        description: getErrorMessage(err) || t("imageUploadFailed"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    if (disabled || !currentFilename) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("auth:token");
      const response = await fetch(
        `/api/images/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!response.ok && response.status !== 204) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || t("imageRemoveFailed"));
      }
      revoke();
      onRemoved?.();
    } catch (err) {
      console.error(err);
      toast({
        title: t("error"),
        description: getErrorMessage(err) || t("imageRemoveFailed"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div
          className="rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0"
          style={{ width: previewSize, height: previewSize }}
        >
          {displaySrc ? (
            <img src={displaySrc} alt="" className="max-w-full max-h-full object-cover" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || busy}
            onClick={pickFile}
            data-testid={`image-upload-trigger-${entity}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1">{currentFilename ? t("imageReplace") : t("imageUpload")}</span>
          </Button>
          {currentFilename ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || busy}
              onClick={removeImage}
              data-testid={`image-remove-${entity}`}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-1">{t("imageRemove")}</span>
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        onChange={onFileChange}
        disabled={disabled || busy}
      />
    </div>
  );
}
