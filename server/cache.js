const NodeCache = require('node-cache');

// Cache com TTL de 1 hora
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll()
};
