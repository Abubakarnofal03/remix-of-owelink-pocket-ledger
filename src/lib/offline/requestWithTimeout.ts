/**
 * Utility for making network requests with timeout support.
 * Falls back to offline behavior when requests time out or fail.
 */

const DEFAULT_TIMEOUT = 5000; // 5 seconds

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the timeout period, it rejects with a timeout error.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Checks if the device has actual network connectivity by making a quick request.
 * navigator.onLine can be unreliable when network disconnects while app is open.
 */
export async function checkActualConnectivity(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    console.log('Connectivity check failed - likely offline');
    return false;
  }
}

/**
 * Executes a network request with automatic timeout and offline fallback.
 * 
 * @param networkFn - The async function that makes the network request
 * @param fallbackFn - The async function to execute if network fails or times out
 * @param options - Configuration options
 * @returns The result from networkFn on success, or fallbackFn on failure
 */
export async function withOfflineFallback<T>(
  networkFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  options: {
    timeout?: number;
    showToast?: boolean;
    toastMessage?: string;
  } = {}
): Promise<{ data: T; isOffline: boolean }> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  // Quick check - if we know we're offline, skip network request
  if (!navigator.onLine) {
    const data = await fallbackFn();
    return { data, isOffline: true };
  }

  try {
    const data = await withTimeout(networkFn(), timeout);
    return { data, isOffline: false };
  } catch (error: any) {
    console.warn('Network request failed, using offline fallback:', error.message);
    
    try {
      const data = await fallbackFn();
      return { data, isOffline: true };
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * A hook-friendly wrapper that automatically detects stale network state
 * and triggers appropriate fallback behavior.
 */
export function isLikelyOffline(): boolean {
  // First check navigator.onLine
  if (!navigator.onLine) {
    return true;
  }
  
  // Check if we have connection info (Android/Chrome)
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (connection) {
    // If connection type is 'none', we're definitely offline
    if (connection.type === 'none') {
      return true;
    }
    // If effective type is very slow, treat as potentially unreliable
    if (connection.effectiveType === 'slow-2g') {
      return true;
    }
  }
  
  return false;
}
