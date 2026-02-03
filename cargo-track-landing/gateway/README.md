## Teltonika Codec 8 TCP Gateway

This gateway accepts Teltonika Codec 8 TCP packets and forwards decoded data to the HTTP ingest endpoint.

### Prerequisites

- Public VPS or server with an open TCP port (default `5055`)
- Node.js 18+ installed
- A reachable HTTP ingest endpoint (`/api/ingest`)

### Run

```bash
export TCP_PORT=5055
export INGEST_URL="https://<your-domain>/api/ingest"
export LTE_INGEST_TOKEN="<token>"
export TELTONIKA_IO_MAP='{"1":"battery","20":"temperature","21":"humidity","24":"rssi"}'

npm run gateway
```

### IO Mapping

`TELTONIKA_IO_MAP` maps Teltonika IO element IDs to fields your app understands.

Example:
```json
{"1":"battery","20":"temperature","21":"humidity","24":"rssi"}
```

### Notes

- Vercel cannot host TCP servers. This gateway must run on a VPS or similar host.
- Make sure the TAT140 is configured to point to your server IP and TCP port.
