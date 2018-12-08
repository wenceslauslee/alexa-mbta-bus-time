const mbta = require('./mbtaApi');
const moment = require('moment-timezone');
const q = require('q');
const _ = require('underscore');

function getPredictions(routeIds, stopId) {
  const routePredictions = _.map(routeIds, async (routeId) => {
    return mbta.getPredictions(routeId, stopId)
      .then(predictions => {
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
      });
  });

  return q.all(routePredictions)
    .then(results => {
      return results.join(' ');
    });
}

module.exports = {
    getPredictions: getPredictions
};
