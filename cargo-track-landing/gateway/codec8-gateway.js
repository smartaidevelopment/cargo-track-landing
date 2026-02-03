const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const TCP_PORT = parseInt(process.env.TCP_PORT, 10) || 5055;
const INGEST_URL = process.env.INGEST_URL || '';
const INGEST_TOKEN = process.env.LTE_INGEST_TOKEN || '';
const IO_MAP = process.env.TELTONIKA_IO_MAP
    ? JSON.parse(process.env.TELTONIKA_IO_MAP)
    : {};

if (!INGEST_URL) {
    console.error('Missing INGEST_URL (e.g. https://<domain>/api/ingest)');
    process.exit(1);
}

function toSignedInt32(value) {
    return value > 0x7fffffff ? value - 0x100000000 : value;
}

function parseImeIFrame(buffer) {
    if (buffer.length < 2) return null;
    const imeiLength = buffer.readUInt16BE(0);
    if (buffer.length < 2 + imeiLength) return null;
    const imei = buffer.slice(2, 2 + imeiLength).toString('utf8');
    const rest = buffer.slice(2 + imeiLength);
    return { imei, rest };
}

function parseIoElement(buffer, offset) {
    const eventIoId = buffer.readUInt8(offset);
    const totalIo = buffer.readUInt8(offset + 1);
    let cursor = offset + 2;
    const io = {};

    const readIoValues = (count, valueSize) => {
        for (let i = 0; i < count; i += 1) {
            const id = buffer.readUInt8(cursor);
            cursor += 1;
            let value;
            if (valueSize === 1) value = buffer.readInt8(cursor);
            else if (valueSize === 2) value = buffer.readInt16BE(cursor);
            else if (valueSize === 4) value = buffer.readInt32BE(cursor);
            else value = Number(buffer.readBigInt64BE(cursor));
            cursor += valueSize;
            io[id] = value;
        }
    };

    const oneByte = buffer.readUInt8(cursor);
    cursor += 1;
    readIoValues(oneByte, 1);

    const twoByte = buffer.readUInt8(cursor);
    cursor += 1;
    readIoValues(twoByte, 2);

    const fourByte = buffer.readUInt8(cursor);
    cursor += 1;
    readIoValues(fourByte, 4);

    const eightByte = buffer.readUInt8(cursor);
    cursor += 1;
    readIoValues(eightByte, 8);

    return { eventIoId, totalIo, io, offset: cursor };
}

function parseAvlRecords(data) {
    let cursor = 0;
    const codecId = data.readUInt8(cursor);
    cursor += 1;
    const recordCount = data.readUInt8(cursor);
    cursor += 1;
    const records = [];

    for (let i = 0; i < recordCount; i += 1) {
        const timestampMs = Number(data.readBigInt64BE(cursor));
        cursor += 8;
        const priority = data.readUInt8(cursor);
        cursor += 1;

        const lonRaw = data.readUInt32BE(cursor);
        cursor += 4;
        const latRaw = data.readUInt32BE(cursor);
        cursor += 4;
        const altitude = data.readInt16BE(cursor);
        cursor += 2;
        const angle = data.readUInt16BE(cursor);
        cursor += 2;
        const satellites = data.readUInt8(cursor);
        cursor += 1;
        const speed = data.readUInt16BE(cursor);
        cursor += 2;

        const { eventIoId, totalIo, io, offset } = parseIoElement(data, cursor);
        cursor = offset;

        records.push({
            timestamp: new Date(timestampMs).toISOString(),
            priority,
            latitude: toSignedInt32(latRaw) / 10000000,
            longitude: toSignedInt32(lonRaw) / 10000000,
            altitude,
            angle,
            satellites,
            speed,
            eventIoId,
            totalIo,
            io
        });
    }

    const recordCountEnd = data.readUInt8(cursor);
    return { codecId, recordCount, recordCountEnd, records };
}

function mapIoToPayload(io) {
    const mapped = {};
    Object.entries(IO_MAP).forEach(([key, field]) => {
        const id = parseInt(key, 10);
        if (!Number.isNaN(id) && io[id] !== undefined) {
            mapped[field] = io[id];
        }
    });
    return mapped;
}

function postToIngest(payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(INGEST_URL);
        const body = JSON.stringify(payload);
        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(
            {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    ...(INGEST_TOKEN ? { Authorization: `Bearer ${INGEST_TOKEN}` } : {})
                }
            },
            res => {
                res.on('data', () => {});
                res.on('end', () => resolve(res.statusCode));
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function decodeAvlFrame(buffer) {
    if (buffer.length < 8) return null;
    const dataLength = buffer.readUInt32BE(4);
    const frameLength = 8 + dataLength + 4;
    if (buffer.length < frameLength) return null;
    const data = buffer.slice(8, 8 + dataLength);
    const rest = buffer.slice(frameLength);
    return { data, rest };
}

const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    let imei = null;

    socket.on('data', async chunk => {
        buffer = Buffer.concat([buffer, chunk]);

        if (!imei) {
            const parsed = parseImeIFrame(buffer);
            if (!parsed) return;
            imei = parsed.imei;
            buffer = parsed.rest;
            socket.write(Buffer.from([0x01]));
        }

        while (true) {
            const frame = decodeAvlFrame(buffer);
            if (!frame) break;
            buffer = frame.rest;

            try {
                const { recordCount, records } = parseAvlRecords(frame.data);
                for (const record of records) {
                    const ioMapped = mapIoToPayload(record.io);
                    const payload = {
                        deviceId: imei,
                        imei,
                        lat: record.latitude,
                        lng: record.longitude,
                        timestamp: record.timestamp,
                        speed: record.speed,
                        heading: record.angle,
                        satellites: record.satellites,
                        accuracy: ioMapped.accuracy ?? null,
                        ...ioMapped
                    };
                    await postToIngest(payload);
                }

                const ack = Buffer.alloc(4);
                ack.writeUInt32BE(recordCount, 0);
                socket.write(ack);
            } catch (error) {
                console.error('Failed to process AVL data:', error);
                socket.destroy();
            }
        }
    });

    socket.on('error', error => {
        console.warn('Socket error:', error.message);
    });
});

server.listen(TCP_PORT, () => {
    console.log(`Codec8 gateway listening on :${TCP_PORT}`);
});
