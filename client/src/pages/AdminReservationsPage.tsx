import { useState, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Search, Calendar, Users, X, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MonthGrid from "@/components/MonthGrid";
import PaginationControls from "@/components/PaginationControls";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { eu, es } from "date-fns/locale";
import type { Reservation, User } from "@shared/schema";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { authFetch } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";

interface ReservationWithUser extends Reservation {
  userName: string | null;
}

export function AdminReservationsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("month") || "";
    }
    return "";
  });
  const [userFilter, setUserFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("user") || "all";
    }
    return "all";
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("status") || "all";
    }
    return "all";
  });
  const [reservations, setReservations] = useState<ReservationWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithUser | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Pagination state
  const pagination = usePagination({ initialPage: 1, initialLimit: 25 });

  // Load reservations
  const loadReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      // Add pagination parameters
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      if (searchTerm) {
        params.append("search", searchTerm);
      }

      if (monthFilter) {
        // Extract month number from YYYY-MM format for API
        const monthParam = monthFilter.split("-")[1];
        params.append("month", monthParam);
      }
      if (userFilter && userFilter !== "all") {
        params.append("user", userFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await authFetch(`/api/reservations?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReservations(data.data || []);
        pagination.updatePagination(data.pagination?.total || 0);
      } else {
        throw new Error("Failed to load reservations");
      }
    } catch (error) {
      console.error("Error loading reservations:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  // Load users for filter
  const loadUsers = async () => {
    try {
      const response = await authFetch("/api/users?status=active");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  // Cancel reservation (admin)
  const cancelReservation = async (reservationId: string, reason: string) => {
    try {
      const response = await authFetch(`/api/reservations/${reservationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellationReason: reason,
        }),
      });

      if (response.ok) {
        toast({
          title: t("reservationCancelledTitle"),
          description: t("reservationCancelledDescription"),
        });
        loadReservations(); // Reload reservations
      } else {
        throw new Error("Failed to cancel reservation");
      }
    } catch (error) {
      console.error("Error canceling reservation:", error);
      toast({
        title: t("errorTitle"),
        description: t("reservationCancelError"),
        variant: "destructive",
      });
    } finally {
      setCancellationReason("");
    }
  };

  // Filter reservations - no longer needed since filtering is done server-side
  // const reservations = reservations.filter(reservation => {
  //   const matchesSearch = !searchTerm ||
  //     reservation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     reservation.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     reservation.type?.toLowerCase().includes(searchTerm.toLowerCase());
  //
  //   return matchesSearch;
  // });

  // Get status options
  const getStatusOptions = () => [
    { value: "all", label: t("allStatuses") },
    { value: "confirmed", label: t("confirmed") },
    { value: "cancelled", label: t("cancelled") },
    { value: "pending", label: t("pending") },
    { value: "completed", label: t("completed") },
  ];

  // Get event type labels
  const eventTypeLabels: Record<string, string> = {
    bazkaria: t("bazkaria"),
    afaria: t("afaria"),
    askaria: t("askaria"),
    hamaiketakako: t("hamaiketakoa"),
  };

  // Handle filter changes
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    pagination.setPage(1); // Reset to first page when searching
  };

  const handleFilterChange = () => {
    pagination.setPage(1); // Reset to first page when filters change
  };

  // Format date
  const formatDate = (date: Date) => {
    return format(date, "yyyy-MM-dd", { locale: language === "es" ? es : eu });
  };

  // Format time
  const formatTime = (date: Date) => {
    return format(date, "HH:mm", { locale: language === "es" ? es : eu });
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "cancelled":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Get status badge component
  const getStatusBadge = (status: string) => {
    return <Badge variant={getStatusBadgeVariant(status)}>{getStatusLabel(status)}</Badge>;
  };

  // Get type badge component
  const getTypeBadge = (type: string) => {
    return <Badge variant="outline">{eventTypeLabels[type] || type}</Badge>;
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return t("confirmed");
      case "cancelled":
        return t("cancelled");
      case "pending":
        return t("pending");
      case "completed":
        return t("completed");
      default:
        return status;
    }
  };

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (monthFilter) params.set("month", monthFilter);
    if (userFilter !== "all") params.set("user", userFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [monthFilter, userFilter, statusFilter]);

  useEffect(() => {
    loadReservations();
    loadUsers();
  }, [monthFilter, userFilter, statusFilter, pagination.page, pagination.limit, searchTerm]);

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("reservationsManagement")}</h1>
            <p className="text-muted-foreground">{t("reservationsManagementDescription")}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              placeholder={t("searchReservation")}
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={value => {
              setStatusFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getStatusOptions().map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={userFilter}
            onValueChange={value => {
              setUserFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allUsers")}</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MonthGrid
            selectedMonth={monthFilter}
            onMonthChange={value => {
              setMonthFilter(value);
              handleFilterChange();
            }}
            className="w-full sm:w-48"
            mode="all"
            yearRange={{ past: 3, future: 3 }}
          />
        </div>

        {/* Reservations Table */}
        <Card className="overflow-hidden">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableHeaderName")}</TableHead>
                    <TableHead>{t("tableHeaderUser")}</TableHead>
                    <TableHead>{t("tableHeaderDate")}</TableHead>
                    <TableHead>{t("tableHeaderTime")}</TableHead>
                    <TableHead>{t("tableHeaderTable")}</TableHead>
                    <TableHead>{t("tableHeaderGuests")}</TableHead>
                    <TableHead>{t("tableHeaderType")}</TableHead>
                    <TableHead className="text-right">{t("tableHeaderStatus")}</TableHead>
                    <TableHead className="text-right">{t("tableHeaderActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {t("loading")}
                      </TableCell>
                    </TableRow>
                  ) : reservations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {t("noReservationsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reservations.map(reservation => (
                      <TableRow key={reservation.id}>
                        <TableCell className="font-medium">{reservation.name}</TableCell>
                        <TableCell>{reservation.userName || t("unknownUser")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span>{formatDate(reservation.startDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(reservation.startDate)}</TableCell>
                        <TableCell>{reservation.table}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span>{reservation.guests}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(reservation.type)}</TableCell>
                        <TableCell className="text-right">
                          {getStatusBadge(reservation.status)}
                        </TableCell>
                        <TableCell className="text-right w-32">
                          <div className="flex items-center gap-2 justify-end ml-auto">
                            {reservation.status === "confirmed" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setReservationToCancel(reservation.id);
                                  setCancelDialogOpen(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReservation(reservation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <PaginationControls pagination={pagination} itemType="reservationsForPagination" />

        {/* Reservation Details Dialog */}
        <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{t("reservationDetailsTitle")}</DialogTitle>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderName")}</p>
                    <p>{selectedReservation.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderUser")}</p>
                    <p>{selectedReservation.userName || t("unknownUser")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderType")}</p>
                    <p>{getTypeBadge(selectedReservation.type)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderStatus")}</p>
                    <p>{getStatusBadge(selectedReservation.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderTable")}</p>
                    <p>{selectedReservation.table}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderGuests")}</p>
                    <p>{selectedReservation.guests}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderDate")}</p>
                    <p>{formatDate(selectedReservation.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("tableHeaderTime")}</p>
                    <p>{formatTime(selectedReservation.startDate)}</p>
                  </div>
                  {selectedReservation.totalAmount && (
                    <div>
                      <p className="text-sm font-medium">{t("cost")}</p>
                      <p>€{selectedReservation.totalAmount}</p>
                    </div>
                  )}
                  {selectedReservation.notes && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{t("notes")}</p>
                      <p>{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel confirmation dialog */}
        <AlertDialog
          open={cancelDialogOpen}
          onOpenChange={open => {
            if (!open) {
              setCancellationReason("");
              setReservationToCancel(null);
            }
            setCancelDialogOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t("cancelReservationTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("cancelReservationConfirmMessage")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cancellationReason" className="text-sm font-medium">
                  {t("cancellationReason")} *
                </label>
                <Textarea
                  id="cancellationReason"
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  placeholder={t("enterCancellationReason")}
                  className="min-h-[100px]"
                  required
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!cancellationReason.trim()) {
                    toast({
                      title: t("errorTitle"),
                      description: t("cancellationReasonRequired"),
                      variant: "destructive",
                    });
                    return;
                  }
                  if (reservationToCancel) {
                    cancelReservation(reservationToCancel, cancellationReason);
                    setCancelDialogOpen(false);
                    setReservationToCancel(null);
                    setCancellationReason("");
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("cancelReservationTitle")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
}
