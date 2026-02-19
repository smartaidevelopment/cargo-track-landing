const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();
const NAMESPACES_SET = 'storage:namespaces';
const PUBLIC_NAMESPACE = 'public';
const TENANTS_KEY = 'cargotrack_tenants';
const DEVICES_KEY = 'cargotrack_devices';

const buildStorageKey = (namespace, key) => `storage:${namespace}:${key}`;

const parseJsonValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
};

const loadPublicUsers = async () => {
    const raw = await redis.get(buildStorageKey(PUBLIC_NAMESPACE, 'cargotrack_users'));
    const parsed = parseJsonValue(raw);
    if (Array.isArray(parsed)) return parsed;
    const legacy = await redis.get('cargotrack_users');
    const legacyParsed = parseJsonValue(legacy);
    return Array.isArray(legacyParsed) ? legacyParsed : [];
};

const loadTenants = async () => {
    const raw = await redis.get(buildStorageKey(PUBLIC_NAMESPACE, TENANTS_KEY));
    const parsed = parseJsonValue(raw);
    return Array.isArray(parsed) ? parsed : [];
};

const readJsonBody = (req) =>
    new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 50000) reject(new Error('Body too large'));
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });

const authorizeAdmin = (req) => {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== 'admin' && session.role !== 'reseller')) return null;
    return session;
};

module.exports = async (req, res) => {
    const session = authorizeAdmin(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        return handleGet(req, res, session);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
        return handleSave(req, res, session);
    }
    if (req.method === 'DELETE') {
        return handleDelete(req, res, session);
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
};

async function handleGet(req, res, session) {
    try {
        let tenants = await loadTenants();
        if (session.role === 'reseller') {
            tenants = tenants.filter((tenant) => tenant.resellerId === session.resellerId);
        }
        const registeredNamespaces = await redis.smembers(NAMESPACES_SET);

        const tenantNamespaces = (tenants || []).map((tenant) => `tenant:${tenant.id}`);
        const userNamespaces = registeredNamespaces.filter((ns) => ns.startsWith('user:'));
        const allCandidates = [...new Set([...tenantNamespaces, ...userNamespaces])];
        const availableNamespaces = allCandidates.filter((ns) => registeredNamespaces.includes(ns));

        if (!availableNamespaces.length) {
            return res.status(200).json({ devices: [] });
        }

        const users = await loadPublicUsers();
        const userMap = new Map(users.map((user) => [user.id, user]));
        const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));

        const devicesByNamespace = await Promise.all(
            availableNamespaces.map(async (namespace) => {
                const raw = await redis.get(buildStorageKey(namespace, DEVICES_KEY));
                const parsed = parseJsonValue(raw);
                if (!Array.isArray(parsed)) return [];

                let tenantId = null;
                let tenantName = null;
                let ownerUserId = null;
                if (namespace.startsWith('tenant:')) {
                    tenantId = namespace.replace('tenant:', '');
                    const tenant = tenantMap.get(tenantId);
                    tenantName = tenant?.name || null;
                } else if (namespace.startsWith('user:')) {
                    ownerUserId = namespace.replace('user:', '');
                    const owner = userMap.get(ownerUserId);
                    if (owner?.tenantId) {
                        tenantId = owner.tenantId;
                        const tenant = tenantMap.get(tenantId);
                        tenantName = tenant?.name || null;
                    }
                }

                return parsed.map((device) => ({
                    ...device,
                    ownerNamespace: namespace,
                    ownerId: device.ownerId || ownerUserId || null,
                    tenantId: tenantId || device.tenantId || null,
                    tenantName: tenantName || device.tenantName || null
                }));
            })
        );

        const devices = devicesByNamespace.flat();
        if (!devices.length) {
            return res.status(200).json({ devices: [] });
        }

        const ids = devices.map((device) => device.id).filter(Boolean);
        const imeis = devices.map((device) => device.lte?.imei).filter(Boolean);
        const allLookupIds = [...new Set([...ids, ...imeis])];
        const kvKeys = allLookupIds.map((id) => `device:latest:${id}`);
        const kvRecords = kvKeys.length ? await redis.mget(...kvKeys) : [];
        const kvMap = new Map();
        kvRecords.forEach((record) => {
            if (record && record.deviceId) {
                kvMap.set(record.deviceId, record);
                if (record.imei) kvMap.set(record.imei, record);
            }
        });

        const merged = devices.map((device) => {
            const live = kvMap.get(device.id) || (device.lte?.imei ? kvMap.get(device.lte.imei) : null);
            const owner = device.ownerId ? userMap.get(device.ownerId) : null;
            return {
                ...device,
                ownerEmail: owner ? owner.email : device.ownerEmail || null,
                ownerCompany: owner ? owner.company : device.ownerCompany || null,
                latitude: live?.latitude ?? device.latitude ?? null,
                longitude: live?.longitude ?? device.longitude ?? null,
                temperature: live?.temperature ?? device.temperature ?? null,
                humidity: live?.humidity ?? device.humidity ?? null,
                battery: live?.battery ?? device.battery ?? null,
                signalStrength: live?.rssi ? `${live.rssi} dBm` : device.signalStrength ?? null,
                lastUpdate: live?.timestamp ?? device.lastUpdate ?? null
            };
        });

        const REGISTRY_KEY = 'cargotrack_device_registry';
        const mappingOps = [];
        devices.forEach((device) => {
            const tid = device.tenantId;
            if (!tid || !device.id) return;
            mappingOps.push(redis.set(`device:tenant:${device.id}`, tid));
            const imei = device.lte?.imei;
            if (imei) mappingOps.push(redis.set(`device:tenant:${imei}`, tid));
            const setKey = `storage:set:tenant:${tid}:${REGISTRY_KEY}`;
            mappingOps.push(redis.sadd(setKey, device.id));
            if (imei) mappingOps.push(redis.sadd(setKey, imei));
        });
        if (mappingOps.length) {
            Promise.all(mappingOps).catch((err) => console.warn('Background tenant mapping sync:', err));
        }

        return res.status(200).json({ devices: merged });
    } catch (error) {
        console.error('Admin devices fetch failed:', error);
        return res.status(500).json({ error: 'Failed to fetch admin devices' });
    }
}

async function handleSave(req, res, session) {
    try {
        const body = await readJsonBody(req);
        const { namespace, device } = body || {};
        if (!namespace || !device || !device.id || !device.name) {
            return res.status(400).json({ error: 'namespace, device.id, and device.name are required' });
        }

        const key = buildStorageKey(namespace, DEVICES_KEY);
        const raw = await redis.get(key);
        const existing = Array.isArray(parseJsonValue(raw)) ? parseJsonValue(raw) : [];

        const idx = existing.findIndex((d) => d.id === device.id);
        const now = new Date().toISOString();

        if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...device, updatedAt: now };
        } else {
            existing.push({ ...device, createdAt: now, updatedAt: now });
        }

        await redis.set(key, JSON.stringify(existing));
        await redis.sadd(NAMESPACES_SET, namespace);

        let tenantId = null;
        if (namespace.startsWith('tenant:')) {
            tenantId = namespace.replace('tenant:', '');
        } else if (device.tenantId) {
            tenantId = device.tenantId;
        }
        if (tenantId) {
            const deviceIds = [device.id];
            const imei = device.lte?.imei;
            if (imei) deviceIds.push(imei);
            const REGISTRY_KEY = 'cargotrack_device_registry';
            const registrySetKey = `storage:set:tenant:${tenantId}:${REGISTRY_KEY}`;
            await Promise.all([
                ...deviceIds.map((id) => redis.set(`device:tenant:${id}`, tenantId)),
                redis.sadd(registrySetKey, ...deviceIds),
                redis.set(buildStorageKey(`tenant:${tenantId}`, REGISTRY_KEY),
                    JSON.stringify(Array.from(new Set(
                        [...(await redis.smembers(registrySetKey) || []).map(String), ...deviceIds]
                    ))))
            ]);
        }

        return res.status(200).json({ ok: true, device: existing[idx >= 0 ? idx : existing.length - 1] });
    } catch (error) {
        console.error('Admin device save failed:', error);
        return res.status(500).json({ error: 'Failed to save device' });
    }
}

async function handleDelete(req, res, session) {
    try {
        const body = await readJsonBody(req);
        const { namespace, deviceId } = body || {};
        if (!namespace || !deviceId) {
            return res.status(400).json({ error: 'namespace and deviceId are required' });
        }

        const key = buildStorageKey(namespace, DEVICES_KEY);
        const raw = await redis.get(key);
        const existing = Array.isArray(parseJsonValue(raw)) ? parseJsonValue(raw) : [];
        const filtered = existing.filter((d) => d.id !== deviceId);

        if (filtered.length === existing.length) {
            return res.status(404).json({ error: 'Device not found' });
        }

        await redis.set(key, JSON.stringify(filtered));
        await redis.del(`device:latest:${deviceId}`);
        return res.status(200).json({ ok: true, deleted: deviceId });
    } catch (error) {
        console.error('Admin device delete failed:', error);
        return res.status(500).json({ error: 'Failed to delete device' });
    }
}
