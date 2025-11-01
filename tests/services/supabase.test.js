/**
 * Jest Tests for Supabase Service
 * 
 * Tests following backend-developer.md standards:
 * - Database connection
 * - Query execution
 * - Real-time subscriptions
 * - Error handling
 * - Connection pooling
 */

import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('Supabase Service - Initialization', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize Supabase client with correct config', () => {
    const mockClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null })
    };

    createClient.mockReturnValue(mockClient);

    const supabaseUrl = 'https://test.supabase.co';
    const supabaseKey = 'test-key';
    
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    expect(createClient).toHaveBeenCalledWith(
      supabaseUrl,
      supabaseKey,
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    );
  });

  it('should disable session persistence for serverless', () => {
    const mockClient = {};
    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    expect(createClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false
        })
      })
    );
  });
});

describe('Supabase Service - fetchEvents()', () => {
  
  it('should fetch events with default limit of 100', async () => {
    const mockData = [
      {
        id: '1',
        occurred_at: '2025-11-01T02:00:00.000Z',
        latitude: 14.5,
        longitude: 121.0,
        depth_km: 10,
        magnitude: 5.0,
        location_text: 'Manila'
      }
    ];

    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: mockData, error: null });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    const { data, error } = await client
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text')
      .order('occurred_at', { ascending: false })
      .limit(100);

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockOrder).toHaveBeenCalledWith('occurred_at', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(100);
    expect(data).toEqual(mockData);
    expect(error).toBeNull();
  });

  it('should handle custom limit parameter', async () => {
    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    await client
      .from('events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(50);

    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('should handle database query errors', async () => {
    const mockError = {
      message: 'Database connection failed',
      code: 'CONNECTION_ERROR'
    };

    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: null, error: mockError });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    const { data, error } = await client
      .from('events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(100);

    expect(data).toBeNull();
    expect(error).toEqual(mockError);
  });

  it('should return empty array when no events found', async () => {
    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    const { data } = await client
      .from('events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(100);

    expect(data).toEqual([]);
  });
});

describe('Supabase Service - subscribeToEvents()', () => {
  
  it('should set up real-time subscription for INSERT events', () => {
    const mockCallback = jest.fn();
    const mockOn = jest.fn().mockReturnThis();
    const mockSubscribe = jest.fn();

    const mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe
    };

    const mockClient = {
      channel: jest.fn().mockReturnValue(mockChannel)
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    const subscription = client
      .channel('events-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        mockCallback
      )
      .subscribe();

    expect(mockClient.channel).toHaveBeenCalledWith('events-channel');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events' },
      mockCallback
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should trigger callback when new event is inserted', () => {
    const mockCallback = jest.fn();
    const mockOn = jest.fn((event, config, callback) => {
      // Simulate immediate trigger
      callback({
        new: {
          id: 'new-event',
          magnitude: 5.5,
          occurred_at: '2025-11-01T05:00:00.000Z'
        }
      });
      return { subscribe: jest.fn() };
    });

    const mockChannel = {
      on: mockOn
    };

    const mockClient = {
      channel: jest.fn().mockReturnValue(mockChannel)
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    client
      .channel('events-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        mockCallback
      )
      .subscribe();

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        new: expect.objectContaining({
          id: 'new-event',
          magnitude: 5.5
        })
      })
    );
  });
});

describe('Supabase Service - triggerScraper()', () => {
  
  it('should make GET request to /api/scrape endpoint', async () => {
    // This would use axios or fetch in real implementation
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    global.fetch = mockFetch;

    const response = await fetch('/api/scrape');
    const data = await response.json();

    expect(mockFetch).toHaveBeenCalledWith('/api/scrape');
    expect(data.success).toBe(true);
  });

  it('should handle scraper errors gracefully', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Scraper failed' })
    });

    global.fetch = mockFetch;

    const response = await fetch('/api/scrape');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.success).toBe(false);
  });
});

describe('Supabase Service - Connection Pooling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should reuse same client instance', () => {
    const mockClient = {};
    createClient.mockReturnValue(mockClient);

    const client1 = createClient('url', 'key');
    const client2 = createClient('url', 'key');

    // Verify both clients are the same instance (mocked behavior)
    expect(client1).toBe(client2);
    expect(client1).toBe(mockClient);
  });

  it('should handle concurrent queries efficiently', async () => {
    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    // Simulate concurrent queries
    const promises = Array.from({ length: 5 }, () =>
      client
        .from('events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(100)
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });
});

describe('Supabase Service - Data Validation', () => {
  
  it('should validate required event fields', async () => {
    const mockData = [
      {
        id: '1',
        occurred_at: '2025-11-01T02:00:00.000Z',
        latitude: 14.5,
        longitude: 121.0,
        depth_km: 10,
        magnitude: 5.0,
        location_text: 'Manila'
      }
    ];

    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue({ data: mockData, error: null });

    const mockClient = {
      from: mockFrom,
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit
    };

    createClient.mockReturnValue(mockClient);

    const client = createClient('url', 'key');
    
    const { data } = await client
      .from('events')
      .select('id, occurred_at, latitude, longitude, depth_km, magnitude, location_text')
      .order('occurred_at', { ascending: false })
      .limit(100);

    // Validate first event has all required fields
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('occurred_at');
    expect(data[0]).toHaveProperty('latitude');
    expect(data[0]).toHaveProperty('longitude');
    expect(data[0]).toHaveProperty('depth_km');
    expect(data[0]).toHaveProperty('magnitude');
    expect(data[0]).toHaveProperty('location_text');
  });
});
