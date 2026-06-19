# Testing Strategy for Complaints Feature

## Overview

This document outlines the comprehensive testing strategy implemented for the complaints feature, following Test-Driven Development (TDD) principles.

## Test Structure

### 1. Unit Tests

#### Hook Tests (`__tests__/hooks/useComplaints.test.ts`)

- **Initialization**: Tests hook mounting, data fetching, and error handling
- **Complaint Submission**: Tests successful submission, error handling, and validation
- **Eligibility Logic**: Tests user complaint eligibility rules
- **Refetch Functionality**: Tests data refresh capabilities

**Coverage Areas:**

- ✅ Hook initialization and cleanup
- ✅ API error handling
- ✅ User authentication checks
- ✅ Complaint submission workflow
- ✅ State management
- ✅ Loading states

#### Component Tests (`__tests__/components/ui/ComplaintBanner.test.tsx`)

- **Status Display**: Tests all complaint statuses (PENDING, IN_REVIEW, RESOLVED, REFUNDED, REJECTED)
- **Styling**: Tests color coding and visual indicators
- **Accessibility**: Tests screen reader support
- **Edge Cases**: Tests unknown status handling

**Coverage Areas:**

- ✅ All complaint statuses
- ✅ Visual styling and colors
- ✅ Accessibility props
- ✅ Default message handling
- ✅ Resolution text display

#### API Tests (`__tests__/api/games.test.ts`)

- **Data Fetching**: Tests complaint retrieval
- **Data Creation**: Tests complaint submission
- **Error Handling**: Tests database errors and validation
- **Input Validation**: Tests required field validation

**Coverage Areas:**

- ✅ Database operations
- ✅ Input validation
- ✅ Error propagation
- ✅ Authentication checks
- ✅ Data transformation

### 2. Integration Tests

#### Form Tests (`__tests__/components/ComplaintForm.test.tsx`)

- **User Interactions**: Tests form filling and submission
- **Validation**: Tests client-side validation rules
- **State Management**: Tests form state updates
- **Error Handling**: Tests submission failures

**Coverage Areas:**

- ✅ Form rendering
- ✅ Field validation
- ✅ User interactions
- ✅ Submission workflow
- ✅ Loading states
- ✅ Error display

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [...],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Test Setup (`jest.setup.js`)

- React Native Gesture Handler mocking
- Vector Icons mocking
- AsyncStorage mocking
- SVG component mocking
- Expo modules mocking

## Running Tests

### Basic Test Run

```bash
npm test
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm test -- --coverage
```

### Specific Test Suite

```bash
npm test -- --testPathPattern="useComplaints"
npm test -- --testPathPattern="ComplaintBanner"
npm test -- --testPathPattern="ComplaintForm"
```

## Test Data

### Mock Complaints

```typescript
const mockComplaints = [
  {
    id: "complaint-1",
    game_id: "game-123",
    complainant_id: "user-123",
    type: "ORGANISER_DID_NOT_BOOK",
    title: "Organiser never booked",
    description: "The organiser promised to book but never did",
    status: "PENDING",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  // ... more mock data
];
```

### Mock User Profile

```typescript
const mockProfile = {
  id: "user-123",
  auth_id: "auth-123",
  admin_status: false,
  email: "test@example.com",
};
```

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
describe("useComplaints", () => {
  it("should fetch complaints on mount", async () => {
    // Arrange
    mockGetGameComplaints.mockResolvedValue(mockComplaints);

    // Act
    const { result } = renderHook(() => useComplaints("game-123"));

    // Assert
    await waitFor(() => {
      expect(result.current.complaints).toEqual(mockComplaints);
    });
  });
});
```

### 2. Comprehensive Mocking

- API functions are mocked to test isolated functionality
- External dependencies are mocked to ensure test reliability
- User authentication state is controlled for testing different scenarios

### 3. Error Scenarios

- Database connection failures
- Network timeouts
- Invalid input data
- Authentication failures
- Permission errors

### 4. Edge Cases

- Empty data sets
- Malformed responses
- Race conditions
- Memory leaks
- Performance issues

## Coverage Goals

### Current Coverage Targets

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Areas of Focus

1. **Business Logic**: Complaint eligibility, status transitions
2. **User Experience**: Form validation, error messages, loading states
3. **Data Integrity**: Input validation, data transformation
4. **Error Handling**: Graceful degradation, user feedback

## Continuous Integration

### Pre-commit Hooks

- Run unit tests
- Check code coverage
- Lint code
- Type checking

### CI Pipeline

1. Install dependencies
2. Run test suite
3. Generate coverage report
4. Upload coverage to service
5. Block merge if coverage drops

## Future Testing Enhancements

### 1. E2E Tests

- Complete user journey testing
- Cross-platform compatibility
- Performance testing

### 2. Visual Regression Tests

- Screenshot comparison
- UI component testing
- Responsive design testing

### 3. Accessibility Tests

- Screen reader compatibility
- Keyboard navigation
- Color contrast validation

### 4. Performance Tests

- Memory usage monitoring
- Render performance
- API response times

## Troubleshooting

### Common Issues

1. **Mock not working**: Check import paths and mock setup
2. **Async test failures**: Use `waitFor` for async operations
3. **Component not rendering**: Check test environment setup
4. **Coverage gaps**: Add tests for uncovered branches

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test ComplaintBanner.test.tsx

# Run tests in debug mode
npm test -- --detectOpenHandles
```

## Conclusion

This comprehensive testing strategy ensures the complaints feature is robust, reliable, and maintainable. The combination of unit tests, integration tests, and proper mocking provides confidence in the codebase quality and helps catch regressions early in the development cycle.
