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
        const result = {
          routeId: routeId
        };

        if (results[0].length === 0) {
          if (results[1]) {
            result.scheduled = formatToLocalTime(results[1]);
          }
          return result;
        }

        var formattedTimeArray = _.map(results[0], prediction => {
          return formatToLocalTime(prediction);
        });
        if (formattedTimeArray.length > 3) {
          formattedTimeArray = formattedTimeArray.slice(0, 3);
        }
        result.predictions = formattedTimeArray;

        return result;
      });
  });

  return q.all(routePredictions)
    .then(results => {
      const routesWithTime = _.filter(results, r => r.predictions && r.scheduled);
      const routesWithoutTime = _.filter(results, r => !r.predictions && !r.scheduled);

      const routesWithTimeString = _.map(routesWithTime, r => formatResult(r)).join(' ');
      const routesWithoutTimeString = formatResultsWithoutTime(routesWithoutTime);

      if (routesWithTimeString === '') {
        return routesWithoutTimeString;
      } else if (routesWithoutTimeString === '') {
        return routesWithTimeString;
      }
      return routesWithTimeString + ' ' + routesWithoutTimeString;
    });
}

function formatResult(result) {
  if (result.predictions) {
    if (result.predictions.length > 1) {
      return `The next predicted times for route ${digitize(result.routeId)} are at ${concatenate(result.predictions)}.`;
    }
    return `The next predicted time for route ${digitize(result.routeId)} is at ${concatenate(result.predictions)}.`;
  }
  return `The next scheduled trip for route ${digitize(result.routeId)} is at ${result.scheduled}.`;
}

function formatResultsWithoutTime(results) {
  const routeIds = concatenate(_.map(results, r => digitize(r.routeId)));
  return `There are no more scheduled trips for route ${routeIds} today.`;
}

function formatToLocalTime(isoTime) {
  return moment(isoTime, 'YYYY-MM-DDTHH:mmZZ').tz('America/New_York').format('hh:mm A');
}

function concatenate(results) {
  if (results.length === 1) {
    return results[0];
  } else if (results.length === 2) {
    return results.join(' and ');
  }
  const last = results.splice(results.length - 1, 1);
  var stringToReturn = results.join(', ');
  stringToReturn += ` and ${last}`;

  return stringToReturn;
}

function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

module.exports = {
  getPredictions: getPredictions
};
