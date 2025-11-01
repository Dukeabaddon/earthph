/**
 * Jest Tests for Events API (/api/events)
 * 
 * Tests following backend-developer.md standards:
 * - HTTP method validation
 * - CORS headers
 * - Response format and structure
 * - Error handling
 * - Performance monitoring
 * - Cache behavior
 */

import handler from '../../api/events.js';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

jest.mock('@supabase/supabase-js');
jest.mock('axios');

// Create chainable mock for Supabase
const createMockSupabaseChain = () => {
  const chain = {
    from: jest.fn(),
    select: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    lt: jest.fn(),
  };
  
  // Make all methods chainable (return the chain itself)
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  
  // limit() is the final call, so it returns a Promise
  chain.limit.mockResolvedValue({ data: [], error: null });
  
  return chain;
};

let mockSupabase = createMockSupabaseChain();

// Mock createClient to return mockSupabase for all instances
createClient.mockImplementation(() => mockSupabase);

describe('Events API - HTTP Method Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Recreate the mock chain for test isolation
    mockSupabase = createMockSupabaseChain();
    createClient.mockImplementation(() => mockSupabase);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should accept GET requests', async () => {
    // Mock successful database response
    mockSupabase.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'event1',
          occurred_at: '2025-11-01T02:23:00Z',
          latitude: 14.5995,
          longitude: 120.9842,
          depth_km: 10.0,
          magnitude: 3.2,
          location_text: '004 km S 73° E of Nasugbu (Batangas)'
        }
      ],
      error: null
    });

    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `
        <table>
          <tbody>
            <tr>
              <td>2025-11-01 - 10:23 AM</td>
              <td>14.5995</td>
              <td>120.9842</td>
              <td>10.0</td>
              <td>3.2</td>
              <td>004 km S 73° E of Nasugbu (Batangas)</td>
            </tr>
          </tbody>
        </table>
      `
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        events: expect.any(Array)
      })
    );
  });

  it('should handle OPTIONS preflight requests', async () => {
    const req = { method: 'OPTIONS' };
    const res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  const unsupportedMethods = ['POST', 'PUT', 'DELETE'];

  unsupportedMethods.forEach((method) => {
    it(`should reject ${method} requests with 405 Method Not Allowed`, async () => {
      const req = { method };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Method not allowed' })
      );
    });
  });
});

describe('Events API - Database Query Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return events from the database', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [
        {
          id: 'event1',
          occurred_at: '2025-11-01T02:23:00Z',
          latitude: 14.5995,
          longitude: 120.9842,
          depth_km: 10.0,
          magnitude: 3.2,
          location_text: '004 km S 73° E of Nasugbu (Batangas)'
        }
      ],
      error: null
    });

    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `
        <table>
          <tbody>
            <tr>
              <td>2025-11-01 - 10:23 AM</td>
              <td>14.5995</td>
              <td>120.9842</td>
              <td>10.0</td>
              <td>3.2</td>
              <td>004 km S 73° E of Nasugbu (Batangas)</td>
            </tr>
          </tbody>
        </table>
      `
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        events: expect.arrayContaining([
          expect.objectContaining({
            id: 'event1',
            occurred_at: '2025-11-01T02:23:00Z'
          })
        ])
      })
    );
  });

  it('should handle database errors gracefully', async () => {
    mockSupabase.select.mockResolvedValue({ 
      data: null, 
      error: { message: 'Database error' } 
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ 
        success: false,
        error: 'Internal server error'
      })
    );
  });

  it('should include CORS headers', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      error: null
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, OPTIONS');
  });

  it('should return empty array when no events found', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      error: null
    });

    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `<table><tbody></tbody></table>`
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        events: [],
        count: 0
      })
    );
  });
});

describe('Events API - Scraping Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should scrape PHIVOLCS when cache is stale', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      error: null
    });

    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `
        <table>
          <tbody>
            <tr>
              <td>2025-11-01 - 10:23 AM</td>
              <td>14.5995</td>
              <td>120.9842</td>
              <td>10.0</td>
              <td>3.2</td>
              <td>004 km S 73° E of Nasugbu (Batangas)</td>
            </tr>
          </tbody>
        </table>
      `
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('phivolcs'),
      expect.any(Object)
    );
  });

  it('should handle scraping failures gracefully', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      error: null
    });

    axios.get.mockRejectedValue(new Error('Network error'));

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    // Should still return success with empty data
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        events: []
      })
    );
  });

  it('should use cached data when available', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [
        {
          id: 'cached-event',
          occurred_at: '2025-11-01T02:23:00Z',
          latitude: 14.5995,
          longitude: 120.9842,
          depth_km: 10.0,
          magnitude: 3.2,
          location_text: 'Cached event'
        }
      ],
      error: null
    });

    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `<table><tbody></tbody></table>`
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    // First call - should scrape
    await handler(req, res);
    const firstCallCount = axios.get.mock.calls.length;

    jest.clearAllMocks();

    // Second call immediately after - should use cache
    await handler(req, res);
    const secondCallCount = axios.get.mock.calls.length;

    // Second call should not trigger scraping (cache is fresh)
    expect(secondCallCount).toBe(0);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        cached: true
      })
    );
  });
});
