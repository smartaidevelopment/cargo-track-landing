# 4G LTE Tracker Setup Guide

This guide will help you connect a real 4G LTE tracker to CargoTrack Pro.

## Prerequisites

1. **4G LTE GPS Tracker** with an active SIM card
2. **Carrier Details** (APN, SIM ICCID, plan status)
3. **Device Identifiers** (Device ID and IMEI)

## Setup Instructions

### Step 1: Collect Device Information

1. **Device ID**
   - Choose an internal identifier (e.g., `CT-TRK-001`)
2. **IMEI**
   - 15-digit device identifier printed on the tracker
3. **SIM ICCID**
   - 18-22 digit identifier on the SIM card
4. **Carrier APN**
   - Provided by your carrier (common defaults: `internet`, `iot`)

### Step 2: Configure in CargoTrack Pro Dashboard

1. **Navigate to 4G LTE Tracker Section**
   - Log in to your dashboard
   - Click "4G LTE Tracker" in the sidebar

2. **Enter Connection Details**
   - **Device ID**: Your internal tracker ID
   - **IMEI**: 15-digit IMEI
   - **SIM ICCID**: 18-22 digit ICCID
   - **Carrier**: Carrier name
   - **APN**: Carrier APN

3. **Set Reporting Interval**
   - Default: 5 seconds
   - Recommended: 5-30 seconds

4. **Connect**
   - Click "Connect Tracker"
   - Wait for confirmation and live data

## Troubleshooting

### No Data Received

- Verify SIM is active and has data
- Confirm LTE coverage in your area
- Double-check APN
- Ensure tracker is powered and GPS has a fix

### Invalid IMEI / ICCID

- IMEI must be exactly 15 digits
- ICCID must be 18-22 digits
- Check labels on device and SIM

## Data Format

The platform supports:
- **JSON** (recommended)
- **NMEA**
- **Binary**
- **Auto-detect**

## Security Notes

⚠️ **Important:**
- Device credentials are stored in browser localStorage (demo only)
- For production, use a backend to store credentials securely
- Rotate SIMs and credentials regularly

## Next Steps

- Verify tracker location on the map
- Set alerts for temperature, battery, and motion
- Configure device details in "Devices" section

