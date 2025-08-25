import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import TerminalView from './components/TerminalView';
import AIAssistant from './components/AIAssistant';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize the app
    const initApp = async () => {
      try {
        // Initialize AI service and terminal
        await invoke('get_system_info');
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
          <p className="mt-4 text-lg">Initializing WarpAI Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <Provider store={store}>
      <Router>
        <div className="app h-screen bg-gray-900 text-white">
          <div className="flex h-full">
            {/* Main terminal area */}
            <div className="flex-1 flex flex-col">
              <Routes>
                <Route path="/" element={<TerminalView />} />
              </Routes>
            </div>
            
            {/* AI Assistant Panel */}
            <div className="w-80 border-l border-gray-700">
        <AIAssistant />
            </div>
          </div>
        </div>
      </Router>
    </Provider>
  );
}

export default App;
