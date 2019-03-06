const _ = require('underscore');

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

function address(string) {
  return `<say-as interpret-as="address">${string}</say-as>`;
}

function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

module.exports = {
  address: address,
  concatenate: concatenate,
  digitize: digitize
};
