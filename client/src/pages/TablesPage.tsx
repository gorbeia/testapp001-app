import { useState, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table as TableIcon, Plus, Edit, Trash2, Users, FileText } from "lucide-react";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ErrorDisplay } from "@/components/ErrorDisplay";

// API helper function
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
};

interface Table {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function TablesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [minCapacity, setMinCapacity] = useState(1);
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await authFetch("/api/tables");
      if (!response.ok) throw new Error("Failed to fetch tables");

      const tablesData = await response.json();
      setTables(tablesData);
    } catch (error) {
      console.error("Error fetching tables:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setMinCapacity(1);
    setMaxCapacity(4);
    setDescription("");
    setIsActive(true);
    setEditingTable(null);
  };

  const handleOpenDialog = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setName(table.name);
      setMinCapacity(table.minCapacity);
      setMaxCapacity(table.maxCapacity);
      setDescription(table.description || "");
      setIsActive(table.isActive);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: t("error"),
        description: t("tableNameRequired"),
        variant: "destructive",
      });
      return;
    }

    if (minCapacity < 1 || maxCapacity < minCapacity) {
      toast({
        title: t("error"),
        description: t("capacityValidation"),
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        minCapacity,
        maxCapacity,
        description: description.trim() || null,
        isActive,
      };

      const response = editingTable
        ? await authFetch(`/api/tables/${editingTable.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await authFetch("/api/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save table");
      }

      const savedTable = await response.json();

      if (editingTable) {
        setTables(prev => prev.map(t => (t.id === editingTable.id ? savedTable : t)));
        toast({
          title: t("success"),
          description: t("tableUpdated"),
        });
      } else {
        setTables(prev => [...prev, savedTable]);
        toast({
          title: t("success"),
          description: t("tableCreated"),
        });
      }

      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Ezin izan da mahaia gorde",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (table: Table) => {
    try {
      const response = await authFetch(`/api/tables/${table.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete table");
      }

      setTables(prev => prev.filter(t => t.id !== table.id));
      toast({
        title: t("success"),
        description: t("tableDeleted"),
      });
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Ezin izan da mahaia ezabatu",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t("tableManagement")}</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("newTable")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTable ? t("editTable") : t("newTable")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("tableName")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t("tableNamePlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minCapacity">{t("minCapacity")}</Label>
                    <Input
                      id="minCapacity"
                      type="number"
                      min="1"
                      value={minCapacity}
                      onChange={e => setMinCapacity(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxCapacity">{t("maxCapacity")}</Label>
                    <Input
                      id="maxCapacity"
                      type="number"
                      min="1"
                      value={maxCapacity}
                      onChange={e => setMaxCapacity(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">{t("description")}</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t("tableDescriptionPlaceholder")}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="isActive">{t("active")}</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleSubmit}>{editingTable ? t("update") : t("create")}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tables.map(table => (
            <Card key={table.id} className={!table.isActive ? "opacity-50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TableIcon className="h-5 w-5" />
                    <span>{table.name}</span>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(table)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("deleteTable")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("deleteTableConfirmation", { name: table.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(table)}>
                            {t("deleteTable")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {table.minCapacity}-{table.maxCapacity} {t("persons")}
                    </span>
                  </div>
                  {table.description && (
                    <div className="flex items-start space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{table.description}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${table.isActive ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span>{table.isActive ? t("active") : t("inactive")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-12">
            <TableIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("noTables")}</h3>
            <p className="text-muted-foreground mb-4">{t("createFirstTable")}</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              {t("newTable")}
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
