# Quick Connect Guide - 4G LTE Tracker

## 🚀 Fast Setup (5 minutes)

### Step 1: Gather LTE Device Details

1. **Device ID**: Your internal ID (e.g., `CT-TRK-001`)
2. **IMEI**: 15-digit identifier printed on the tracker
3. **SIM ICCID**: 18-22 digit SIM identifier
4. **Carrier & APN**: Provided by your LTE carrier (common APNs: `internet`, `iot`)

### Step 2: Connect in Dashboard

1. Open **Dashboard** → **4G LTE Tracker** section
2. Fill in:
   - **Device ID**
   - **IMEI**
   - **SIM ICCID**
   - **Carrier**
   - **APN**
3. Set your **Reporting Interval**
4. Click **"Connect Tracker"**

### Step 3: Verify Connection

✅ **Success indicators:**
- Status shows "Connected"
- "Connected! Receiving LTE updates..." message appears
- Real-time data appears in the panels
- Location shows on map (if GPS data available)

## ⚠️ Troubleshooting

### No Data Received

- ✅ Ensure SIM is active and has data
- ✅ Verify LTE coverage in your area
- ✅ Confirm APN with your carrier
- ✅ Check device power and antenna placement
- ✅ Increase reporting interval to reduce battery drain

### Invalid IMEI or ICCID

- ✅ IMEI should be exactly 15 digits
- ✅ ICCID should be 18-22 digits
- ✅ Verify values from device/SIM labels

## 📊 Expected Data Format

Your tracker should send data in one of these formats:

### JSON (Recommended)
- GPS coordinates
- Temperature (°C)
- Humidity (%)
- Battery level (%)
- Signal strength

### NMEA or Binary
- Check tracker documentation
- Use auto-detect if unsure

## 🔧 Advanced Settings

### Reporting Interval
- **Default**: 5 seconds
- **Lower** = More frequent updates (higher power use)
- **Higher** = Less frequent updates (longer battery life)
- **Recommended**: 5-30 seconds

## 📝 Checklist

Before connecting:
- [ ] Tracker is powered on
- [ ] SIM is active and inserted
- [ ] APN is correct
- [ ] IMEI and ICCID are correct
- [ ] LTE coverage is available

## 🆘 Still Having Issues?

1. **Check Browser Console** (F12 → Console) for errors
2. **Verify SIM status** in your carrier portal
3. **Test with simulation** to verify UI works
4. **See LTE_SETUP.md** for detailed troubleshooting

## 💡 Pro Tips

- **Save Settings**: Your LTE settings are saved in the browser
- **Monitor Signal**: Watch RSSI values for connectivity health
- **Start Slow**: Use a longer interval for initial testing

---

**Ready to connect?** Go to Dashboard → 4G LTE Tracker and follow the steps above!

