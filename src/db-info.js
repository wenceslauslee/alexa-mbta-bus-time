const db = require('./db-api');
const timeHelper = require('./time-helper');

function create(deviceId, stopId, routeIds) {
  return db.create(deviceId, stopId, routeIds);
}

function query(deviceId) {
  return db.query(deviceId)
  	.then(data => {
  	  if (data && data.length >= 1) {
  	  	// return 1 item for now
  	  	return data[0];
  	  }
  	  return null;
  	});
}

function retrieve(deviceId, stopId) {
  return db.retrieve(deviceId, stopId);
}

function remove(deviceId, stopId) {
  return db.remove(deviceId, stopId);
}

function update(deviceId, stopId, routeIds) {
  const lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
  return db.update(deviceId, stopId, routeIds, lastUpdatedDateTime);
}

module.exports = {
  create: create,
  query: query,
  remove: remove,
  retrieve: retrieve,
  update: update
};