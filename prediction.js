const mbta = require('./mbtaApi');
const moment = require('moment-timezone');
const _ = require('underscore');

async function getPredictions(routeId, stopId) {
  const predictions = await mbta.getPredictions(routeId, stopId);

  if (predictions.length === 0) {
    return `There are currently no predictions for route ${routeId}.`;
  }

  const formattedTimeArray = _.map(predictions, prediction => {
    return moment(prediction, 'YYYY-MM-DDTHH:mmZZ').tz('America/New_York').format('hh:mm A');
  });
  const formattedTime = formattedTimeArray.join(' and ');

  if (formattedTimeArray.length === 1) {
    return `The next predicted time for route ${routeId} is at ${formattedTime}.`
  }

  return `The next predicted times for route ${routeId} are at ${formattedTime}.`
}

module.exports = {
    getPredictions: getPredictions
};
