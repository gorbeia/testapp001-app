import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Package, Coffee, Wine, Beer, Cake, Pizza, Sandwich, Utensils, ChefHat, IceCream, Apple, Carrot, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const iconOptions = [
  { name: 'Package', icon: Package, translationKey: 'iconPackage' },
  { name: 'Coffee', icon: Coffee, translationKey: 'iconCoffee' },
  { name: 'Wine', icon: Wine, translationKey: 'iconWine' },
  { name: 'Beer', icon: Beer, translationKey: 'iconBeer' },
  { name: 'Cake', icon: Cake, translationKey: 'iconCake' },
  { name: 'Pizza', icon: Pizza, translationKey: 'iconPizza' },
  { name: 'Sandwich', icon: Sandwich, translationKey: 'iconSandwich' },
  { name: 'Utensils', icon: Utensils, translationKey: 'iconUtensils' },
  { name: 'ChefHat', icon: ChefHat, translationKey: 'iconChefHat' },
  { name: 'IceCream', icon: IceCream, translationKey: 'iconIceCream' },
  { name: 'Apple', icon: Apple, translationKey: 'iconApple' },
  { name: 'Carrot', icon: Carrot, translationKey: 'iconCarrot' },
  { name: 'ShoppingBag', icon: ShoppingBag, translationKey: 'iconShoppingBag' },
];

interface IconSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconSelector({ value, onChange }: IconSelectorProps) {
  const { t } = useLanguage();
  const selectedIcon = iconOptions.find(option => option.name === value);
  const SelectedIconComponent = selectedIcon?.icon;

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger className="w-full p-2 border rounded-md bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-between">
        {SelectedIconComponent ? (
          <div className="flex items-center">
            <SelectedIconComponent className="mr-2 h-4 w-4" />
            <span>{selectedIcon ? t(selectedIcon.translationKey as any) : value}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">{t('selectIcon')}</span>
        )}
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content 
          className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]">
            {iconOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <SelectPrimitive.Item
                  key={option.name}
                  value={option.name}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <IconComponent className="h-4 w-4" />
                  </span>
                  <SelectPrimitive.ItemText>{t(option.translationKey as any)}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
