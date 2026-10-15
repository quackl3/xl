/**
 * Creates a WebSocket connection to the server with the proper protocol
 * @param path The WebSocket endpoint path
 * @returns A new WebSocket instance
 */
export function createSocketConnection(path: string): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}${path}`;
  return new WebSocket(wsUrl);
}
