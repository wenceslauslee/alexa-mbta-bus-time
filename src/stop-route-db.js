const db = require('./db-api');
const moment = require('moment-timezone');
const timeHelper = require('./time-helper');
const _ = require('underscore');

const tableName = 'mbtabustime-stop-route';

function create(deviceId, stopId, routeIds) {
  const lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
  const params = {
    TableName: tableName,
    Item: {
      "deviceId": deviceId,
      "stopId": stopId,
      "routeIds": routeIds,
      "lastUpdatedDateTime": lastUpdatedDateTime
    }
  };

  return db.create(params);
}

function query(deviceId) {
  const params = {
    TableName : tableName,
    ProjectionExpression:"stopId, routeIds",
    KeyConditionExpression: "deviceId = :d",
    ExpressionAttributeValues: {
      ":d": deviceId
    }
  };

  return db.query(params)
  	.then(data => {
  	  if (data && data.length > 0) {
        return _.max(data, d => moment(d).valueOf());
  	  }
  	  return null;
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

function update(deviceId, stopId, routeIds) {
  const lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId,
      "stopId": stopId
    },
    UpdateExpression: "set routeIds = :r, lastUpdatedDateTime = :t",
    ExpressionAttributeValues: {
      ":r": routeIds,
      ":t": lastUpdatedDateTime,
    },
    ReturnValues: "UPDATED_NEW"
  };
  
  return db.update(params);
}

module.exports = {
  create: create,
  query: query,
  remove: remove,
  retrieve: retrieve,
  update: update
};