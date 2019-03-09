const request = require('request-promise');
const _ = require('underscore');

function getEarliestSchedule(stopId, direction, routeId, date, time) {
  const formattedTime = time.replace(':', '%3A');

  return request({
    uri: `https://api-v3.mbta.com/schedules?page%5Boffset%5D=0&page%5Blimit%5D=1&sort=arrival_time` +
      `&filter%5Bdate%5D=${date}&filter%5Bmin_time%5D=${formattedTime}` +
      `&filter%5Bmax_time%5D=23%3A59&filter%5Broute%5D=${routeId}` +
      `&filter%5Bdirection_id%5D=${direction}&filter%5Bstop%5D=${stopId}`,
    headers: {
      'Authorization': `Bearer ${process.env.mbta_api_key}`
    },
    json: true
  })
    .then(response => {
      const data = response.data;
      if (data.length === 0) {
        return null;
      }

      const earliestScheduledTime = data[0].attributes.arrival_time;
      console.log('Earliest scheduled time is: ' + earliestScheduledTime);

      return earliestScheduledTime;
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}

function getPredictions(stopId, direction, routeId) {
  return request({
    uri: `https://api-v3.mbta.com/predictions?filter%5Bstop%5D=${stopId}&filter%5Broute%5D=${routeId}` +
      `&filter%5Bdirection_id%5D=${direction}`,
    headers: {
      'Authorization': `Bearer ${process.env.mbta_api_key}`
    },
    json: true
  })
    .then(response => {
      const predictions = _.map(response.data, data => {
        return data.attributes.arrival_time;
      });

      return predictions;
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}

function getStop(stopId) {
  return request({
    uri: `https://api-v3.mbta.com/stops?filter%5Bid%5D=${stopId}&filter%5Broute_type%5D=3`,
    headers: {
      'Authorization': `Bearer ${process.env.mbta_api_key}`
    },
    json: true
  })
    .then(response => {
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}

module.exports = {
  getEarliestSchedule: getEarliestSchedule,
  getPredictions: getPredictions,
  getStop: getStop
};
