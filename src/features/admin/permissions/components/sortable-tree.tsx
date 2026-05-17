import type { UniqueIdentifier } from '@dnd-kit/core';
import {
  defaultAnimateLayoutChanges,
  useSortable,
} from '@dnd-kit/sortable';
import type { AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconChevronRight,
  IconGripVertical,
  IconTrash,
  IconEdit,
  IconFolder,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Permission } from '../data/schema';
import { Button } from '@/components/ui/button';
import { useDroppable } from '@dnd-kit/core';

interface TreeItemProps {
  id: UniqueIdentifier;
  children?: React.ReactNode;
  collapsed?: boolean;
  onCollapse?(): void;
  permission: Permission;
  onDelete: (permission: Permission) => void;
  onEdit?: (permission: Permission) => void;
  isModule?: boolean;
  searchQuery?: string;
}

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, isDragging } = args;

  if (isSorting || isDragging) {
    return defaultAnimateLayoutChanges(args);
  }

  return true;
};

export function SortableTreeItem({
  id,
  children,
  collapsed = true,
  onCollapse,
  permission,
  onDelete,
  onEdit,
  isModule = false,
  searchQuery = '',
}: TreeItemProps) {
  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    )
  }

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    animateLayoutChanges,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: id,
    data: {
      isModule,
      module: permission.module,
    },
  });

  const setRefs = (el: HTMLElement | null) => {
    setSortableRef(el);
    if (isModule) {
      setDroppableRef(el);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getMethodColor = (method?: string) => {
    const map: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      POST: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[method || ''] || '';
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        'flex flex-col rounded-md border transition-colors duration-200 bg-white dark:bg-zinc-900/50',
        isDragging && 'opacity-30 scale-95',
        isModule ? 'bg-white dark:bg-zinc-800/80 shadow-sm border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50',
        isModule && 'hover:bg-slate-100 dark:hover:bg-zinc-800',
        isOver && 'ring-2 ring-primary ring-offset-2 bg-slate-100 dark:bg-zinc-800',
        isModule && isOver && 'scale-[1.01]'
      )}
    >
        <div className={cn("flex items-center justify-between", isModule ? "py-2 px-4" : "py-1.5 pl-3 pr-1")}>
        <div className="flex items-center gap-3">
          {!isModule && (
            <button
              className="cursor-grab touch-none p-1 -ml-2 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"
              {...attributes}
              {...listeners}
            >
              <IconGripVertical className="h-5 w-5 text-slate-400" />
            </button>
          )}

          {children && (
            <button 
              onClick={onCollapse} 
              className="flex items-center justify-center p-1 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-700"
            >
              <IconChevronRight
                className={cn(
                  'h-5 w-5 shrink-0 transition-transform duration-200 text-slate-600 dark:text-slate-400',
                  !collapsed && 'rotate-90'
                )}
              />
            </button>
          )}

          <div className="flex items-center gap-3">
            {isModule ? (
              <div className="flex items-center gap-2">
                <IconFolder className="h-4 w-4 text-slate-400" />
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {highlightText(permission.name, searchQuery)}
                </div>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-none">
                  {(children as any)?.length || 0}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate max-w-[250px]">
                  {highlightText(permission.name, searchQuery)}
                </div>
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px] font-bold px-1.5 py-0 h-4 border-none flex-shrink-0", getMethodColor(permission.httpMethod))}
                >
                  {permission.httpMethod}
                </Badge>
                <code className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate flex-1">
                  {highlightText(permission.apiPath, searchQuery)}
                </code>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
          {!isModule && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              onClick={() => onEdit(permission)}
            >
              <IconEdit className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
            onClick={() => onDelete(permission)}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!collapsed && children && (
        <div className="pl-12 pr-4 pb-4 mt-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
