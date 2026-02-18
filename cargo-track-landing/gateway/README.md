## Teltonika Codec 8 TCP Gateway

This gateway accepts Teltonika Codec 8 / Codec 8 Extended TCP packets and forwards decoded data to the HTTP ingest endpoint.

### Prerequisites

- Public VPS or server with an open TCP port (default `5055`)
- Node.js 18+ installed
- A reachable HTTP ingest endpoint (`/api/ingest`)

### Quick Setup (on your VPS)

```bash
# 1. Copy the gateway folder to your server
scp -r gateway/ root@188.166.165.41:/opt/cargotrack-gateway/

# 2. SSH into the server
ssh root@188.166.165.41

# 3. Run the setup script
cd /opt/cargotrack-gateway
chmod +x setup.sh
./setup.sh
```

### Manual Run

```bash
export TCP_PORT=5055
export INGEST_URL="https://cargo-track-landing.vercel.app/api/ingest"
export LTE_INGEST_TOKEN="<your-token>"
export TELTONIKA_IO_MAP='{"113":"battery","72":"temperature","21":"rssi","67":"batteryVoltage","66":"externalVoltage","240":"movement","200":"sleepMode","116":"chargerConnected","636":"lteCellId"}'
export LOG_IO=1

node codec8-gateway.js
```

### TAT140 IO Element Mapping

| IO ID | Field Name       | Description                      | Unit / Range        |
|-------|------------------|----------------------------------|---------------------|
| 113   | battery          | Battery Level                    | 0-100%              |
| 72    | temperature      | Dallas Temperature Sensor 1      | 0.1°C (-55 to 115)  |
| 21    | rssi             | GSM Signal Quality               | 0-5 scale           |
| 67    | batteryVoltage   | Battery Voltage                  | mV (auto-scaled)    |
| 66    | externalVoltage  | External Voltage                 | mV (auto-scaled)    |
| 240   | movement         | Movement Detected                | 0/1                 |
| 200   | sleepMode        | Sleep Mode State                 | 0-4                 |
| 116   | chargerConnected | Charger Connected                | 0/1                 |
| 636   | lteCellId        | LTE Cell ID                      | integer             |

Values from the AVL record itself (no IO mapping needed):
- `latitude`, `longitude` — GPS coordinates
- `speed` — km/h
- `altitude` — meters
- `satellites` — satellite count
- `timestamp` — ISO string

### Temperature Sensor Error Codes

Dallas Temperature values 850, 2000, 3000, 4000, 5000 are error codes (sensor not ready, read error, not connected, etc.) and are filtered out automatically.

### Service Management

```bash
sudo systemctl status cargotrack-gateway    # Check status
sudo journalctl -u cargotrack-gateway -f     # View live logs
sudo systemctl restart cargotrack-gateway    # Restart
sudo systemctl stop cargotrack-gateway       # Stop
```

### Notes

- Vercel cannot host TCP servers. This gateway must run on a VPS or similar host.
- The TAT140 should be configured to point to your server IP and TCP port 5055.
- On first connection, the gateway logs the raw IO element snapshot for the IMEI (set `LOG_IO=1`).
