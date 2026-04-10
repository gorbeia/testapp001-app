import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { formatDateShort } from "@/lib/date-locale";
import { Building2, Plus, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SepaMode } from "@shared/schema";

interface Society {
  id: string;
  name: string;
  alphabeticId: string;
  subdomain?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export function BackofficeSocietiesPage() {
  const { t, language } = useLanguage();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subdomainDialogSociety, setSubdomainDialogSociety] = useState<Society | null>(null);
  const [subdomainInput, setSubdomainInput] = useState("");
  const [subdomainCheckMessage, setSubdomainCheckMessage] = useState<string | null>(null);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [isSavingSubdomain, setIsSavingSubdomain] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    iban: "",
    creditorId: "",
    address: "",
    phone: "",
    email: "",
    reservationPricePerMember: "25.00",
    kitchenPricePerMember: "10.00",
    sepaMode: "monthly" as SepaMode,
  });

  useEffect(() => {
    const loadSocieties = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch("/api/backoffice/societies");
        if (!response.ok) {
          throw new Error("Failed to fetch societies");
        }
        const data = await response.json();
        setSocieties(data);
      } catch {
        setError("Failed to load societies");
      } finally {
        setLoading(false);
      }
    };

    loadSocieties();
  }, []);

  useEffect(() => {
    if (!subdomainDialogSociety) return;

    const raw = subdomainInput.trim().toLowerCase();
    if (raw === "") {
      setSubdomainCheckMessage(null);
      setSubdomainChecking(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setSubdomainChecking(true);
      setSubdomainCheckMessage(null);
      try {
        const params = new URLSearchParams({ value: raw });
        params.set("excludeId", subdomainDialogSociety.id);
        const res = await authFetch(`/api/backoffice/societies/check-subdomain?${params}`);
        if (!res.ok) {
          setSubdomainCheckMessage(t("subdomainCheckError"));
          return;
        }
        const body = (await res.json()) as {
          available: boolean;
          reason?: "invalid" | "taken";
        };
        if (!body.available) {
          if (body.reason === "invalid") {
            setSubdomainCheckMessage(t("subdomainInvalid"));
          } else {
            setSubdomainCheckMessage(t("subdomainTaken"));
          }
        }
      } catch {
        setSubdomainCheckMessage(t("subdomainCheckError"));
      } finally {
        setSubdomainChecking(false);
      }
    }, 400);

    return () => window.clearTimeout(handle);
  }, [subdomainInput, subdomainDialogSociety, t]);

  const openSubdomainDialog = (society: Society) => {
    setSubdomainDialogSociety(society);
    setSubdomainInput(society.subdomain ?? "");
    setSubdomainCheckMessage(null);
  };

  const closeSubdomainDialog = () => {
    setSubdomainDialogSociety(null);
    setSubdomainInput("");
    setSubdomainCheckMessage(null);
  };

  const handleSaveSubdomain = async () => {
    if (!subdomainDialogSociety) return;
    const trimmed = subdomainInput.trim().toLowerCase();
    if (trimmed !== "" && subdomainCheckMessage) {
      return;
    }

    setIsSavingSubdomain(true);
    setError(null);
    try {
      const response = await authFetch(`/api/backoffice/societies/${subdomainDialogSociety.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: trimmed === "" ? null : trimmed }),
      });

      if (response.status === 409) {
        setError(t("subdomainTaken"));
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg =
          typeof body === "object" && body && "message" in body
            ? String((body as { message: string }).message)
            : t("failedToUpdateSocietySubdomain");
        setError(msg);
        return;
      }

      const loadResponse = await authFetch("/api/backoffice/societies");
      if (loadResponse.ok) {
        const data = await loadResponse.json();
        setSocieties(data);
      }
      closeSubdomainDialog();
    } catch {
      setError(t("failedToUpdateSocietySubdomain"));
    } finally {
      setIsSavingSubdomain(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError(t("societyNameRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authFetch("/api/backoffice/societies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        await response.json().catch(() => ({}));
        throw new Error(t("failedToCreateSociety"));
      }

      // Reload societies list
      const loadResponse = await authFetch("/api/backoffice/societies");
      if (loadResponse.ok) {
        const data = await loadResponse.json();
        setSocieties(data);
      }

      // Reset form and close dialog
      setFormData({
        name: "",
        iban: "",
        creditorId: "",
        address: "",
        phone: "",
        email: "",
        reservationPricePerMember: "25.00",
        kitchenPricePerMember: "10.00",
        sepaMode: "monthly",
      });
      setIsCreateDialogOpen(false);
    } catch {
      setError(t("failedToCreateSociety"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {t("allSocieties")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("manageAllSocieties")}</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("newSociety")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("createSociety")}</DialogTitle>
                <DialogDescription>{t("createSocietyDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name">{t("societyName")} *</Label>
                  <Input
                    id="create-name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("societyName")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-email">{t("societyEmail")}</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="society@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="create-phone">{t("societyPhone")}</Label>
                  <Input
                    id="create-phone"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+34 123 456 789"
                  />
                </div>
                <div>
                  <Label htmlFor="create-address">{t("societyAddress")}</Label>
                  <Input
                    id="create-address"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Main Street, 123"
                  />
                </div>
                <div>
                  <Label htmlFor="create-iban">{t("societyIban")}</Label>
                  <Input
                    id="create-iban"
                    value={formData.iban}
                    onChange={e => setFormData({ ...formData, iban: e.target.value })}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-creditor-id">{t("societyCreditorId")}</Label>
                  <Input
                    id="create-creditor-id"
                    value={formData.creditorId}
                    onChange={e => setFormData({ ...formData, creditorId: e.target.value })}
                    placeholder="ES000000000000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-reservation-price">{t("reservationPricePerMember")}</Label>
                  <Input
                    id="create-reservation-price"
                    type="number"
                    step="0.01"
                    value={formData.reservationPricePerMember}
                    onChange={e =>
                      setFormData({ ...formData, reservationPricePerMember: e.target.value })
                    }
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <Label htmlFor="create-kitchen-price">{t("kitchenPricePerMember")}</Label>
                  <Input
                    id="create-kitchen-price"
                    type="number"
                    step="0.01"
                    value={formData.kitchenPricePerMember}
                    onChange={e =>
                      setFormData({ ...formData, kitchenPricePerMember: e.target.value })
                    }
                    placeholder="10.00"
                  />
                </div>
                <div>
                  <Label>{t("sepaMode")}</Label>
                  <Select
                    value={formData.sepaMode}
                    onValueChange={(v: SepaMode) => setFormData({ ...formData, sepaMode: v })}
                  >
                    <SelectTrigger data-testid="backoffice-select-sepa-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t("sepaModeMonthly")}</SelectItem>
                      <SelectItem value="bimonthly">{t("sepaModeBimonthly")}</SelectItem>
                      <SelectItem value="quarterly">{t("sepaModeQuarterly")}</SelectItem>
                      <SelectItem value="on_demand">{t("sepaModeOnDemand")}</SelectItem>
                      <SelectItem value="disabled">{t("sepaModeDisabled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting || !formData.name.trim()}>
                  {isSubmitting ? t("creating") : t("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {societies.map(society => (
              <Card key={society.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 shrink-0" />
                      {society.name}
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => openSubdomainDialog(society)}
                      aria-label={t("editSocietySubdomain")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    ID: {society.alphabeticId}
                    {society.subdomain ? ` · ${society.subdomain}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {society.email && (
                    <p className="text-sm text-muted-foreground">{society.email}</p>
                  )}
                  {society.phone && (
                    <p className="text-sm text-muted-foreground">{society.phone}</p>
                  )}
                  {society.address && (
                    <p className="text-sm text-muted-foreground">{society.address}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created: {formatDateShort(society.createdAt, language)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && societies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t("noResults")}</h3>
            <p className="text-muted-foreground">{t("noSocietiesFound")}</p>
          </div>
        )}

        <Dialog
          open={subdomainDialogSociety !== null}
          onOpenChange={open => {
            if (!open) closeSubdomainDialog();
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("editSocietySubdomain")}</DialogTitle>
              <DialogDescription>
                {subdomainDialogSociety
                  ? `${subdomainDialogSociety.name} (${subdomainDialogSociety.alphabeticId})`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="subdomain-input">{t("societySubdomainLabel")}</Label>
              <Input
                id="subdomain-input"
                value={subdomainInput}
                onChange={e => setSubdomainInput(e.target.value)}
                placeholder="nire-txokoa"
                autoComplete="off"
                data-testid="backoffice-input-society-subdomain"
              />
              <p className="text-xs text-muted-foreground">{t("societySubdomainHint")}</p>
              {subdomainChecking && <p className="text-xs text-muted-foreground">{t("loading")}</p>}
              {subdomainCheckMessage && (
                <p className="text-xs text-destructive">{subdomainCheckMessage}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={closeSubdomainDialog}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSaveSubdomain}
                disabled={
                  isSavingSubdomain ||
                  (subdomainInput.trim() !== "" && (!!subdomainCheckMessage || subdomainChecking))
                }
                data-testid="backoffice-save-society-subdomain"
              >
                {isSavingSubdomain ? t("loading") : t("saveSocietySubdomain")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
