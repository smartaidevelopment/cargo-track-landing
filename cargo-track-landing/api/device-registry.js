const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();
const DEVICE_REGISTRY_KEY = 'cargotrack_device_registry';
const MAX_DEVICE_ID_LENGTH = 128;

const buildStorageKey = (namespace, key) => `storage:${namespace}:${key}`;
const buildRegistrySetKey = (namespace) => `storage:set:${namespace}:${DEVICE_REGISTRY_KEY}`;
const buildDeviceTenantKey = (deviceId) => `device:tenant:${deviceId}`;

const decodeValue = (raw) => {
    if (raw === null || raw === undefined) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return raw;
    }
};

const sanitizeDeviceIds = (ids) => Array.from(
    new Set(
        (Array.isArray(ids) ? ids : [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && id.length <= MAX_DEVICE_ID_LENGTH)
    )
);

const readJsonBody = async (req) => {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) throw Object.assign(new Error('Body too large'), { status: 413 });
        chunks.push(chunk);
    }
    if (!chunks.length) return null;
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
        return null;
    }
};

const loadRegistry = async (namespace, storageKey) => {
    const setKey = buildRegistrySetKey(namespace);
    const setMembers = sanitizeDeviceIds(await redis.smembers(setKey));
    if (setMembers.length) return setMembers;

    const raw = await redis.get(storageKey);
    const decoded = decodeValue(raw);
    const fromStorage = sanitizeDeviceIds(Array.isArray(decoded) ? decoded : []);
    if (fromStorage.length) {
        await redis.sadd(setKey, ...fromStorage);
    }
    return fromStorage;
};

module.exports = async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.tenantId) {
        if (req.method === 'GET') {
            return res.status(200).json({ deviceIds: [] });
        }
        if (req.method === 'POST' || req.method === 'DELETE') {
            return res.status(200).json({ ok: false, unauthorized: true, removed: 0, count: 0 });
        }
        return res.status(200).json({ ok: false, unauthorized: true });
    }

    const namespace = `tenant:${session.tenantId}`;
    const storageKey = buildStorageKey(namespace, DEVICE_REGISTRY_KEY);
    const planTier = (session.planTier || '').toString().toLowerCase();
    const deviceLimit = planTier.includes('enterprise')
        ? 1000
        : planTier.includes('reseller')
            ? 10000
            : planTier.includes('smb') || planTier.includes('pro') || planTier.includes('business')
                ? 25
                : 3;

    if (req.method === 'GET') {
        const deviceIds = await loadRegistry(namespace, storageKey);
        if (deviceIds.length) {
            await redis.set(storageKey, JSON.stringify(deviceIds));
        }
        return res.status(200).json({ deviceIds });
    }

    if (req.method === 'POST') {
        const body = (await readJsonBody(req)) || {};
        const ids = sanitizeDeviceIds(Array.isArray(body.deviceIds) ? body.deviceIds : []);
        if (!ids.length) {
            return res.status(400).json({ error: 'Missing deviceIds' });
        }
        const ownershipChecks = await Promise.all(
            ids.map(async (id) => ({
                id,
                tenantId: await redis.get(buildDeviceTenantKey(id))
            }))
        );
        const conflicted = ownershipChecks.find(
            (item) => item.tenantId && String(item.tenantId) !== String(session.tenantId)
        );
        if (conflicted) {
            return res.status(409).json({ error: `Device already assigned to another tenant: ${conflicted.id}` });
        }
        const setKey = buildRegistrySetKey(namespace);
        if (ids.length) {
            await redis.sadd(setKey, ...ids);
        }
        let next = sanitizeDeviceIds(await redis.smembers(setKey));
        if (next.length > deviceLimit) {
            await redis.srem(setKey, ...ids);
            next = sanitizeDeviceIds(await redis.smembers(setKey));
            return res.status(403).json({ error: 'Device limit exceeded for plan' });
        }
        await redis.set(storageKey, JSON.stringify(next));
        await Promise.all(
            ids.filter(Boolean).map((id) => redis.set(buildDeviceTenantKey(id), session.tenantId))
        );
        return res.status(200).json({ ok: true, count: next.length });
    }

    if (req.method === 'DELETE') {
        const body = (await readJsonBody(req)) || {};
        const removeIds = sanitizeDeviceIds(Array.isArray(body.deviceIds) ? body.deviceIds : []);
        const existing = await loadRegistry(namespace, storageKey);

        if (removeIds.length) {
            const existingSet = new Set(existing);
            const removableIds = removeIds.filter((id) => existingSet.has(id));
            const setKey = buildRegistrySetKey(namespace);
            if (!removableIds.length) {
                return res.status(200).json({ ok: true, removed: 0, count: existing.length });
            }
            await redis.srem(setKey, ...removableIds);
            const next = sanitizeDeviceIds(await redis.smembers(setKey));
            await redis.set(storageKey, JSON.stringify(next));
            await Promise.all(
                removableIds.map((id) => redis.del(buildDeviceTenantKey(id)))
            );
            const latestKeys = removableIds.map((id) => `device:latest:${id}`);
            const historyKeys = removableIds.map((id) => `device:history:${id}`);
            await Promise.all(
                [...latestKeys, ...historyKeys].map((key) => redis.del(key).catch(() => null))
            );
            return res.status(200).json({ ok: true, removed: removableIds.length, count: next.length });
        }
        return res.status(400).json({ error: 'deviceIds is required for delete' });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
};
