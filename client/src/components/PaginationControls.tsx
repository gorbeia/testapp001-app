import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useLanguage } from '@/lib/i18n';
import type { PaginationState } from '@/hooks/use-pagination';
import type { TranslationKey } from '@/lib/i18n';

interface PaginationControlsProps {
  pagination: PaginationState & {
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    getPageNumbers: (maxVisible?: number) => number[];
  };
  itemType: TranslationKey;
  limitOptions?: number[];
  maxVisiblePages?: number;
}

export default function PaginationControls({ 
  pagination, 
  itemType, 
  limitOptions = [10, 25, 50, 100],
  maxVisiblePages = 5
}: PaginationControlsProps) {
  const { t } = useLanguage();

  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
      <div className="text-sm text-muted-foreground">
        {t('showingResults', { 
          from: ((pagination.page - 1) * pagination.limit) + 1,
          to: Math.min(pagination.page * pagination.limit, pagination.total),
          total: pagination.total,
          type: t(itemType as TranslationKey)
        })}
      </div>
      
      <div className="flex items-center gap-2">
        <Select value={pagination.limit.toString()} onValueChange={(value) => pagination.setLimit(parseInt(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {limitOptions.map((limit) => (
              <SelectItem key={limit} value={limit.toString()}>
                {limit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => pagination.prevPage()}
                className={!pagination.hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {/* Page Numbers */}
            {pagination.getPageNumbers(maxVisiblePages).map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  onClick={() => pagination.setPage(pageNum)}
                  isActive={pagination.page === pageNum}
                  className="cursor-pointer"
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => pagination.nextPage()}
                className={!pagination.hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
