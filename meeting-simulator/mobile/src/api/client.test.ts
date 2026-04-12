describe('api client', () => {
  const originalApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    jest.resetModules();
    if (originalApiBase === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
      return;
    }
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBase;
  });

  it('requires EXPO_PUBLIC_API_BASE_URL', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    jest.isolateModules(() => {
      const { getApiBaseUrl } = require('./client');
      expect(() => getApiBaseUrl()).toThrow('EXPO_PUBLIC_API_BASE_URL 未配置');
    });
  });

  it('normalizes configured API base url', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://115.190.10.83/';

    jest.isolateModules(() => {
      const { getApiBaseUrl } = require('./client');
      expect(getApiBaseUrl()).toBe('http://115.190.10.83');
    });
  });
});
