import React, { useState } from 'react';
import { MapMode } from '../types';
import { Menu, X, Compass, Crosshair, ZoomIn, ZoomOut, Settings, Map as MapIcon, ShieldAlert, Layers, Navigation } from 'lucide-react';

interface SideMenuProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  zoomLevel: number;
  onZoom: (val: number) => void;
}

interface MenuButtonProps {
  label: string;
  icon: any;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({ 
  label, 
  icon: Icon, 
  onClick, 
  active = false,
  danger = false
}) => (
  <button 
    onClick={onClick}
    className={`
      w-16 h-16 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-200 active:scale-95 shadow-lg
      ${active 
        ? 'bg-emerald-900/90 border-emerald-500 text-emerald-400 shadow-emerald-900/30' 
        : danger 
          ? 'bg-red-950/80 border-red-800 text-red-500 hover:bg-red-900/90'
          : 'bg-slate-800/90 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 hover:border-slate-500'
      }
    `}
  >
    <Icon size={24} className="mb-1" />
    <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
  </button>
);

export const SideMenu: React.FC<SideMenuProps> = React.memo(({ isOpen, setIsOpen, mapMode, setMapMode, zoomLevel, onZoom }) => {
  const [activeCategory, setActiveCategory] = useState<string | null>('map');

  // Configuration for the cascading menu
  const categories = [
    { 
      id: 'map', 
      label: 'MAP', 
      icon: MapIcon,
      items: [
        { 
          label: 'N-UP', 
          icon: Navigation, 
          active: mapMode === MapMode.NORTH_UP, 
          onClick: () => setMapMode(MapMode.NORTH_UP) 
        },
        { 
          label: 'H-UP', 
          icon: Compass, 
          active: mapMode === MapMode.HEADING_UP, 
          onClick: () => setMapMode(MapMode.HEADING_UP) 
        },
        { 
          label: 'CLR', 
          icon: Crosshair, 
          onClick: () => {} // Placeholder for declutter
        }
      ]
    },
    {
      id: 'zoom',
      label: 'ZOOM',
      icon: Layers, 
      items: [
         { label: 'IN', icon: ZoomIn, onClick: () => onZoom(zoomLevel * 1.5) },
         { label: 'OUT', icon: ZoomOut, onClick: () => onZoom(zoomLevel / 1.5) }
      ]
    },
    {
       id: 'mission',
       label: 'MSN',
       icon: Settings,
       items: [
         { 
           label: 'EMG', 
           icon: ShieldAlert, 
           danger: true, 
           onClick: () => alert('EMERGENCY BEACON ACTIVATED') 
         },
         { 
           label: 'SET', 
           icon: Settings, 
           onClick: () => {} // Placeholder for settings
         }
       ]
    }
  ];

  const handleCategoryClick = (id: string) => {
    // Toggle: if clicking active, close it (or keep it? Usually keep active until another is clicked or menu closed)
    // Here we toggle off if clicked again for flexibility
    setActiveCategory(activeCategory === id ? null : id);
  };

  const handleMainToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      setActiveCategory(null); // Reset sub-menu when closing main
    } else {
      setIsOpen(true);
      setActiveCategory('map'); // Default to first category open
    }
  };

  return (
    <div 
      className="fixed z-30 flex flex-row items-start gap-4"
      style={{
        top: 'calc(1rem + env(safe-area-inset-top))',
        left: 'calc(1rem + env(safe-area-inset-left))'
      }}
    >
      
      {/* Column 1: Main Controls */}
      <div className="flex flex-col gap-3">
        {/* Burger / Toggle */}
        <button 
          onClick={handleMainToggle}
          className={`
            w-16 h-16 flex items-center justify-center rounded-2xl border-2 transition-all duration-200 shadow-xl mb-2
            ${isOpen 
              ? 'bg-slate-700 border-slate-500 text-white' 
              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700'
            }
          `}
        >
          {isOpen ? <X size={32} /> : <Menu size={32} />}
        </button>

        {/* Categories (only visible when open) */}
        {isOpen && categories.map(cat => (
          <MenuButton 
            key={cat.id}
            label={cat.label} 
            icon={cat.icon} 
            active={activeCategory === cat.id} 
            onClick={() => handleCategoryClick(cat.id)} 
          />
        ))}
      </div>

      {/* Column 2: Sub Menu (Cascading) */}
      {isOpen && activeCategory && (
        <div className="flex flex-col gap-3 pt-[calc(4rem+1.25rem)] animate-in slide-in-from-left-4 fade-in duration-200">
           {categories.find(c => c.id === activeCategory)?.items.map((item, index) => (
              <MenuButton 
                key={index}
                label={item.label}
                icon={item.icon}
                active={item.active}
                danger={item.danger}
                onClick={item.onClick}
              />
           ))}
        </div>
      )}

    </div>
  );
});