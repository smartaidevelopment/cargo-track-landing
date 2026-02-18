const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
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

        const latest = await redis.get(`device:latest:${deviceId}`);
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

        const devicesSet = await redis.sismember('devices:latest', deviceId);
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
