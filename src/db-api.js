const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-east-1"
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'mbta-bus-time';

function create(deviceId, stopId, routeIds) {
  const params = {
    TableName: tableName,
    Item: {
      "deviceId": deviceId,
      "stopId": stopId,
      "routeIds": routeIds
    }
  };

  return docClient.put(params).promise()
    .then(() => {
      console.log('DB data creation successful');
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function retrieve(deviceId) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId
    }
  };
  
  return docClient.get(params).promise()
    .then(data => {
      console.log('DB data retrieval successful')
      return data.Item;
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function remove(deviceId) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId
    }
  };

  return docClient.delete(params).promise()
    .then(() => {
      console.log('DB data deletion successful');
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function update(deviceId, stopId, routeIds) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId
    },
    UpdateExpression: "set stopId = :s, routeIds = :r",
    ExpressionAttributeValues: {
      ":s": stopId,
      ":r": routeIds
    },
    ReturnValues: "UPDATED_NEW"
  };

  return docClient.update(params).promise()
    .then(() => {
      console.log('DB data update successful');
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

module.exports = {
  create: create,
  remove: remove,
  retrieve: retrieve,
  update: update
};