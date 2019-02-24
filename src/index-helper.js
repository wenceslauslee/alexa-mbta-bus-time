const attributes = require('./attributes');
const constants = require('./constants');
const levenshtein = require('./levenshtein');
const mbtaInfo = require('./mbta-info');
const moment = require('moment-timezone');
const prediction = require('./prediction');
const stopRouteDb = require('./stop-route-db');
const timeHelper = require('./time-helper');
const _ = require('underscore');

function callDirectiveService(handlerInput, speechOutput) {
  const requestEnvelope = handlerInput.requestEnvelope;
  const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
  const requestId = requestEnvelope.request.requestId;
  const endpoint = requestEnvelope.context.System.apiEndpoint;
  const token = requestEnvelope.context.System.apiAccessToken;

  const directive = {
    header: {
      requestId
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: speechOutput
    }
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
      const recent = sessionAttributes.recent;
      if (!recent) {
        sessionAttributes.currentState = constants.ADD_STOP_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const display = `No stops related to this device.`;
        const speech = `We could not find any data related to your device. ${constants.FOLLOW_UP_STOP_PROMPT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      var nickname;
      if (handlerInput.requestEnvelope.request.intent &&
        handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent &&
        handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const display = `Stop name ${nickname} is invalid.`;
        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      if (recent.routeIds.length === 0) {
        sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const display = `No routes related to this stop.`;
        const speech = `We could not find any routes related to this stop. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);

          return prediction.getPredictions(
            recent.stopId, recent.direction, recent.routeIds, timeAttributes.currentDate, timeAttributes.currentTime);
        })
        .then((predictions) => {
          const speech = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_GET_SUMMARY)
            .withSimpleCard(constants.SKILL_NAME, predictions.display)
            .withShouldEndSession(false)
            .getResponse();
        });
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
      const recent = sessionAttributes.recent;
      if (!recent) {
        sessionAttributes.currentState = constants.ADD_STOP_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const display = `No stops related to this device.`;
        const speech = `We could not find any data related to your device. ${constants.FOLLOW_UP_STOP_PROMPT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      var nickname;
      if (handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const display = `Stop name ${nickname} is invalid.`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);

          return prediction.getPredictions(
            recent.stopId, recent.direction, [routeId], timeAttributes.currentDate, timeAttributes.currentTime);
        })
        .then((predictions) => {
          const speech = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_GET_ROUTE)
            .withSimpleCard(constants.SKILL_NAME, predictions.display)
            .withShouldEndSession(false)
            .getResponse();
        });
    });
}

function addStop(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const stopId = handlerInput.requestEnvelope.request.intent.slots.Stop.value;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      return mbtaInfo.getStop(stopId)
        .then(stops => {
          if (stops.length > 0) {
            const stop = stops[0];
            const recent = {
              deviceId: deviceId,
              stopId: stop.id,
              routeIds: []
            };
            sessionAttributes.recent = recent;
            sessionAttributes.currentState = constants.ADD_STOP_INTENT;
            attributes.setAttributes(handlerInput, sessionAttributes);

            const display = `Stop (${stopId}) ${stop.attributes.name} added.`;
            const speech = `Adding stop ${digitize(stopId)}, ${address(stop.attributes.name)}, ` +
                `into saved stops. ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(speech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, display)
              .withShouldEndSession(false)
              .getResponse();
          } else {
            const display = `Stop ${stopId} invalid.`;
            const speech = `Stop ${digitize(stopId)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(speech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, display)
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

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      var nickname;
      if (handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const display = `Stop name ${nickname} is invalid.`;
        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      const recent = sessionAttributes.recent;
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      recent.routeIds.push(routeId);
      recent.routeIds = _.uniq(recent.routeIds);
      if (recent.routeIds.length > 3) {
        recent.routeIds.splice(0, 1);
      }
      sessionAttributes.stops[sessionAttributes.index] = recent;
      sessionAttributes.currentState = null;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);
          const display = `Route ${routeId} added.`;
          const speech = `Adding route ${digitize(routeId)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, display)
            .withShouldEndSession(false)
            .getResponse();
        });
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function deleteStop(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      if (sessionAttributes.recent === null) {
        const display = `No stops found.`;
        const speech = `There are no stops related to your device. ${constants.TRY_AGAIN_PROMPT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      const stopId = sessionAttributes.recent.stopId;
      const stopName = sessionAttributes.recent.stopName;

      return stopRouteDb.remove(deviceId, stopId)
        .then(() => {
          sessionAttributes = getNextRecentStop(sessionAttributes);
          attributes.setAttributes(handlerInput, sessionAttributes);
          const recent = sessionAttributes.recent;
          if (recent) {
            recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
            sessionAttributes.stops[sessionAttributes.index] = recent;

            return stopRouteDb.updateEntry(recent);
          }
        })
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);
          const display = `Stop (${stopId}) ${stopName} deleted.`;
          const speech = `Deleting stop ${stopName} from saved stops. ${constants.FOLLOW_UP_PROMPT_SHORT}`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_ADD_ROUTE)
            .withSimpleCard(constants.SKILL_NAME, display)
            .withShouldEndSession(false)
            .getResponse();
        });
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function deleteRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const recent = sessionAttributes.recent;
      if (recent === null) {
        const display = `No stops found.`;
        const speech = `Deleting route ${digitize(routeId)}. ${constants.FOLLOW_UP_PROMPT_SHORT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      }
      recent.routeIds = _.without(recent.routeIds, routeId);
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);
          const display = `Route ${routeId} deleted.`;
          const speech = `Deleting route ${digitize(routeId)} from stop ${recent.stopName}. ` +
            `${constants.FOLLOW_UP_PROMPT_SHORT}`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_ADD_ROUTE)
            .withSimpleCard(constants.SKILL_NAME, display)
            .withShouldEndSession(false)
            .getResponse();
        });
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleNumberInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const number = handlerInput.requestEnvelope.request.intent.slots.Number.value;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes.currentState;
      if (!currentState) {
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      } else if (currentState === constants.ADD_STOP_INTENT) {
        return mbtaInfo.getStop(number)
          .then(stops => {
            if (stops.length > 0) {
              const stop = stops[0];
              const recent = {
                deviceId: deviceId,
                stopId: stop.id,
                routeIds: []
              };
              sessionAttributes.recent = recent;
              attributes.setAttributes(handlerInput, sessionAttributes);
              const display = `Stop (${number}) ${stop.attributes.name} added.`;
              const speech = `Adding stop ${digitize(number)}, ${address(stop.attributes.name)}, ` +
                `into saved stops. ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;

              return handlerInput.responseBuilder
                .speak(speech)
                .reprompt(constants.REPROMPT_REPEAT)
                .withSimpleCard(constants.SKILL_NAME, display)
                .withShouldEndSession(false)
                .getResponse();
            }
            const speech = `Stop ${digitize(number)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
            const display = `Stop ${number} invalid.`;

            return handlerInput.responseBuilder
              .speak(speech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, display)
              .withShouldEndSession(false)
              .getResponse();
          });
      } else if (currentState === constants.ADD_ROUTE_INTENT) {
        const recent = sessionAttributes.recent;
        recent.routeIds.push(number);
        recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
        if (sessionAttributes.index === -1) {
          sessionAttributes.stops.push(recent);
          sessionAttributes.index = sessionAttributes.stops.length - 1;
        } else {
          sessionAttributes.stops[sessionAttributes.index] = recent;
        }
        sessionAttributes.currentState = null;

        return stopRouteDb.updateEntry(recent)
          .then(() => {
            attributes.setAttributes(handlerInput, sessionAttributes);
            const speech = `Adding route ${digitize(number)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;
            const display = `Route ${number} added.`;

            return handlerInput.responseBuilder
              .speak(speech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, display)
              .withShouldEndSession(false)
              .getResponse();
          });
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleNameInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  var name;
  if (handlerInput.requestEnvelope.request.intent.slots.City &&
    handlerInput.requestEnvelope.request.intent.slots.City.value) {
    name = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
  } else {
    name = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
  }

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes['currentState'];
      if (!currentState) {
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      } else if (currentState === constants.ADD_STOP_INTENT) {
        const duplicateName = _.find(sessionAttributes.stops, s => s.stopName === name);
        if (duplicateName) {
          const speech = `The name ${name} has already been used. ${constants.TRY_AGAIN_PROMPT}`;
          const display = `The name ${name} has already been used.`;

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, display)
            .withShouldEndSession(false)
            .getResponse();
        }
        const recent = sessionAttributes.recent;
        recent.stopName = name;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const speech = `Using ${name} as stop name. ${constants.FOLLOW_UP_YES_NO_PROMPT}`;
        const display = `Using ${name} as stop name.`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleDirectionInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes.currentState;
      if (!currentState) {
        return handlerInput.responseBuilder
          .speak(constants.STOP_MESSAGE)
          .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
          .withShouldEndSession(true)
          .getResponse();
      } else if (currentState === constants.ADD_STOP_INTENT) {
        const directionValue = handlerInput.requestEnvelope.request.intent.slots.Direction.value.toLowerCase();
        const recent = sessionAttributes.recent;
        if (directionValue === constants.INBOUND_TEXT) {
          recent.direction = constants.INBOUND;
        } else {
          recent.direction = constants.OUTBOUND;
        }
        const duplicateStop = _.find(
          sessionAttributes.stops, s => s.stopId === recent.stopId && s.direction === recent.direction);
        if (duplicateStop) {
          const speech = `This stop has been added already. ${constants.TRY_AGAIN_PROMPT} ` +
            `What stop number would you like to use?`;
          const display = 'This stop has been added already.';
          sessionAttributes.recent = null;
          sessionAttributes.currentState = constants.ADD_STOP_INTENT;
          attributes.setAttributes(handlerInput, sessionAttributes);

          return handlerInput.responseBuilder
            .speak(speech)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, display)
            .withShouldEndSession(false)
            .getResponse();
        }
        recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
        attributes.setAttributes(handlerInput, sessionAttributes);

        const speech = `Adding stop ${digitize(recent.stopId)} into saved routes. ` +
          `${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
        const display = `Stop ${recent.stopId} added.`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleYesInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes.currentState;
      if (!currentState) {
        return handlerInput.responseBuilder
          .speak(constants.STOP_MESSAGE)
          .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
          .withShouldEndSession(true)
          .getResponse();
      } else if (currentState === constants.ADD_STOP_INTENT) {
        const recent = sessionAttributes.recent;
        const name = recent.stopName;
        if (sessionAttributes.index === -1) {
          sessionAttributes.stops.push(recent);
          sessionAttributes.index = 0;
        } else {
          sessionAttributes.stops[sessionAttributes.index] = recent;
          sessionAttributes.index = sessionAttributes.stops.length - 1;
        }

        return stopRouteDb.updateEntry(recent)
          .then(() => {
            sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
            attributes.setAttributes(handlerInput, sessionAttributes);
            const speech = `OK. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
            const display = `Using ${name} as stop name.`;

            return handlerInput.responseBuilder
              .speak(speech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, display)
              .withShouldEndSession(false)
              .getResponse();
          });
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleNoInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes.currentState;
      if (!currentState) {
        return handlerInput.responseBuilder
          .speak(constants.STOP_MESSAGE)
          .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
          .withShouldEndSession(true)
          .getResponse();
      } else if (currentState === constants.ADD_STOP_INTENT) {
        const speech = `OK. ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
        const display = `${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;

        return handlerInput.responseBuilder
          .speak(speech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, display)
          .withShouldEndSession(false)
          .getResponse();
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);
        return handlerInput.responseBuilder
          .speak(constants.REPROMPT_GET_SUMMARY)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
          .withShouldEndSession(false)
          .getResponse();
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

// Gets session attributes from request, otherwise reads from DB.
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

// Interpret as digits.
function digitize(number) {
  return `<say-as interpret-as="digits">${number}</say-as>`;
}

// Interpret as address.
function address(string) {
  return `<say-as interpret-as="address">${string}</say-as>`;
}

// Gets the most appropriate stop given a stop nickname.
function getSpecificLocation(sessionAttributes, nickname) {
  const index = levenshtein.getBestMatch(nickname, sessionAttributes.recent, sessionAttributes.stops);
  if (index === null) {
    sessionAttributes.invalidOperation = true;
  } else {
    sessionAttributes.invalidOperation = false;
    if (index >= 0) {
      sessionAttributes.recent = sessionAttributes.stops[index];
      sessionAttributes.index = index;
    }
  }

  return sessionAttributes;
}

// Gets the next recent stop if current stop gets deleted.
function getNextRecentStop(sessionAttributes) {
  sessionAttributes.stops.splice(sessionAttributes.index, 1);

  if (sessionAttributes.stops.length === 0) {
    sessionAttributes.recent = null;
    sessionAttributes.index = -1;
  } else {
    const recent = _.max(sessionAttributes.stops, s => moment(s.lastUpdatedDateTime).valueOf());
    const index = _.find(sessionAttributes.stops, s => recent.stopId === s.stopId && recent.direction === s.direction);
    sessionAttributes.recent = recent;
    sessionAttributes.index = index;
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
  handleNameInput: handleNameInput,
  handleDirectionInput: handleDirectionInput,
  handleYesInput: handleYesInput,
  handleNoInput: handleNoInput
};
