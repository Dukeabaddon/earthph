import axios from 'axios';

export default async function handler(req, res) {
  return res.status(200).json({
    message: 'Axios import successful',
    timestamp: new Date().toISOString(),
    axiosVersion: axios.VERSION || 'unknown'
  });
}

