const { Redis } = require('@upstash/redis');
const { getSessionFromRequest } = require('./_auth');

const redis = Redis.fromEnv();
const PACKAGES_KEY = 'storage:public:cargotrack_packages';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET') {
        try {
            const raw = await redis.get(PACKAGES_KEY);
            const packages = typeof raw === 'string' ? JSON.parse(raw) : (raw || null);
            return res.status(200).json({ packages });
        } catch (err) {
            return res.status(500).json({ error: 'Failed to read packages' });
        }
    }

    if (req.method === 'PUT') {
        const session = getSessionFromRequest(req);
        if (!session || session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!body || typeof body !== 'object') {
                return res.status(400).json({ error: 'Invalid payload' });
            }
            await redis.set(PACKAGES_KEY, JSON.stringify(body));
            return res.status(200).json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: 'Failed to save packages' });
        }
    }

    res.status(405).json({ error: 'Method not allowed' });
};
