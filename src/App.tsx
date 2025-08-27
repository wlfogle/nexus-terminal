import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { WarpStyleTerminal } from './components/terminal/WarpStyleTerminal';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize the app
    const initApp = async () => {
      try {
        // Check if we're in Tauri context
        const isTauriContext = typeof window !== 'undefined' && (window as any).__TAURI__;
        
        if (isTauriContext) {
          // Initialize AI service and terminal in Tauri context
          await invoke('get_system_info');
        } else {
          // Browser context - mock initialization
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate init delay
        }
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsReady(true); // Still allow the app to load
      }
    };

    initApp();
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Initializing NexusTerminal...</p>
        </div>
      </div>
    );
  }

  return (
    <Provider store={store}>
      <Router>
        <div className="app h-screen bg-gray-900 text-white">
          <Routes>
            <Route path="/" element={<WarpStyleTerminal />} />
          </Routes>
        </div>
      </Router>
    </Provider>
  );
}

export default App;
