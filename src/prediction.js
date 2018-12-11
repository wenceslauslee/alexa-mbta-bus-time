const mbta = require('./mbtaApi');
const moment = require('moment-timezone');
const q = require('q');
const _ = require('underscore');

function getPredictions(routeIds, stopId, currentDate, currentTime) {
  const routePredictions = _.map(routeIds, async (routeId) => {
    const predictionPromise = mbta.getPredictions(routeId, stopId);
    const earliestSchedulePromise = mbta.getEarliestSchedule(routeId, stopId, currentDate, currentTime);

    return q.all([predictionPromise, earliestSchedulePromise])
      .then((results) => {
        if (!results[1]) {
          return `There are no more scheduled trips for route ${routeId} today.`;
        }
        if (results[0].length === 0) {
          return `There are currently no predictions for route ${routeId}. `
            + `The next scheduled trip is at ${formatToLocalTime(results[1])}.`;
        }

        const formattedTimeArray = _.map(results[0], prediction => {
          return formatToLocalTime(prediction);
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

function formatToLocalTime(isoTime) {
  return moment(isoTime, 'YYYY-MM-DDTHH:mmZZ').tz('America/New_York').format('hh:mm A');
}

module.exports = {
    getPredictions: getPredictions
};
