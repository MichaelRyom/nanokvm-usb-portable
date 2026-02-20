import { useCallback, useEffect, useRef, useState } from 'react';
import { Divider } from 'antd';
import clsx from 'clsx';
import { useAtomValue } from 'jotai';
import { ChevronRightIcon, GripVerticalIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import Draggable from 'react-draggable';

import { menuConfigAtom, serialStateAtom } from '@/jotai/device.ts';
import { type MenuItemId, type SubMenuItemId, SERIAL_REQUIRED_ITEMS, isSubMenuItem, getSubMenuItemMeta } from '@/libs/menu-config';
import * as storage from '@/libs/storage';

import { Audio } from './audio';
import { Fullscreen } from './fullscreen';
import { Keyboard } from './keyboard';
import { Mouse } from './mouse';
import { PromotedSubMenuItem } from './promoted-items';
import { Recorder } from './recorder';
import { Screenshot } from './screenshot';
import { SerialPort } from './serial-port';
import { Settings } from './settings';
import { Video } from './video';

// Map menu item IDs to their components
const MENU_COMPONENTS: Record<MenuItemId, React.FC> = {
  video: Video,
  audio: Audio,
  serialPort: SerialPort,
  keyboard: Keyboard,
  mouse: Mouse,
  recorder: Recorder,
  screenshot: Screenshot,
  settings: Settings,
  fullscreen: Fullscreen,
};

export const Menu = () => {
  const serialState = useAtomValue(serialStateAtom);
  const menuConfig = useAtomValue(menuConfigAtom);

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isVertical, setIsVertical] = useState(storage.getMenuOrientation() === 'vertical');
  const [menuBounds, setMenuBounds] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const nodeRef = useRef<HTMLDivElement | null>(null);

  const handleResize = useCallback(() => {
    if (!nodeRef.current) return;

    const elementRect = nodeRef.current.getBoundingClientRect();

    // Menu starts at left: 10px, top: 10px
    // Bounds are relative to starting position
    setMenuBounds({
      left: -10, // Can't go past left edge
      top: -10,  // Can't go past top edge
      right: window.innerWidth - elementRect.width - 10,
      bottom: window.innerHeight - elementRect.height - 10
    });
  }, []);

  useEffect(() => {
    const isOpen = storage.getIsMenuOpen();
    setIsMenuOpen(isOpen);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  useEffect(() => {
    handleResize();
  }, [isMenuOpen, serialState, isVertical, menuConfig, handleResize]);

  // Filter visible items based on serial connection state
  const visibleItems = menuConfig.visibleItems.filter((itemId) => {
    // Check if it's a promoted submenu item
    if (isSubMenuItem(itemId)) {
      const meta = getSubMenuItemMeta(itemId);
      if (meta?.requiresSerial && serialState !== 'connected') {
        return false;
      }
      return true;
    }
    // If main menu item requires serial and we're not connected, hide it
    if (SERIAL_REQUIRED_ITEMS.includes(itemId as MenuItemId) && serialState !== 'connected') {
      return false;
    }
    return true;
  });

  // Render a menu item by ID (either main menu or promoted submenu item)
  const renderMenuItem = (itemId: MenuItemId | SubMenuItemId) => {
    // Check if it's a promoted submenu item
    if (isSubMenuItem(itemId)) {
      return <PromotedSubMenuItem key={itemId} itemId={itemId} />;
    }
    // Regular menu item
    const Component = MENU_COMPONENTS[itemId as MenuItemId];
    if (!Component) return null;
    return <Component key={itemId} />;
  };

  function toggleMenu() {
    const isOpen = !isMenuOpen;

    setIsMenuOpen(isOpen);
    storage.setIsMenuOpen(isOpen);
  }

  function toggleOrientation() {
    const newIsVertical = !isVertical;
    setIsVertical(newIsVertical);
    storage.setMenuOrientation(newIsVertical ? 'vertical' : 'horizontal');
    
    // After orientation change, ensure menu stays on screen
    // Use setTimeout to allow React to re-render with new dimensions
    setTimeout(() => {
      if (!nodeRef.current) return;
      const rect = nodeRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 10;
      const maxY = window.innerHeight - rect.height - 10;
      
      setDragPosition(prev => ({
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, maxY)
      }));
    }, 0);
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds={menuBounds}
      handle="strong"
      position={dragPosition}
      onDrag={(_, data) => setDragPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className="fixed left-[10px] top-[10px] z-[1000] transition-opacity duration-300"
      >
        {/* Menubar */}
        <div className="sticky top-[10px] flex w-full justify-start">
          <div
            className={clsx(
              'items-center justify-between rounded bg-neutral-800/70 px-2',
              isMenuOpen ? 'flex' : 'hidden',
              isVertical ? 'flex-col space-y-1.5 py-2 w-[34px]' : 'flex-row space-x-1.5 h-[34px]'
            )}
          >
            <strong>
              <div className="flex h-[28px] w-[28px] cursor-move select-none items-center justify-center text-neutral-400">
                <GripVerticalIcon size={18} className={isVertical ? 'rotate-90' : ''} />
              </div>
            </strong>
            <Divider type={isVertical ? 'horizontal' : 'vertical'} className={isVertical ? 'my-0 w-full' : ''} />

            {visibleItems.map((itemId) => renderMenuItem(itemId))}
            <div
              className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-neutral-400 hover:bg-neutral-700/70 hover:text-white"
              onClick={toggleOrientation}
              title={isVertical ? 'Switch to horizontal' : 'Switch to vertical'}
            >
              <RotateCcwIcon size={16} />
            </div>
            <div
              className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-white hover:bg-neutral-700/70"
              onClick={toggleMenu}
            >
              <XIcon size={18} />
            </div>
          </div>

          {/* Menubar expand button */}
          {!isMenuOpen && (
            <div className={clsx(
              'flex items-center rounded-lg bg-neutral-800/50 p-1',
              isVertical ? 'flex-col' : 'flex-row'
            )}>
              <strong>
                <div className="flex size-[26px] cursor-move select-none items-center justify-center text-neutral-400">
                  <GripVerticalIcon size={18} className={isVertical ? 'rotate-90' : ''} />
                </div>
              </strong>
              <Divider type={isVertical ? 'horizontal' : 'vertical'} style={{ margin: isVertical ? '4px 0' : '0 4px' }} />
              <div
                className="flex size-[26px] cursor-pointer items-center justify-center rounded text-neutral-400 hover:bg-neutral-700/70 hover:text-white"
                onClick={toggleMenu}
              >
                <ChevronRightIcon size={18} className={isVertical ? 'rotate-90' : ''} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Draggable>
  );
};
