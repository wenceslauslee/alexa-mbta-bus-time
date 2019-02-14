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

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {      
      return getSessionAttributes(handlerInput, deviceId);
    })
    .then(sessionAttributes => {
      if (handlerInput.requestEnvelope.request.intent 
        && handlerInput.requestEnvelope.request.intent.slots.City.value) {
        const nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        console.log(`Using city nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent 
        && handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        const nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        console.log(`Using street nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      const data = sessionAttributes.recent;
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
        data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
        return stopRouteDb.updateEntry(data)
          .then(() => {
            const index = _.findIndex(sessionAttributes.stops, s => (s.stopId === data.stopId));
            sessionAttributes.stops[index] = data;
            attributes.setAttributes(handlerInput, sessionAttributes);
          })
          .then(() => {
            return prediction.getPredictions(
              data.routeIds, data.stopId, timeAttributes.currentDate, timeAttributes.currentTime);
          })        
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
    .then(sessionAttributes => {
      if (!sessionAttributes.recent) {
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
      }
      if (handlerInput.requestEnvelope.request.intent.slots.City.value) {
        const nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        console.log(`Using city nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        const nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        console.log(`Using street nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      const data = sessionAttributes.recent;
      data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      return stopRouteDb.updateEntry(data)
        .then(() => {
          const index = _.findIndex(sessionAttributes.stops, s => (s.stopId === data.stopId));
          sessionAttributes.stops[index] = data;
          attributes.setAttributes(handlerInput, sessionAttributes);
        })
        .then(() => {
          return prediction.getPredictions(
            [routeId], data.stopId, timeAttributes.currentDate, timeAttributes.currentTime)
        })        
        .then((predictions) => {
          const speechOutput = `${predictions} ${constants.FOLLOW_UP_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(constants.REPROMPT_GET_ROUTE)
            .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
            .withShouldEndSession(false)
            .getResponse();
        });
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
      return mbtaInfo.getStop(stopId)
        .then(stops => {
          if (stops.length > 0) {
            const stop = stops[0];
            const recent = {
              deviceId: deviceId,
              stopId: stop.id
            };
            if (handlerInput.requestEnvelope.request.intent.slots.City.value) {
              const nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
              console.log(`Using city nickname ${nickname} for stop.`);
              recent.stopName = nickname;
            }
            if (handlerInput.requestEnvelope.request.intent.slots.Street.value) {
              const nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
              console.log(`Using street nickname ${nickname} for stop.`);
              recent.stopName = nickname;
            }
            sessionAttributes.recent = recent;
            sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
            attributes.setAttributes(handlerInput, sessionAttributes);
            const addStopConfirmation = `Adding stop ${digitize(stopId)}, ${address(stop.attributes.name)}, `
              + `into saved stops. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;

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
      const data = sessionAttributes.recent;
      data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      if (data.routeIds.length === 3) {
        data.routeIds = data.routeIds.splice(0, 1);
      }
      data.routeIds.push(routeId);
      const index = _.findIndex(sessionAttributes.stops, s => (s.stopId === data.stopId));
      sessionAttributes.stops[index] = data;
      attributes.setAttributes(handlerInput, sessionAttributes);

      return data;
    })
    .then(data => {
      return stopRouteDb.updateEntry(data);
    })
    .then(() => {
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
  const addRouteConfirmation = `Adding route ${digitize(number)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;
  const invalidStopSpeech = `Stop ${digitize(number)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];
  if (!currentState) {
    return handlerInput.responseBuilder
        .speak(constants.REPROMPT_GET_SUMMARY)
        .reprompt(constants.REPROMPT_GET_SUMMARY)
        .withSimpleCard(SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
        .withShouldEndSession(false)
        .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    return mbtaInfo.getStop(number)
      .then(stops => {
        if (stops.length > 0) {
          const stop = stops[0];
          const recent = {
            deviceId: deviceId,
            stopId: stop.id
          };
          sessionAttributes.recent = recent;
          sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
          attributes.setAttributes(handlerInput, sessionAttributes);
          const addStopConfirmation = `Adding stop ${digitize(number)}, ${address(stop.attributes.name)}, `
            + `into saved stops. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;

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
    const recent = sessionAttributes.recent;
    if (!recent.routeIds) {
      recent.routeIds = [number];
    } else {
      recent.routeIds.push(number);
    }
    recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
    sessionAttributes.currentState = null;
    const index = _.findIndex(sessionAttributes.stops, s => (s.stopId === recent.stopId));
    if (index === -1) {
      sessionAttributes.stops.push(recent);
    } else {
      sessionAttributes.stops[index] = recent;
    }
    attributes.setAttributes(handlerInput, sessionAttributes);

    return stopRouteDb.updateEntry(recent)
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
  if (!sessionAttributes.recent) {
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

function address(string) {
  return `<say-as interpret-as="address">${string}</say-as>`;
}

function getSpecificLocation(sessionAttributes, nickname) {
  if (sessionAttributes.recent.stopName === nickname) {
    return sessionAttributes;
  }
  const index = _.findIndex(sessionAttributes.stops, s => (s.stopName === nickname));
  if (index !== -1) {
    sessionAttributes.recent = sessionAttributes.stops[index];
  }
  return sessionAttributes;
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