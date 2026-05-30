function log(level, event, data = {}) {
  console.log(JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
}

module.exports = {
  info:  (event, data) => log('info',  event, data),
  error: (event, data) => log('error', event, data),
};