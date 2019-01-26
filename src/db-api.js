const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-east-1"
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'mbta-bus-time';

function save(deviceId, stopId, routeIds) {
	
}

function retrieve(deviceId) {
  var params = {
    TableName: tableName,
    Key: {
      "deviceId": deviceId
    }
  };
	
  return docClient.get(params).promise()
  	.then(data => {
  		console.log(data);
  		return data.Item;
  	})
  	.catch(err => {
  		console.log(err);
  		throw err;
  	});
}

function remove(deviceId) {

}

module.exports = {
  save: save,
  retrieve: retrieve,
  remove: remove
};