const attributes = require('./attributes');
const dbInfo = require('./db-info');
const prediction = require('./prediction');
const timeHelper = require('./time-helper');
const _ = require('underscore');

const SKILL_NAME = 'MBTA Bus Time';

function callDirectiveService(handlerInput, speechOutput) {
  const requestEnvelope = handlerInput.requestEnvelope;
  const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
  const requestId = requestEnvelope.request.requestId;
  const endpoint = requestEnvelope.context.System.apiEndpoint;
  const token = requestEnvelope.context.System.apiAccessToken;

  const directive = {
    header: {
      requestId,
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: speechOutput,
    },
  };

  return directiveServiceClient.enqueue(directive, endpoint, token);
}

function getSummary(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const followUpPrompt = 'Would you like to do anything else?';
  const repromptSpeech = 'I did not quite get that.  Would you like to get a summary?';
  const timeAttributes = timeHelper.getTimeAttributes();
  const initialSpeechOutput = `The current time is ${timeAttributes.currentTimeSpeech}.`;

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {
      const sessionAttributes = attributes.getAttributes(handlerInput);
      if (_.isEmpty(sessionAttributes)) {
        return dbInfo.retrieve(deviceId)
          .then(data => {
            attributes.setAttributes(handlerInput, data);
            return data;
          });
      }
      return Promise.resolve(sessionAttributes);
    })
    .then(data => {
      if (data) {        
        return prediction.getPredictions(
            data.routeIds, data.stopId, timeAttributes.currentDate, timeAttributes.currentTime)
          .then((predictions) => {
            const speechOutput = `${predictions} ${followUpPrompt}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(repromptSpeech)
              .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
              .withShouldEndSession(false)
              .getResponse();
          });
      } else {
        // Prompt user to register stop and route.
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function getRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const followUpPrompt = 'Would you like to do anything else?';
  const repromptSpeech = 'I did not quite get that.  Do you want to ask for a specific route?';
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const timeAttributes = timeHelper.getTimeAttributes();
  const initialSpeechOutput = `The current time is ${timeAttributes.currentTimeSpeech}. `;

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {
      const sessionAttributes = attributes.getAttributes(handlerInput);
      if (_.isEmpty(sessionAttributes)) {
        return dbInfo.retrieve(deviceId)
          .then(data => {
            attributes.setAttributes(handlerInput, data);
            return data;
          });
      }
      return Promise.resolve(sessionAttributes);
    })
    .then(data => {
      if (data) {
        return prediction.getPredictions(
            [routeId], data.stopId, timeAttributes.currentDate, timeAttributes.currentTime)
          .then((predictions) => {
            const speechOutput = `${predictions} ${followUpPrompt}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(repromptSpeech)
              .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
              .withShouldEndSession(false)
              .getResponse();
          });
      } else {
        // Prompt user to register stop and route
      }
    });  
}

function addStop(handlerInput) {

}

function addRoute(handlerInput) {

}

module.exports = {
  callDirectiveService: callDirectiveService,
  getSummary: getSummary,
  getRoute: getRoute,
  addStop: addStop,
  addRoute: addRoute
};