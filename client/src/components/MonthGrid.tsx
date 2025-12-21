import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import * as Select from '@radix-ui/react-select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface MonthGridProps {
  selectedMonth?: string;
  onMonthChange: (month: string) => void;
  className?: string;
  // Configuration options for month/year ranges
  mode?: 'future' | 'past' | 'all';
  yearRange?: {
    past?: number; // Number of past years to include
    future?: number; // Number of future years to include
  };
}

const MonthGrid = ({ selectedMonth, onMonthChange, className, mode = 'future', yearRange = { past: 2, future: 2 } }: MonthGridProps) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [tempSelectedYear, setTempSelectedYear] = useState<string>('');

  // Initialize tempSelectedYear when component mounts or selectedMonth changes
  useEffect(() => {
    if (selectedMonth) {
      setTempSelectedYear(selectedMonth.split('-')[0]);
    } else {
      setTempSelectedYear(new Date().getFullYear().toString());
    }
  }, [selectedMonth]);

  // Generate year options based on mode and yearRange
  const generateYearOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    let startYear = currentYear;
    let endYear = currentYear;
    
    switch (mode) {
      case 'future':
        startYear = currentYear;
        endYear = currentYear + (yearRange.future || 2);
        break;
      case 'past':
        startYear = currentYear - (yearRange.past || 2);
        endYear = currentYear;
        break;
      case 'all':
        startYear = currentYear - (yearRange.past || 2);
        endYear = currentYear + (yearRange.future || 2);
        break;
    }
    
    for (let year = startYear; year <= endYear; year++) {
      options.push({
        value: year.toString(),
        display: year.toString()
      });
    }
    return options;
  };

  const getCurrentYear = () => {
    if (tempSelectedYear) return tempSelectedYear;
    if (!selectedMonth) return new Date().getFullYear().toString();
    return selectedMonth.split('-')[0];
  };

  const getCurrentMonth = () => {
    if (!selectedMonth) return (new Date().getMonth() + 1).toString().padStart(2, '0');
    return selectedMonth.split('-')[1];
  };

  const generateMonthOptions = () => {
    const monthNames = language === 'eu' ? [
      'Urtarrila', 'Otsaila', 'Martxoa', 'Apirila', 'Maiatza', 'Ekaina',
      'Uztaila', 'Abuztua', 'Iraila', 'Urria', 'Azaroa', 'Abendua'
    ] : [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const allMonths = monthNames.map((name, index) => ({
      value: (index + 1).toString().padStart(2, '0'),
      display: name
    }));
    
    // Filter months based on mode and selected year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const selectedYear = getCurrentYear();
    
    switch (mode) {
      case 'future':
        if (currentYear === parseInt(selectedYear)) {
          // For current year, only show current month and future months
          return allMonths.filter((month, index) => index + 1 >= currentMonth);
        }
        // For future years, show all months
        return allMonths;
      case 'past':
        if (currentYear === parseInt(selectedYear)) {
          // For current year, only show past months and current month
          return allMonths.filter((month, index) => index + 1 <= currentMonth);
        }
        // For past years, show all months
        return allMonths;
      case 'all':
      default:
        // Show all months for any year
        return allMonths;
    }
  };

  const getSelectedDisplay = () => {
    if (!selectedMonth) return t('allMonths');
    const [year, month] = selectedMonth.split('-');
    const monthNames = language === 'eu' ? [
      'Urtarrila', 'Otsaila', 'Martxoa', 'Apirila', 'Maiatza', 'Ekaina',
      'Uztaila', 'Abuztua', 'Iraila', 'Urria', 'Azaroa', 'Abendua'
    ] : [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const yearOptions = generateYearOptions();
  const monthOptions = generateMonthOptions();
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            className
          )}
          data-testid="month-selector-trigger"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="font-medium whitespace-nowrap">{getSelectedDisplay()}</span>
          </div>
          <div className="flex items-center gap-1">
            {selectedMonth && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onMonthChange('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                data-testid="clear-month-trigger"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <div className="h-4 w-4 text-gray-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content 
          className="z-50 w-screen max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4"
          align="start"
          sideOffset={4}
        >
          <div className="space-y-4">
            {/* Year Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('year')}</label>
              <Select.Root 
                value={tempSelectedYear || currentYear} 
                onValueChange={(year: string) => {
                  setTempSelectedYear(year);
                }}
              >
                <Select.Trigger className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <Select.Value />
                  <Select.Icon className="h-4 w-4 text-gray-500">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    <Select.Viewport className="p-1">
                      {yearOptions.map((option) => (
                        <Select.Item 
                          key={option.value}
                          value={option.value}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-blue-50 focus:outline-none"
                        >
                          <Select.ItemText>{option.display}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Month Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('month')}</label>
              <div className="grid grid-cols-3 gap-2">
                {monthOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      const finalYear = tempSelectedYear || getCurrentYear();
                      const newMonth = `${finalYear}-${option.value}`;
                      onMonthChange(newMonth);
                      setOpen(false);
                    }}
                    className={cn(
                      'px-3 py-2 text-sm rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      currentMonth === option.value
                        ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    {option.display}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Clear Selection Button */}
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  onMonthChange('');
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              >
                {t('clearSelection')}
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default MonthGrid;
