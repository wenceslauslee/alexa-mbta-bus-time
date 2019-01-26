const _ = require('underscore');

function setAttributes(handlerInput, attributesToSet) {
  const attributesManager = handlerInput.attributesManager
  var existingAttributes = attributesManager.getSessionAttributes();

  if (!existingAttributes) {
  	attributesManager.setSessionAttributes(attributesToSet);
  } else {
  	existingAttributes = _.extend(attributesToSet, existingAttributes);
  	attributesManager.setSessionAttributes(existingAttributes);
  }

  return;
}

module.exports = {
  setAttributes: setAttributes
};