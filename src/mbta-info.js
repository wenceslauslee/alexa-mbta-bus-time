const mbta = require('./mbta-api');

function isStopIdValid(stopId) {
  return mbta.getStop(stopId)
    .then(data => {
      return data.length !== 0;
    });
}

module.exports = {
  isStopIdValid: isStopIdValid,
};
