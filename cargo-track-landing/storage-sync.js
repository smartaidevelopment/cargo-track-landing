// KV-backed localStorage sync (client-side)
(() => {
    if (typeof window === 'undefined' || !window.fetch || !window.localStorage) {
        return;
    }

    const STORAGE_API = '/api/storage';
    const PUBLIC_NAMESPACE = 'public';
    const SYNC_PREFIXES = ['cargotrack_', 'lte_', 'user_api_keys'];
    const EXTRA_KEYS = ['user_api_keys'];
    const GLOBAL_KEYS = new Set([
        'cargotrack_users',
        'cargotrack_admin_users',
        'cargotrack_security_audit',
        'cargotrack_tenants'
    ]);
    const DEVICE_LIST_KEY = 'cargotrack_devices';
    const DEVICE_REGISTRY_KEY = 'cargotrack_device_registry';
    const ALERTS_LIST_KEY = 'cargotrack_alerts';
    const ALERTS_MAX_ENTRIES = 2000;
    const EXCLUDED_KEYS = new Set(['cargotrack_auth', 'cargotrack_admin']);
    const pendingSync = new Map();
    let isApplyingServerData = false;
    let hasCompletedInitialSync = false;
    let hasScheduledAuthReadySync = false;

    const emitStorageSyncEvent = (type, detail = {}) => {
        try {
            window.dispatchEvent(new CustomEvent(type, { detail }));
        } catch (error) {
            // Ignore event dispatch issues in unsupported environments.
        }
    };

    const shouldSyncKey = (key) => {
        if (!key) return false;
        if (EXCLUDED_KEYS.has(key)) return false;
        if (EXTRA_KEYS.includes(key)) return true;
        return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
    };

    const parseLocalStorageValue = (value) => {
        if (value === null || value === undefined) return null;
        try {
            return JSON.parse(value);
        } catch (err) {
            return value;
        }
    };

    const serializeForLocalStorage = (value) => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch (err) {
            return String(value);
        }
    };

    const normalizeArray = (value) => (Array.isArray(value) ? value : []);

    const getDeviceMergeKey = (device) => {
        if (!device || typeof device !== 'object') return null;
        return device?.lte?.imei || device.id || device.deviceId || null;
    };

    const mergeDeviceListValues = (localValue, serverValue) => {
        // Treat this browser's device list as source-of-truth when present.
        // This prevents resurrecting deleted devices from stale server state.
        if (localValue !== null && localValue !== undefined) {
            return normalizeArray(localValue);
        }
        const localDevices = normalizeArray(localValue);
        const serverDevices = normalizeArray(serverValue);
        if (!localDevices.length) return serverDevices;
        if (!serverDevices.length) return localDevices;

        const mergedById = new Map();
        const upsert = (device) => {
            const key = getDeviceMergeKey(device);
            if (!key) return;
            const existing = mergedById.get(key);
            if (!existing) {
                mergedById.set(key, device);
                return;
            }
            mergedById.set(key, {
                ...device,
                ...existing,
                lte: {
                    ...(device.lte || {}),
                    ...(existing.lte || {})
                },
                tracker: {
                    ...(device.tracker || {}),
                    ...(existing.tracker || {})
                }
            });
        };

        serverDevices.forEach(upsert);
        localDevices.forEach(upsert);
        return Array.from(mergedById.values());
    };

    const mergeRegistryValues = (localValue, serverValue) => {
        // Keep local registry authoritative when present so removals persist on refresh.
        if (localValue !== null && localValue !== undefined) {
            return normalizeArray(localValue)
                .map((id) => String(id || '').trim())
                .filter(Boolean);
        }
        const localIds = normalizeArray(localValue);
        const serverIds = normalizeArray(serverValue);
        return Array.from(
            new Set(
                [...localIds, ...serverIds]
                    .map((id) => String(id || '').trim())
                    .filter(Boolean)
            )
        );
    };

    const parseTimestamp = (value) => {
        if (value === null || value === undefined || value === '') return Date.now();
        if (typeof value === 'number') {
            return Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : Date.now();
        }
        const parsed = Date.parse(String(value));
        return Number.isFinite(parsed) ? parsed : Date.now();
    };

    const normalizeAlertEntry = (entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const ts = parseTimestamp(entry.timestamp);
        const severity = ['critical', 'warning', 'info'].includes(entry.severity) ? entry.severity : 'info';
        return {
            id: String(entry.id || `alert-${ts}-${Math.random().toString(36).slice(2, 7)}`),
            title: String(entry.title || 'Alert'),
            message: String(entry.message || ''),
            severity,
            icon: String(entry.icon || 'fas fa-bell'),
            read: Boolean(entry.read),
            timestamp: new Date(ts).toISOString()
        };
    };

    const normalizeAlertList = (value) => {
        const source = Array.isArray(value) ? value : [];
        const mergedById = new Map();
        source.forEach((item) => {
            const alert = normalizeAlertEntry(item);
            if (!alert) return;
            const existing = mergedById.get(alert.id);
            if (!existing) {
                mergedById.set(alert.id, alert);
                return;
            }
            const existingTs = parseTimestamp(existing.timestamp);
            const incomingTs = parseTimestamp(alert.timestamp);
            if (incomingTs >= existingTs) {
                mergedById.set(alert.id, {
                    ...alert,
                    // Preserve unread if either source is unread.
                    read: existing.read && alert.read
                });
            } else {
                mergedById.set(alert.id, {
                    ...existing,
                    read: existing.read && alert.read
                });
            }
        });
        return Array.from(mergedById.values())
            .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp))
            .slice(0, ALERTS_MAX_ENTRIES);
    };

    const mergeAlertsValues = (localValue, serverValue) => normalizeAlertList([
        ...normalizeAlertList(localValue),
        ...normalizeAlertList(serverValue)
    ]);

    const mergeServerItemsWithLocal = (serverItems) => {
        const merged = { ...serverItems };
        const localDevices = parseLocalStorageValue(localStorage.getItem(DEVICE_LIST_KEY));
        const localRegistry = parseLocalStorageValue(localStorage.getItem(DEVICE_REGISTRY_KEY));

        if (Object.prototype.hasOwnProperty.call(merged, DEVICE_LIST_KEY)) {
            merged[DEVICE_LIST_KEY] = mergeDeviceListValues(localDevices, merged[DEVICE_LIST_KEY]);
        }

        if (Object.prototype.hasOwnProperty.call(merged, DEVICE_REGISTRY_KEY)) {
            merged[DEVICE_REGISTRY_KEY] = mergeRegistryValues(localRegistry, merged[DEVICE_REGISTRY_KEY]);
        }

        if (Object.prototype.hasOwnProperty.call(merged, ALERTS_LIST_KEY)) {
            const localAlerts = parseLocalStorageValue(localStorage.getItem(ALERTS_LIST_KEY));
            merged[ALERTS_LIST_KEY] = mergeAlertsValues(localAlerts, merged[ALERTS_LIST_KEY]);
        }

        return merged;
    };

    const decodeSessionPayload = (token) => {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const body = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const pad = body.length % 4 ? '='.repeat(4 - (body.length % 4)) : '';
        try {
            const json = atob(body + pad);
            return JSON.parse(json);
        } catch (error) {
            return null;
        }
    };

    const getSessionClaims = () => {
        const token = getSessionToken();
        return decodeSessionPayload(token);
    };

    const isSessionTokenFresh = (token) => {
        const claims = decodeSessionPayload(token);
        if (!claims || !claims.exp || Number.isNaN(Number(claims.exp))) return false;
        const safetyWindowMs = 30 * 1000;
        return Number(claims.exp) > (Date.now() + safetyWindowMs);
    };

    const getSessionToken = () => {
        try {
            return localStorage.getItem('cargotrack_session_token');
        } catch (err) {
            return null;
        }
    };

    const withAuthHeaders = (headers = {}) => {
        const token = getSessionToken();
        if (!token) return headers;
        return {
            ...headers,
            Authorization: `Bearer ${token}`,
            'x-session-token': token
        };
    };

    const getLocalUserPassword = () => {
        try {
            const authRaw = localStorage.getItem('cargotrack_auth');
            if (!authRaw) return null;
            const auth = JSON.parse(authRaw);
            const email = (auth?.email || '').toString().trim();
            if (!email) return null;
            const usersRaw = localStorage.getItem('cargotrack_users');
            const users = JSON.parse(usersRaw || '[]');
            const matching = Array.isArray(users)
                ? users.find((item) => item && item.email === email && item.password)
                : null;
            return matching?.password || null;
        } catch (error) {
            return null;
        }
    };

    const refreshSessionToken = async () => {
        try {
            if (typeof window.requestSessionToken !== 'function') return false;
            const existingToken = getSessionToken();
            if (isSessionTokenFresh(existingToken)) return true;

            const existingClaims = decodeSessionPayload(existingToken);
            const storedRole = (() => { try { return localStorage.getItem('cargotrack_session_role'); } catch(e) { return null; } })();
            if (existingClaims?.role === 'admin' || existingClaims?.role === 'reseller' || storedRole === 'admin' || storedRole === 'reseller') {
                return isSessionTokenFresh(existingToken);
            }

            const authRaw = localStorage.getItem('cargotrack_auth');
            if (!authRaw) return false;
            const auth = JSON.parse(authRaw);
            const email = (auth?.email || '').toString().trim();
            if (!email) return false;
            const password = getLocalUserPassword();
            if (!password) return false;
            const result = await window.requestSessionToken('user', email, password);
            if (result && result.success) return true;
            return isSessionTokenFresh(existingToken);
        } catch (error) {
            return isSessionTokenFresh(getSessionToken());
        }
    };

    const fetchJson = async (url, options = {}) => {
        const namespaceHeader = options?.headers?.['x-storage-namespace'] || options?.headers?.['X-Storage-Namespace'] || null;
        const requiresTenantAuth = Boolean(namespaceHeader && namespaceHeader !== PUBLIC_NAMESPACE);
        if (requiresTenantAuth && !isSessionTokenFresh(getSessionToken())) {
            const refreshed = await refreshSessionToken();
            if (!refreshed) {
                throw new Error('Unauthorized');
            }
        }
        const nextOptions = {
            ...options,
            headers: withAuthHeaders(options.headers || {})
        };
        let response = await fetch(url, nextOptions);
        if (response.status === 401) {
            const refreshed = await refreshSessionToken();
            if (refreshed) {
                response = await fetch(url, {
                    ...options,
                    headers: withAuthHeaders(options.headers || {})
                });
            }
        }
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || `Request failed (${response.status})`);
        }
        return response.json();
    };

    const getNamespace = () => {
        try {
            const claims = getSessionClaims();
            if (claims?.role === 'admin' || claims?.role === 'reseller') {
                if (claims.email) {
                    return `admin:${claims.email}`;
                }
            }
            if (claims?.tenantId) {
                return `tenant:${claims.tenantId}`;
            }
            const rawUser = localStorage.getItem('cargotrack_auth');
            if (rawUser) {
                const user = JSON.parse(rawUser);
                if (user?.tenantId) {
                    return `tenant:${user.tenantId}`;
                }
                if (user?.userId) {
                    return `user:${user.userId}`;
                }
            }
        } catch (err) {
            return null;
        }
        return null;
    };

    const getNamespaceForKey = (key) => {
        if (GLOBAL_KEYS.has(key)) {
            const claims = getSessionClaims();
            if (claims?.role === 'admin' || claims?.role === 'reseller') {
                return PUBLIC_NAMESPACE;
            }
            return null;
        }
        const namespace = getNamespace();
        if (!namespace) return null;
        const token = getSessionToken();
        // Tenant/user namespaces require auth; skip background sync until token exists.
        if (!token && namespace !== PUBLIC_NAMESPACE) return null;
        // Avoid startup race where auth.js has not exposed requestSessionToken yet.
        if (namespace !== PUBLIC_NAMESPACE && typeof window.requestSessionToken !== 'function') return null;
        return namespace;
    };

    const ensureAuthReadySync = () => {
        if (hasScheduledAuthReadySync) return;
        hasScheduledAuthReadySync = true;
        const trySyncWhenReady = () => {
            const namespace = getNamespace();
            const hasToken = Boolean(getSessionToken());
            const authReady = typeof window.requestSessionToken === 'function';
            if (namespace && namespace !== PUBLIC_NAMESPACE && hasToken && authReady) {
                hasScheduledAuthReadySync = false;
                initialSync();
                return;
            }
            setTimeout(trySyncWhenReady, 250);
        };
        setTimeout(trySyncWhenReady, 250);
    };

    const postItems = async (itemsByNamespace) => {
        const namespaces = Object.keys(itemsByNamespace);
        for (const namespace of namespaces) {
            const payload = { items: itemsByNamespace[namespace] };
            await fetchJson(STORAGE_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-storage-namespace': namespace
                },
                body: JSON.stringify(payload)
            });
        }
    };

    const deleteKeys = async (keysByNamespace) => {
        const namespaces = Object.keys(keysByNamespace);
        for (const namespace of namespaces) {
            const keys = keysByNamespace[namespace];
            if (!keys.length) continue;
            await fetchJson(STORAGE_API, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-storage-namespace': namespace
                },
                body: JSON.stringify({ keys })
            });
        }
    };

    const scheduleSyncKey = (key, value) => {
        if (!shouldSyncKey(key)) return;
        const namespace = getNamespaceForKey(key);
        if (!namespace) return;
        if (pendingSync.has(key)) {
            clearTimeout(pendingSync.get(key));
        }
        const timeoutId = setTimeout(async () => {
            pendingSync.delete(key);
            try {
                await postItems({
                    [namespace]: {
                        [key]: parseLocalStorageValue(value)
                    }
                });
            } catch (err) {
                console.warn('KV sync failed:', err);
            }
        }, 200);
        pendingSync.set(key, timeoutId);
    };

    const scheduleDeleteKey = (key) => {
        if (!shouldSyncKey(key)) return;
        const namespace = getNamespaceForKey(key);
        if (!namespace) return;
        if (pendingSync.has(key)) {
            clearTimeout(pendingSync.get(key));
            pendingSync.delete(key);
        }
        setTimeout(async () => {
            try {
                await deleteKeys({ [namespace]: [key] });
            } catch (err) {
                console.warn('KV delete failed:', err);
            }
        }, 200);
    };

    const _syncSafeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { console.warn('localStorage write failed:', k, e); } };

    const applyServerData = (items) => {
        if (!items || typeof items !== 'object') return;
        isApplyingServerData = true;
        Object.entries(items).forEach(([key, value]) => {
            if (!shouldSyncKey(key)) return;
            if (key === DEVICE_LIST_KEY) {
                const localValue = parseLocalStorageValue(localStorage.getItem(DEVICE_LIST_KEY));
                const mergedValue = mergeDeviceListValues(localValue, value);
                _syncSafeSet(key, serializeForLocalStorage(mergedValue));
                return;
            }
            if (key === DEVICE_REGISTRY_KEY) {
                const localValue = parseLocalStorageValue(localStorage.getItem(DEVICE_REGISTRY_KEY));
                const mergedValue = mergeRegistryValues(localValue, value);
                _syncSafeSet(key, serializeForLocalStorage(mergedValue));
                return;
            }
            if (key === ALERTS_LIST_KEY) {
                const localValue = parseLocalStorageValue(localStorage.getItem(ALERTS_LIST_KEY));
                const mergedValue = mergeAlertsValues(localValue, value);
                _syncSafeSet(key, serializeForLocalStorage(mergedValue));
                return;
            }
            _syncSafeSet(key, serializeForLocalStorage(value));
        });
        isApplyingServerData = false;
        emitStorageSyncEvent('cargotrack:storage-sync-applied', { keys: Object.keys(items) });
    };

    const getLocalSyncItemsForNamespace = (namespace) => {
        const items = {};
        Object.keys(localStorage).forEach((key) => {
            if (!shouldSyncKey(key)) return;
            const keyNamespace = getNamespaceForKey(key);
            if (keyNamespace !== namespace) return;
            items[key] = parseLocalStorageValue(localStorage.getItem(key));
        });
        return items;
    };

    const getLocalSyncItems = () => {
        const grouped = {};
        Object.keys(localStorage).forEach((key) => {
            if (!shouldSyncKey(key)) return;
            const namespace = getNamespaceForKey(key);
            if (!namespace) return;
            if (!grouped[namespace]) grouped[namespace] = {};
            grouped[namespace][key] = parseLocalStorageValue(localStorage.getItem(key));
        });
        return grouped;
    };

    const migrateLegacyUserNamespace = async (claims, tenantNamespace) => {
        if (!claims?.userId || !tenantNamespace) return;
        const legacyNamespace = `user:${claims.userId}`;
        if (legacyNamespace === tenantNamespace) return;
        try {
            const tenantResult = await fetchJson(`${STORAGE_API}?all=true`, {
                headers: {
                    'x-storage-namespace': tenantNamespace
                }
            });
            const tenantItems = tenantResult?.items || {};
            if (Object.keys(tenantItems).length) return;
            const legacyResult = await fetchJson(`${STORAGE_API}?all=true`, {
                headers: {
                    'x-storage-namespace': legacyNamespace
                }
            });
            const legacyItems = legacyResult?.items || {};
            if (Object.keys(legacyItems).length) {
                await postItems({ [tenantNamespace]: legacyItems });
            }
        } catch (error) {
            console.warn('Legacy namespace migration failed:', error);
        }
    };

    const initialSync = async () => {
        try {
            let namespace = getNamespace();
            let claims = getSessionClaims();
            const token = getSessionToken();
            const authReady = typeof window.requestSessionToken === 'function';
            if (namespace && namespace !== PUBLIC_NAMESPACE && (!token || !authReady)) {
                ensureAuthReadySync();
                return;
            }
            if (namespace && namespace !== PUBLIC_NAMESPACE) {
                const refreshed = await refreshSessionToken();
                // Fail closed: avoid firing unauthorized storage calls with stale tokens.
                if (!refreshed) {
                    ensureAuthReadySync();
                    return;
                }
                namespace = getNamespace();
                claims = getSessionClaims();
            }
            const namespaces = [];
            if (claims?.role === 'admin' || claims?.role === 'reseller') {
                namespaces.push(PUBLIC_NAMESPACE);
            }
            if (namespace) {
                namespaces.push(namespace);
            }

            if (claims?.tenantId) {
                await migrateLegacyUserNamespace(claims, `tenant:${claims.tenantId}`);
            }

            for (const ns of namespaces) {
                const result = await fetchJson(`${STORAGE_API}?all=true`, {
                    headers: {
                        'x-storage-namespace': ns
                    }
                });
                const serverItems = result?.items || {};
                const serverKeys = Object.keys(serverItems);

                if (serverKeys.length) {
                    const mergedItems = mergeServerItemsWithLocal(serverItems);
                    applyServerData(mergedItems);
                    if (JSON.stringify(mergedItems) !== JSON.stringify(serverItems)) {
                        await postItems({ [ns]: mergedItems });
                    }
                    continue;
                }

                const localItems = getLocalSyncItemsForNamespace(ns);
                if (Object.keys(localItems).length) {
                    await postItems({ [ns]: localItems });
                }
            }
        } catch (err) {
            console.warn('KV initial sync failed:', err);
        } finally {
            hasCompletedInitialSync = true;
            emitStorageSyncEvent('cargotrack:storage-sync-complete', { initial: true });
        }
    };

    const patchLocalStorage = () => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        const originalRemoveItem = localStorage.removeItem.bind(localStorage);

        localStorage.setItem = (key, value) => {
            originalSetItem(key, value);
            if (isApplyingServerData) return;
            if (key === 'cargotrack_auth' || key === 'cargotrack_admin') {
                initialSync();
            }
            scheduleSyncKey(key, value);
        };

        localStorage.removeItem = (key) => {
            originalRemoveItem(key);
            if (isApplyingServerData) return;
            if (key === 'cargotrack_auth' || key === 'cargotrack_admin') {
                initialSync();
            }
            scheduleDeleteKey(key);
        };
    };

    patchLocalStorage();
    // Run on next tick so auth.js can finish loading first.
    setTimeout(initialSync, 0);

    window.AurionStorageSync = {
        refresh: initialSync,
        getLocalSyncItems,
        hasCompletedInitialSync: () => hasCompletedInitialSync
    };
})();
