/**
 * Jest Tests for PHIVOLCS Scraper (/api/scrape)
 * 
 * Tests following backend-developer.md standards:
 * - Unit tests for pure functions (datetime parsing, validation)
 * - Integration tests for scraper workflow
 * - Edge case handling (invalid data, rate limiting)
 * - Error boundary testing
 */

import handler from '../../api/scrape.js';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

jest.mock('@supabase/supabase-js');
jest.mock('axios');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
};

createClient.mockReturnValue(mockSupabase);

describe('Scraper API - HTTP Method Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers to control rate limiting
    jest.useFakeTimers();
    // Advance past any rate limits (6 minutes = 360,000ms)
    jest.advanceTimersByTime(6 * 60 * 1000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should accept GET requests', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 1, error: null });

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
      `,
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
      expect.objectContaining({ success: true })
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

  it('should reject non-GET requests', async () => {
    const req = { method: 'POST' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Method not allowed' })
    );
  });
});

describe('Scraper API - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should scrape and upsert events successfully', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 1, error: null });

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
      `,
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
      expect.objectContaining({ success: true })
    );
    expect(mockSupabase.upsert).toHaveBeenCalled();
    expect(mockSupabase.delete).toHaveBeenCalled();
  });

  it('should handle rate limiting correctly', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 1, error: null });

    axios.get.mockResolvedValue({
      data: `<table><tbody></tbody></table>`,
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    // First request should succeed
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    // Reset mocks
    jest.clearAllMocks();

    // Second request immediately after should be rate limited
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Rate limit exceeded' })
    );

    // Advance time by 6 minutes
    jest.advanceTimersByTime(6 * 60 * 1000);
    jest.clearAllMocks();

    // Third request after 6 minutes should succeed
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle PHIVOLCS network errors', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

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

  it('should handle database upsert errors', async () => {
    mockSupabase.upsert.mockResolvedValue({ 
      data: null, 
      error: { message: 'Database error' } 
    });

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
      `,
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
});

describe('Scraper API - Data Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should skip rows with invalid cell count', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `
        <table>
          <tbody>
            <tr>
              <td>2025-11-01 - 10:23 AM</td>
              <td>14.5995</td>
              <td>120.9842</td>
            </tr>
          </tbody>
        </table>
      `,
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ 
        success: true,
        events_count: 0
      })
    );
  });

  it('should skip rows with out-of-bounds coordinates', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `
        <table>
          <tbody>
            <tr>
              <td>2025-11-01 - 10:23 AM</td>
              <td>50.0</td>
              <td>200.0</td>
              <td>10.0</td>
              <td>3.2</td>
              <td>Invalid location</td>
            </tr>
          </tbody>
        </table>
      `,
    });

    const req = { method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ 
        success: true,
        events_count: 0,
        skipped_rows: 1
      })
    );
  });
});

describe('Scraper API - CORS Headers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should include CORS headers', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({ count: 0, error: null });

    axios.get.mockResolvedValue({
      data: `<table><tbody></tbody></table>`,
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
});
