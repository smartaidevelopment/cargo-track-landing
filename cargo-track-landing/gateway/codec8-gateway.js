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
const LOG_IO = process.env.LOG_IO === '1';
const LOG_IO_ONCE = process.env.LOG_IO_ONCE !== '0';
const loggedImeis = new Set();

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
    console.log(`Tracker connected: IMEI ${imei}`);
    return { imei, rest };
}

function assertReadable(buffer, offset, length, label) {
    if (offset + length > buffer.length) {
        throw new RangeError(`Buffer out of range while reading ${label}`);
    }
}

function parseIoElementWithMode(buffer, offset, isExtended) {
    const idSize = isExtended ? 2 : 1;
    const countSize = isExtended ? 2 : 1;

    assertReadable(buffer, offset, idSize + countSize, 'IO header');
    const eventIoId = isExtended ? buffer.readUInt16BE(offset) : buffer.readUInt8(offset);
    const totalIo = isExtended
        ? buffer.readUInt16BE(offset + idSize)
        : buffer.readUInt8(offset + idSize);
    let cursor = offset + idSize + countSize;
    const io = {};

    const readIoValues = (count, valueSize) => {
        for (let i = 0; i < count; i += 1) {
            if (cursor + idSize + valueSize > buffer.length) {
                cursor = buffer.length;
                break;
            }
            try {
                const id = isExtended ? buffer.readUInt16BE(cursor) : buffer.readUInt8(cursor);
                cursor += idSize;
                let value;
                if (valueSize === 1) value = buffer.readInt8(cursor);
                else if (valueSize === 2) value = buffer.readInt16BE(cursor);
                else if (valueSize === 4) value = buffer.readInt32BE(cursor);
                else value = Number(buffer.readBigInt64BE(cursor));
                cursor += valueSize;
                io[id] = value;
            } catch (error) {
                cursor = buffer.length;
                break;
            }
        }
    };

    if (cursor + countSize <= buffer.length) {
        const oneByte = isExtended ? buffer.readUInt16BE(cursor) : buffer.readUInt8(cursor);
        cursor += countSize;
        readIoValues(oneByte, 1);
    } else {
        return { eventIoId, totalIo, io, offset: buffer.length };
    }

    if (cursor + countSize <= buffer.length) {
        const twoByte = isExtended ? buffer.readUInt16BE(cursor) : buffer.readUInt8(cursor);
        cursor += countSize;
        readIoValues(twoByte, 2);
    } else {
        return { eventIoId, totalIo, io, offset: buffer.length };
    }

    if (cursor + countSize <= buffer.length) {
        const fourByte = isExtended ? buffer.readUInt16BE(cursor) : buffer.readUInt8(cursor);
        cursor += countSize;
        readIoValues(fourByte, 4);
    } else {
        return { eventIoId, totalIo, io, offset: buffer.length };
    }

    if (cursor + countSize <= buffer.length) {
        const eightByte = isExtended ? buffer.readUInt16BE(cursor) : buffer.readUInt8(cursor);
        cursor += countSize;
        readIoValues(eightByte, 8);
    } else {
        return { eventIoId, totalIo, io, offset: buffer.length };
    }

    return { eventIoId, totalIo, io, offset: cursor };
}

function parseIoElement(buffer, offset, codecId) {
    const isExtended = codecId === 0x8e;
    try {
        return parseIoElementWithMode(buffer, offset, isExtended);
    } catch (error) {
        if (!isExtended) {
            throw error;
        }
        return parseIoElementWithMode(buffer, offset, false);
    }
}

function parseAvlRecords(data) {
    let cursor = 0;
    assertReadable(data, cursor, 2, 'codec id + record count');
    const codecId = data.readUInt8(cursor);
    cursor += 1;
    const recordCount = data.readUInt8(cursor);
    cursor += 1;
    const records = [];

    for (let i = 0; i < recordCount; i += 1) {
        if (cursor + 24 > data.length) break;
        assertReadable(data, cursor, 8 + 1 + 4 + 4 + 2 + 2 + 1 + 2, 'AVL record header');
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

        let eventIoId = null;
        let totalIo = null;
        let io = {};
        try {
            const parsed = parseIoElement(data, cursor, codecId);
            eventIoId = parsed.eventIoId;
            totalIo = parsed.totalIo;
            io = parsed.io;
            cursor = parsed.offset;
        } catch (error) {
            cursor = data.length;
        }

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

    let recordCountEnd = recordCount;
    if (cursor + 1 <= data.length) {
        recordCountEnd = data.readUInt8(cursor);
    }
    return { codecId, recordCount, recordCountEnd, records };
}

function scaleIoValue(field, value) {
    if (typeof value !== 'number') return value;
    if (field === 'temperature' || field === 'humidity') {
        if (value === 32767 || (value >= 850 && [850, 2000, 3000, 4000, 5000].includes(value))) return null;
        const magnitude = Math.abs(value);
        return magnitude > 1000 ? value / 1000 : value / 10;
    }
    if (field === 'battery') {
        let normalized = Math.abs(value);
        if (normalized > 1000) {
            normalized = normalized / 100;
        } else if (normalized > 100) {
            normalized = normalized / 10;
        }
        if (normalized > 100) normalized = 100;
        return Math.round(normalized * 10) / 10;
    }
    if (field === 'batteryVoltage' || field === 'externalVoltage') {
        return Math.round(value) / 1000;
    }
    return value;
}

function mapIoToPayload(io) {
    const mapped = {};
    Object.entries(IO_MAP).forEach(([key, field]) => {
        const id = parseInt(key, 10);
        if (!Number.isNaN(id) && io[id] !== undefined) {
            mapped[field] = scaleIoValue(field, io[id]);
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
                let responseBody = '';
                res.on('data', chunk => {
                    if (responseBody.length < 512) {
                        responseBody += chunk.toString('utf8');
                    }
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 300) {
                        console.warn(`Ingest responded ${res.statusCode}: ${responseBody}`);
                    }
                    resolve(res.statusCode);
                });
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
        console.log(`[${imei || 'new'}] Bytes received: ${chunk.length}`);
        buffer = Buffer.concat([buffer, chunk]);

        if (!imei) {
            const parsed = parseImeIFrame(buffer);
            if (!parsed) return;
            imei = parsed.imei;
            buffer = parsed.rest;
            socket.write(Buffer.from([0x01]));
            console.log(`[${imei}] IMEI accepted, remaining buffer: ${buffer.length} bytes`);
        }

        while (true) {
            if (buffer.length < 8) {
                if (buffer.length > 0) console.log(`[${imei}] Waiting for AVL frame header: have ${buffer.length} bytes, need 8`);
                break;
            }
            const dataLength = buffer.readUInt32BE(4);
            const frameLength = 8 + dataLength + 4;
            if (buffer.length < frameLength) {
                console.log(`[${imei}] Waiting for full AVL frame: have ${buffer.length}, need ${frameLength} (dataLength=${dataLength})`);
                break;
            }
            const frame = decodeAvlFrame(buffer);
            if (!frame) break;
            buffer = frame.rest;
            console.log(`[${imei}] AVL frame decoded: ${frame.data.length} bytes of data`);

            let recordCount = 0;
            let parseFailed = false;
            try {
                const parsed = parseAvlRecords(frame.data);
                recordCount = parsed.recordCount;
                console.log(`[${imei}] Parsed ${recordCount} AVL records`);
                for (const record of parsed.records) {
                    const ioMapped = mapIoToPayload(record.io);
                    if (LOG_IO && (!LOG_IO_ONCE || !loggedImeis.has(imei))) {
                        console.log(`[${imei}] IO snapshot:`, JSON.stringify(record.io));
                        loggedImeis.add(imei);
                    }
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
                    console.log(`[${imei}] Sending to ingest: lat=${payload.lat} lng=${payload.lng} battery=${payload.battery} temp=${payload.temperature}`);
                    const status = await postToIngest(payload);
                    console.log(`[${imei}] Ingest response: ${status}`);
                }
            } catch (error) {
                console.error(`[${imei}] Failed to process AVL data:`, error.message || error);
                parseFailed = true;
            }

            if (parseFailed) {
                socket.destroy();
                return;
            }

            const ack = Buffer.alloc(4);
            ack.writeUInt32BE(recordCount, 0);
            socket.write(ack);
            console.log(`[${imei}] ACK sent for ${recordCount} records`);
        }
    });

    socket.on('close', () => {
        console.log(`[${imei || 'unknown'}] Connection closed`);
    });

    socket.on('error', error => {
        console.warn(`[${imei || 'unknown'}] Socket error:`, error.message);
    });
});

server.listen(TCP_PORT, () => {
    console.log(`Codec8 gateway listening on :${TCP_PORT}`);
});
