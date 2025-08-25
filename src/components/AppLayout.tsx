import React, { useState, useCallback } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NavigationSidebar from './NavigationSidebar';
import { MultiCameraDashboard } from './MultiCameraDashboard';
import { CameraGrid } from './CameraGrid';
import { MultiViewfinderGrid } from './MultiViewfinderGrid';
import { PresetLibrary } from './PresetLibrary';
import { FirmwareUpdateManager } from './FirmwareUpdateManager';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ProtocolAnalyzer } from './ProtocolAnalyzer';
import { SetupWizard } from './SetupWizard';
import { lightTheme, darkTheme } from '../styles/theme';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};
    transition: background-color ${props => props.theme.transitions.default},
                color ${props => props.theme.transitions.default};
  }

  #root {
    height: 100vh;
    overflow: hidden;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.surface};
  }

  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.border};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${props => props.theme.colors.textSecondary};
  }

  /* Focus styles for accessibility */
  *:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }

  button:focus,
  input:focus,
  select:focus,
  textarea:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`;

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
`;

const MainContent = styled.main<{ $sidebarCollapsed: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: ${props => props.$sidebarCollapsed ? '60px' : '280px'};
  transition: margin-left ${props => props.theme.transitions.default};
  overflow: hidden;

  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const Header = styled.header`
  background-color: ${props => props.theme.colors.surface};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 64px;
  box-shadow: 0 1px 3px ${props => props.theme.colors.shadow};
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const Breadcrumb = styled.nav`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;

  .separator {
    color: ${props => props.theme.colors.border};
  }

  .current {
    color: ${props => props.theme.colors.text};
    font-weight: 500;
  }
`;

const SystemStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  font-size: 14px;
`;

const StatusIndicator = styled.div<{ $status: 'online' | 'offline' | 'warning' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.$status) {
      case 'online': return props.theme.colors.success;
      case 'warning': return props.theme.colors.warning;
      case 'error': return props.theme.colors.danger;
      default: return props.theme.colors.textSecondary;
    }
  }};
`;

const ThemeToggle = styled.button`
  background: none;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius};
  padding: ${props => props.theme.spacing.sm};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.surface};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ContentArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${props => props.theme.spacing.lg};
  background-color: ${props => props.theme.colors.background};
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${props => props.theme.colors.text};
  font-size: 24px;
  cursor: pointer;
  padding: ${props => props.theme.spacing.sm};

  @media (max-width: 768px) {
    display: block;
  }
`;

interface AppLayoutProps {
  children?: React.ReactNode;
}

interface SystemHealth {
  status: 'online' | 'offline' | 'warning' | 'error';
  message: string;
  connectedDevices: number;
  activeStreams: number;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemHealth] = useState<SystemHealth>({
    status: 'online',
    message: 'All systems operational',
    connectedDevices: 3,
    activeStreams: 2
  });

  const toggleTheme = useCallback(() => {
    setIsDarkTheme(prev => !prev);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const getBreadcrumbPath = (pathname: string): string[] => {
    const pathMap: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/cameras': 'Cameras',
      '/streaming': 'Live Streaming',
      '/presets': 'Presets',
      '/firmware': 'Firmware',
      '/diagnostics': 'Diagnostics',
      '/settings': 'Settings',
      '/analyzer': 'Protocol Analyzer',
      '/setup': 'Setup Wizard'
    };

    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = '/' + segments.slice(0, index + 1).join('/');
      return pathMap[path] || segment.charAt(0).toUpperCase() + segment.slice(1);
    });
  };

  return (
    <ThemeProvider theme={isDarkTheme ? darkTheme : lightTheme}>
      <GlobalStyle />
      <Router>
        <AppContainer>
          <NavigationSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
          
          <MainContent $sidebarCollapsed={sidebarCollapsed}>
            <Header>
              <HeaderLeft>
                <MobileMenuButton
                  onClick={toggleMobileMenu}
                  aria-label="Toggle mobile menu"
                >
                  ☰
                </MobileMenuButton>
                
                <Breadcrumb>
                  {getBreadcrumbPath(window.location.pathname).map((crumb, index, arr) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span className="separator">/</span>}
                      <span className={index === arr.length - 1 ? 'current' : ''}>
                        {crumb}
                      </span>
                    </React.Fragment>
                  ))}
                </Breadcrumb>
              </HeaderLeft>

              <HeaderRight>
                <SystemStatus>
                  <StatusIndicator $status={systemHealth.status} />
                  <span>{systemHealth.connectedDevices} devices</span>
                  <span>•</span>
                  <span>{systemHealth.activeStreams} streams</span>
                </SystemStatus>

                <ThemeToggle
                  onClick={toggleTheme}
                  aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
                >
                  {isDarkTheme ? '☀️' : '🌙'}
                </ThemeToggle>
              </HeaderRight>
            </Header>

            <ContentArea>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<MultiCameraDashboard />} />
                <Route path="/cameras" element={<CameraGrid />} />
                <Route path="/streaming" element={<MultiViewfinderGrid />} />
                <Route path="/presets" element={<PresetLibrary />} />
                <Route path="/firmware" element={<FirmwareUpdateManager />} />
                <Route path="/diagnostics" element={<DiagnosticsPanel />} />
                <Route path="/analyzer" element={<ProtocolAnalyzer />} />
                <Route path="/setup" element={<SetupWizard />} />
              </Routes>
              {children}
            </ContentArea>
          </MainContent>
        </AppContainer>
      </Router>
    </ThemeProvider>
  );
};

export default AppLayout;