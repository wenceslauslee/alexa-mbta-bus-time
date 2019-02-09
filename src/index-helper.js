const attributes = require('./attributes');
const constants = require('./constants');
const mbtaInfo = require('./mbta-info');
const prediction = require('./prediction');
const stopRouteDb = require('./stop-route-db');
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
  const timeAttributes = timeHelper.getTimeAttributes();
  const initialSpeechOutput = `The current time is ${timeAttributes.currentTimeSpeech}.`;
  const sessionAttributes = attributes.getAttributes(handlerInput);

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {      
      return getSessionAttributes(handlerInput, deviceId);
    })
    .then(data => {
      if (!data) {
        sessionAttributes.currentState = constants.ADD_STOP_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const speechOutput = `We could not find any data related to your device. `
          + `What stop number would you like to use by default?`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
          .withShouldEndSession(false)
          .getResponse();
      } else if (data.stopId && data.routeIds && data.routeIds.length === 0) {     
        sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const speechOutput = `We could not find any routes related to your stop. `
          + `What route number would you like to use?`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
          .withShouldEndSession(false)
          .getResponse();
      } else if (data.stopId && data.routeIds && data.routeIds.length !== 0) {     
        attributes.setAttributes(handlerInput, data);   
        return prediction.getPredictions(
            data.routeIds, data.stopId, timeAttributes.currentDate, timeAttributes.currentTime)
          .then((predictions) => {
            const speechOutput = `${predictions} ${constants.FOLLOW_UP_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(constants.REPROMPT_GET_SUMMARY)
              .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
              .withShouldEndSession(false)
              .getResponse();
          });
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function getRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const timeAttributes = timeHelper.getTimeAttributes();
  const initialSpeechOutput = `The current time is ${timeAttributes.currentTimeSpeech}. `;

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {
      return getSessionAttributes(handlerInput, deviceId);
    })
    .then(data => {
      if (data) {
        return prediction.getPredictions(
            [routeId], data.stopId, timeAttributes.currentDate, timeAttributes.currentTime)
          .then((predictions) => {
            const speechOutput = `${predictions} ${constants.FOLLOW_UP_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(constants.REPROMPT_GET_ROUTE)
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
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const stopId = handlerInput.requestEnvelope.request.intent.slots.Stop.value;
  const speechOutput = `Adding stop ${digitize(stopId)}. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
  const invalidStopSpeech = `Stop ${digitize(stopId)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      return mbtaInfo.isStopIdValid(stopId)
        .then(valid => {
          if (valid) {
            sessionAttributes.stopId = stopId;
            sessionAttributes.routeIds = [];
            return stopRouteDb.update(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
              .then(() => sessionAttributes)
              .then(sessionAttributes => {
                attributes.setAttributes(handlerInput, sessionAttributes);

                return handlerInput.responseBuilder
                  .speak(speechOutput)
                  .reprompt(constants.REPROMPT_ADD_STOP)
                  .withSimpleCard(SKILL_NAME, `${speechOutput}`)
                  .withShouldEndSession(false)
                  .getResponse();
              });
          } else {
            return handlerInput.responseBuilder
              .speak(invalidStopSpeech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(SKILL_NAME, invalidStopSpeech)
              .withShouldEndSession(false)
              .getResponse();
          }
        });      
    })    
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function addRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const speechOutput = `Adding route ${digitize(routeId)} into saved routes. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
  
  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      if (sessionAttributes.routeIds.length === 3) {
        sessionAttributes.routeIds = sessionAttributes.routeIds.splice(0, 1);
      }
      sessionAttributes.routeIds.push(routeId);
      return stopRouteDb.update(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
        .then(() => sessionAttributes);
    })
    .then(sessionAttributes => {
      attributes.setAttributes(handlerInput, sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(constants.REPROMPT_ADD_ROUTE)
        .withSimpleCard(SKILL_NAME, `${speechOutput}`)
        .withShouldEndSession(false)
        .getResponse();
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function deleteStop(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const stopId = handlerInput.requestEnvelope.request.intent.slots.Stop.value;
  const speechOutput = `Deleting stop ${digitize(stopId)} from saved stops. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
  
  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      return stopRouteDb.remove(deviceId, sessionAttributes.stopId)
        .then(() => sessionAttributes);
    })
    .then(sessionAttributes => {
      if (sessionAttributes.stopId === stopId) {
        attributes.clearAttributes(handlerInput);
      }      

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(constants.REPROMPT_ADD_ROUTE)
        .withSimpleCard(SKILL_NAME, `${speechOutput}`)
        .withShouldEndSession(false)
        .getResponse();
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function deleteRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const speechOutput = `Deleting route ${digitize(routeId)} from saved routes. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
  
  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      sessionAttributes.routeIds = _.without(sessionAttributes.routeIds, routeId);
      return stopRouteDb.update(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
        .then(() => sessionAttributes);
    })
    .then(sessionAttributes => {
      attributes.setAttributes(handlerInput, sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(constants.REPROMPT_ADD_ROUTE)
        .withSimpleCard(SKILL_NAME, `${speechOutput}`)
        .withShouldEndSession(false)
        .getResponse();
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleNumberInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const number = handlerInput.requestEnvelope.request.intent.slots.Number.value;
  const addStopConfirmation = `Adding stop ${digitize(number)} into saved stops. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
  const addRouteConfirmation = `Adding route ${digitize(number)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;
  const invalidStopSpeech = `Stop ${digitize(number)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];
  if (!currentState) {
    // TODO: Figure out how to route this to the get summary intent if yes, otherwise exit on no.
    return handlerInput.responseBuilder
        .speak(constants.REPROMPT_GET_SUMMARY)
        .reprompt(constants.REPROMPT_GET_SUMMARY)
        .withSimpleCard(SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
        .withShouldEndSession(false)
        .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    return mbtaInfo.isStopIdValid(number)
      .then(valid => {
        if (valid) {
          sessionAttributes.stopId = number;
          sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
          attributes.setAttributes(handlerInput, sessionAttributes);

          return handlerInput.responseBuilder
            .speak(addStopConfirmation)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(SKILL_NAME, addStopConfirmation)
            .withShouldEndSession(false)
            .getResponse();
        } else {
          return handlerInput.responseBuilder
            .speak(invalidStopSpeech)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(SKILL_NAME, invalidStopSpeech)
            .withShouldEndSession(false)
            .getResponse();
        }
      });
  } else if (currentState === constants.ADD_ROUTE_INTENT) {
    if (!sessionAttributes.routeIds) {
      sessionAttributes.routeIds = [number];
    } else {
      sessionAttributes.routeIds.push(number);
    }
    sessionAttributes.currentState = null;
    attributes.setAttributes(handlerInput, sessionAttributes);

    return stopRouteDb.create(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
      .then(() => {
        return handlerInput.responseBuilder
          .speak(addRouteConfirmation)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(SKILL_NAME, addRouteConfirmation)
          .withShouldEndSession(false)
          .getResponse();
        })
      .catch(err => {
        console.log(err);
        throw err;
      });
  } else {
    const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
    console.log(errorMessage);
    throw new Error(errorMessage);
  }
}

function getSessionAttributes(handlerInput, deviceId) {
  const sessionAttributes = attributes.getAttributes(handlerInput);
  if (_.isEmpty(sessionAttributes)) {
    return stopRouteDb.query(deviceId)
      .then(data => {
        attributes.setAttributes(handlerInput, data);
        return data;
      });
  }
  return Promise.resolve(sessionAttributes);
}

function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

module.exports = {
  callDirectiveService: callDirectiveService,
  getSummary: getSummary,
  getRoute: getRoute,
  addStop: addStop,
  addRoute: addRoute,
  deleteStop: deleteStop,
  deleteRoute: deleteRoute,
  handleNumberInput: handleNumberInput,
};