import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Chip, 
  DataTable, 
  Searchbar,
  Menu,
  Divider,
  Dialog,
  Portal
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { RootState, Process, Service } from '@/types';
import { 
  fetchProcesses, 
  fetchServices, 
  killProcess, 
  controlService 
} from '@/store/systemSlice';
import { AppDispatch } from '@/store';

const SystemScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { processes, services, loading } = useSelector((state: RootState) => state.system);
  const { status } = useSelector((state: RootState) => state.connection);

  const [activeTab, setActiveTab] = useState<'processes' | 'services'>('processes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    if (status === 'connected') {
      dispatch(fetchProcesses());
      dispatch(fetchServices());
      
      const interval = setInterval(() => {
        if (activeTab === 'processes') {
          dispatch(fetchProcesses());
        } else {
          dispatch(fetchServices());
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [status, activeTab, dispatch]);

  const filteredProcesses = processes.filter(process =>
    process.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    process.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKillProcess = async () => {
    if (selectedProcess) {
      await dispatch(killProcess(selectedProcess.pid));
      setSelectedProcess(null);
      setConfirmDialog(false);
    }
  };

  const handleControlService = async (action: 'start' | 'stop' | 'restart') => {
    if (selectedService) {
      await dispatch(controlService({ name: selectedService.name, action }));
      setSelectedService(null);
      setMenuVisible(false);
    }
  };

  const renderProcessItem = ({ item }: { item: Process }) => (
    <DataTable.Row 
      onPress={() => setSelectedProcess(item)}
      style={selectedProcess?.pid === item.pid ? styles.selectedRow : undefined}
    >
      <DataTable.Cell style={styles.pidCell}>
        <Text style={styles.pidText}>{item.pid}</Text>
      </DataTable.Cell>
      <DataTable.Cell style={styles.nameCell}>
        <View>
          <Text style={styles.processName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.processCommand} numberOfLines={1}>{item.command}</Text>
        </View>
      </DataTable.Cell>
      <DataTable.Cell numeric style={styles.cpuCell}>
        <Text style={styles.metricText}>{item.cpu.toFixed(1)}%</Text>
      </DataTable.Cell>
      <DataTable.Cell numeric style={styles.memoryCell}>
        <Text style={styles.metricText}>{item.memory.toFixed(1)}%</Text>
      </DataTable.Cell>
    </DataTable.Row>
  );

  const renderServiceItem = ({ item }: { item: Service }) => (
    <Card style={styles.serviceCard} onPress={() => setSelectedService(item)}>
      <Card.Content>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Chip 
            icon={item.status === 'active' ? 'check-circle' : 'alert-circle'}
            textStyle={{ color: getStatusColor(item.status) }}
            style={{ backgroundColor: getStatusBgColor(item.status) }}
          >
            {item.status}
          </Chip>
        </View>
        <Text style={styles.serviceDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.serviceFooter}>
          <Chip size="small" disabled={!item.enabled}>
            {item.enabled ? 'Enabled' : 'Disabled'}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'inactive': return '#ff9800';
      case 'failed': return '#f44336';
      default: return '#757575';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'active': return '#e8f5e8';
      case 'inactive': return '#fff3e0';
      case 'failed': return '#ffebee';
      default: return '#f5f5f5';
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <Button
          mode={activeTab === 'processes' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('processes')}
          style={styles.tabButton}
        >
          Processes ({processes.length})
        </Button>
        <Button
          mode={activeTab === 'services' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('services')}
          style={styles.tabButton}
        >
          Services ({services.length})
        </Button>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder={`Search ${activeTab}...`}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Content */}
      {activeTab === 'processes' ? (
        <View style={styles.content}>
          <DataTable style={styles.table}>
            <DataTable.Header>
              <DataTable.Title style={styles.pidCell}>PID</DataTable.Title>
              <DataTable.Title style={styles.nameCell}>Process</DataTable.Title>
              <DataTable.Title numeric style={styles.cpuCell}>CPU</DataTable.Title>
              <DataTable.Title numeric style={styles.memoryCell}>MEM</DataTable.Title>
            </DataTable.Header>
            <FlatList
              data={filteredProcesses}
              keyExtractor={(item) => item.pid.toString()}
              renderItem={renderProcessItem}
              style={styles.list}
            />
          </DataTable>
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.name}
          renderItem={renderServiceItem}
          contentContainerStyle={styles.servicesList}
          style={styles.list}
        />
      )}

      {/* Process Actions */}
      {selectedProcess && (
        <Card style={styles.actionCard}>
          <Card.Content>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>
                Selected: {selectedProcess.name} (PID: {selectedProcess.pid})
              </Text>
              <Button 
                mode="text" 
                onPress={() => setSelectedProcess(null)}
                icon="close"
                compact
              />
            </View>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon="stop"
                buttonColor="#f44336"
                onPress={() => setConfirmDialog(true)}
              >
                Kill Process
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Service Actions */}
      {selectedService && (
        <Card style={styles.actionCard}>
          <Card.Content>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>
                Selected: {selectedService.name}
              </Text>
              <Button 
                mode="text" 
                onPress={() => setSelectedService(null)}
                icon="close"
                compact
              />
            </View>
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                icon="play-arrow"
                onPress={() => handleControlService('start')}
                disabled={selectedService.status === 'active'}
              >
                Start
              </Button>
              <Button
                mode="outlined"
                icon="stop"
                onPress={() => handleControlService('stop')}
                disabled={selectedService.status === 'inactive'}
              >
                Stop
              </Button>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={() => handleControlService('restart')}
              >
                Restart
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Portal>
        <Dialog visible={confirmDialog} onDismiss={() => setConfirmDialog(false)}>
          <Dialog.Title>Confirm Action</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to kill process "{selectedProcess?.name}" (PID: {selectedProcess?.pid})?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialog(false)}>Cancel</Button>
            <Button onPress={handleKillProcess} buttonColor="#f44336">Kill</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  searchBar: {
    margin: 16,
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  table: {
    backgroundColor: 'white',
  },
  list: {
    flex: 1,
  },
  servicesList: {
    padding: 16,
  },
  pidCell: {
    flex: 0.8,
    justifyContent: 'center',
  },
  nameCell: {
    flex: 3,
  },
  cpuCell: {
    flex: 1,
  },
  memoryCell: {
    flex: 1,
  },
  selectedRow: {
    backgroundColor: '#e3f2fd',
  },
  pidText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  processName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  processCommand: {
    fontSize: 12,
    color: '#666',
  },
  metricText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  serviceCard: {
    marginBottom: 8,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionCard: {
    margin: 16,
    marginTop: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});

export default SystemScreen;
