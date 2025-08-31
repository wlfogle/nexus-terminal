import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { FileItem, FileOperation } from '@/types';
import { fileService } from '@/services/fileService';

interface FilesState {
  currentPath: string;
  files: FileItem[];
  selectedFiles: string[];
  clipboard: FileOperation | null;
  loading: boolean;
  error: string | null;
}

const initialState: FilesState = {
  currentPath: '/',
  files: [],
  selectedFiles: [],
  clipboard: null,
  loading: false,
  error: null,
};

// Async thunks
export const browseDirectory = createAsyncThunk(
  'files/browse',
  async (path: string, { rejectWithValue }) => {
    try {
      const files = await fileService.browseDirectory(path);
      return { path, files };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to browse directory');
    }
  }
);

export const createFile = createAsyncThunk(
  'files/create',
  async ({ path, type }: { path: string; type: 'file' | 'directory' }, { rejectWithValue }) => {
    try {
      const file = await fileService.createFile(path, type);
      return file;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create file');
    }
  }
);

export const deleteFiles = createAsyncThunk(
  'files/delete',
  async (paths: string[], { rejectWithValue }) => {
    try {
      await fileService.deleteFiles(paths);
      return paths;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete files');
    }
  }
);

export const uploadFile = createAsyncThunk(
  'files/upload',
  async ({ localPath, remotePath }: { localPath: string; remotePath: string }, { rejectWithValue }) => {
    try {
      const file = await fileService.uploadFile(localPath, remotePath);
      return file;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to upload file');
    }
  }
);

export const downloadFile = createAsyncThunk(
  'files/download',
  async ({ remotePath, localPath }: { remotePath: string; localPath: string }, { rejectWithValue }) => {
    try {
      await fileService.downloadFile(remotePath, localPath);
      return remotePath;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to download file');
    }
  }
);

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setCurrentPath: (state, action: PayloadAction<string>) => {
      state.currentPath = action.payload;
    },
    selectFiles: (state, action: PayloadAction<string[]>) => {
      state.selectedFiles = action.payload;
    },
    addSelectedFile: (state, action: PayloadAction<string>) => {
      if (!state.selectedFiles.includes(action.payload)) {
        state.selectedFiles.push(action.payload);
      }
    },
    removeSelectedFile: (state, action: PayloadAction<string>) => {
      state.selectedFiles = state.selectedFiles.filter(f => f !== action.payload);
    },
    clearSelection: (state) => {
      state.selectedFiles = [];
    },
    copyFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.clipboard = {
        type: 'copy',
        files: action.payload,
        source: state.currentPath,
      };
    },
    cutFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.clipboard = {
        type: 'cut',
        files: action.payload,
        source: state.currentPath,
      };
    },
    clearClipboard: (state) => {
      state.clipboard = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Browse directory cases
      .addCase(browseDirectory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(browseDirectory.fulfilled, (state, action) => {
        state.currentPath = action.payload.path;
        state.files = action.payload.files;
        state.loading = false;
        state.selectedFiles = [];
      })
      .addCase(browseDirectory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create file cases
      .addCase(createFile.fulfilled, (state, action) => {
        state.files.push(action.payload);
      })
      // Delete files cases
      .addCase(deleteFiles.fulfilled, (state, action) => {
        const deletedPaths = action.payload;
        state.files = state.files.filter(f => !deletedPaths.includes(f.path));
        state.selectedFiles = [];
      })
      // Upload file cases
      .addCase(uploadFile.fulfilled, (state, action) => {
        const existingIndex = state.files.findIndex(f => f.path === action.payload.path);
        if (existingIndex >= 0) {
          state.files[existingIndex] = action.payload;
        } else {
          state.files.push(action.payload);
        }
      });
  },
});

export const {
  setCurrentPath,
  selectFiles,
  addSelectedFile,
  removeSelectedFile,
  clearSelection,
  copyFiles,
  cutFiles,
  clearClipboard,
  clearError,
} = filesSlice.actions;

export default filesSlice.reducer;
