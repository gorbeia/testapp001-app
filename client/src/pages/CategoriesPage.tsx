import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Coffee,
  Wine,
  Beer,
  Cake,
  Pizza,
  Sandwich,
  Utensils,
  ChefHat,
  IceCream,
  Apple,
  Carrot,
  ShoppingBag,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/api";
import { IconSelector } from "@/components/IconSelector";

// Icon mapping function
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    Package: Package,
    Coffee: Coffee,
    Wine: Wine,
    Beer: Beer,
    Cake: Cake,
    Pizza: Pizza,
    Sandwich: Sandwich,
    Utensils: Utensils,
    ChefHat: ChefHat,
    IceCream: IceCream,
    Apple: Apple,
    Carrot: Carrot,
    ShoppingBag: ShoppingBag,
  };
  return iconMap[iconName] || Package;
};

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  societyId: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormData {
  color: string;
  icon: string;
  isActive: boolean;
  messages: {
    eu: { name: string; description: string };
    es: { name: string; description: string };
  };
}

export default function CategoriesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeLanguageTab, setActiveLanguageTab] = useState<"eu" | "es">("eu");
  const [formData, setFormData] = useState<CategoryFormData>({
    color: "#6B7280",
    icon: "Package",
    isActive: true,
    messages: {
      eu: { name: "", description: "" },
      es: { name: "", description: "" },
    },
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await authFetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json() as Promise<Category[]>;
    },
  });

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await authFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  // Update category mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await authFetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      resetForm();
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authFetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete category");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: Error) => {
      const description = error.message === "categoryInUse" ? t("categoryInUse") : error.message;
      toast({
        title: t("error"),
        description,
        variant: "destructive",
      });
    },
  });

  // Reorder categories mutation
  const reorderMutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const response = await authFetch("/api/categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder categories");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const resetForm = () => {
    setFormData({
      color: "#6B7280",
      icon: "Package",
      isActive: true,
      messages: {
        eu: { name: "", description: "" },
        es: { name: "", description: "" },
      },
    });
  };

  const handleEdit = async (category: Category) => {
    setEditingCategory(category);

    // Fetch all language data for this category
    try {
      const [euResponse, esResponse] = await Promise.all([
        authFetch("/api/categories/" + category.id, { headers: { "Accept-Language": "eu" } }),
        authFetch("/api/categories/" + category.id, { headers: { "Accept-Language": "es" } }),
      ]);

      const euData = euResponse.ok ? await euResponse.json() : category;
      const esData = esResponse.ok ? await esResponse.json() : category;

      setFormData({
        color: category.color,
        icon: category.icon,
        isActive: category.isActive,
        messages: {
          eu: {
            name: euData.name || category.name,
            description: euData.description || category.description || "",
          },
          es: {
            name: esData.name || category.name,
            description: esData.description || category.description || "",
          },
        },
      });
    } catch (error) {
      // Fallback to current language data
      setFormData({
        color: category.color,
        icon: category.icon,
        isActive: category.isActive,
        messages: {
          eu: {
            name: category.name,
            description: category.description || "",
          },
          es: {
            name: category.name,
            description: category.description || "",
          },
        },
      });
    }
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">{t("loading")}</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("productCategories")}</h1>
          <p className="text-muted-foreground">{t("manageProductCategories")}</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              {t("addCategory")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createCategory")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Multilingual Name and Description */}
              <div>
                <Label>{t("name")}</Label>
                <div className="border rounded-md">
                  <div className="flex border-b">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 text-sm font-medium border-r ${
                        activeLanguageTab === "eu" ? "bg-muted" : ""
                      }`}
                      onClick={() => setActiveLanguageTab("eu")}
                    >
                      EU (Euskara)
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 text-sm font-medium ${
                        activeLanguageTab === "es" ? "bg-muted" : ""
                      }`}
                      onClick={() => setActiveLanguageTab("es")}
                    >
                      ES (Español)
                    </button>
                  </div>
                  {activeLanguageTab === "eu" && (
                    <div className="p-3 space-y-3">
                      <div>
                        <Input
                          placeholder={t("name")}
                          value={formData.messages.eu.name}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              messages: {
                                ...formData.messages,
                                eu: { ...formData.messages.eu, name: e.target.value },
                              },
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Textarea
                          placeholder={t("description")}
                          value={formData.messages.eu.description}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              messages: {
                                ...formData.messages,
                                eu: { ...formData.messages.eu, description: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                  {activeLanguageTab === "es" && (
                    <div className="p-3 space-y-3">
                      <div>
                        <Input
                          placeholder={t("name")}
                          value={formData.messages.es.name}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              messages: {
                                ...formData.messages,
                                es: { ...formData.messages.es, name: e.target.value },
                              },
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Textarea
                          placeholder={t("description")}
                          value={formData.messages.es.description}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              messages: {
                                ...formData.messages,
                                es: { ...formData.messages.es, description: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color">{t("color")}</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className="w-16 h-10"
                    />
                    <Input
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#6B7280"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="icon">{t("icon")}</Label>
                  <IconSelector
                    value={formData.icon}
                    onChange={value => setFormData({ ...formData, icon: value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={checked => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">{t("active")}</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("saving") : t("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {categories.map(category => (
          <Card key={category.id} className={!category.isActive ? "opacity-50" : ""}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-lg"
                    style={{ backgroundColor: category.color + "20" }}
                  >
                    {(() => {
                      const IconComponent = getIconComponent(category.icon);
                      return (
                        <IconComponent className="h-6 w-6" style={{ color: category.color }} />
                      );
                    })()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteCategory")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("deleteCategoryConfirm")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(category.id)}>
                          {t("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("noCategories")}</h3>
              <p className="text-muted-foreground">{t("noCategoriesDesc")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editCategory")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Multilingual Name and Description */}
            <div>
              <Label>{t("name")}</Label>
              <div className="border rounded-md">
                <div className="flex border-b">
                  <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-sm font-medium border-r ${
                      activeLanguageTab === "eu" ? "bg-muted" : ""
                    }`}
                    onClick={() => setActiveLanguageTab("eu")}
                  >
                    EU (Euskara)
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-sm font-medium ${
                      activeLanguageTab === "es" ? "bg-muted" : ""
                    }`}
                    onClick={() => setActiveLanguageTab("es")}
                  >
                    ES (Español)
                  </button>
                </div>
                {activeLanguageTab === "eu" && (
                  <div className="p-3 space-y-3">
                    <div>
                      <Input
                        placeholder={t("name")}
                        value={formData.messages.eu.name}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            messages: {
                              ...formData.messages,
                              eu: { ...formData.messages.eu, name: e.target.value },
                            },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Textarea
                        placeholder={t("description")}
                        value={formData.messages.eu.description}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            messages: {
                              ...formData.messages,
                              eu: { ...formData.messages.eu, description: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {activeLanguageTab === "es" && (
                  <div className="p-3 space-y-3">
                    <div>
                      <Input
                        placeholder={t("name")}
                        value={formData.messages.es.name}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            messages: {
                              ...formData.messages,
                              es: { ...formData.messages.es, name: e.target.value },
                            },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Textarea
                        placeholder={t("description")}
                        value={formData.messages.es.description}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            messages: {
                              ...formData.messages,
                              es: { ...formData.messages.es, description: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-color">{t("color")}</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#6B7280"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-icon">{t("icon")}</Label>
                <IconSelector
                  value={formData.icon}
                  onChange={value => setFormData({ ...formData, icon: value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={checked => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="edit-isActive">{t("active")}</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
