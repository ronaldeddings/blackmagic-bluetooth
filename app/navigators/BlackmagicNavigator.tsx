/**
 * Blackmagic Bluetooth Navigator
 * 
 * Phase 7 Navigator - Main app navigation with bottom tabs
 * - Connection Screen for device management
 * - Camera Control Screen for recording and settings
 * - File Manager Screen for media management
 * - Settings Screen for app configuration
 */

import { TextStyle, ViewStyle } from "react-native"
import { BottomTabScreenProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { CompositeScreenProps } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "../components/Icon"
import { ConnectionScreen } from "../screens/ConnectionScreen"
import { CameraControlScreen } from "../screens/CameraControlScreen"
import { FileManagerScreen } from "../screens/FileManagerScreen"
import { SettingsScreen } from "../screens/SettingsScreen"
import { useAppTheme } from "../theme/context"
import type { ThemedStyle } from "../theme/types"

import { AppStackParamList, AppStackScreenProps } from "./AppNavigator"

export type BlackmagicTabParamList = {
  Connection: undefined
  CameraControl: undefined
  FileManager: undefined
  Settings: undefined
}

/**
 * Helper for automatically generating navigation prop types for each route.
 *
 * More info: https://reactnavigation.org/docs/typescript/#organizing-types
 */
export type BlackmagicTabScreenProps<T extends keyof BlackmagicTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<BlackmagicTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

const Tab = createBottomTabNavigator<BlackmagicTabParamList>()

/**
 * This is the main navigator for the Blackmagic Bluetooth app with a bottom tab bar.
 * Each tab represents a major app functionality:
 * - Connection: Scan, connect, and manage Blackmagic devices
 * - Camera Control: Record, configure camera settings, monitor status
 * - File Manager: Browse, download, and manage media files
 * - Settings: Configure app preferences and view device info
 *
 * More info: https://reactnavigation.org/docs/bottom-tab-navigator/
 * @returns {JSX.Element} The rendered `BlackmagicNavigator`.
 */
export function BlackmagicNavigator() {
  const { bottom } = useSafeAreaInsets()
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: themed([$tabBar, { height: bottom + 70 }]),
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tintInactive,
        tabBarLabelStyle: themed($tabBarLabel),
        tabBarItemStyle: themed($tabBarItem),
      }}
    >
      <Tab.Screen
        name="Connection"
        component={ConnectionScreen}
        options={{
          tabBarLabel: "Connect",
          tabBarIcon: ({ focused }) => (
            <Icon
              icon="components"
              color={focused ? colors.tint : colors.tintInactive}
              size={28}
            />
          ),
        }}
      />

      <Tab.Screen
        name="CameraControl"
        component={CameraControlScreen}
        options={{
          tabBarLabel: "Camera",
          tabBarIcon: ({ focused }) => (
            <Icon
              icon="view"
              color={focused ? colors.tint : colors.tintInactive}
              size={28}
            />
          ),
        }}
      />

      <Tab.Screen
        name="FileManager"
        component={FileManagerScreen}
        options={{
          tabBarLabel: "Files",
          tabBarIcon: ({ focused }) => (
            <Icon
              icon="menu"
              color={focused ? colors.tint : colors.tintInactive}
              size={28}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ focused }) => (
            <Icon
              icon="settings"
              color={focused ? colors.tint : colors.tintInactive}
              size={28}
            />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

const $tabBar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  borderTopColor: colors.separator,
  borderTopWidth: 1,
  elevation: 8,
  shadowOffset: {
    width: 0,
    height: -2,
  },
  shadowOpacity: 0.1,
  shadowRadius: 8,
})

const $tabBarItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.sm,
})

const $tabBarLabel: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  fontSize: 11,
  fontFamily: typography.primary.medium,
  lineHeight: 14,
  color: colors.text,
  marginBottom: 2,
})