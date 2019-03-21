const db = require('./db-api');
const moment = require('moment-timezone');
const _ = require('underscore');

const tableName = 'mbtabustime-stop-route';

function create(deviceId, stopId, direction, stopName, lastUpdatedDateTime, routeIds) {
  const params = {
    TableName: tableName,
    Item: {
      'deviceId': deviceId,
      'stopId': encodeStop(stopId, direction),
      'stopName': stopName,
      'lastUpdatedDateTime': lastUpdatedDateTime,
      'routeIds': routeIds
    }
  };

  return db.create(params);
}

function query(deviceId) {
  const params = {
    TableName: tableName,
    ProjectionExpression: 'deviceId, stopId, stopName, lastUpdatedDateTime, routeIds',
    KeyConditionExpression: 'deviceId = :d',
    ExpressionAttributeValues: {
      ':d': deviceId
    }
  };

  return db.query(params)
    .then(data => {
      data = _.map(data, d => {
        const decodedStop = decodeStop(d.stopId);
        d.stopId = decodedStop.stopId;
        d.direction = decodedStop.direction;

        return d;
      });

      if (data && data.length > 0) {
        const recent = _.max(data, d => moment(d.lastUpdatedDateTime).valueOf());
        const index = _.findIndex(data, d => recent.stopId === d.stopId && recent.direction === d.direction);

        return {
          recent: _.max(data, d => moment(d.lastUpdatedDateTime).valueOf()),
          stops: data,
          index: index,
          currentState: null,
          invalidOperation: false
        };
      }
      return {
        recent: null,
        stops: [],
        index: -1,
        currentState: null,
        invalidOperation: false
      };
    });
}

function retrieve(deviceId, stopId) {
  const params = {
    TableName: tableName,
    Key: {
      'deviceId': deviceId,
      'stopId': stopId
    }
  };

  return db.retrieve(params);
}

function remove(deviceId, stopId, direction) {
  const stopIdDirection = encodeStop(stopId, direction);
  const params = {
    TableName: tableName,
    Key: {
      'deviceId': deviceId,
      'stopId': stopIdDirection
    }
  };

  return db.remove(params);
}

function update(deviceId, stopIdDirection, stopName, lastUpdatedDateTime, routeIds) {
  const params = {
    TableName: tableName,
    Key: {
      'deviceId': deviceId,
      'stopId': stopIdDirection
    },
    UpdateExpression: 'set routeIds = :r, stopName= :s, lastUpdatedDateTime = :t',
    ExpressionAttributeValues: {
      ':r': routeIds,
      ':s': stopName,
      ':t': lastUpdatedDateTime
    },
    ReturnValues: 'UPDATED_NEW'
  };

  return db.update(params);
}

function updateEntry(recent) {
  return update(recent.deviceId, encodeStop(recent.stopId, recent.direction), recent.stopName,
    recent.lastUpdatedDateTime, recent.routeIds);
}

function encodeStop(stopId, direction) {
  return `${stopId}-${direction}`;
}

function decodeStop(stopDirection) {
  const index = stopDirection.indexOf('-');

  return {
    stopId: stopDirection.substring(0, index),
    direction: parseInt(stopDirection.substring(index + 1))
  };
}

module.exports = {
  create: create,
  query: query,
  remove: remove,
  retrieve: retrieve,
  update: update,
  updateEntry: updateEntry
};
