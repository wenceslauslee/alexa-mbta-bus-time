const mbta = require('./mbta-api');
const moment = require('moment-timezone');
const q = require('q');
const _ = require('underscore');

function getPredictions(routeIds, stopId, currentDate, currentTime) {
  const routePredictions = _.map(routeIds, async (routeId) => {
    const predictionPromise = mbta.getPredictions(routeId, stopId);
    const earliestSchedulePromise = mbta.getEarliestSchedule(routeId, stopId, currentDate, currentTime);

    return q.all([predictionPromise, earliestSchedulePromise])
      .then((results) => {
        if (results[0].length === 0) {
          if (!results[1]) {
            return `There are no more scheduled trips for route ${digitize(routeId)} today.`;
          }
          return `The next scheduled trip for route ${digitize(routeId)} is at ${formatToLocalTime(results[1])}.`;
        }

        const formattedTimeArray = _.map(results[0], prediction => {
          return formatToLocalTime(prediction);
        });
        const formattedTime = formattedTimeArray.join(' and ');

        if (formattedTimeArray.length === 1) {
          return `The next predicted time for route ${digitize(routeId)} is at ${formattedTime}.`
        }

        return `The next predicted times for route ${digitize(routeId)} are at ${formattedTime}.`
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

function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

module.exports = {
  getPredictions: getPredictions
};
