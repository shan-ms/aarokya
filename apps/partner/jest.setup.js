/* eslint-disable no-undef */

// React Native full mock for testing without babel/metro
jest.mock('react-native', () => {
  const React = require('react');

  const createMockComponent = (name) => {
    const component = (props) => {
      return React.createElement(name, props, props.children);
    };
    component.displayName = name;
    return component;
  };

  return {
    Platform: { OS: 'android', select: jest.fn((obj) => obj.android) },
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {}),
      hairlineWidth: 1,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    PixelRatio: {
      get: jest.fn(() => 2),
      roundToNearestPixel: jest.fn((val) => val),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Linking: {
      openURL: jest.fn(),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Alert: {
      alert: jest.fn(),
    },
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TextInput: createMockComponent('TextInput'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    TouchableHighlight: createMockComponent('TouchableHighlight'),
    TouchableWithoutFeedback: createMockComponent('TouchableWithoutFeedback'),
    ScrollView: createMockComponent('ScrollView'),
    FlatList: ({ data, renderItem, ListEmptyComponent, ListFooterComponent, keyExtractor, ...props }) => {
      const React = require('react');
      const items = data && data.length > 0
        ? data.map((item, index) => React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : index },
            renderItem({ item, index })
          ))
        : (ListEmptyComponent
            ? (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent)
            : null);
      const footer = ListFooterComponent
        ? (typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent)
        : null;
      return React.createElement('FlatList', props, items, footer);
    },
    SectionList: createMockComponent('SectionList'),
    SafeAreaView: createMockComponent('SafeAreaView'),
    ActivityIndicator: createMockComponent('ActivityIndicator'),
    Image: createMockComponent('Image'),
    Modal: createMockComponent('Modal'),
    Switch: createMockComponent('Switch'),
    StatusBar: createMockComponent('StatusBar'),
    KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
    RefreshControl: createMockComponent('RefreshControl'),
    Animated: {
      View: createMockComponent('Animated.View'),
      Text: createMockComponent('Animated.Text'),
      Image: createMockComponent('Animated.Image'),
      ScrollView: createMockComponent('Animated.ScrollView'),
      FlatList: createMockComponent('Animated.FlatList'),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(() => ({ __getValue: jest.fn() })),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        __getValue: jest.fn(() => 0),
      })),
      timing: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
      spring: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
      parallel: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
      sequence: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
      event: jest.fn(),
      createAnimatedComponent: (comp) => comp,
    },
    useColorScheme: jest.fn(() => 'light'),
    useWindowDimensions: jest.fn(() => ({ width: 375, height: 812 })),
    I18nManager: { isRTL: false },
  };
});

// React Navigation mocks
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    getParent: jest.fn(() => ({ navigate: jest.fn() })),
  }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
}));

// i18next mock
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

// React Native Vector Icons mock
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// React Native Safe Area Context mock
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, ...props }) => React.createElement('SafeAreaView', props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// React Native Gesture Handler mock
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: 'Swipeable',
  GestureHandlerRootView: ({ children }) => children,
  TouchableOpacity: 'TouchableOpacity',
}));

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Please update the following components') ||
     args[0].includes('deprecated'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};
