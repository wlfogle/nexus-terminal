import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput as RNTextInput } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Chip,
  IconButton,
  Menu,
  Dialog,
  Portal,
  List,
  Divider
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { RootState, TerminalSession, CommandHistory } from '@/types';
import {
  createSession,
  executeCommand,
  terminateSession,
  setActiveSession,
  fetchHistory
} from '@/store/terminalSlice';
import { AppDispatch } from '@/store';
import { terminalService } from '@/services/terminalService';

const TerminalScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { sessions, activeSession, history, output, loading } = useSelector(
    (state: RootState) => state.terminal
  );
  const { status } = useSelector((state: RootState) => state.connection);

  const [command, setCommand] = useState('');
  const [sessionMenuVisible, setSessionMenuVisible] = useState(false);
  const [newSessionDialog, setNewSessionDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const commandInputRef = useRef<RNTextInput>(null);
  const outputRef = useRef<FlatList>(null);

  useEffect(() => {
    if (status === 'connected') {
      // Subscribe to terminal events
      terminalService.subscribeToTerminalOutput((data: any) => {
        setTerminalOutput(prev => [...prev, data.output]);
      });

      terminalService.subscribeToCommandExecution((data: CommandHistory) => {
        setTerminalOutput(prev => [
          ...prev,
          `$ ${data.command}`,
          data.output,
          data.exitCode !== 0 ? `Exit code: ${data.exitCode}` : ''
        ].filter(Boolean));
      });

      return () => {
        terminalService.unsubscribeFromTerminalEvents();
      };
    }
  }, [status]);

  useEffect(() => {
    if (activeSession) {
      dispatch(fetchHistory(activeSession));
    }
  }, [activeSession, dispatch]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      await dispatch(createSession(newSessionName)).unwrap();
      setNewSessionDialog(false);
      setNewSessionName('');
      setTerminalOutput([`Session '${newSessionName}' created`]);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleExecuteCommand = async () => {
    if (!command.trim() || !activeSession) return;

    const cmd = command.trim();
    setCommand('');
    
    // Add command to output immediately
    setTerminalOutput(prev => [...prev, `$ ${cmd}`]);

    try {
      // Use WebSocket for real-time execution
      terminalService.sendCommand(activeSession, cmd);
      
      // Also dispatch to Redux for history
      await dispatch(executeCommand({
        sessionId: activeSession,
        command: cmd
      })).unwrap();
    } catch (error) {
      setTerminalOutput(prev => [...prev, `Error: ${error}`]);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await dispatch(terminateSession(sessionId)).unwrap();
      setTerminalOutput(prev => [...prev, `Session terminated`]);
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  const handleSwitchSession = (sessionId: string) => {
    dispatch(setActiveSession(sessionId));
    setSessionMenuVisible(false);
    setTerminalOutput([`Switched to session: ${sessions.find(s => s.id === sessionId)?.name}`]);
  };

  const handleInterrupt = () => {
    if (activeSession) {
      terminalService.sendInterrupt(activeSession);
      setTerminalOutput(prev => [...prev, '^C']);
    }
  };

  const activeSessionData = sessions.find(s => s.id === activeSession);

  const renderOutputItem = ({ item, index }: { item: string; index: number }) => (
    <Text style={[
      styles.outputText,
      item.startsWith('$') && styles.commandText,
      item.startsWith('Error:') && styles.errorText,
      item.startsWith('Exit code:') && styles.exitCodeText
    ]} key={index}>
      {item}
    </Text>
  );

  if (status !== 'connected') {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Terminal Unavailable</Text>
            <Text style={styles.subtitle}>
              Connect to a server to access terminal functionality
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Session Management */}
      <Card style={styles.sessionCard}>
        <Card.Content>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionInfo}>
              {activeSessionData ? (
                <>
                  <Chip icon="terminal">{activeSessionData.name}</Chip>
                  <Text style={styles.sessionPath}>
                    {activeSessionData.currentDirectory}
                  </Text>
                </>
              ) : (
                <Text style={styles.noSession}>No active session</Text>
              )}
            </View>
            <View style={styles.sessionActions}>
              <Menu
                visible={sessionMenuVisible}
                onDismiss={() => setSessionMenuVisible(false)}
                anchor={
                  <IconButton
                    icon="menu"
                    onPress={() => setSessionMenuVisible(true)}
                  />
                }
              >
                {sessions.map((session) => (
                  <Menu.Item
                    key={session.id}
                    onPress={() => handleSwitchSession(session.id)}
                    title={session.name}
                    leadingIcon={session.id === activeSession ? "check" : "terminal"}
                  />
                ))}
                <Divider />
                <Menu.Item
                  onPress={() => setNewSessionDialog(true)}
                  title="New Session"
                  leadingIcon="plus"
                />
                {activeSessionData && (
                  <Menu.Item
                    onPress={() => handleTerminateSession(activeSession!)}
                    title="Close Session"
                    leadingIcon="close"
                  />
                )}
              </Menu>
              <IconButton
                icon="add"
                onPress={() => setNewSessionDialog(true)}
              />
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Terminal Output */}
      <Card style={styles.terminalCard}>
        <Card.Content style={styles.terminalContent}>
          <FlatList
            ref={outputRef}
            data={terminalOutput}
            renderItem={renderOutputItem}
            style={styles.outputList}
            onContentSizeChange={() => outputRef.current?.scrollToEnd()}
            keyExtractor={(item, index) => index.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyOutput}>
                {activeSessionData ? 'Ready for commands...' : 'Create or select a session to start'}
              </Text>
            }
          />
        </Card.Content>
      </Card>

      {/* Command Input */}
      <Card style={styles.inputCard}>
        <Card.Content>
          <View style={styles.inputContainer}>
            <TextInput
              ref={commandInputRef}
              label="Command"
              value={command}
              onChangeText={setCommand}
              mode="outlined"
              style={styles.commandInput}
              disabled={!activeSessionData}
              onSubmitEditing={handleExecuteCommand}
              right={
                <TextInput.Icon
                  icon="send"
                  onPress={handleExecuteCommand}
                  disabled={!command.trim() || !activeSessionData}
                />
              }
              multiline={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.inputActions}>
              <Button
                mode="text"
                icon="stop"
                onPress={handleInterrupt}
                disabled={!activeSessionData}
                compact
              >
                Ctrl+C
              </Button>
              <Button
                mode="text"
                icon="refresh"
                onPress={() => setTerminalOutput([])}
                compact
              >
                Clear
              </Button>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Command History */}
      {history.length > 0 && (
        <Card style={styles.historyCard}>
          <Card.Title
            title="Command History"
            left={(props) => <Icon {...props} name="history" size={24} />}
          />
          <Card.Content>
            {history.slice(-5).map((item) => (
              <List.Item
                key={item.id}
                title={item.command}
                description={`Exit code: ${item.exitCode} • ${new Date(item.timestamp).toLocaleTimeString()}`}
                left={(props) => <List.Icon {...props} icon="terminal" />}
                onPress={() => setCommand(item.command)}
              />
            ))}
          </Card.Content>
        </Card>
      )}

      {/* New Session Dialog */}
      <Portal>
        <Dialog visible={newSessionDialog} onDismiss={() => setNewSessionDialog(false)}>
          <Dialog.Title>Create New Terminal Session</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Session Name"
              value={newSessionName}
              onChangeText={setNewSessionName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewSessionDialog(false)}>Cancel</Button>
            <Button
              onPress={handleCreateSession}
              disabled={!newSessionName.trim()}
            >
              Create
            </Button>
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
  card: {
    margin: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  sessionCard: {
    margin: 16,
    marginBottom: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionPath: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  noSession: {
    color: '#666',
    fontStyle: 'italic',
  },
  sessionActions: {
    flexDirection: 'row',
  },
  terminalCard: {
    flex: 1,
    margin: 16,
    marginVertical: 8,
    backgroundColor: '#000000',
  },
  terminalContent: {
    flex: 1,
    padding: 8,
  },
  outputList: {
    flex: 1,
  },
  outputText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00ff00',
    marginVertical: 1,
  },
  commandText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff0000',
  },
  exitCodeText: {
    color: '#ffaa00',
    fontSize: 10,
  },
  emptyOutput: {
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  inputCard: {
    margin: 16,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'column',
  },
  commandInput: {
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  historyCard: {
    margin: 16,
    marginTop: 8,
    maxHeight: 200,
  },
});

export default TerminalScreen;
