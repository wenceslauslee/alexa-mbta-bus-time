const levenshtein = require('js-levenshtein');

// Return -1 if recent is exact match
// Return index if levenshtein < 3
// Otherwise return null
function getBestMatch(stringToMatch, recentStop, stops) {
  if (stringToMatch === null || stringToMatch === recentStop.stopName) {
    return -1;
  }

  var min = stringToMatch.length;
  var minIndex = null;
  for (var i = 0; i < stops.length; i++) {
    const l = levenshtein(stringToMatch, stops[i].stopName);
    if (l === 1) {
      return i;
    }
    if (l < min) {
      min = l;
      minIndex = i;
    }
  }

  if (min > 3) {
    return null;
  }

  return minIndex;
}

module.exports = {
  getBestMatch: getBestMatch
};
