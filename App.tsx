import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { store, persistor } from '@/store';
import { theme } from '@/utils/theme';

// Import Phase 3 services
import { advancedFileService } from './src/services/advancedFileService';
import { systemAutomationService } from './src/services/systemAutomationService';
import { advancedMonitoringService } from './src/services/advancedMonitoringService';
import { enterpriseIntegrationService } from './src/services/enterpriseIntegrationService';
import { productionDeploymentService } from './src/services/productionDeploymentService';

// Import screens (we'll create these next)
import SplashScreen from '@/screens/SplashScreen';
import LoginScreen from '@/screens/LoginScreen';
import MainTabNavigator from '@/screens/MainTabNavigator';

const Stack = createStackNavigator();

const App: React.FC = () => {
  useEffect(() => {
    // Initialize Phase 3 Advanced Services
    const initializeAdvancedServices = async () => {
      try {
        console.log('🚀 Initializing Phase 3 Advanced Services...');
        
        // Initialize services in parallel for better performance
        await Promise.all([
          advancedFileService.initialize(),
          systemAutomationService.initialize(),
          advancedMonitoringService.initialize(),
          enterpriseIntegrationService.initialize(),
          productionDeploymentService.initialize('production')
        ]);
        
        console.log('✅ Phase 3 Advanced Services initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Phase 3 services:', error);
      }
    };

    initializeAdvancedServices();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={<SplashScreen />} persistor={persistor}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                }}
                initialRouteName="Splash"
              >
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Main" component={MainTabNavigator} />
              </Stack.Navigator>
            </NavigationContainer>
          </PaperProvider>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;
