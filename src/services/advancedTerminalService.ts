import { TerminalSession } from '@/types';
import { terminalService } from './terminalService';

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  active: boolean;
  pinned: boolean;
  color?: string;
}

interface TerminalPane {
  id: string;
  sessionId: string;
  position: { x: number; y: number; width: number; height: number };
  active: boolean;
  minimized: boolean;
}

interface TerminalTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  colors: {
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

class AdvancedTerminalService {
  private tabs: Map<string, TerminalTab> = new Map();
  private panes: Map<string, TerminalPane> = new Map();
  private themes: Map<string, TerminalTheme> = new Map();
  private activeTabId: string | null = null;
  private activePaneId: string | null = null;
  private tabCallbacks: ((tabs: TerminalTab[]) => void)[] = [];
  private paneCallbacks: ((panes: TerminalPane[]) => void)[] = [];
  private splitMode: 'horizontal' | 'vertical' | 'grid' = 'horizontal';

  async initialize(): Promise<void> {
    this.loadDefaultThemes();
    console.log('🖥️ Advanced Terminal Service initialized');
  }

  // Tab Management
  async createTab(title?: string): Promise<string> {
    try {
      const sessionId = await terminalService.createSession(title || 'New Session');
      const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const tab: TerminalTab = {
        id: tabId,
        sessionId,
        title: title || `Tab ${this.tabs.size + 1}`,
        active: false,
        pinned: false
      };

      this.tabs.set(tabId, tab);
      
      // Activate the new tab
      await this.activateTab(tabId);
      
      this.notifyTabsChange();
      return tabId;
    } catch (error) {
      console.error('Failed to create tab:', error);
      throw error;
    }
  }

  async closeTab(tabId: string): Promise<boolean> {
    try {
      const tab = this.tabs.get(tabId);
      if (!tab) return false;

      // Don't close pinned tabs
      if (tab.pinned) return false;

      // Terminate the session
      await terminalService.terminateSession(tab.sessionId);
      
      // Remove tab
      this.tabs.delete(tabId);
      
      // If this was the active tab, activate another one
      if (this.activeTabId === tabId) {
        const remainingTabs = Array.from(this.tabs.keys());
        if (remainingTabs.length > 0) {
          await this.activateTab(remainingTabs[0]);
        } else {
          this.activeTabId = null;
        }
      }

      this.notifyTabsChange();
      return true;
    } catch (error) {
      console.error('Failed to close tab:', error);
      return false;
    }
  }

  async activateTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Deactivate current tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.active = false;
      }
    }

    // Activate new tab
    tab.active = true;
    this.activeTabId = tabId;

    // Switch terminal session
    await terminalService.switchSession(tab.sessionId);

    this.notifyTabsChange();
    return true;
  }

  async renameTab(tabId: string, newTitle: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.title = newTitle;
    this.notifyTabsChange();
    return true;
  }

  async pinTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.pinned = !tab.pinned;
    this.notifyTabsChange();
    return true;
  }

  async setTabColor(tabId: string, color: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.color = color;
    this.notifyTabsChange();
    return true;
  }

  // Pane Management
  async createPane(position?: { x: number; y: number; width: number; height: number }): Promise<string> {
    try {
      const sessionId = await terminalService.createSession('Split Pane');
      const paneId = `pane_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const defaultPosition = position || this.calculatePanePosition();
      
      const pane: TerminalPane = {
        id: paneId,
        sessionId,
        position: defaultPosition,
        active: false,
        minimized: false
      };

      this.panes.set(paneId, pane);
      
      // Activate the new pane
      await this.activatePane(paneId);
      
      this.notifyPanesChange();
      return paneId;
    } catch (error) {
      console.error('Failed to create pane:', error);
      throw error;
    }
  }

  async closePane(paneId: string): Promise<boolean> {
    try {
      const pane = this.panes.get(paneId);
      if (!pane) return false;

      // Terminate the session
      await terminalService.terminateSession(pane.sessionId);
      
      // Remove pane
      this.panes.delete(paneId);
      
      // Reorganize remaining panes
      await this.reorganizePanes();
      
      // If this was the active pane, activate another one
      if (this.activePaneId === paneId) {
        const remainingPanes = Array.from(this.panes.keys());
        if (remainingPanes.length > 0) {
          await this.activatePane(remainingPanes[0]);
        } else {
          this.activePaneId = null;
        }
      }

      this.notifyPanesChange();
      return true;
    } catch (error) {
      console.error('Failed to close pane:', error);
      return false;
    }
  }

  async activatePane(paneId: string): Promise<boolean> {
    const pane = this.panes.get(paneId);
    if (!pane) return false;

    // Deactivate current pane
    if (this.activePaneId) {
      const currentPane = this.panes.get(this.activePaneId);
      if (currentPane) {
        currentPane.active = false;
      }
    }

    // Activate new pane
    pane.active = true;
    this.activePaneId = paneId;

    // Switch terminal session
    await terminalService.switchSession(pane.sessionId);

    this.notifyPanesChange();
    return true;
  }

  async resizePane(paneId: string, newPosition: { x: number; y: number; width: number; height: number }): Promise<boolean> {
    const pane = this.panes.get(paneId);
    if (!pane) return false;

    pane.position = newPosition;
    this.notifyPanesChange();
    return true;
  }

  async setSplitMode(mode: 'horizontal' | 'vertical' | 'grid'): Promise<void> {
    this.splitMode = mode;
    await this.reorganizePanes();
  }

  // Theme Management
  async applyTheme(themeId: string): Promise<boolean> {
    const theme = this.themes.get(themeId);
    if (!theme) return false;

    // Apply theme to all active sessions
    console.log(`🎨 Applying theme: ${theme.name}`);
    return true;
  }

  async createCustomTheme(theme: Omit<TerminalTheme, 'id'>): Promise<string> {
    const themeId = `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.themes.set(themeId, {
      id: themeId,
      ...theme
    });

    return themeId;
  }

  getThemes(): TerminalTheme[] {
    return Array.from(this.themes.values());
  }

  getTabs(): TerminalTab[] {
    return Array.from(this.tabs.values());
  }

  getPanes(): TerminalPane[] {
    return Array.from(this.panes.values());
  }

  getActiveTab(): TerminalTab | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  getActivePane(): TerminalPane | null {
    return this.activePaneId ? this.panes.get(this.activePaneId) || null : null;
  }

  onTabsChange(callback: (tabs: TerminalTab[]) => void): void {
    this.tabCallbacks.push(callback);
  }

  onPanesChange(callback: (panes: TerminalPane[]) => void): void {
    this.paneCallbacks.push(callback);
  }

  private calculatePanePosition(): { x: number; y: number; width: number; height: number } {
    const paneCount = this.panes.size;
    
    switch (this.splitMode) {
      case 'horizontal':
        return {
          x: 0,
          y: paneCount * (100 / (paneCount + 1)),
          width: 100,
          height: 100 / (paneCount + 1)
        };
        
      case 'vertical':
        return {
          x: paneCount * (100 / (paneCount + 1)),
          y: 0,
          width: 100 / (paneCount + 1),
          height: 100
        };
        
      case 'grid':
        const cols = Math.ceil(Math.sqrt(paneCount + 1));
        const rows = Math.ceil((paneCount + 1) / cols);
        const col = paneCount % cols;
        const row = Math.floor(paneCount / cols);
        
        return {
          x: (col * 100) / cols,
          y: (row * 100) / rows,
          width: 100 / cols,
          height: 100 / rows
        };
        
      default:
        return { x: 0, y: 0, width: 100, height: 100 };
    }
  }

  private async reorganizePanes(): Promise<void> {
    const paneArray = Array.from(this.panes.values());
    
    paneArray.forEach((pane, index) => {
      const newPosition = this.calculatePanePositionForIndex(index, paneArray.length);
      pane.position = newPosition;
    });

    this.notifyPanesChange();
  }

  private calculatePanePositionForIndex(index: number, total: number): { x: number; y: number; width: number; height: number } {
    switch (this.splitMode) {
      case 'horizontal':
        return {
          x: 0,
          y: index * (100 / total),
          width: 100,
          height: 100 / total
        };
        
      case 'vertical':
        return {
          x: index * (100 / total),
          y: 0,
          width: 100 / total,
          height: 100
        };
        
      case 'grid':
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        return {
          x: (col * 100) / cols,
          y: (row * 100) / rows,
          width: 100 / cols,
          height: 100 / rows
        };
        
      default:
        return { x: 0, y: 0, width: 100, height: 100 };
    }
  }

  private loadDefaultThemes(): void {
    // Default dark theme
    this.themes.set('dark', {
      id: 'dark',
      name: 'Dark',
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: '#264f78',
      colors: {
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    });

    // Default light theme
    this.themes.set('light', {
      id: 'light',
      name: 'Light',
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      selection: '#add6ff',
      colors: {
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5'
      }
    });

    // Monokai theme
    this.themes.set('monokai', {
      id: 'monokai',
      name: 'Monokai',
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      selection: '#49483e',
      colors: {
        black: '#272822',
        red: '#f92672',
        green: '#a6e22e',
        yellow: '#f4bf75',
        blue: '#66d9ef',
        magenta: '#ae81ff',
        cyan: '#a1efe4',
        white: '#f8f8f2',
        brightBlack: '#75715e',
        brightRed: '#f92672',
        brightGreen: '#a6e22e',
        brightYellow: '#f4bf75',
        brightBlue: '#66d9ef',
        brightMagenta: '#ae81ff',
        brightCyan: '#a1efe4',
        brightWhite: '#f9f8f5'
      }
    });
  }

  private notifyTabsChange(): void {
    const tabs = this.getTabs();
    this.tabCallbacks.forEach(callback => {
      try {
        callback(tabs);
      } catch (error) {
        console.error('Tab callback error:', error);
      }
    });
  }

  private notifyPanesChange(): void {
    const panes = this.getPanes();
    this.paneCallbacks.forEach(callback => {
      try {
        callback(panes);
      } catch (error) {
        console.error('Pane callback error:', error);
      }
    });
  }

  dispose(): void {
    this.tabs.clear();
    this.panes.clear();
    this.tabCallbacks = [];
    this.paneCallbacks = [];
    this.activeTabId = null;
    this.activePaneId = null;
  }
}

export const advancedTerminalService = new AdvancedTerminalService();
