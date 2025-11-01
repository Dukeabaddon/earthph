/**
 * Jest Tests for Events API (/api/events)
 */

import handler from '../../api/events.js';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test.key.anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test.key.service';

const mockReq = (method = 'GET', ip = '127.0.0.1') => ({
  method,
  headers: { 'x-forwarded-for': ip }
});

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
});

const mockSupabase = () => {
  const chain = {
    from: jest.fn(),
    select: jest.fn(),
    gte: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
};

describe('Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return events successfully', async () => {
    const mock = mockSupabase();
    mock.limit.mockResolvedValue({
      data: [{
        id: '1',
        occurred_at: '2025-11-01T10:00:00Z',
        latitude: 14.5,
        longitude: 121.0,
        depth_km: 10,
        magnitude: 3.5,
        location_text: 'Test'
      }],
      error: null
    });
    createClient.mockReturnValue(mock);

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('should handle rate limiting', async () => {
    const mock = mockSupabase();
    mock.limit.mockResolvedValue({ data: [], error: null });
    createClient.mockReturnValue(mock);

    const ip = '192.168.1.100';
    for (let i = 0; i < 11; i++) {
      const req = mockReq('GET', ip);
      const res = mockRes();
      await handler(req, res);
      
      if (i === 10) {
        expect(res.status).toHaveBeenCalledWith(429);
      }
    }
  });

  it('should handle database errors', async () => {
    const mock = mockSupabase();
    mock.limit.mockResolvedValue({
      data: null,
      error: { message: 'DB error' }
    });
    createClient.mockReturnValue(mock);

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
