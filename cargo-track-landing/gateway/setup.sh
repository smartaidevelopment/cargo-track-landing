#!/bin/bash
# CargoTrack Codec8 Gateway Setup for VPS
# Run this on your server (188.166.165.41)

set -e

echo "=== CargoTrack Codec8 Gateway Setup ==="

# Create app directory
APP_DIR="/opt/cargotrack-gateway"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

# Copy gateway files
cp codec8-gateway.js "$APP_DIR/"
cp package.json "$APP_DIR/"

# Create environment file
cat > "$APP_DIR/.env" << 'ENVEOF'
TCP_PORT=5055
INGEST_URL=https://cargo-track-landing.vercel.app/api/ingest
LTE_INGEST_TOKEN=__REPLACE_WITH_YOUR_TOKEN__

# TAT140 IO Element Mapping (Codec 8 Extended)
# IO 113 = Battery Level (0-100%)
# IO 72  = Dallas Temperature 1 (0.1°C, range -55 to +115°C)
# IO 21  = GSM Signal Quality (0-5)
# IO 67  = Battery Voltage (mV)
# IO 66  = External Voltage (mV)
# IO 240 = Movement (0/1)
# IO 200 = Sleep Mode (0-4)
# IO 116 = Charger Connected (0/1)
# IO 636 = LTE Cell ID
TELTONIKA_IO_MAP={"113":"battery","72":"temperature","21":"rssi","67":"batteryVoltage","66":"externalVoltage","240":"movement","200":"sleepMode","116":"chargerConnected","636":"lteCellId"}

# Enable IO logging on first connection to verify mapping
LOG_IO=1
LOG_IO_ONCE=1
ENVEOF

echo "Environment file created at $APP_DIR/.env"

# Create systemd service
sudo tee /etc/systemd/system/cargotrack-gateway.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=CargoTrack Codec8 TCP Gateway
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cargotrack-gateway
EnvironmentFile=/opt/cargotrack-gateway/.env
ExecStart=/usr/bin/node codec8-gateway.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable cargotrack-gateway
sudo systemctl start cargotrack-gateway

echo ""
echo "=== Setup Complete ==="
echo "Gateway is running on port 5055"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status cargotrack-gateway   # Check status"
echo "  sudo journalctl -u cargotrack-gateway -f    # View live logs"
echo "  sudo systemctl restart cargotrack-gateway   # Restart"
echo ""
echo "Point your TAT140 to: $(curl -s ifconfig.me):5055"
