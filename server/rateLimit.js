// Fixed-window-per-caller rate limiter, no dependency.
// ponytail: per-process memory — correct for the single Render container;
// swap for express-rate-limit + Redis only if this ever runs multi-instance.
module.exports = function rateLimit({ max, windowMs, message, now = Date.now }) {
  const hits = new Map();
  return (req, res, next) => {
    const t = now();
    const recent = (hits.get(req.ip) || []).filter((ts) => t - ts < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ message });
    }
    recent.push(t);
    hits.set(req.ip, recent);
    if (hits.size > 5000) hits.clear(); // crude memory bound; worst case one free window
    next();
  };
};
