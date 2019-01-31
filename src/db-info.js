const db = require('./db-api');

function create(deviceId, stopId, routeIds) {
  return db.create(deviceId, stopId, routeIds);
}

function retrieve(deviceId) {
  return db.retrieve(deviceId);
}

function remove(deviceId) {
  return db.remove(deviceId);
}

function update(deviceId, stopId, routeIds) {
  return db.update(deviceId, stopId, routeIds);
}

module.exports = {
  create: create,
  remove: remove,
  retrieve: retrieve,
  update: update
};