const mbta = require('./mbta-api');
const moment = require('moment-timezone');
const q = require('q');
const utils = require('./utils');
const _ = require('underscore');

function getPredictions(stopId, direction, routeIds, currentDate, currentTime) {
  const routePredictions = _.map(routeIds, async (routeId) => {
    const predictionPromise = mbta.getPredictions(stopId, direction, routeId);
    const earliestSchedulePromise = mbta.getEarliestSchedule(stopId, direction, routeId, currentDate, currentTime);

    return q.all([predictionPromise, earliestSchedulePromise])
      .then((results) => {
        const result = {
          id: routeId,
          scheduled: null,
          predictions: null
        };

        if (results[0].length === 0) {
          if (results[1] !== null) {
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
  if (result.predictions !== null) {
    if (result.predictions.length > 1) {
      return {
        speech: `The next predicted times for route ${utils.digitize(result.id)} ` +
          `are at ${utils.concatenate(result.predictions)}.`,
        display: `${result.id}: ${utils.concatenate(result.predictions)}`
      };
    }
    return {
      speech: `The next predicted time for route ${utils.digitize(result.id)} ` +
        `is at ${utils.concatenate(result.predictions)}.`,
      display: `${result.id}: ${utils.concatenate(result.predictions)}`
    };
  }
  return {
    speech: `The next scheduled trip for route ${utils.digitize(result.id)} is at ${result.scheduled}.`,
    display: `${result.id}: ${result.scheduled}`
  };
}

function formatResultsWithoutTime(results) {
  const routeIds = utils.concatenate(_.map(results, r => `${utils.digitize(r.id)}`));

  return {
    speech: `There are no more scheduled trips for route ${routeIds} today.`,
    display: _.map(results, r => `${r.id}: None`).join('\n')
  };
}

function formatToLocalTime(isoTime) {
  return moment(isoTime, 'YYYY-MM-DDTHH:mmZZ').tz('America/New_York').format('hh:mm A');
}

module.exports = {
  getPredictions: getPredictions
};
