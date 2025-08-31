import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2',
    primaryContainer: '#bbdefb',
    secondary: '#03dac4',
    secondaryContainer: '#b2dfdb',
    tertiary: '#ff9800',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    background: '#fafafa',
    error: '#f44336',
    errorContainer: '#ffcdd2',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#0d47a1',
    onSecondary: '#000000',
    onSecondaryContainer: '#004d40',
    onTertiary: '#000000',
    onSurface: '#000000',
    onSurfaceVariant: '#424242',
    onError: '#ffffff',
    onErrorContainer: '#b71c1c',
    onBackground: '#000000',
    outline: '#bdbdbd',
    shadow: '#000000',
    inverseSurface: '#121212',
    inverseOnSurface: '#ffffff',
    inversePrimary: '#90caf9',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#90caf9',
    primaryContainer: '#0d47a1',
    secondary: '#80cbc4',
    secondaryContainer: '#004d40',
    tertiary: '#ffb74d',
    surface: '#121212',
    surfaceVariant: '#1e1e1e',
    background: '#000000',
    error: '#cf6679',
    errorContainer: '#b71c1c',
    onPrimary: '#0d47a1',
    onPrimaryContainer: '#bbdefb',
    onSecondary: '#004d40',
    onSecondaryContainer: '#b2dfdb',
    onTertiary: '#e65100',
    onSurface: '#ffffff',
    onSurfaceVariant: '#e0e0e0',
    onError: '#b71c1c',
    onErrorContainer: '#ffcdd2',
    onBackground: '#ffffff',
    outline: '#424242',
    shadow: '#000000',
    inverseSurface: '#ffffff',
    inverseOnSurface: '#000000',
    inversePrimary: '#1976d2',
  },
};

// Export light theme by default
export const theme = lightTheme;
export { lightTheme, darkTheme };
