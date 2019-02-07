const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-east-1"
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'mbtabustime-stop-route';

function create(deviceId, stopId, routeIds) {
  const params = {
    TableName: tableName,
    Item: {
      "deviceId": deviceId,
      "stopId": stopId,
      "routeIds": routeIds
    }
  };
  console.log(params);

  return docClient.put(params).promise()
    .then(() => {
      console.log('DB data creation successful');
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
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
  console.log(params);

  return docClient.query(params).promise()
    .then(data => {
      console.log('DB data query successful');
      console.log(JSON.stringify(data, null, 2));
      return data.Items;
    })
    .catch(err => {
      console.log(err);
      throw err;
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
  console.log(params);
  
  return docClient.get(params).promise()
    .then(data => {
      console.log('DB data retrieval successful');
      console.log(JSON.stringify(data, null, 2));
      return data.Item;
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function remove(deviceId, stopId) {
  const params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId,
      "stopId": stopId
    }
  };
  console.log(params);

  return docClient.delete(params).promise()
    .then(() => {
      console.log('DB data delete successful');
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
      "deviceId": deviceId,
      "stopId": stopId
    },
    UpdateExpression: "set routeIds = :r",
    ExpressionAttributeValues: {
      ":r": routeIds
    },
    ReturnValues: "UPDATED_NEW"
  };
  console.log(params);

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
  query: query,
  remove: remove,
  retrieve: retrieve,
  update: update
};