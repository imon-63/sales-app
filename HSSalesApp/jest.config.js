module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation/.*|@reduxjs/toolkit|react-redux|reselect|immer|react-native-calendars|react-native-swipe-gestures|xdate)/)',
  ],
};
