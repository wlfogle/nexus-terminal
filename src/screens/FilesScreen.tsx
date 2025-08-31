import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  List,
  IconButton,
  Menu,
  Searchbar,
  Dialog,
  Portal,
  TextInput,
  Chip,
  FAB,
  ProgressBar
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DocumentPicker from 'react-native-document-picker';

import { RootState, FileItem, FileOperation } from '@/types';
import {
  browseDirectory,
  createFile,
  deleteFiles,
  uploadFile,
  downloadFile,
  selectFiles,
  addSelectedFile,
  removeSelectedFile,
  clearSelection,
  copyFiles,
  cutFiles,
  setCurrentPath
} from '@/store/filesSlice';
import { AppDispatch } from '@/store';
import { fileService } from '@/services/fileService';

const FilesScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { 
    currentPath, 
    files, 
    selectedFiles, 
    clipboard, 
    loading, 
    error 
  } = useSelector((state: RootState) => state.files);
  const { status } = useSelector((state: RootState) => state.connection);

  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [createName, setCreateName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showHidden, setShowHidden] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ visible: boolean; file?: FileItem }>({ visible: false });
  const [newName, setNewName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (status === 'connected') {
      dispatch(browseDirectory(currentPath));
      
      // Subscribe to file change events
      fileService.subscribeToFileChanges((event: any) => {
        if (event.path.startsWith(currentPath)) {
          dispatch(browseDirectory(currentPath));
        }
      });

      return () => {
        fileService.unsubscribeFromFileChanges();
      };
    }
  }, [status, currentPath, dispatch]);

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHidden = showHidden || !file.isHidden;
    return matchesSearch && matchesHidden;
  });

  const handleNavigate = (path: string) => {
    dispatch(setCurrentPath(path));
    dispatch(browseDirectory(path));
    dispatch(clearSelection());
  };

  const handleNavigateUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    handleNavigate(parentPath);
  };

  const handleFilePress = (file: FileItem) => {
    if (selectedFiles.length > 0) {
      // Multi-select mode
      if (selectedFiles.includes(file.path)) {
        dispatch(removeSelectedFile(file.path));
      } else {
        dispatch(addSelectedFile(file.path));
      }
    } else {
      // Normal mode
      if (file.type === 'directory') {
        handleNavigate(file.path);
      } else {
        // Open file for editing or viewing
        handleEditFile(file);
      }
    }
  };

  const handleFileLongPress = (file: FileItem) => {
    if (!selectedFiles.includes(file.path)) {
      dispatch(addSelectedFile(file.path));
    }
  };

  const handleCreateFile = async () => {
    if (!createName.trim()) return;

    const fullPath = `${currentPath}/${createName}`.replace('//', '/');
    
    try {
      await dispatch(createFile({ path: fullPath, type: createType })).unwrap();
      setCreateDialog(false);
      setCreateName('');
      dispatch(browseDirectory(currentPath));
    } catch (error) {
      Alert.alert('Error', `Failed to create ${createType}`);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.length === 0) return;

    Alert.alert(
      'Delete Files',
      `Are you sure you want to delete ${selectedFiles.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteFiles(selectedFiles)).unwrap();
              dispatch(clearSelection());
            } catch (error) {
              Alert.alert('Error', 'Failed to delete files');
            }
          }
        }
      ]
    );
  };

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      if (result && result[0]) {
        const file = result[0];
        const remotePath = `${currentPath}/${file.name}`.replace('//', '/');
        
        setIsUploading(true);
        setUploadProgress(0);
        
        await dispatch(uploadFile({
          localPath: file.uri,
          remotePath
        })).unwrap();
        
        setIsUploading(false);
        dispatch(browseDirectory(currentPath));
      }
    } catch (error) {
      setIsUploading(false);
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Failed to upload file');
      }
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      const localPath = `/storage/emulated/0/Download/${file.name}`;
      await dispatch(downloadFile({
        remotePath: file.path,
        localPath
      })).unwrap();
      Alert.alert('Success', `File downloaded to Downloads/${file.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const handleEditFile = async (file: FileItem) => {
    try {
      const content = await fileService.readFileContent(file.path);
      Alert.alert(
        'File Content',
        content.length > 500 ? content.substring(0, 500) + '...' : content,
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Download', onPress: () => handleDownloadFile(file) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to read file content');
    }
  };

  const handleCopyFiles = () => {
    const filesToCopy = files.filter(f => selectedFiles.includes(f.path));
    dispatch(copyFiles(filesToCopy));
    dispatch(clearSelection());
  };

  const handleCutFiles = () => {
    const filesToCut = files.filter(f => selectedFiles.includes(f.path));
    dispatch(cutFiles(filesToCut));
    dispatch(clearSelection());
  };

  const handlePasteFiles = async () => {
    if (!clipboard) return;

    try {
      const sourcePaths = clipboard.files.map(f => f.path);
      if (clipboard.type === 'copy') {
        await fileService.copyFiles(sourcePaths, currentPath);
      } else {
        await fileService.moveFiles(sourcePaths, currentPath);
      }
      dispatch(browseDirectory(currentPath));
    } catch (error) {
      Alert.alert('Error', 'Failed to paste files');
    }
  };

  const handleRenameFile = async () => {
    if (!renameDialog.file || !newName.trim()) return;

    try {
      const newPath = renameDialog.file.path.replace(
        renameDialog.file.name,
        newName
      );
      await fileService.renameFile(renameDialog.file.path, newPath);
      setRenameDialog({ visible: false });
      setNewName('');
      dispatch(browseDirectory(currentPath));
    } catch (error) {
      Alert.alert('Error', 'Failed to rename file');
    }
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') return 'folder';
    if (file.type === 'symlink') return 'link';
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'txt': case 'md': case 'log': return 'description';
      case 'js': case 'ts': case 'jsx': case 'tsx': return 'code';
      case 'json': case 'xml': case 'yaml': case 'yml': return 'data-object';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': return 'image';
      case 'mp4': case 'avi': case 'mkv': case 'mov': return 'movie';
      case 'mp3': case 'wav': case 'flac': return 'music-note';
      case 'pdf': return 'picture-as-pdf';
      case 'zip': case 'tar': case 'gz': case 'rar': return 'archive';
      default: return 'insert-drive-file';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFileItem = ({ item }: { item: FileItem }) => {
    const isSelected = selectedFiles.includes(item.path);
    
    return (
      <List.Item
        title={item.name}
        description={`${formatFileSize(item.size)} • ${item.permissions} • ${new Date(item.modified).toLocaleDateString()}`}
        left={(props) => (
          <List.Icon 
            {...props} 
            icon={getFileIcon(item)}
            color={item.type === 'directory' ? '#1976d2' : undefined}
          />
        )}
        right={() => isSelected ? <Icon name="check-circle" size={24} color="#1976d2" /> : null}
        onPress={() => handleFilePress(item)}
        onLongPress={() => handleFileLongPress(item)}
        style={[
          styles.fileItem,
          isSelected && styles.selectedFileItem
        ]}
      />
    );
  };

  if (status !== 'connected') {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Files Unavailable</Text>
            <Text style={styles.subtitle}>
              Connect to a server to access file management
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Path Navigation */}
      <Card style={styles.pathCard}>
        <Card.Content>
          <View style={styles.pathContainer}>
            <IconButton
              icon="arrow-back"
              onPress={handleNavigateUp}
              disabled={currentPath === '/'}
            />
            <Text style={styles.pathText} numberOfLines={1}>
              {currentPath}
            </Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="more-vert"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => setShowHidden(!showHidden)}
                title={showHidden ? 'Hide Hidden Files' : 'Show Hidden Files'}
                leadingIcon={showHidden ? 'visibility-off' : 'visibility'}
              />
              <Menu.Item
                onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                title={viewMode === 'list' ? 'Grid View' : 'List View'}
                leadingIcon={viewMode === 'list' ? 'grid-view' : 'view-list'}
              />
            </Menu>
          </View>
        </Card.Content>
      </Card>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search files..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Selection Actions */}
      {selectedFiles.length > 0 && (
        <Card style={styles.actionsCard}>
          <Card.Content>
            <View style={styles.actionsContainer}>
              <Chip icon="check" compact>
                {selectedFiles.length} selected
              </Chip>
              <View style={styles.actionButtons}>
                <IconButton icon="content-copy" onPress={handleCopyFiles} />
                <IconButton icon="content-cut" onPress={handleCutFiles} />
                <IconButton icon="delete" onPress={handleDeleteSelected} />
                <IconButton icon="close" onPress={() => dispatch(clearSelection())} />
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* File List */}
      {loading && <ProgressBar indeterminate style={styles.progressBar} />}
      
      <FlatList
        data={filteredFiles}
        keyExtractor={(item) => item.path}
        renderItem={renderFileItem}
        style={styles.fileList}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No files match your search' : 'This directory is empty'}
              </Text>
            </Card.Content>
          </Card>
        }
      />

      {/* Upload Progress */}
      {isUploading && (
        <Card style={styles.progressCard}>
          <Card.Content>
            <Text>Uploading file...</Text>
            <ProgressBar progress={uploadProgress / 100} style={styles.uploadProgress} />
          </Card.Content>
        </Card>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        {clipboard && (
          <FAB
            icon="content-paste"
            style={[styles.fab, styles.pasteFab]}
            onPress={handlePasteFiles}
            size="small"
          />
        )}
        <FAB
          icon="upload"
          style={[styles.fab, styles.uploadFab]}
          onPress={handleUploadFile}
          size="small"
        />
        <FAB
          icon="add"
          style={[styles.fab, styles.createFab]}
          onPress={() => setCreateDialog(true)}
        />
      </View>

      {/* Create File/Directory Dialog */}
      <Portal>
        <Dialog visible={createDialog} onDismiss={() => setCreateDialog(false)}>
          <Dialog.Title>Create New {createType}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.createTypeContainer}>
              <Button
                mode={createType === 'file' ? 'contained' : 'outlined'}
                onPress={() => setCreateType('file')}
                style={styles.typeButton}
              >
                File
              </Button>
              <Button
                mode={createType === 'directory' ? 'contained' : 'outlined'}
                onPress={() => setCreateType('directory')}
                style={styles.typeButton}
              >
                Directory
              </Button>
            </View>
            <TextInput
              label={`${createType} name`}
              value={createName}
              onChangeText={setCreateName}
              mode="outlined"
              autoFocus
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialog(false)}>Cancel</Button>
            <Button onPress={handleCreateFile} disabled={!createName.trim()}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Rename Dialog */}
      <Portal>
        <Dialog visible={renameDialog.visible} onDismiss={() => setRenameDialog({ visible: false })}>
          <Dialog.Title>Rename {renameDialog.file?.name}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="New name"
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialog({ visible: false })}>Cancel</Button>
            <Button onPress={handleRenameFile} disabled={!newName.trim()}>
              Rename
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
  pathCard: {
    margin: 16,
    marginBottom: 8,
  },
  pathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
    marginHorizontal: 8,
  },
  searchBar: {
    margin: 16,
    marginTop: 8,
  },
  actionsCard: {
    margin: 16,
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  progressBar: {
    margin: 16,
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 1,
  },
  selectedFileItem: {
    backgroundColor: '#e3f2fd',
  },
  emptyCard: {
    margin: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  progressCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  uploadProgress: {
    marginTop: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  fab: {
    marginBottom: 8,
  },
  createFab: {
    backgroundColor: '#1976d2',
  },
  uploadFab: {
    backgroundColor: '#4caf50',
  },
  pasteFab: {
    backgroundColor: '#ff9800',
  },
  createTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  dialogInput: {
    marginTop: 8,
  },
});

export default FilesScreen;
