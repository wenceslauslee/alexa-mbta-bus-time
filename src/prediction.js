const constants = require('./constants');
const mbta = require('./mbta-api');
const moment = require('moment-timezone');
const q = require('q');
const _ = require('underscore');

function getPredictions(routes, stopId, currentDate, currentTime) {
  const routePredictions = _.map(routes, async (route) => {
    const predictionPromise = mbta.getPredictions(route.id, route.direction, stopId);
    const earliestSchedulePromise = mbta.getEarliestSchedule(route.id, route.direction, stopId, currentDate, currentTime);

    return q.all([predictionPromise, earliestSchedulePromise])
      .then((results) => {
        const result = {
          id: route.id
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
      const routesWithTime = _.filter(results, r => r.predictions || r.scheduled);
      const routesWithoutTime = _.filter(results, r => !r.predictions && !r.scheduled);

      const routesWithTimeSpeech = _.map(routesWithTime, r => formatResult(r).speech).join(' ');
      const routesWithTimeDisplay = _.map(routesWithTime, r => formatResult(r).display).join('\n');
      const routesWithoutTimeSpeech = formatResultsWithoutTime(routesWithoutTime).speech;
      const routesWithoutTimeDisplay = formatResultsWithoutTime(routesWithoutTime).display;

      if (routesWithTime.length === 0) {
        return {
          speech: routesWithoutTimeSpeech,
          display: routesWithoutTimeDisplay
        };
      } else if (routesWithoutTime.length === 0) {
        return {
          speech: routesWithTimeSpeech,
          display: routesWithTimeDisplay
        };
      }
      return {
        speech: routesWithTimeSpeech + ' ' + routesWithoutTimeSpeech,
        display: routesWithTimeDisplay + '\n' + routesWithoutTimeDisplay
      };
    });
}

function formatResult(result) {
  if (result.predictions) {
    if (result.predictions.length > 1) {
      return {
        speech: `The next predicted times for route ${digitize(result.id)} ${formatDirection(result.direction)} `
          + `are at ${concatenate(result.predictions)}.`,
        display: `${result.id} ${formatDirection(result.direction)}: ${concatenate(result.predictions)}`
      };
    }
    return {
      speech: `The next predicted time for route ${digitize(result.id)} ${formatDirection(result.direction)} `
        + `is at ${concatenate(result.predictions)}.`,
      display: `${result.id} ${formatDirection(result.direction)}: ${concatenate(result.predictions)}`
    };
  }
  return {
    speech: `The next scheduled trip for route ${digitize(result.id)} ${formatDirection(result.direction)} `
      + `is at ${result.scheduled}.`,
    display: `${result.id} ${formatDirection(result.direction)}: ${result.scheduled}`
  };
}

function formatResultsWithoutTime(results) {
  const routeIds = concatenate(_.map(results, r => `${digitize(r.id)} ${formatDirection(r.direction)}`));

  return {
    speech: `There are no more scheduled trips for route ${routeIds} today.`,
    display: _.map(results, r => `${r.id}  ${formatDirection(r.direction)}: None`).join('\n')
  };
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
  const excludeLast = _.initial(results);
  var stringToReturn = excludeLast.join(', ');
  stringToReturn += ` and ${results[results.length - 1]}`;

  return stringToReturn;
}

function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

function formatDirection(direction) {
  return (direction === constants.INBOUND)
    ? constants.INBOUND_TEXT
    : constants.OUTBOUND_TEXT;
}

module.exports = {
  getPredictions: getPredictions
};
