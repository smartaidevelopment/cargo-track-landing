const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();
const PUBLIC_NAMESPACE = 'public';
const TENANTS_KEY = 'cargotrack_tenants';

const buildKey = (namespace, key) => `storage:${namespace}:${key}`;

const decodeValue = (raw) => {
    if (raw === null || raw === undefined) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return raw;
    }
};

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

const loadTenants = async () => {
    const raw = await redis.get(buildKey(PUBLIC_NAMESPACE, TENANTS_KEY));
    return Array.isArray(decodeValue(raw)) ? decodeValue(raw) : [];
};

const saveTenants = async (tenants) => {
    await redis.set(buildKey(PUBLIC_NAMESPACE, TENANTS_KEY), JSON.stringify(tenants ?? []));
};

module.exports = async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        const tenants = await loadTenants();
        if (session.role === 'admin') {
            return res.status(200).json({ tenants });
        }
        if (session.role === 'reseller') {
            const filtered = tenants.filter((tenant) => tenant.resellerId === session.resellerId);
            return res.status(200).json({ tenants: filtered });
        }
        if (session.tenantId) {
            const tenant = tenants.find((item) => item.id === session.tenantId);
            return res.status(200).json({ tenants: tenant ? [tenant] : [] });
        }
        return res.status(200).json({ tenants: [] });
    }

    if (req.method === 'POST') {
        if (session.role !== 'admin' && session.role !== 'reseller') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const body = (await readJsonBody(req)) || {};
        const name = (body.name || '').toString().trim();
        const planTier = (body.planTier || '').toString().trim() || 'individual';
        if (!name) {
            return res.status(400).json({ error: 'Missing tenant name' });
        }
        const tenants = await loadTenants();
        const tenant = {
            id: `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            planTier,
            ownerUserId: body.ownerUserId || null,
            resellerId: session.role === 'reseller' ? session.resellerId : (body.resellerId || null),
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        tenants.push(tenant);
        await saveTenants(tenants);
        return res.status(200).json({ tenant });
    }

    if (req.method === 'PUT') {
        if (session.role !== 'admin' && session.role !== 'reseller') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const body = (await readJsonBody(req)) || {};
        const tenantId = (body.id || '').toString().trim();
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant id' });
        }
        const tenants = await loadTenants();
        const idx = tenants.findIndex((t) => t.id === tenantId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        if (session.role === 'reseller' && tenants[idx].resellerId !== session.resellerId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const allowedFields = ['name', 'planTier', 'status', 'defaultCarrier', 'defaultApn', 'simProvider', 'networkNotes'];
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                tenants[idx][field] = String(body[field]).trim();
            }
        }
        tenants[idx].updatedAt = new Date().toISOString();
        await saveTenants(tenants);
        return res.status(200).json({ tenant: tenants[idx] });
    }

    if (req.method === 'DELETE') {
        if (session.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const tenantId = (req.query?.tenantId || '').toString().trim();
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenantId' });
        }
        const tenants = await loadTenants();
        const idx = tenants.findIndex((t) => t.id === tenantId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        tenants.splice(idx, 1);
        await saveTenants(tenants);
        return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,PUT,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
};
