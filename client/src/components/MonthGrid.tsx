import { useState } from 'react';
import { Calendar } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import * as Select from '@radix-ui/react-select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface MonthGridProps {
  selectedMonth?: string;
  onMonthChange: (month: string) => void;
  className?: string;
}

const MonthGrid = ({ selectedMonth, onMonthChange, className }: MonthGridProps) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  // Generate year and month options
  const generateYearOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // Generate options for current year and previous 4 years
    for (let year = currentYear; year >= currentYear - 4; year--) {
      options.push({
        value: year.toString(),
        display: year.toString()
      });
    }
    return options;
  };

  const getCurrentYear = () => {
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
    
    // For current year, only show current and previous months
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const selectedYear = getCurrentYear();
    
    if (currentYear === parseInt(selectedYear)) {
      // Filter to only show current month and previous months
      return allMonths.filter((month, index) => index + 1 <= currentMonth);
    }
    
    // For previous years, show all months
    return allMonths;
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
            <span className="font-medium">{getSelectedDisplay()}</span>
          </div>
          <div className="h-4 w-4 text-gray-500">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
                value={currentYear} 
                onValueChange={(year: string) => {
                  const newMonth = `${year}-${currentMonth}`;
                  onMonthChange(newMonth);
                  setOpen(false);
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
                      const newMonth = `${currentYear}-${option.value}`;
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
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default MonthGrid;
