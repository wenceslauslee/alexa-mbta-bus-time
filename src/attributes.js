const _ = require('underscore');

function getAttributes(handlerInput) {
  return handlerInput.attributesManager.getSessionAttributes();
}

function setAttributes(handlerInput, attributesToSet) {
  const attributesManager = handlerInput.attributesManager
  var existingAttributes = attributesManager.getSessionAttributes();

  if (_.isEmpty(existingAttributes)) {
    console.log(`Attributes set to ${JSON.stringify(attributesToSet, null, 2)}`);
    attributesManager.setSessionAttributes(attributesToSet);
  } else {
    existingAttributes = _.extend(attributesToSet, existingAttributes);
    console.log(`Attributes set to ${JSON.stringify(existingAttributes, null, 2)}`);
    attributesManager.setSessionAttributes(existingAttributes);
  }

  return;
}

module.exports = {
  getAttributes: getAttributes,
  setAttributes: setAttributes
};