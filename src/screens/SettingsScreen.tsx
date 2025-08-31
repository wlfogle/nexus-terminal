import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  List,
  Switch,
  Button,
  Dialog,
  Portal,
  TextInput,
  Chip,
  Divider
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { RootState, ConnectionConfig } from '@/types';
import { 
  disconnectFromServer, 
  addConnectionProfile, 
  removeConnectionProfile 
} from '@/store/connectionSlice';
import { logout, clearAuth } from '@/store/authSlice';
import { AppDispatch } from '@/store';

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  
  const { config, profiles } = useSelector((state: RootState) => state.connection);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('5');
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [profileDialog, setProfileDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileHost, setNewProfileHost] = useState('');
  const [newProfilePort, setNewProfilePort] = useState('8080');

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      await dispatch(disconnectFromServer()).unwrap();
      dispatch(clearAuth());
      setLogoutDialog(false);
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to logout properly');
    }
  };

  const handleSaveProfile = () => {
    if (!newProfileName.trim() || !newProfileHost.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const profile: ConnectionConfig = {
      id: Date.now().toString(),
      name: newProfileName,
      host: newProfileHost,
      port: parseInt(newProfilePort) || 8080,
      secure: false,
      autoConnect: false,
      timeout: 30,
    };

    dispatch(addConnectionProfile(profile));
    setProfileDialog(false);
    setNewProfileName('');
    setNewProfileHost('');
    setNewProfilePort('8080');
  };

  const handleDeleteProfile = (profileId: string) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this connection profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => dispatch(removeConnectionProfile(profileId))
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Connection Info */}
      <Card style={styles.card}>
        <Card.Title 
          title="Current Connection" 
          left={(props) => <Icon {...props} name="wifi" size={24} />}
        />
        <Card.Content>
          {config ? (
            <View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Server:</Text>
                <Text style={styles.value}>{config.host}:{config.port}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Secure:</Text>
                <Chip size="small">{config.secure ? 'HTTPS/WSS' : 'HTTP/WS'}</Chip>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Status:</Text>
                <Chip 
                  icon="check-circle" 
                  textStyle={{ color: '#4caf50' }}
                  style={{ backgroundColor: '#e8f5e8' }}
                >
                  Connected
                </Chip>
              </View>
            </View>
          ) : (
            <Text>No active connection</Text>
          )}
        </Card.Content>
      </Card>

      {/* App Settings */}
      <Card style={styles.card}>
        <Card.Title 
          title="App Settings" 
          left={(props) => <Icon {...props} name="settings" size={24} />}
        />
        <Card.Content>
          <List.Item
            title="Dark Mode"
            description="Use dark theme throughout the app"
            left={(props) => <List.Icon {...props} icon="brightness-6" />}
            right={() => (
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Notifications"
            description="Receive system alerts and notifications"
            left={(props) => <List.Icon {...props} icon="notifications" />}
            right={() => (
              <Switch
                value={notifications}
                onValueChange={setNotifications}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Auto Refresh"
            description="Automatically refresh system metrics"
            left={(props) => <List.Icon {...props} icon="autorenew" />}
            right={() => (
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
              />
            )}
          />
          {autoRefresh && (
            <View style={styles.subSetting}>
              <TextInput
                label="Refresh Interval (seconds)"
                value={refreshInterval}
                onChangeText={setRefreshInterval}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={styles.intervalInput}
              />
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Connection Profiles */}
      <Card style={styles.card}>
        <Card.Title 
          title="Connection Profiles" 
          left={(props) => <Icon {...props} name="bookmark" size={24} />}
          right={(props) => (
            <Button 
              mode="text" 
              icon="add"
              onPress={() => setProfileDialog(true)}
            >
              Add
            </Button>
          )}
        />
        <Card.Content>
          {profiles.length > 0 ? (
            profiles.map((profile) => (
              <List.Item
                key={profile.id}
                title={profile.name}
                description={`${profile.host}:${profile.port}`}
                left={(props) => <List.Icon {...props} icon="computer" />}
                right={(props) => (
                  <Button
                    mode="text"
                    icon="delete"
                    textColor="#f44336"
                    onPress={() => handleDeleteProfile(profile.id)}
                  >
                    Delete
                  </Button>
                )}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No saved connection profiles</Text>
          )}
        </Card.Content>
      </Card>

      {/* Security */}
      <Card style={styles.card}>
        <Card.Title 
          title="Security" 
          left={(props) => <Icon {...props} name="security" size={24} />}
        />
        <Card.Content>
          <List.Item
            title="Clear Authentication"
            description="Remove stored credentials and tokens"
            left={(props) => <List.Icon {...props} icon="lock-reset" />}
            onPress={() => {
              Alert.alert(
                'Clear Authentication',
                'This will remove all stored authentication data. You will need to login again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear', 
                    style: 'destructive',
                    onPress: () => dispatch(clearAuth())
                  }
                ]
              );
            }}
          />
          <Divider />
          <List.Item
            title="Logout"
            description="Disconnect and return to login screen"
            left={(props) => <List.Icon {...props} icon="logout" />}
            onPress={() => setLogoutDialog(true)}
          />
        </Card.Content>
      </Card>

      {/* About */}
      <Card style={styles.card}>
        <Card.Title 
          title="About" 
          left={(props) => <Icon {...props} name="info" size={24} />}
        />
        <Card.Content>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Version:</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Build:</Text>
            <Text style={styles.value}>Phase 1 Implementation</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Developer:</Text>
            <Text style={styles.value}>Nexus Terminal Team</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog visible={logoutDialog} onDismiss={() => setLogoutDialog(false)}>
          <Dialog.Title>Confirm Logout</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to logout and disconnect from the server?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialog(false)}>Cancel</Button>
            <Button onPress={handleLogout} buttonColor="#f44336">Logout</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Profile Dialog */}
      <Portal>
        <Dialog visible={profileDialog} onDismiss={() => setProfileDialog(false)}>
          <Dialog.Title>Add Connection Profile</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Profile Name"
              value={newProfileName}
              onChangeText={setNewProfileName}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="Host"
              value={newProfileHost}
              onChangeText={setNewProfileHost}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="Port"
              value={newProfilePort}
              onChangeText={setNewProfilePort}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setProfileDialog(false)}>Cancel</Button>
            <Button onPress={handleSaveProfile}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  subSetting: {
    paddingLeft: 56,
    paddingRight: 16,
    paddingTop: 8,
  },
  intervalInput: {
    width: 200,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 16,
  },
  dialogInput: {
    marginBottom: 16,
  },
});

export default SettingsScreen;
