import axios from 'axios';

export default async function handler(req, res) {
  try {
    // Just test if we can reach PHIVOLCS
    const response = await axios.get('https://earthquake.phivolcs.dost.gov.ph/', {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return res.status(200).json({
      success: true,
      statusCode: response.status,
      dataLength: response.data.length,
      contentType: response.headers['content-type']
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      code: error.code,
      response: error.response?.status
    });
  }
}
