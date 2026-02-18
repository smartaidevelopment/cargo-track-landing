const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = Redis.fromEnv();
const DEVICE_REGISTRY_KEY = 'cargotrack_device_registry';
const INGEST_RETRY_ATTEMPTS = 3;
const MAX_DEVICE_ID_LENGTH = 128;
const buildDeviceTenantKey = (deviceId) => `device:tenant:${deviceId}`;
const buildStorageKey = (namespace, key) => `storage:${namespace}:${key}`;
const buildRegistrySetKey = (namespace) => `storage:set:${namespace}:${DEVICE_REGISTRY_KEY}`;

const toFixedHash = (v) => crypto.createHash('sha256').update(String(v ?? '')).digest();
const safeTokenEqual = (a, b) => {
    try { return crypto.timingSafeEqual(toFixedHash(a), toFixedHash(b)); } catch (_) { return false; }
};

function parseJsonBody(body) {
    if (!body) return null;
    if (typeof body === 'object') return body;
    if (typeof body !== 'string') return null;
    try {
        return JSON.parse(body);
    } catch (error) {
        const params = new URLSearchParams(body);
        if ([...params.keys()].length === 0) return null;
        return Object.fromEntries(params.entries());
    }
}

function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function getFirstValue(obj, keys) {
    for (const key of keys) {
        const value = key.includes('.') ? getNestedValue(obj, key) : obj[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
}

function toNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatitude(latitude) {
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

function isValidLongitude(longitude) {
    return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

async function withRetry(operation, attempts = INGEST_RETRY_ATTEMPTS) {
    let lastError = null;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (i < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
            }
        }
    }
    throw lastError;
}

function normalizeTemperature(value) {
    if (value === null || value === undefined) return null;
    const numeric = toNumber(value);
    if (numeric === null) return null;
    const magnitude = Math.abs(numeric);
    if (magnitude > 1000) return numeric / 1000;
    if (magnitude > 200) return numeric / 10;
    if (magnitude > 100) return numeric / 10;
    return numeric;
}

function normalizeHumidity(value) {
    if (value === null || value === undefined) return null;
    const numeric = toNumber(value);
    if (numeric === null) return null;
    const magnitude = Math.abs(numeric);
    if (magnitude > 1000) return numeric / 1000;
    if (magnitude > 100) return numeric / 10;
    return numeric;
}

function normalizeBattery(value) {
    if (value === null || value === undefined) return null;
    let numeric = toNumber(value);
    if (numeric === null) return null;
    let magnitude = Math.abs(numeric);
    if (magnitude > 1000) {
        magnitude = magnitude / 100;
    } else if (magnitude > 100) {
        magnitude = magnitude / 10;
    }
    if (magnitude > 100) magnitude = 100;
    return Math.round(magnitude * 10) / 10;
}

function normalizeTimestamp(value, fallbackIso) {
    if (value === null || value === undefined || value === '') return fallbackIso;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return fallbackIso;
        const ms = value < 1e12 ? value * 1000 : value;
        return new Date(ms).toISOString();
    }

    const raw = String(value).trim();
    if (!raw) return fallbackIso;

    if (/^\d+(\.\d+)?$/.test(raw)) {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) return fallbackIso;
        const ms = numeric < 1e12 ? numeric * 1000 : numeric;
        return new Date(ms).toISOString();
    }

    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
    }
    return fallbackIso;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const token = process.env.LTE_INGEST_TOKEN;
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerToken = req.headers['x-ingest-token'] || '';
    console.log('[ingest] request received', {
        hasBearer: Boolean(bearerToken),
        hasHeaderToken: Boolean(headerToken)
    });

    if (!token) {
        console.error('[ingest] LTE_INGEST_TOKEN is not configured');
        res.status(503).json({ error: 'Ingest misconfigured' });
        return;
    }

    if (!safeTokenEqual(bearerToken, token) && !safeTokenEqual(headerToken, token)) {
        console.log('[ingest] unauthorized');
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const callerIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const rlKey = `rl:ingest:${callerIp}`;
    const rlCount = await redis.incr(rlKey);
    if (rlCount === 1) await redis.expire(rlKey, 60);
    if (rlCount > 120) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const payload = parseJsonBody(req.body);
    if (!payload) {
        console.log('[ingest] invalid payload');
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
    }

    const deviceIdRaw = getFirstValue(payload, [
        'deviceId',
        'device_id',
        'device.id',
        'trackerId',
        'tracker_id',
        'id',
        'imei',
        'serial',
        'serialNumber'
    ]);
    const deviceId = deviceIdRaw ? deviceIdRaw.toString().trim() : '';
    console.log('[ingest] parsed payload', {
        deviceId,
        imei: payload.imei ? String(payload.imei).trim() : null
    });

    const latitude = toNumber(getFirstValue(payload, [
        'latitude',
        'lat',
        'location.lat',
        'location.latitude',
        'gps.lat',
        'gps.latitude',
        'position.lat',
        'position.latitude'
    ]));
    const longitude = toNumber(getFirstValue(payload, [
        'longitude',
        'lng',
        'lon',
        'long',
        'location.lng',
        'location.longitude',
        'gps.lng',
        'gps.longitude',
        'position.lng',
        'position.longitude'
    ]));

    if (!deviceId || deviceId.length > MAX_DEVICE_ID_LENGTH) {
        console.log('[ingest] missing required fields', {
            deviceId,
            latitude,
            longitude
        });
        res.status(400).json({ error: 'Valid deviceId is required' });
        return;
    }
    const hasCoordinates = latitude !== null && longitude !== null;
    if (hasCoordinates && (!isValidLatitude(latitude) || !isValidLongitude(longitude))) {
        res.status(400).json({ error: 'Invalid coordinates' });
        return;
    }

    const now = new Date().toISOString();
    const imeiValue = payload.imei ? payload.imei.toString().trim() : '';
    const persistedIds = Array.from(new Set([deviceId, imeiValue].filter(Boolean)));
    const tenantFromPayload = getFirstValue(payload, ['tenantId', 'tenant_id']);
    const payloadTenantId = tenantFromPayload ? tenantFromPayload.toString().trim() : '';
    let tenantId = '';
    try {
        let mapped = await redis.get(buildDeviceTenantKey(deviceId));
        if (!mapped && imeiValue) {
            mapped = await redis.get(buildDeviceTenantKey(imeiValue));
        }
        tenantId = mapped ? mapped.toString() : '';
    } catch (error) {
        tenantId = '';
    }
    if (!tenantId) {
        res.status(409).json({ error: 'Device is not registered to a tenant' });
        return;
    }
    if (payloadTenantId && tenantId !== payloadTenantId) {
        res.status(403).json({ error: 'Tenant mismatch for device' });
        return;
    }
    try {
        await Promise.all(persistedIds.map((id) => withRetry(() => redis.set(buildDeviceTenantKey(id), tenantId))));
        const namespace = `tenant:${tenantId}`;
        const registryKey = buildStorageKey(namespace, DEVICE_REGISTRY_KEY);
        const registrySetKey = buildRegistrySetKey(namespace);
        await withRetry(() => redis.sadd(registrySetKey, ...persistedIds));
        const registryMembers = await withRetry(() => redis.smembers(registrySetKey));
        const registry = Array.from(new Set((Array.isArray(registryMembers) ? registryMembers : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        await withRetry(() => redis.set(registryKey, JSON.stringify(registry)));
    } catch (error) {
        console.error('[ingest] failed tenant/registry update', { deviceId, tenantId, error: error?.message || error });
        res.status(503).json({ error: 'Failed to persist tenant registry mapping' });
        return;
    }
    const record = {
        deviceId,
        imei: imeiValue || null,
        tenantId: tenantId || null,
        latitude: hasCoordinates ? latitude : null,
        longitude: hasCoordinates ? longitude : null,
        timestamp: normalizeTimestamp(getFirstValue(payload, [
            'timestamp',
            'time',
            'ts',
            'gps_time',
            'gpsTime',
            'reportedAt'
        ]), now),
        battery: normalizeBattery(getFirstValue(payload, [
            'battery',
            'batteryLevel',
            'battery_level',
            'batteryPct',
            'battery_pct'
        ])),
        temperature: normalizeTemperature(getFirstValue(payload, [
            'temperature',
            'temp',
            'temp_c',
            'temperature_c',
            'sensors.temperature',
            'sensor.temperature'
        ])),
        humidity: normalizeHumidity(getFirstValue(payload, [
            'humidity',
            'hum',
            'rh',
            'relativeHumidity',
            'relative_humidity',
            'sensors.humidity',
            'sensor.humidity'
        ])),
        collision: toNumber(getFirstValue(payload, [
            'collision',
            'collisionG',
            'impact',
            'impactG',
            'shock',
            'shockG',
            'gForce',
            'g_force'
        ])),
        tilt: toNumber(getFirstValue(payload, [
            'tilt',
            'tiltAngle',
            'tilt_angle',
            'angle',
            'orientation.tilt'
        ])),
        rssi: toNumber(getFirstValue(payload, [
            'rssi',
            'signal',
            'signalStrength',
            'signal_strength'
        ])),
        speed: toNumber(getFirstValue(payload, [
            'speed',
            'gps.speed',
            'location.speed'
        ])),
        heading: toNumber(getFirstValue(payload, [
            'heading',
            'course',
            'bearing'
        ])),
        accuracy: toNumber(getFirstValue(payload, [
            'accuracy',
            'gps.accuracy',
            'location.accuracy'
        ])),
        satellites: toNumber(getFirstValue(payload, [
            'satellites',
            'sat',
            'gps.satellites'
        ])),
        updatedAt: now
    };

    try {
        await Promise.all(
            persistedIds.map((id) =>
                withRetry(() =>
                    redis.set(`device:latest:${id}`, {
                        ...record,
                        // Preserve canonical tracker ID from payload so alias
                        // records (e.g. IMEI keys) can still resolve back to
                        // the true telemetry history key.
                        deviceId,
                        id
                    })
                )
            )
        );
        await withRetry(() => redis.sadd('devices:latest', ...persistedIds));
        const retentionDays = Number.parseInt(process.env.HISTORY_RETENTION_DAYS || '90', 10);
        const retentionMs = Number.isFinite(retentionDays) && retentionDays > 0
            ? retentionDays * 24 * 60 * 60 * 1000
            : 90 * 24 * 60 * 60 * 1000;
        const ts = Date.parse(record.timestamp) || Date.now();
        if (hasCoordinates) {
            const historyKey = `device:history:${deviceId}`;
            const historyPoint = {
                id: `${deviceId}-${ts}`,
                deviceId,
                latitude: record.latitude,
                longitude: record.longitude,
                timestamp: new Date(ts).toISOString(),
                temperature: record.temperature,
                humidity: record.humidity,
                collision: record.collision,
                tilt: record.tilt,
                battery: record.battery,
                speed: record.speed,
                heading: record.heading,
                accuracy: record.accuracy,
                satellites: record.satellites
            };
            await withRetry(() => redis.zadd(historyKey, { score: ts, member: JSON.stringify(historyPoint) }));
            await withRetry(() => redis.zremrangebyscore(historyKey, 0, ts - retentionMs));
        }
        console.log('[ingest] persisted', {
            deviceId,
            tenantId: tenantId || null
        });
        res.status(200).json({ success: true, deviceId });
    } catch (error) {
        console.error('KV write failed:', error);
        res.status(500).json({ error: 'Failed to persist device location' });
    }
};
