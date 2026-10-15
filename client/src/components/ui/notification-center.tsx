import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, XCircle, AlertTriangle, Info, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NotificationType, NotificationPriority } from '@shared/schema';

// Define interfaces
interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  priority: NotificationPriority;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  sessionId?: string;
  metaData?: any;
}

interface NotificationCenterProps {
  className?: string;
  limit?: number;
}

// Style utilities
const getPriorityStyles = (priority: NotificationPriority) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-500 text-white';
    case 'low':
    default:
      return 'bg-blue-500 text-white';
  }
};

const getTypeIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'info':
      return <Info className="h-5 w-5 text-blue-500" />;
    case 'session_activity':
      return <Info className="h-5 w-5 text-purple-500" />;
    case 'user_activity':
      return <Info className="h-5 w-5 text-cyan-500" />;
    case 'system':
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
};

// Component for individual notification
const NotificationItem = ({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification, 
  onMarkAsRead: (id: number) => void 
}) => {
  const timeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diff = now.getTime() - past.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };
  
  return (
    <div 
      className={cn(
        "p-3 border-b border-gray-700 hover:bg-gray-800/50 transition-colors relative",
        !notification.read && "bg-gray-800/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getTypeIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white truncate pr-6">{notification.title}</h4>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
          {notification.details && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.details}</p>
          )}
          {notification.actionUrl && (
            <a 
              href={notification.actionUrl} 
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
            >
              Ver más
            </a>
          )}
          {!notification.read && (
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-1"
              onClick={() => onMarkAsRead(notification.id)}
              title="Marcar como leída"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {notification.priority !== 'low' && (
        <Badge 
          variant="outline" 
          className={cn("mt-2 text-xs", getPriorityStyles(notification.priority))}
        >
          {notification.priority.toUpperCase()}
        </Badge>
      )}
    </div>
  );
};

// Main notification center component
export function NotificationCenter({ className, limit = 10 }: NotificationCenterProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Queries
  const { 
    data: notifications = [], 
    isLoading,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!user,
  });
  
  const { 
    data: unreadCount = 0,
    refetch: refetchCount
  } = useQuery<number>({
    queryKey: ['/api/notifications/unread/count'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!user,
  });
  
  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/notifications/${id}/read`);
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      refetchCount();
    }
  });
  
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/notifications/read-all');
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      refetchCount();
    }
  });
  
  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };
  
  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };
  
  // Effect to refetch on window focus
  useEffect(() => {
    if (user) {
      const intervalId = setInterval(() => {
        refetchCount();
      }, 60000); // Check for new notifications every minute
      
      return () => clearInterval(intervalId);
    }
  }, [user, refetchCount]);
  
  if (!user) return null;
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[1.5rem] h-[1.5rem] bg-red-500 text-white" 
              variant="outline"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 md:w-96 bg-gray-900 border-gray-700 text-white p-0" 
        align="end"
      >
        <DropdownMenuLabel className="flex items-center justify-between py-4 px-5 border-b border-gray-700">
          <span className="text-lg font-semibold">Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400 hover:text-white"
              onClick={handleMarkAllAsRead}
            >
              Marcar todas como leídas
            </Button>
          )}
        </DropdownMenuLabel>
        <ScrollArea className="h-[50vh] max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <div className="flex justify-center mb-3">
                <Bell className="h-8 w-8 opacity-20" />
              </div>
              <p>No tienes notificaciones</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem 
          className="text-center py-2 hover:bg-gray-800 cursor-pointer transition-colors text-blue-400 hover:text-blue-300"
          onClick={() => {
            setIsOpen(false);
            // Navigate to notification preferences (you can implement this)
          }}
        >
          Preferencias de notificación
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Utility function for query fetching
function getQueryFn({ on401 = "error" }: { on401?: "error" | "returnNull" } = {}) {
  return async ({ queryKey }: { queryKey: [string, ...any[]] }) => {
    const [url, ...params] = queryKey;
    
    try {
      const res = await apiRequest("GET", url, ...params);
      
      if (res.status === 401) {
        if (on401 === "returnNull") return null;
        throw new Error("Unauthorized");
      }
      
      return await res.json();
    } catch (err) {
      console.error(`Error fetching ${url}:`, err);
      throw err;
    }
  };
}