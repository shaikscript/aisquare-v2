const SESSION_STORAGE_KEY = 'aisquare_session_token';
const WINDOW_NAME_PREFIX = 'aisquare_sid:';

// Primary in-memory token — works 100% even when cross-origin iframes block cookies AND Web Storage
let inMemorySessionToken = null;

function readFromWindowName() {
  if (typeof window === 'undefined') return null;
  try {
    if (typeof window.name === 'string' && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      const val = window.name.slice(WINDOW_NAME_PREFIX.length).trim();
      return val || null;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function getStoredSessionToken() {
  if (inMemorySessionToken) return inMemorySessionToken;
  if (typeof window === 'undefined') return null;

  try {
    const sVal = window.sessionStorage?.getItem(SESSION_STORAGE_KEY);
    if (sVal) {
      inMemorySessionToken = sVal;
      return sVal;
    }
  } catch {
    // sessionStorage blocked in cross-origin iframe
  }

  try {
    const lVal = window.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (lVal) {
      inMemorySessionToken = lVal;
      return lVal;
    }
  } catch {
    // localStorage blocked in cross-origin iframe
  }

  const wVal = readFromWindowName();
  if (wVal) {
    inMemorySessionToken = wVal;
    return wVal;
  }

  return null;
}

export function setStoredSessionToken(token) {
  inMemorySessionToken = token || null;
  if (typeof window === 'undefined') return;

  try {
    if (token) {
      window.sessionStorage?.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage block
  }

  try {
    if (token) {
      window.localStorage?.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.localStorage?.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage block
  }

  try {
    if (token) {
      window.name = `${WINDOW_NAME_PREFIX}${token}`;
    } else if (typeof window.name === 'string' && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      window.name = '';
    }
  } catch {
    // Ignore
  }
}

export function clearStoredSessionToken() {
  setStoredSessionToken(null);
}

/**
 * Appends ?sid=<token> (or &sid=<token>) for authenticated PDF / resume iframe & download URLs
 * when running inside cookie-restricted preview iframes.
 */
export function withSessionQuery(url) {
  const token = getStoredSessionToken();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sid=${encodeURIComponent(token)}`;
}

function appendSidQuery(path, token) {
  if (!token) return path;
  // Do not attach old session token to login/bootstrap endpoints
  if (
    path.startsWith('/api/auth/admin/login') ||
    path.startsWith('/api/auth/employee/login') ||
    path.startsWith('/api/auth/bootstrap-admin')
  ) {
    return path;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}_sid=${encodeURIComponent(token)}`;
}

/**
 * Relative-URL API client (browser never calls localhost directly).
 * Transmits the session token via:
 *   1. Custom header X-AISquare-Session (immune to reverse-proxy Authorization header stripping/injection)
 *   2. Query parameter _sid (immune to all header & 3rd-party cookie stripping)
 *   3. Standard Authorization: Bearer header
 *   4. HttpOnly Cookie (credentials: 'include')
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, isFormData = false, headers = {} } = options;

  const token = getStoredSessionToken();
  const mergedHeaders = { ...headers };
  if (token) {
    mergedHeaders['X-AISquare-Session'] = token;
    if (!mergedHeaders.Authorization) {
      mergedHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const requestUrl = appendSidQuery(path, token);

  const fetchOptions = {
    method,
    credentials: 'include',
    headers: mergedHeaders,
  };

  if (body !== undefined) {
    const autoFormData =
      isFormData || (typeof FormData !== 'undefined' && body instanceof FormData);
    if (autoFormData) {
      fetchOptions.body = body;
    } else {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const response = await fetch(requestUrl, fetchOptions);
  const contentType = response.headers.get('content-type') || '';

  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && payload?.code === 'UNAUTHENTICATED') {
      const latestToken = getStoredSessionToken();
      if (!latestToken || latestToken === token) {
        clearStoredSessionToken();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new CustomEvent('aisquare:unauthenticated'));
          } catch {
            // Ignore
          }
        }
      }
    }
    const err = new Error(
      (payload && typeof payload === 'object' && payload.error) ||
        `Request failed with status ${response.status}`
    );
    err.status = response.status;
    err.code = payload?.code;
    err.payload = payload;
    throw err;
  }

  return payload;
}
