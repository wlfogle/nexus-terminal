import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ProgressBar, Button, Chip } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { RootState } from '@/types';
import { fetchSystemMetrics } from '@/store/systemSlice';
import { AppDispatch } from '@/store';

const DashboardScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { metrics, loading } = useSelector((state: RootState) => state.system);
  const { status } = useSelector((state: RootState) => state.connection);

  useEffect(() => {
    if (status === 'connected') {
      dispatch(fetchSystemMetrics());
      // Set up periodic refresh
      const interval = setInterval(() => {
        dispatch(fetchSystemMetrics());
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [status, dispatch]);

  const refreshMetrics = () => {
    dispatch(fetchSystemMetrics());
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Connection Status */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusRow}>
              <Text style={styles.cardTitle}>Connection Status</Text>
              <Chip 
                icon="wifi" 
                textStyle={{ color: status === 'connected' ? '#4caf50' : '#f44336' }}
                style={{ 
                  backgroundColor: status === 'connected' ? '#e8f5e8' : '#ffebee' 
                }}
              >
                {status}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* System Metrics */}
        {metrics && (
          <>
            {/* CPU Usage */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.metricRow}>
                  <Icon name="memory" size={24} color="#1976d2" />
                  <Text style={styles.cardTitle}>CPU Usage</Text>
                </View>
                <Text style={styles.metricValue}>{metrics.cpu.usage.toFixed(1)}%</Text>
                <ProgressBar progress={metrics.cpu.usage / 100} style={styles.progressBar} />
                <Text style={styles.metricDetail}>
                  {metrics.cpu.cores} cores • {metrics.cpu.model}
                </Text>
              </Card.Content>
            </Card>

            {/* Memory Usage */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.metricRow}>
                  <Icon name="storage" size={24} color="#1976d2" />
                  <Text style={styles.cardTitle}>Memory Usage</Text>
                </View>
                <Text style={styles.metricValue}>{metrics.memory.percentage.toFixed(1)}%</Text>
                <ProgressBar progress={metrics.memory.percentage / 100} style={styles.progressBar} />
                <Text style={styles.metricDetail}>
                  {(metrics.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB / {(metrics.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
                </Text>
              </Card.Content>
            </Card>

            {/* Disk Usage */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.metricRow}>
                  <Icon name="folder" size={24} color="#1976d2" />
                  <Text style={styles.cardTitle}>Disk Usage</Text>
                </View>
                <Text style={styles.metricValue}>{metrics.disk.percentage.toFixed(1)}%</Text>
                <ProgressBar progress={metrics.disk.percentage / 100} style={styles.progressBar} />
                <Text style={styles.metricDetail}>
                  {(metrics.disk.used / 1024 / 1024 / 1024).toFixed(1)} GB / {(metrics.disk.total / 1024 / 1024 / 1024).toFixed(1)} GB
                </Text>
              </Card.Content>
            </Card>

            {/* System Info */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>System Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Uptime:</Text>
                  <Text style={styles.infoValue}>
                    {Math.floor(metrics.uptime / 3600)}h {Math.floor((metrics.uptime % 3600) / 60)}m
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Load Average:</Text>
                  <Text style={styles.infoValue}>
                    {metrics.loadAverage.map(load => load.toFixed(2)).join(', ')}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </>
        )}

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Card.Title title="Quick Actions" />
          <Card.Content>
            <View style={styles.buttonRow}>
              <Button 
                mode="outlined" 
                icon="refresh" 
                onPress={refreshMetrics}
                loading={loading}
                style={styles.button}
              >
                Refresh
              </Button>
              <Button 
                mode="outlined" 
                icon="terminal" 
                style={styles.button}
              >
                New Terminal
              </Button>
            </View>
          </Card.Content>
        </Card>
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
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    marginBottom: 8,
  },
  metricDetail: {
    fontSize: 14,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  infoValue: {
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default DashboardScreen;
