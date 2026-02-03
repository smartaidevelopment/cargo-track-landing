const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        let ids = [];
        if (req.query && req.query.ids) {
            const raw = Array.isArray(req.query.ids) ? req.query.ids.join(',') : req.query.ids;
            ids = raw.split(',').map(id => id.trim()).filter(Boolean);
        } else {
            ids = await kv.smembers('devices:latest');
        }

        if (!ids || ids.length === 0) {
            res.status(200).json({ devices: [] });
            return;
        }

        const keys = ids.map(id => `device:latest:${id}`);
        const records = await kv.mget(...keys);
        const devices = (records || []).filter(Boolean);

        res.status(200).json({ devices });
    } catch (error) {
        console.error('KV read failed:', error);
        res.status(500).json({ error: 'Failed to fetch device locations' });
    }
};
