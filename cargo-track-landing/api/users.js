const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();
const PUBLIC_NAMESPACE = 'public';
const USERS_KEY = 'cargotrack_users';
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

const hashPassword = (password) =>
    crypto.createHash('sha256').update(String(password)).digest('hex');

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

const loadUsers = async () => {
    const raw = await redis.get(buildKey(PUBLIC_NAMESPACE, USERS_KEY));
    return Array.isArray(decodeValue(raw)) ? decodeValue(raw) : [];
};

const saveUsers = async (users) => {
    await redis.set(buildKey(PUBLIC_NAMESPACE, USERS_KEY), JSON.stringify(users ?? []));
};

const loadTenants = async () => {
    const raw = await redis.get(buildKey(PUBLIC_NAMESPACE, TENANTS_KEY));
    return Array.isArray(decodeValue(raw)) ? decodeValue(raw) : [];
};

module.exports = async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        const users = await loadUsers();
        if (session.role === 'admin') {
            return res.status(200).json({ users });
        }
        if (session.role === 'reseller') {
            const tenants = await loadTenants();
            const resellerTenantIds = new Set(
                tenants.filter((t) => t.resellerId === session.resellerId).map((t) => t.id)
            );
            const filtered = users.filter((user) => resellerTenantIds.has(user.tenantId));
            return res.status(200).json({ users: filtered });
        }
        if (session.tenantId) {
            const filtered = users.filter((user) => user.tenantId === session.tenantId);
            return res.status(200).json({ users: filtered });
        }
        return res.status(200).json({ users: [] });
    }

    if (req.method === 'POST') {
        if (session.role !== 'admin' && session.role !== 'reseller') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const body = (await readJsonBody(req)) || {};
        const email = (body.email || '').toString().trim();
        const password = (body.password || '').toString();
        const tenantId = (body.tenantId || '').toString().trim();
        const company = (body.company || '').toString().trim();
        const planTier = (body.planTier || '').toString().trim() || 'individual';
        if (!email || !password || !tenantId) {
            return res.status(400).json({ error: 'Missing email, password, or tenantId' });
        }
        const tenants = await loadTenants();
        const tenant = tenants.find((item) => item.id === tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        if (session.role === 'reseller' && tenant.resellerId !== session.resellerId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const users = await loadUsers();
        if (users.some((user) => user.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const user = {
            id: `u-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            email,
            password: hashPassword(password),
            company: company || tenant.name,
            phone: body.phone || '',
            package: body.package || planTier,
            planTier,
            role: 'user',
            tenantId,
            resellerId: tenant.resellerId || null,
            devices: body.devices || 1,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        users.push(user);
        await saveUsers(users);
        return res.status(200).json({ user });
    }

    if (req.method === 'DELETE') {
        if (session.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const userId = (req.query?.userId || '').toString().trim();
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        const users = await loadUsers();
        const idx = users.findIndex((u) => u.id === userId);
        if (idx === -1) {
            return res.status(404).json({ error: 'User not found' });
        }
        const deletedUser = users[idx];
        users.splice(idx, 1);
        await saveUsers(users);

        let deletedTenantId = null;
        if (deletedUser.tenantId) {
            const otherUsersInTenant = users.some((u) => u.tenantId === deletedUser.tenantId);
            if (!otherUsersInTenant) {
                const tenants = await loadTenants();
                const filteredTenants = tenants.filter((t) => t.id !== deletedUser.tenantId);
                if (filteredTenants.length !== tenants.length) {
                    await redis.set(buildKey(PUBLIC_NAMESPACE, TENANTS_KEY), JSON.stringify(filteredTenants));
                    deletedTenantId = deletedUser.tenantId;
                    const ns = `tenant:${deletedUser.tenantId}`;
                    const NAMESPACES_SET = 'storage:namespaces';
                    try {
                        const nsKeys = [
                            buildKey(ns, 'cargotrack_devices'),
                            buildKey(ns, 'cargotrack_alerts'),
                            buildKey(ns, 'cargotrack_invoices'),
                            buildKey(ns, 'cargotrack_payments')
                        ];
                        await Promise.all(nsKeys.map((k) => redis.del(k)));
                        await redis.srem(NAMESPACES_SET, ns);
                    } catch (cleanupErr) {
                        console.warn('Tenant namespace cleanup partial failure:', cleanupErr);
                    }
                }
            }
        }

        return res.status(200).json({ ok: true, deletedTenantId });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
};
