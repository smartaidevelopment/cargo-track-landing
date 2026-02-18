const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const { issueSessionToken, SESSION_SECRET } = require('./_auth');
const { checkRateLimit, readJsonBodyLimited, getCallerIp } = require('./_rate-limit');

const redis = Redis.fromEnv();
const PUBLIC_NAMESPACE = 'public';
const TENANTS_KEY = 'cargotrack_tenants';
const USERS_KEY = 'cargotrack_users';
const ADMIN_USERS_KEY = 'cargotrack_admin_users';

const OWNER_ADMIN_EMAIL = (process.env.ADMIN_OWNER_EMAIL || 'smartaidevelopment@gmail.com').trim();
const OWNER_ADMIN_PASSWORD = (process.env.ADMIN_OWNER_PASSWORD || '').trim();

const buildKey = (namespace, key) => `storage:${namespace}:${key}`;

const decodeValue = (raw) => {
    if (raw === null || raw === undefined) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return raw;
    }
};

const readJsonBody = (req) => readJsonBodyLimited(req, 16 * 1024);

const getPublicValue = async (key) => {
    const namespaced = await redis.get(buildKey(PUBLIC_NAMESPACE, key));
    if (namespaced !== null) {
        return decodeValue(namespaced);
    }
    const legacy = await redis.get(key);
    return decodeValue(legacy);
};

const setPublicValue = async (key, value) => {
    await redis.set(buildKey(PUBLIC_NAMESPACE, key), JSON.stringify(value ?? null));
};

const mapPackageToTier = (value) => {
    const label = (value || '').toString().toLowerCase();
    if (label.includes('enterprise') || label.includes('large')) return 'enterprise';
    if (label.includes('pro') || label.includes('business') || label.includes('smb')) return 'smb';
    return 'individual';
};

const ensureTenantForUser = async (user) => {
    if (!user) return { user, tenant: null };
    const tenants = (await getPublicValue(TENANTS_KEY)) || [];
    if (user.tenantId) {
        const existing = Array.isArray(tenants)
            ? tenants.find((tenant) => tenant.id === user.tenantId)
            : null;
        return { user, tenant: existing || null };
    }
    const planTier = user.planTier || mapPackageToTier(user.package);
    const tenant = {
        id: `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: user.company || user.email,
        planTier,
        ownerUserId: user.id,
        resellerId: user.resellerId || null,
        createdAt: new Date().toISOString(),
        status: 'active'
    };
    const nextTenants = Array.isArray(tenants) ? [...tenants, tenant] : [tenant];
    await setPublicValue(TENANTS_KEY, nextTenants);

    const users = (await getPublicValue(USERS_KEY)) || [];
    const updatedUsers = Array.isArray(users)
        ? users.map((item) => (item.id === user.id ? { ...item, tenantId: tenant.id, planTier } : item))
        : users;
    await setPublicValue(USERS_KEY, updatedUsers);

    return { user: { ...user, tenantId: tenant.id, planTier }, tenant };
};

const toFixedLengthHash = (value) =>
    crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest();

const safeStringEqual = (a, b) => {
    const left = toFixedLengthHash(a);
    const right = toFixedLengthHash(b);
    return crypto.timingSafeEqual(left, right);
};

const hashPassword = (password) =>
    crypto.createHash('sha256').update(String(password)).digest('hex');

const verifyPassword = (inputPassword, storedPassword) => {
    const inputHash = hashPassword(inputPassword);
    if (safeStringEqual(storedPassword, inputHash)) return true;
    if (safeStringEqual(storedPassword, inputPassword)) return true;
    return false;
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SESSION_SECRET) {
        return res.status(500).json({ error: 'Session secret not configured' });
    }

    const ip = getCallerIp(req);
    const { allowed, remaining } = await checkRateLimit('rl:session', ip, 15, 60);
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    if (!allowed) {
        return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }

    let body;
    try {
        body = (await readJsonBody(req)) || {};
    } catch (err) {
        if (err.status === 413) return res.status(413).json({ error: 'Request body too large' });
        return res.status(400).json({ error: 'Invalid request body' });
    }
    const role = (body.role || '').toString().trim();
    const email = (body.email || '').toString().trim();
    const password = (body.password || '').toString();

    if (!role || !email || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        if (role === 'admin') {
            // Check owner admin from env var first
            if (OWNER_ADMIN_PASSWORD && safeStringEqual(email, OWNER_ADMIN_EMAIL) && safeStringEqual(password, OWNER_ADMIN_PASSWORD)) {
                const token = issueSessionToken({
                    role: 'admin',
                    email: OWNER_ADMIN_EMAIL,
                    userId: OWNER_ADMIN_EMAIL,
                    namespace: `admin:${OWNER_ADMIN_EMAIL}`,
                    planTier: 'admin'
                });
                return res.status(200).json({ token });
            }

            // Check additional admins stored in Redis (created by owner)
            const admins = (await getPublicValue(ADMIN_USERS_KEY)) || [];
            const admin = Array.isArray(admins) ? admins.find((item) => item.email === email) : null;
            if (admin && verifyPassword(password, admin.password)) {
                const token = issueSessionToken({
                    role: admin.role === 'reseller' ? 'reseller' : 'admin',
                    email: admin.email,
                    userId: admin.email,
                    namespace: `admin:${admin.email}`,
                    resellerId: admin.role === 'reseller' ? admin.email : null,
                    planTier: admin.role === 'reseller' ? 'reseller' : 'admin'
                });
                return res.status(200).json({ token });
            }

            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        if (role === 'user') {
            const users = (await getPublicValue(USERS_KEY)) || [];
            const user = Array.isArray(users) ? users.find((item) => item.email === email) : null;

            if (!user || !verifyPassword(password, user.password) || user.isActive === false) {
                return res.status(401).json({ error: 'Invalid user credentials' });
            }
            const { user: resolvedUser, tenant } = await ensureTenantForUser(user);
            const planTier = resolvedUser.planTier || (tenant ? tenant.planTier : mapPackageToTier(resolvedUser.package));
            const token = issueSessionToken({
                role: 'user',
                email: resolvedUser.email,
                userId: resolvedUser.id,
                namespace: resolvedUser.tenantId ? `tenant:${resolvedUser.tenantId}` : `user:${resolvedUser.id}`,
                tenantId: resolvedUser.tenantId || null,
                planTier: planTier || 'individual',
                resellerId: resolvedUser.resellerId || null
            });
            return res.status(200).json({
                token,
                user: {
                    id: resolvedUser.id,
                    email: resolvedUser.email,
                    company: resolvedUser.company || '',
                    phone: resolvedUser.phone || '',
                    package: resolvedUser.package || '',
                    planTier: planTier || 'individual',
                    tenantId: resolvedUser.tenantId || null,
                    role: 'user',
                    devices: resolvedUser.devices || 1,
                    isActive: true,
                    createdAt: resolvedUser.createdAt || null
                }
            });
        }

        return res.status(400).json({ error: 'Invalid role' });
    } catch (error) {
        console.error('Session issue failed:', error);
        return res.status(500).json({ error: 'Failed to issue session token' });
    }
};
