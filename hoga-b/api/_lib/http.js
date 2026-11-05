// Helper HTTP untuk serverless function Vercel.
// Folder yang diawali "_" tidak dijadikan endpoint oleh Vercel.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
}

// Membungkus handler: menangkap error dan mengubahnya jadi respons JSON { error }.
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'Terjadi kesalahan pada server.' });
    }
  };
}

function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) {
    throw new HttpError(405, `Method ${req.method} tidak diizinkan.`);
  }
}

module.exports = { HttpError, send, handle, requireMethod };
