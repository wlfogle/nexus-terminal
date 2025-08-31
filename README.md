# 📱 Nexus Terminal Mobile

> **The Ultimate Mobile Terminal Companion App**  
> Enterprise-grade SSH terminal with AI-powered intelligence, advanced automation, and real-time system monitoring.

[![React Native](https://img.shields.io/badge/React%20Native-0.72+-61DAFB?style=flat&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Alpha Release](https://img.shields.io/badge/Alpha-v1.0.0--alpha.1-orange?style=flat)](https://github.com/wlfogle/nexus-terminal/releases)
[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-success?style=flat)](https://github.com/wlfogle/nexus-terminal)

## 🚨 Alpha Release v1.0.0-alpha.1

**This is an alpha release** of the Nexus Terminal Mobile companion app. It's designed to work in conjunction with the [Nexus Terminal Desktop v1.0.0-alpha.1](https://github.com/wlfogle/nexus-terminal) release.

### Alpha Features
- ✅ **Core terminal connectivity** to Nexus Terminal desktop app
- ✅ **Real-time system monitoring** of connected systems
- ✅ **File browser** for remote file management
- ✅ **Secure authentication** with token-based system
- ✅ **Dashboard** for system overview and quick actions
- 🔄 **AI integration** (limited - desktop app handles AI processing)
- 🔄 **Advanced automation** (planned for beta)

### Alpha Limitations
- Requires [Nexus Terminal Desktop](https://github.com/wlfogle/nexus-terminal) running to connect
- Limited offline functionality
- Some advanced features are placeholder UI
- Performance optimizations ongoing
- Android/iOS platform folders need initialization

## 🚀 Overview

**Nexus Terminal Mobile** is the mobile companion app for the [Nexus Terminal](https://github.com/wlfogle/nexus-terminal) desktop application. It provides a complete mobile terminal experience with enterprise-grade features, AI-powered assistance, and advanced system management capabilities.

## Features

### ✅ Phase 1: Core Functionality (Completed)

- **Connection Management**: Auto-discovery, manual configuration, connection profiles
- **Authentication System**: Token-based, username/password, and certificate authentication  
- **Terminal Emulator**: Interactive terminal sessions with command history
- **File Browser**: Navigate filesystem, CRUD operations, file transfer
- **System Monitoring**: Real-time metrics, process management, service control
- **Settings Management**: App preferences, connection profiles, security settings

### 🔄 Phase 2: Advanced Features (Planned)

- AI-powered ecosystem insights
- Advanced file operations  
- Performance optimizations
- Enhanced security features

### 📋 Phase 3: Future Enhancements (Planned)

- Multi-device synchronization
- Plugin system for extensibility
- Advanced automation workflows
- Machine learning integration
- Cloud backup and sync
- Enterprise management features

## Technical Stack

- **React Native 0.72.6** with TypeScript
- **Redux Toolkit** for state management
- **React Navigation 6** for navigation
- **React Native Paper** for Material Design UI
- **Socket.IO** for real-time communication
- **Axios** for HTTP requests
- **React Native Keychain** for secure storage

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Main application screens
│   ├── SplashScreen.tsx
│   ├── LoginScreen.tsx
│   ├── MainTabNavigator.tsx
│   ├── DashboardScreen.tsx
│   ├── TerminalScreen.tsx
│   ├── FilesScreen.tsx
│   ├── SystemScreen.tsx
│   └── SettingsScreen.tsx
├── services/           # API communication services
│   ├── connectionService.ts
│   ├── authService.ts
│   ├── systemService.ts
│   ├── fileService.ts
│   ├── terminalService.ts
│   └── ecosystemService.ts
├── store/             # Redux store and slices
│   ├── index.ts
│   ├── connectionSlice.ts
│   ├── authSlice.ts
│   ├── systemSlice.ts
│   ├── filesSlice.ts
│   ├── terminalSlice.ts
│   └── ecosystemSlice.ts
├── types/             # TypeScript type definitions
│   └── index.ts
└── utils/             # Utility functions and theme
    └── theme.ts
```

## Installation & Setup

### Prerequisites

- Node.js 16+ 
- React Native development environment
- Android SDK (for Android development)
- Nexus Terminal backend server

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd nexus-terminal-mobile
   npm install
   ```

2. **iOS Setup (macOS only):**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android Setup:**
   - Ensure Android SDK is properly configured
   - Enable USB debugging on your Android device

### Development

1. **Start Metro bundler:**
   ```bash
   npm start
   ```

2. **Run on Android:**
   ```bash
   npm run android
   ```

3. **Run on iOS:**
   ```bash
   npm run ios
   ```

### Building for Production

1. **Android APK:**
   ```bash
   npm run build:android
   ```

2. **Android AAB (Play Store):**
   ```bash
   cd android && ./gradlew bundleRelease
   ```

## Configuration

### Backend Server Requirements

The mobile app requires a compatible Nexus Terminal backend server running with the following API endpoints:

#### Authentication
- `POST /api/auth/login` - Username/password authentication
- `POST /api/auth/token` - Token authentication  
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Logout

#### System Information
- `GET /api/system/info` - System information
- `GET /api/system/metrics` - Real-time system metrics
- `GET /api/system/processes` - Running processes
- `GET /api/system/services` - System services

#### File Operations
- `GET /api/files/browse` - Browse directories
- `POST /api/files/upload` - Upload files
- `GET /api/files/download` - Download files
- `PUT /api/files/content` - Read/write file content
- `DELETE /api/files/delete` - Delete files

#### Terminal Operations
- `POST /api/terminal/create` - Create terminal session
- `POST /api/terminal/execute` - Execute command
- `GET /api/terminal/history` - Command history
- `DELETE /api/terminal/session` - Close session

#### WebSocket Events
- `connection_established` / `connection_lost`
- `terminal_output` / `command_executed`
- `system_metrics_update` / `process_started`
- `file_changed` / `directory_created`

### App Configuration

Update connection settings in the login screen:
- **Host**: IP address or hostname of your Nexus Terminal server
- **Port**: Server port (default: 8080)
- **Secure**: Enable HTTPS/WSS for encrypted communication

## Security Features

- **Secure Storage**: Authentication tokens stored using Android Keystore
- **Encrypted Communication**: Full TLS/SSL encryption support
- **Certificate Authentication**: X.509 client certificate support
- **Session Management**: Automatic token refresh and secure session handling

## Development Guidelines

### Code Standards
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Implement comprehensive error handling
- Write unit tests for critical functionality
- Document all public APIs and interfaces

### Contributing
1. Fork the repository
2. Create a feature branch
3. Follow the established code style
4. Add tests for new functionality
5. Submit a pull request

## Troubleshooting

### Common Issues

1. **Connection Problems**
   - Verify network connectivity
   - Check firewall settings on server
   - Confirm correct IP address and port
   - Validate authentication credentials

2. **Build Issues**
   - Clear Metro cache: `npx react-native start --reset-cache`
   - Clean build: `cd android && ./gradlew clean && cd ..`
   - Check Android SDK configuration

3. **Performance Issues**
   - Clear app cache and data
   - Check available device memory
   - Review background app restrictions

## API Documentation

For detailed API documentation, refer to the backend server documentation. The mobile app implements a comprehensive client for all available endpoints with proper error handling and real-time updates via WebSocket connections.

## License

MIT License - see LICENSE file for details

## Support

For support, bug reports, or feature requests:
- Create an issue in the repository
- Contact the Nexus Terminal Development Team
- Check the troubleshooting guide

---

**Version**: 1.0.0 (Phase 1 Implementation)  
**Last Updated**: August 31, 2025  
**Maintainer**: Nexus Terminal Development Team
