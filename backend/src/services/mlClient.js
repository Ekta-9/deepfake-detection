const axios    = require('axios');
const FormData = require('form-data');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function predictFromMlService(file) {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename:    file.originalname || 'image.jpg',
    contentType: file.mimetype,
  });

  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
      headers:          form.getHeaders(),
      timeout:          60_000,   // TF model can take 30-60s on first inference
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });
    return data;
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.detail || 'ML service returned an error';
      const e = new Error(message);
      e.status = 502;
      throw e;
    }
    const e = new Error('ML service unavailable');
    e.status = 502;
    throw e;
  }
}

module.exports = { predictFromMlService };
