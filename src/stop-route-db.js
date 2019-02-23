const db = require('./db-api');
const moment = require('moment-timezone');
const timeHelper = require('./time-helper');
const _ = require('underscore');

const tableName = 'mbtabustime-stop-route';

function create(deviceId, stopId, routes, stopName, lastUpdatedDateTime) {
  if (!stopName) {
    stopName = '---';
  }

  const params = {
    TableName: tableName,
    Item: {
      "deviceId": deviceId,
      "stopId": stopId,
      "routes": routes,
      "stopName": stopName,
      "lastUpdatedDateTime": lastUpdatedDateTime
    }
  };

  return db.create(params);
}

function query(deviceId) {
  const params = {
    TableName : tableName,
    ProjectionExpression:"deviceId, stopId, routes, stopName, lastUpdatedDateTime",
    KeyConditionExpression: "deviceId = :d",
    ExpressionAttributeValues: {
      ":d": deviceId
    }
  };

  return db.query(params)
  	.then(data => {
  	  if (data && data.length > 0) {
        return {
          recent: _.max(data, d => moment(d.lastUpdatedDateTime).valueOf()),
          stops: data
        };
  	  }
  	  return {
        recent: null,
        stops: []
      };
  	});
}

function retrieve(deviceId, stopId) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId,
      "stopId": stopId
    }
  };

  return db.retrieve(params);
}

function remove(deviceId, stopId) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId,
      "stopId": stopId
    }
  };

  return db.remove(params);
}

function update(deviceId, stopId, routes, stopName, lastUpdatedDateTime) {
  if (!stopName) {
    stopName = '---'
  }

  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId,
      "stopId": stopId
    },
    UpdateExpression: "set routes = :r, stopName= :s, lastUpdatedDateTime = :t",
    ExpressionAttributeValues: {
      ":r": routes,
      ":s": stopName,
      ":t": lastUpdatedDateTime,
    },
    ReturnValues: "UPDATED_NEW"
  };

  return db.update(params);
}

function updateEntry(recent) {
  return update(recent.deviceId, recent.stopId, recent.routes, recent.stopName, recent.lastUpdatedDateTime);
}

module.exports = {
  create: create,
  query: query,
  remove: remove,
  retrieve: retrieve,
  update: update,
  updateEntry: updateEntry
};