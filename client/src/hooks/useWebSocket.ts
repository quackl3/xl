import { useState, useEffect, useCallback, useRef } from 'react';
import { createSocketConnection } from '@/utils/websocket';

export const useWebSocket = (path: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Create socket connection
  useEffect(() => {
    const createConnection = () => {
      const ws = createSocketConnection(path);
      
      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      });
      
      ws.addEventListener('close', (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        setConnected(false);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const timeout = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
          console.log(`Attempting to reconnect in ${timeout}ms...`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            createConnection();
          }, timeout);
        } else {
          console.error('Maximum reconnection attempts reached.');
        }
      });
      
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      setSocket(ws);
    };
    
    createConnection();
    
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [path]);

  // Send message function
  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, [socket]);

  return { socket, connected, sendMessage };
};
