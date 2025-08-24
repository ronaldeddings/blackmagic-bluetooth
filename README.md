# Blackmagic Bluetooth Interface

A comprehensive web-based Bluetooth interface for Blackmagic cameras, built with React, TypeScript, and Bun. This application enables direct communication with Blackmagic cameras via Web Bluetooth API with advanced security analysis and firmware management capabilities.

## 🚀 Features

### Core Functionality
- **Device Discovery**: Scan and connect to Blackmagic cameras via Bluetooth
- **Service Analysis**: Discover and analyze Bluetooth GATT services and characteristics
- **Security Assessment**: Comprehensive security risk analysis of discovered services
- **Firmware Analysis**: Analyze firmware patterns and update capabilities

### Advanced Features
- **File Transfer**: Upload/download files to/from connected devices
- **Audio Management**: Record and stream audio with configurable quality settings
- **Data Export**: Export analysis results in JSON/CSV formats
- **Local Storage**: Persistent storage for device history and preferences

### Technical Highlights
- **Web Bluetooth API**: Native browser Bluetooth support
- **TypeScript**: Full type safety and IntelliSense support
- **Responsive Design**: Mobile-first UI with accessibility features
- **Security-First**: Built-in risk assessment and security recommendations

## 📋 Prerequisites

- **Browser**: Chrome 56+ or Edge 79+ with Web Bluetooth support
- **HTTPS**: Required for Web Bluetooth API in production
- **Node.js**: 16+ (for development)
- **Bun**: Latest version for package management and builds

## 🛠️ Installation

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd blackmagic-bluetooth

# Install dependencies
bun install

# Start development server
bun run dev
```

### Production Build

```bash
# Create production build
bun run build

# Preview production build
bun run preview
```

## 🎯 Usage

### 1. Device Discovery
- Click "Scan for Devices" to discover nearby Blackmagic cameras
- Ensure your camera has Bluetooth enabled and is in pairing mode
- Select your camera from the discovered devices list

### 2. Device Connection
- Navigate to the Connection tab
- Click "Connect" to establish Bluetooth connection
- Wait for service discovery to complete automatically

### 3. Service Analysis
- Switch to the Services tab to explore discovered services
- Click "Run Analysis" for comprehensive security and firmware analysis
- Expand services to view individual characteristics and their properties

### 4. Data Export
- Analysis results are automatically saved locally
- Export functionality available for JSON and CSV formats
- Connection history and preferences persist between sessions

## 📚 Architecture

### Project Structure
```
src/
├── components/           # React UI components
│   ├── DeviceScanner/    # Device discovery interface
│   ├── ConnectionManager/ # Connection management
│   └── ServiceExplorer/  # Service analysis interface
├── services/            # Core business logic
│   ├── bluetooth/       # Bluetooth communication
│   ├── analysis/        # Security & firmware analysis
│   ├── advanced/        # File transfer & audio
│   └── storage/         # Local data persistence
├── types/               # TypeScript type definitions
└── utils/              # Utility functions and constants
```

### Key Services

#### BluetoothAdapter
- Manages Web Bluetooth API interactions
- Handles device discovery and connection
- Service and characteristic management

#### SecurityAnalyzer
- Analyzes discovered services for security risks
- Categorizes threats (Critical/High/Medium/Low)
- Generates actionable security recommendations

#### FirmwareAnalyzer
- Analyzes firmware patterns and capabilities
- Detects update mechanisms (OTA/DFU)
- Memory analysis and service verification

## 🔒 Security Features

### Risk Assessment
- **Critical**: Nordic DFU Service, File Transfer Profile
- **High**: HID Service, Object Push Profile, Audio Source
- **Medium**: Generic services with device information
- **Low**: Standard battery and information services

### Security Recommendations
- Automatic generation of security best practices
- Service-specific threat analysis
- Compliance and monitoring guidelines

## 🧪 Technical Implementation

### Verified Service UUIDs
The application includes comprehensive firmware analysis data:
- **169,840,640 bytes** of analyzed firmware data
- **27,684 total** verified UUID occurrences
- **10 verified services** with detailed risk profiles
- **9 HCI commands** with verified implementation patterns

### Web Bluetooth Compatibility
- Standard GATT service discovery
- Characteristic read/write/notify operations
- Secure connection handling with retry logic
- Cross-browser compatibility (Chrome/Edge)

## 🚀 Deployment

### Development Server
```bash
bun run dev
# Runs on http://localhost:5173
```

### Production Deployment
```bash
# Build for production
bun run build

# Deploy dist/ folder to your web server
# Ensure HTTPS is enabled for Web Bluetooth API
```

### HTTPS Requirements
Web Bluetooth API requires HTTPS in production. For local development, `localhost` is allowed over HTTP.

## 📊 Performance

### Build Statistics
- **Total Bundle Size**: ~200KB (gzipped)
- **Vendor Chunk**: 140KB (React + dependencies)
- **App Bundle**: 33KB (application code)
- **Bluetooth Module**: 10KB (Bluetooth services)

### Runtime Performance
- **Connection Time**: <5 seconds typical
- **Service Discovery**: 1-3 seconds
- **Analysis Generation**: <1 second
- **Memory Usage**: <50MB typical

## 🔧 Configuration

### Environment Variables
```bash
VITE_APP_TITLE="Blackmagic Bluetooth Interface"
VITE_DEFAULT_TIMEOUT=5000
VITE_MAX_RETRY_ATTEMPTS=3
```

### Browser Configuration
Enable Web Bluetooth in Chrome:
```
chrome://flags/#enable-web-bluetooth
```

## 🤝 Contributing

### Development Guidelines
1. Follow TypeScript strict mode requirements
2. Use provided ESLint configuration
3. Maintain test coverage for new features
4. Follow security-first development practices

### Code Style
- Use TypeScript for all new code
- Follow React functional component patterns
- Implement proper error handling
- Add JSDoc comments for public APIs

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Web Bluetooth not supported**
- Ensure you're using Chrome 56+ or Edge 79+
- Verify Web Bluetooth is enabled in browser flags
- Check that you're on HTTPS (or localhost)

**Device not found**
- Verify camera Bluetooth is enabled
- Check camera is in pairing/discoverable mode
- Ensure no other device is connected to the camera

**Connection failures**
- Try disconnecting and reconnecting
- Check browser console for specific error messages
- Verify camera supports the discovered services

**Analysis errors**
- Ensure services are properly discovered
- Check network connectivity for firmware analysis
- Verify sufficient browser permissions

## 📞 Support

For issues and questions:
1. Check the browser console for error messages
2. Verify your setup meets the prerequisites
3. Consult the Web Bluetooth API documentation
4. Review the troubleshooting section above

---

**Built with ❤️ using React, TypeScript, and Bun**