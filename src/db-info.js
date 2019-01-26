const db = require('./db-api');

function retrieve(deviceId) {
  return db.retrieve(deviceId);
}

module.exports = {
  retrieve: retrieve
};