import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card, 
  SegmentedButtons,
  Switch,
  HelperText,
  ActivityIndicator
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

import { RootState, ConnectionConfig, AuthConfig } from '@/types';
import { connectToServer } from '@/store/connectionSlice';
import { authenticateUser } from '@/store/authSlice';
import { AppDispatch } from '@/store';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  
  const { status: connectionStatus, error: connectionError } = useSelector((state: RootState) => state.connection);
  const { isAuthenticated, error: authError } = useSelector((state: RootState) => state.auth);

  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState('8080');
  const [secure, setSecure] = useState(false);
  const [authMethod, setAuthMethod] = useState<'token' | 'password'>('token');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isConnecting = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

  const handleConnect = async () => {
    const config: ConnectionConfig = {
      id: Date.now().toString(),
      name: 'Default Connection',
      host,
      port: parseInt(port),
      secure,
      autoConnect: true,
      timeout: 30,
    };

    try {
      await dispatch(connectToServer(config)).unwrap();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleAuthenticate = async () => {
    const config: AuthConfig = {
      method: authMethod,
      token: authMethod === 'token' ? token : undefined,
      username: authMethod === 'password' ? username : undefined,
      password: authMethod === 'password' ? password : undefined,
    };

    try {
      await dispatch(authenticateUser(config)).unwrap();
      navigation.replace('Main');
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nexus Terminal</Text>
        <Text style={styles.subtitle}>Mobile Control Console</Text>

        {/* Connection Settings */}
        <Card style={styles.card}>
          <Card.Title title="Connection Settings" />
          <Card.Content>
            <TextInput
              label="Host"
              value={host}
              onChangeText={setHost}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Port"
              value={port}
              onChangeText={setPort}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.switchRow}>
              <Text>Secure Connection (HTTPS/WSS)</Text>
              <Switch value={secure} onValueChange={setSecure} />
            </View>
            {connectionError && (
              <HelperText type="error">{connectionError}</HelperText>
            )}
          </Card.Content>
          <Card.Actions>
            <Button
              mode="contained"
              onPress={handleConnect}
              loading={isConnecting}
              disabled={isConnecting || isConnected}
            >
              {isConnected ? 'Connected' : 'Connect'}
            </Button>
          </Card.Actions>
        </Card>

        {/* Authentication */}
        {isConnected && (
          <Card style={styles.card}>
            <Card.Title title="Authentication" />
            <Card.Content>
              <SegmentedButtons
                value={authMethod}
                onValueChange={(value) => setAuthMethod(value as any)}
                buttons={[
                  { value: 'token', label: 'Token' },
                  { value: 'password', label: 'Password' },
                ]}
                style={styles.segmentedButtons}
              />

              {authMethod === 'token' ? (
                <TextInput
                  label="Authentication Token"
                  value={token}
                  onChangeText={setToken}
                  mode="outlined"
                  secureTextEntry
                  style={styles.input}
                />
              ) : (
                <>
                  <TextInput
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    mode="outlined"
                    style={styles.input}
                  />
                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                  />
                </>
              )}
              
              {authError && (
                <HelperText type="error">{authError}</HelperText>
              )}
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                onPress={handleAuthenticate}
                disabled={
                  (authMethod === 'token' && !token) ||
                  (authMethod === 'password' && (!username || !password))
                }
              >
                Login
              </Button>
            </Card.Actions>
          </Card>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1976d2',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
});

export default LoginScreen;
