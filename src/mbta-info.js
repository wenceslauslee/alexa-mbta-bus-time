const mbta = require('./mbta-api');

function isStopIdValid(stopId) {
  return mbta.getStop(stopId)
    .then(data => {
      return data.length !== 0;
    });
}

function getStop(stopId) {
  return mbta.getStop(stopId);
}

module.exports = {
  getStop: getStop,
  isStopIdValid: isStopIdValid
};
