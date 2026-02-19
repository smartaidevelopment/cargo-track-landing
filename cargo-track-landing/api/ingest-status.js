const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();

async function findImeiForDevice(deviceId) {
    try {
        const namespaces = await redis.smembers('storage:namespaces');
        for (const ns of namespaces) {
            const raw = await redis.get(`storage:${ns}:cargotrack_devices`);
            const devices = Array.isArray(parseJsonValue(raw)) ? parseJsonValue(raw) : [];
            const match = devices.find((d) => d.id === deviceId);
            if (match && match.lte?.imei) return match.lte.imei;
        }
    } catch (_) {}
    return null;
}

const NAMESPACES_SET = 'storage:namespaces';
const DEVICES_KEY = 'cargotrack_devices';
const buildStorageKey = (namespace, key) => `storage:${namespace}:${key}`;
const parseJsonValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return null; }
};

module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const deviceId = (req.query?.deviceId || '').toString().trim();
    if (!deviceId) {
        return res.status(400).json({ error: 'deviceId query parameter is required' });
    }

    if (req.method === 'POST') {
        return handleFix(req, res, deviceId);
    }

    const checks = {
        deviceId,
        ingestTokenConfigured: false,
        tenantMapping: null,
        tenantId: null,
        latestData: null,
        dataAge: null,
        dataAgeLabel: null,
        inDevicesSet: false,
        registryStatus: null,
        pipelineStatus: 'unknown'
    };

    try {
        checks.ingestTokenConfigured = !!process.env.LTE_INGEST_TOKEN;

        const tenantId = await redis.get(`device:tenant:${deviceId}`);
        checks.tenantId = tenantId ? String(tenantId) : null;
        checks.tenantMapping = !!tenantId;

        if (checks.tenantId) {
            const registrySetKey = `storage:set:tenant:${checks.tenantId}:cargotrack_device_registry`;
            const members = await redis.smembers(registrySetKey);
            const inRegistry = Array.isArray(members) && members.map(String).includes(deviceId);
            checks.registryStatus = inRegistry ? 'registered' : 'not_in_registry';
        } else {
            checks.registryStatus = 'no_tenant';
        }

        let latest = await redis.get(`device:latest:${deviceId}`);
        if (!latest || typeof latest !== 'object') {
            const deviceImei = await findImeiForDevice(deviceId);
            if (deviceImei) {
                latest = await redis.get(`device:latest:${deviceImei}`);
                checks.resolvedVia = 'imei';
                checks.imei = deviceImei;
            }
        }
        if (latest && typeof latest === 'object') {
            checks.latestData = {
                timestamp: latest.timestamp || latest.updatedAt || null,
                latitude: latest.latitude,
                longitude: latest.longitude,
                battery: latest.battery,
                temperature: latest.temperature,
                speed: latest.speed,
                satellites: latest.satellites,
                rssi: latest.rssi
            };
            const ts = Date.parse(latest.updatedAt || latest.timestamp);
            if (Number.isFinite(ts)) {
                const ageMs = Date.now() - ts;
                checks.dataAge = ageMs;
                if (ageMs < 60000) checks.dataAgeLabel = `${Math.round(ageMs / 1000)}s ago`;
                else if (ageMs < 3600000) checks.dataAgeLabel = `${Math.round(ageMs / 60000)}m ago`;
                else if (ageMs < 86400000) checks.dataAgeLabel = `${Math.round(ageMs / 3600000)}h ago`;
                else checks.dataAgeLabel = `${Math.round(ageMs / 86400000)}d ago`;
            }
        }

        let devicesSet = await redis.sismember('devices:latest', deviceId);
        if (!devicesSet && checks.imei) {
            devicesSet = await redis.sismember('devices:latest', checks.imei);
        }
        checks.inDevicesSet = !!devicesSet;

        if (!checks.ingestTokenConfigured) {
            checks.pipelineStatus = 'misconfigured';
        } else if (!checks.tenantMapping) {
            checks.pipelineStatus = 'not_registered';
        } else if (!checks.latestData) {
            checks.pipelineStatus = 'awaiting_data';
        } else if (checks.dataAge !== null && checks.dataAge < 300000) {
            checks.pipelineStatus = 'connected';
        } else if (checks.dataAge !== null && checks.dataAge < 3600000) {
            checks.pipelineStatus = 'stale';
        } else {
            checks.pipelineStatus = 'inactive';
        }

        return res.status(200).json(checks);
    } catch (error) {
        console.error('Ingest status check failed:', error);
        return res.status(500).json({ error: 'Diagnostics check failed' });
    }
};

async function handleFix(req, res, deviceId) {
    try {
        const namespaces = await redis.smembers(NAMESPACES_SET);
        let foundTenantId = null;
        let foundImei = null;

        for (const ns of namespaces) {
            const raw = await redis.get(buildStorageKey(ns, DEVICES_KEY));
            const devices = Array.isArray(parseJsonValue(raw)) ? parseJsonValue(raw) : [];
            const match = devices.find((d) => d.id === deviceId);
            if (match) {
                if (ns.startsWith('tenant:')) {
                    foundTenantId = ns.replace('tenant:', '');
                } else if (match.tenantId) {
                    foundTenantId = match.tenantId;
                }
                foundImei = match.lte?.imei || null;
                break;
            }
        }

        if (!foundTenantId) {
            return res.status(404).json({ error: 'Could not determine tenant for this device. Ensure the device is assigned to a tenant namespace.' });
        }

        const REGISTRY_KEY = 'cargotrack_device_registry';
        const registrySetKey = `storage:set:tenant:${foundTenantId}:${REGISTRY_KEY}`;
        const ops = [
            redis.set(`device:tenant:${deviceId}`, foundTenantId),
            redis.sadd(registrySetKey, deviceId)
        ];
        if (foundImei) {
            ops.push(redis.set(`device:tenant:${foundImei}`, foundTenantId));
            ops.push(redis.sadd(registrySetKey, foundImei));
        }
        await Promise.all(ops);

        const members = await redis.smembers(registrySetKey);
        const registryKey = buildStorageKey(`tenant:${foundTenantId}`, REGISTRY_KEY);
        await redis.set(registryKey, JSON.stringify(Array.from(new Set(members.map(String)))));

        return res.status(200).json({
            ok: true,
            deviceId,
            tenantId: foundTenantId,
            imei: foundImei,
            message: 'Device registered to tenant successfully'
        });
    } catch (error) {
        console.error('Ingest status fix failed:', error);
        return res.status(500).json({ error: 'Failed to fix device registration' });
    }
}
