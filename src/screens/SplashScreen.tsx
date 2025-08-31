import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '@/types';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { status } = useSelector((state: RootState) => state.connection);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && status === 'connected') {
        navigation.replace('Main');
      } else {
        navigation.replace('Login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, status, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nexus Terminal</Text>
      <Text style={styles.subtitle}>Mobile Control Console</Text>
      <ActivityIndicator size="large" style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1976d2',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#bbdefb',
    marginBottom: 32,
  },
  loader: {
    marginTop: 32,
  },
});

export default SplashScreen;
