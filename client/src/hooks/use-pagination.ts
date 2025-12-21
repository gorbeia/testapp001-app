import { useState, useCallback } from 'react';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  totalItems?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { initialPage = 1, initialLimit = 25, totalItems = 0 } = options;
  
  const [state, setState] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    total: totalItems,
    totalPages: Math.ceil(totalItems / initialLimit),
    hasNext: initialPage < Math.ceil(totalItems / initialLimit),
    hasPrev: initialPage > 1,
  });

  const updatePagination = useCallback((newTotal: number) => {
    setState(prev => {
      const totalPages = Math.ceil(newTotal / prev.limit);
      return {
        ...prev,
        total: newTotal,
        totalPages,
        hasNext: prev.page < totalPages,
        hasPrev: prev.page > 1,
      };
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setState(prev => {
      const totalPages = Math.ceil(prev.total / prev.limit);
      const validPage = Math.max(1, Math.min(page, totalPages));
      return {
        ...prev,
        page: validPage,
        hasNext: validPage < totalPages,
        hasPrev: validPage > 1,
      };
    });
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState(prev => {
      const newLimit = Math.max(1, Math.min(limit, 100));
      const totalPages = Math.ceil(prev.total / newLimit);
      const newPage = Math.min(prev.page, totalPages || 1);
      return {
        ...prev,
        limit: newLimit,
        page: newPage,
        totalPages,
        hasNext: newPage < totalPages,
        hasPrev: newPage > 1,
      };
    });
  }, []);

  const nextPage = useCallback(() => {
    if (state.hasNext) {
      setPage(state.page + 1);
    }
  }, [state.hasNext, state.page, setPage]);

  const prevPage = useCallback(() => {
    if (state.hasPrev) {
      setPage(state.page - 1);
    }
  }, [state.hasPrev, state.page, setPage]);

  const reset = useCallback(() => {
    setState({
      page: initialPage,
      limit: initialLimit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  }, [initialPage, initialLimit]);

  const getPageNumbers = useCallback((maxVisible: number = 5) => {
    const { page, totalPages } = state;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than or equal to maxVisible
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (page <= Math.floor(maxVisible / 2)) {
      // Show first maxVisible pages when current page is near the beginning
      return Array.from({ length: maxVisible }, (_, i) => i + 1);
    }
    
    if (page >= totalPages - Math.floor(maxVisible / 2)) {
      // Show last maxVisible pages when current page is near the end
      return Array.from({ length: maxVisible }, (_, i) => totalPages - maxVisible + 1 + i);
    }
    
    // Show pages centered around current page
    const startPage = page - Math.floor(maxVisible / 2);
    return Array.from({ length: maxVisible }, (_, i) => startPage + i);
  }, [state]);

  return {
    ...state,
    setPage,
    setLimit,
    nextPage,
    prevPage,
    updatePagination,
    reset,
    getPageNumbers,
  };
}

export type { PaginationState };
