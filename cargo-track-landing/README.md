# CargoTrack Pro - Real-Time Cargo Tracking Platform

A complete web application for real-time cargo tracking solutions with GPS/GNSS tracking systems, multi-sensor monitoring, and 4G LTE integration. Includes a landing page, user authentication, and a comprehensive monitoring dashboard.

## 🚀 Quick Start

### Local Development
```bash
# Using Node.js
npm install
npm start

# Or using Python
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Deploy Online
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy Options:**
- **Vercel**: `vercel` (recommended)
- **Netlify**: Drag & drop folder
- **GitHub Pages**: Push to GitHub and enable Pages
- **Firebase**: `firebase deploy`

## ✨ Features

### Landing Page
- **Modern Design**: Clean, professional UI with smooth animations
- **Fully Responsive**: Works on desktop, tablet, and mobile
- **Package Selection**: Three pricing tiers (Basic, Professional, Enterprise)
- **Order Form**: Complete order form with account creation
- **Payment Options**: Credit Card, PayPal, Bank Transfer

### Dashboard & Monitoring
- **Real-Time Tracking**: Interactive map with device locations
- **Device Management**: Add, edit, and manage tracking devices
- **Multi-Sensor Support**: Temperature, humidity, accelerometer, gyroscope, magnetometer, pressure, light, proximity
- **Network Support**: 4G LTE, LTE Cat-M1, 2G, 3G, 5G, BLE, NFC, GPS/GNSS
- **Alerts System**: Real-time alerts and notifications
- **Analytics**: Charts and performance metrics
- **LTE Integration**: Connect and monitor LTE trackers with configurable reporting intervals

### Authentication
- User registration on purchase
- Secure login system
- Session management
- Protected dashboard access

## Features

- **Modern Design**: Clean, professional UI with smooth animations and transitions
- **Fully Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- **Interactive Elements**: Package selection, order form, and payment options
- **Multiple Use Cases**: Showcases solutions for pharmaceutical, cold chain, valuable cargo, and sensitive products
- **Technology Highlights**: Features GPS/GNSS, 4G LTE/2G-5G, NFC, LTE Cat-M1 connectivity options
- **Sensor Integration**: Temperature, humidity, accelerometer, and collision detection sensors

## Sections

1. **Hero Section**: Eye-catching introduction with call-to-action buttons
2. **Features Section**: Highlights of tracking technology capabilities
3. **Use Cases Section**: Industry-specific solutions with visual cards
4. **Packages Section**: Three pricing tiers (Basic, Professional, Enterprise)
5. **Order Section**: Complete order form with payment options
6. **Footer**: Contact information and quick links

## Package Options

### Basic - $99/month
- GPS/GNSS Tracking
- Temperature Sensor
- LTE Connectivity
- Basic Alerts
- Web Dashboard
- Up to 10 Devices

### Professional - $249/month (Most Popular)
- All Basic Features
- Temperature & Humidity
- Accelerometer
- Collision Detection
- 4G LTE + 5G
- Advanced Alerts
- Mobile App
- Up to 50 Devices
- Analytics Dashboard

### Enterprise - $499/month
- All Professional Features
- NFC Support
- Multi-Network (2G-5G, 4G LTE)
- Custom Sensors
- API Access
- White-label Solution
- Priority Support
- Unlimited Devices
- Custom Integrations

## Payment Options

- Credit Card
- PayPal
- Bank Transfer

## Technologies Used

- HTML5
- CSS3 (with CSS Variables)
- JavaScript (Vanilla JS)
- Font Awesome Icons (via CDN)

## 📁 Project Structure

```
cargo-track-landing/
├── index.html          # Landing page
├── login.html          # Login page  
├── dashboard.html      # Main dashboard
├── styles.css          # Landing page styles
├── dashboard.css       # Dashboard styles
├── script.js           # Landing page scripts
├── auth.js             # Authentication system
├── login.js            # Login functionality
├── dashboard.js         # Dashboard functionality
├── package.json        # NPM configuration
├── vercel.json         # Vercel deployment config
├── netlify.toml        # Netlify deployment config
└── DEPLOYMENT.md       # Deployment guide
```

## 🛠️ Setup

1. Clone or download this repository
2. Open `index.html` in a web browser, or
3. Run a local server (see Quick Start above)
4. No build process required - works directly in the browser

## 🌐 Deployment

This application is ready to deploy to any static hosting service:

- **Vercel** (Recommended): `vercel` command or drag & drop
- **Netlify**: Drag & drop or `netlify deploy`
- **GitHub Pages**: Push to GitHub and enable Pages
- **Firebase Hosting**: `firebase deploy`
- **Any static host**: Upload all files via FTP

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #10b981;
    --accent-color: #f59e0b;
    /* ... */
}
```

### Package Pricing
Update the `packages` object in `script.js`:
```javascript
const packages = {
    basic: {
        name: 'Basic',
        price: 99,
        description: 'Basic - $99/month'
    },
    // ...
};
```

### Content
Edit the HTML content in `index.html` to match your specific needs.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🔧 Configuration

### 4G LTE Tracker
- Access the "4G LTE Tracker" section in the dashboard
- Configure Device ID, IMEI, SIM ICCID, and APN
- Select reporting interval (1 second to 1 hour)
- Simulation data available for UI testing

### Device Management
- Add devices with detailed configuration
- Support for multiple network types
- Sensor configuration
- GPS/GNSS tracker settings

### Live LTE Tracking (Vercel KV)
Use the serverless endpoints in `api/` to ingest and read live tracker locations.

**Setup (Vercel):**
- Create a Vercel KV store and connect it to this project.
- Add the environment variable `LTE_INGEST_TOKEN` with a strong token.
- Vercel injects KV connection vars automatically after linking.

**Ingest endpoint:** `POST /api/ingest`  
Auth: `Authorization: Bearer <token>` or `X-Ingest-Token: <token>`

Example payload:
```bash
curl -X POST "https://<your-domain>/api/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "deviceId": "DEV-0001",
    "imei": "356938035643809",
    "lat": 37.7749,
    "lng": -122.4194,
    "timestamp": "2026-02-03T18:10:00Z",
    "battery": 88,
    "temperature": 4.2,
    "humidity": 52,
    "rssi": -71
  }'
```

**Read endpoint:** `GET /api/locations`  
Optional filter: `?ids=DEV-0001,DEV-0002`

Example:
```bash
curl "https://<your-domain>/api/locations?ids=DEV-0001"
```

### EYE Sensor Integration (via TAT140 BLE)
If the EYE sensor is paired to a TAT140 tracker, the tracker can forward sensor data to your backend. This app accepts common fields for temperature and humidity in `/api/ingest`.

**How to capture the payload format:**
- In the TAT140 platform, set the HTTP/MQTT destination to a temporary webhook (or this app's `/api/ingest` endpoint).
- Send a test report from the tracker and record the raw payload.
- Share the payload keys so we can map any custom fields.

**Fields the ingest endpoint already understands:**
- Device ID: `deviceId`, `device_id`, `trackerId`, `id`, `imei`, `serial`
- Location: `lat`/`lng`, `latitude`/`longitude`, `gps.lat`/`gps.lng`
- Temperature: `temperature`, `temp`, `temp_c`, `sensors.temperature`
- Humidity: `humidity`, `hum`, `rh`, `sensors.humidity`

If your payload uses different keys, we can extend the mapping quickly.

## ⚠️ Production Considerations

### Current Implementation (Demo)
- **Authentication**: Uses localStorage (client-side only)
- **Data Storage**: Browser localStorage
- **LTE**: Simulation mode
- **Payments**: Simulated

### For Production Use
- **Backend API**: Implement server-side authentication and data storage
- **Database**: PostgreSQL, MongoDB, or cloud database
- **Real LTE**: Integrate with your carrier or cellular IoT platform
- **Payment Gateway**: Integrate Stripe, PayPal, or other providers
- **HTTPS**: Required for geolocation and secure features

## 🧪 Testing

1. **Landing Page**: Visit the homepage
2. **Create Account**: Fill out the order form to create an account
3. **Login**: Use the created credentials to login
4. **Dashboard**: Explore all dashboard features
5. **Device Management**: Add and configure devices
6. **4G LTE Tracker**: Connect tracker in simulation mode

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

MIT License - Feel free to use for your projects.

## 🤝 Contributing

This is a complete application ready for deployment. For production use, consider:
- Adding backend API
- Implementing real database
- Integrating actual payment processing
- Connecting to real LTE networks

## 📞 Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)


