const { kv } = require('@vercel/kv');

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

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const token = process.env.LTE_INGEST_TOKEN;
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerToken = req.headers['x-ingest-token'] || '';

    if (token && bearerToken !== token && headerToken !== token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const payload = parseJsonBody(req.body);
    if (!payload) {
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

    if (!deviceId || latitude === null || longitude === null) {
        res.status(400).json({ error: 'deviceId, latitude, and longitude are required' });
        return;
    }

    const now = new Date().toISOString();
    const record = {
        deviceId,
        imei: payload.imei ? payload.imei.toString().trim() : null,
        latitude,
        longitude,
        timestamp: getFirstValue(payload, [
            'timestamp',
            'time',
            'ts',
            'gps_time',
            'gpsTime',
            'reportedAt'
        ]) || now,
        battery: toNumber(getFirstValue(payload, [
            'battery',
            'batteryLevel',
            'battery_level',
            'batteryPct',
            'battery_pct'
        ])),
        temperature: toNumber(getFirstValue(payload, [
            'temperature',
            'temp',
            'temp_c',
            'temperature_c',
            'sensors.temperature',
            'sensor.temperature'
        ])),
        humidity: toNumber(getFirstValue(payload, [
            'humidity',
            'hum',
            'rh',
            'relativeHumidity',
            'relative_humidity',
            'sensors.humidity',
            'sensor.humidity'
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
        await kv.set(`device:latest:${deviceId}`, record);
        await kv.sadd('devices:latest', deviceId);
        res.status(200).json({ success: true, deviceId });
    } catch (error) {
        console.error('KV write failed:', error);
        res.status(500).json({ error: 'Failed to persist device location' });
    }
};
