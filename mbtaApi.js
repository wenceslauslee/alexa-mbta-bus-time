const request = require('request-promise');
const _ = require('underscore');

function getPredictions(routeId, stopId) {
  return request({
    uri: `https://api-v3.mbta.com/predictions?filter%5Bstop%5D=${stopId}&filter%5Broute%5D=${routeId}`,
    headers: {
      'Authorization': `Bearer ${process.env.mbta_api_key}`
    },
    json: true
  })
    .then(response => {
      const predictions = _.map(response.data, data => {
        return data.attributes.arrival_time;
      });
      console.log(predictions);

      return predictions;
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}

module.exports = {
    getPredictions: getPredictions
};
