import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarContainer = styled(motion.aside)<{ $collapsed: boolean; $mobileOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: ${props => props.$collapsed ? '60px' : '280px'};
  background-color: ${props => props.theme.colors.dark};
  border-right: 1px solid ${props => props.theme.colors.border};
  box-shadow: 2px 0 8px ${props => props.theme.colors.shadow};
  transition: width ${props => props.theme.transitions.default};
  z-index: 1000;
  overflow: hidden;

  @media (max-width: 768px) {
    width: 280px;
    transform: ${props => props.$mobileOpen ? 'translateX(0)' : 'translateX(-100%)'};
    transition: transform ${props => props.theme.transitions.default};
  }
`;

const SidebarHeader = styled.div<{ $collapsed: boolean }>`
  padding: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: ${props => props.$collapsed ? 'center' : 'space-between'};
  min-height: 64px;
`;

const Logo = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  color: white;
  font-size: 18px;
  font-weight: 600;

  .logo-icon {
    font-size: 24px;
    color: ${props => props.theme.colors.primary};
  }

  .logo-text {
    display: ${props => props.$collapsed ? 'none' : 'block'};
    transition: opacity ${props => props.theme.transitions.default};
  }
`;

const CollapseButton = styled.button<{ $collapsed: boolean }>`
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius};
  transition: background-color ${props => props.theme.transitions.fast};
  display: ${props => props.$collapsed ? 'none' : 'block'};

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const Navigation = styled.nav`
  padding: ${props => props.theme.spacing.md} 0;
  flex: 1;
  overflow-y: auto;
`;

const NavigationSection = styled.div<{ $collapsed: boolean }>`
  margin-bottom: ${props => props.theme.spacing.lg};

  .section-title {
    display: ${props => props.$collapsed ? 'none' : 'block'};
    padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.lg};
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: ${props => props.theme.spacing.sm};
  }
`;

const NavigationItem = styled(motion.div)<{ $active: boolean; $collapsed: boolean }>`
  position: relative;
  margin: 2px ${props => props.theme.spacing.sm};
`;

const NavigationLink = styled.button<{ $active: boolean; $collapsed: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  background: ${props => props.$active ? props.theme.colors.primary : 'none'};
  border: none;
  border-radius: ${props => props.theme.borderRadius};
  color: ${props => props.$active ? 'white' : 'rgba(255, 255, 255, 0.8)'};
  font-size: 14px;
  font-weight: ${props => props.$active ? '500' : '400'};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  text-align: left;
  justify-content: ${props => props.$collapsed ? 'center' : 'flex-start'};

  &:hover {
    background: ${props => props.$active ? props.theme.colors.primary : 'rgba(255, 255, 255, 0.1)'};
    color: white;
  }

  .nav-icon {
    font-size: 18px;
    min-width: 18px;
  }

  .nav-text {
    display: ${props => props.$collapsed ? 'none' : 'block'};
    transition: opacity ${props => props.theme.transitions.default};
  }

  .nav-badge {
    display: ${props => props.$collapsed ? 'none' : 'flex'};
    margin-left: auto;
    background: ${props => props.theme.colors.danger};
    color: white;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    min-width: 16px;
    justify-content: center;
  }
`;

const Tooltip = styled(motion.div)`
  position: absolute;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  background: ${props => props.theme.colors.dark};
  color: white;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius};
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px ${props => props.theme.colors.shadow};
  z-index: 1001;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 50%;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-right-color: ${props => props.theme.colors.dark};
  }
`;

const MobileOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

interface NavigationItemData {
  id: string;
  path: string;
  icon: string;
  label: string;
  badge?: number;
  section: string;
}

interface NavigationSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navigationItems: NavigationItemData[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    icon: '📊',
    label: 'Dashboard',
    section: 'main'
  },
  {
    id: 'cameras',
    path: '/cameras',
    icon: '📹',
    label: 'Cameras',
    section: 'main'
  },
  {
    id: 'streaming',
    path: '/streaming',
    icon: '📺',
    label: 'Live Streaming',
    section: 'main'
  },
  {
    id: 'presets',
    path: '/presets',
    icon: '⚙️',
    label: 'Presets',
    section: 'configuration'
  },
  {
    id: 'firmware',
    path: '/firmware',
    icon: '🔄',
    label: 'Firmware',
    badge: 2,
    section: 'configuration'
  },
  {
    id: 'diagnostics',
    path: '/diagnostics',
    icon: '📈',
    label: 'Diagnostics',
    section: 'tools'
  },
  {
    id: 'analyzer',
    path: '/analyzer',
    icon: '🔍',
    label: 'Protocol Analyzer',
    section: 'tools'
  },
  {
    id: 'setup',
    path: '/setup',
    icon: '🎯',
    label: 'Setup Wizard',
    section: 'tools'
  }
];

const sections = [
  { id: 'main', title: 'Main' },
  { id: 'configuration', title: 'Configuration' },
  { id: 'tools', title: 'Tools & Debug' }
];

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    onMobileClose();
  }, [navigate, onMobileClose]);

  const handleItemHover = useCallback((itemId: string | null) => {
    if (collapsed) {
      setHoveredItem(itemId);
    }
  }, [collapsed]);

  const isActive = useCallback((path: string) => {
    return location.pathname === path;
  }, [location.pathname]);

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <MobileOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      <SidebarContainer
        $collapsed={collapsed}
        $mobileOpen={mobileOpen}
        initial={false}
        animate={{
          width: collapsed ? 60 : 280
        }}
        transition={{ duration: 0.3 }}
      >
        <SidebarHeader $collapsed={collapsed}>
          <Logo $collapsed={collapsed}>
            <span className="logo-icon">🎬</span>
            <span className="logo-text">Blackmagic</span>
          </Logo>
          <CollapseButton
            $collapsed={collapsed}
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            ←
          </CollapseButton>
        </SidebarHeader>

        <Navigation>
          {sections.map(section => {
            const sectionItems = navigationItems.filter(item => item.section === section.id);
            
            return (
              <NavigationSection key={section.id} $collapsed={collapsed}>
                <div className="section-title">{section.title}</div>
                {sectionItems.map(item => (
                  <NavigationItem
                    key={item.id}
                    $active={isActive(item.path)}
                    $collapsed={collapsed}
                    onMouseEnter={() => handleItemHover(item.id)}
                    onMouseLeave={() => handleItemHover(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <NavigationLink
                      $active={isActive(item.path)}
                      $collapsed={collapsed}
                      onClick={() => handleNavigate(item.path)}
                      aria-label={item.label}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.label}</span>
                      {item.badge && (
                        <span className="nav-badge">{item.badge}</span>
                      )}
                    </NavigationLink>

                    <AnimatePresence>
                      {collapsed && hoveredItem === item.id && (
                        <Tooltip
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {item.label}
                          {item.badge && (
                            <span style={{ 
                              marginLeft: '8px',
                              background: '#dc3545',
                              borderRadius: '8px',
                              padding: '1px 4px',
                              fontSize: '10px'
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </Tooltip>
                      )}
                    </AnimatePresence>
                  </NavigationItem>
                ))}
              </NavigationSection>
            );
          })}
        </Navigation>
      </SidebarContainer>
    </>
  );
};

export default NavigationSidebar;