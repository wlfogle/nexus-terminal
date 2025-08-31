import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screen components (we'll create basic versions)
import DashboardScreen from './DashboardScreen';
import TerminalScreen from './TerminalScreen';
import FilesScreen from './FilesScreen';
import SystemScreen from './SystemScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Terminal':
              iconName = 'terminal';
              break;
            case 'Files':
              iconName = 'folder';
              break;
            case 'System':
              iconName = 'computer';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#757575',
        headerStyle: {
          backgroundColor: '#1976d2',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          headerTitle: 'System Overview',
        }}
      />
      <Tab.Screen 
        name="Terminal" 
        component={TerminalScreen}
        options={{
          title: 'Terminal',
          headerTitle: 'Terminal Sessions',
        }}
      />
      <Tab.Screen 
        name="Files" 
        component={FilesScreen}
        options={{
          title: 'Files',
          headerTitle: 'File Manager',
        }}
      />
      <Tab.Screen 
        name="System" 
        component={SystemScreen}
        options={{
          title: 'System',
          headerTitle: 'System Monitor',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'App Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
