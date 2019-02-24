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
      var nickname;
      if (handlerInput.requestEnvelope.request.intent &&
        handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        console.log(`Using city nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent &&
        handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        console.log(`Using street nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidStopName) {
        const invalidStopNameSpeech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const invalidStopNameDisplay = `Stop name ${nickname} is invalid.`;
        return handlerInput.responseBuilder
          .speak(invalidStopNameSpeech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, invalidStopNameDisplay)
          .withShouldEndSession(false)
          .getResponse();
      }
      const data = sessionAttributes.recent;
      if (!data) {
        sessionAttributes.currentState = constants.ADD_STOP_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const whichStopOutput = `What stop number would you like to use by default?`;
        const speechOutput = `We could not find any data related to your device. ${whichStopOutput}`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, whichStopOutput)
          .withShouldEndSession(false)
          .getResponse();
      } else if (data.stopId && data.routeIds && data.routeIds.length === 0) {
        sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);
        const whichRouteOutput = `What route number would you like to use?`;
        const speechOutput = `We could not find any routes related to your stop. ${whichRouteOutput}`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, whichRouteOutput)
          .withShouldEndSession(false)
          .getResponse();
      } else if (data.stopId && data.routeIds && data.routeIds.length !== 0) {
        data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
        return stopRouteDb.updateEntry(data)
          .then(() => {
            const index = _.findIndex(
              sessionAttributes.stops, s => (s.stopId === data.stopId && s.direction === data.direction));
            sessionAttributes.stops[index] = data;
            attributes.setAttributes(handlerInput, sessionAttributes);
          })
          .then(() => {
            return prediction.getPredictions(
              data.stopId, data.direction, data.routeIds, timeAttributes.currentDate, timeAttributes.currentTime);
          })
          .then((predictions) => {
            const speechOutput = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(constants.REPROMPT_GET_SUMMARY)
              .withSimpleCard(constants.SKILL_NAME, predictions.display)
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
        const whichStopOutput = `What stop number would you like to use by default?`;
        const speechOutput = `We could not find any data related to your device. ${whichStopOutput}`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, whichStopOutput)
          .withShouldEndSession(false)
          .getResponse();
      }
      var nickname;
      if (handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        console.log(`Using city nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        console.log(`Using street nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidStopName) {
        const invalidStopNameSpeech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const invalidStopNameDisplay = `Stop name ${nickname} is invalid.`;
        return handlerInput.responseBuilder
          .speak(invalidStopNameSpeech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, invalidStopNameDisplay)
          .withShouldEndSession(false)
          .getResponse();
      }
      const data = sessionAttributes.recent;
      data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      return stopRouteDb.updateEntry(data)
        .then(() => {
          const index = _.findIndex(
            sessionAttributes.stops, s => (s.stopId === data.stopId && s.direction === data.direction));
          sessionAttributes.stops[index] = data;
          attributes.setAttributes(handlerInput, sessionAttributes);
        })
        .then(() => {
          return prediction.getPredictions(
            data.stopId, data.direction, [routeId], timeAttributes.currentDate, timeAttributes.currentTime);
        })
        .then((predictions) => {
          const speechOutput = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(speechOutput)
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
  const invalidStopDisplay = `Stop ${stopId} invalid.`;
  const invalidStopSpeech = `Stop ${digitize(stopId)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;

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
            var addStopDisplay = `Stop (${stopId}) ${stop.attributes.name} added.`;
            var addStopConfirmation = `Adding stop ${digitize(stopId)}, ${address(stop.attributes.name)}, ` +
                `into saved stops. ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;

            return handlerInput.responseBuilder
              .speak(addStopConfirmation)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
              .withShouldEndSession(false)
              .getResponse();
          } else {
            return handlerInput.responseBuilder
              .speak(invalidStopSpeech)
              .reprompt(constants.REPROMPT_REPEAT)
              .withSimpleCard(constants.SKILL_NAME, invalidStopDisplay)
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
  const displayOutput = `Route ${routeId} added.`;
  const speechOutput = `Adding route ${digitize(routeId)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      var nickname;
      if (handlerInput.requestEnvelope.request.intent.slots.City &&
        handlerInput.requestEnvelope.request.intent.slots.City.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
        console.log(`Using city nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (handlerInput.requestEnvelope.request.intent.slots.Street &&
        handlerInput.requestEnvelope.request.intent.slots.Street.value) {
        nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
        console.log(`Using street nickname ${nickname} for stop.`);
        sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      }
      if (sessionAttributes.invalidStopName) {
        const invalidStopNameSpeech = `Stop name ${nickname} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
        const invalidStopNameDisplay = `Stop name ${nickname} is invalid.`;
        return handlerInput.responseBuilder
          .speak(invalidStopNameSpeech)
          .reprompt(constants.REPROMPT_GET_SUMMARY)
          .withSimpleCard(constants.SKILL_NAME, invalidStopNameDisplay)
          .withShouldEndSession(false)
          .getResponse();
      }
      const data = sessionAttributes.recent;
      data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      data.routeIds.push(routeId);
      data.routeIds = _.uniq(data.routeIds);
      if (data.routeIds.length > 3) {
        data.routeIds.splice(0, 1);
      }
      const index = _.findIndex(
        sessionAttributes.stops, s => (s.stopId === data.stopId && s.direction === data.direction));
      sessionAttributes.stops[index] = data;

      return stopRouteDb.updateEntry(data)
        .then(() => {
          sessionAttributes.currentState = null;
          attributes.setAttributes(handlerInput, sessionAttributes);

          return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, displayOutput)
            .withShouldEndSession(false)
            .getResponse();
        })
        .catch(err => {
          console.log(err);
          throw err;
        });
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function deleteStop(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const invalidOperationDisplay = `No stops found.`;
  const invalidOperationSpeech = `There are no stops related to your device. ${constants.TRY_AGAIN_PROMPT}`;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      if (sessionAttributes.recent === null) {
        return handlerInput.responseBuilder
          .speak(invalidOperationSpeech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, invalidOperationDisplay)
          .withShouldEndSession(false)
          .getResponse();
      } else {
        const stopId = sessionAttributes.recent.stopId;
        const stopName = sessionAttributes.recent.stopName;
        sessionAttributes = getNextRecentStop(sessionAttributes);
        return stopRouteDb.remove(deviceId, stopId)
          .then(() => {
            if (sessionAttributes.recent) {
              const data = sessionAttributes.recent;
              data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
              const index = _.findIndex(
                sessionAttributes.stops, s => (s.stopId === data.stopId && s.direction === data.direction));
              sessionAttributes.stops[index] = data;

              return stopRouteDb.updateEntry(data);
            }
          })
          .then(() => {
            attributes.setAttributes(handlerInput, sessionAttributes);
            const displayOutput = `Stop (${stopId}) ${stopName} deleted.`;
            const speechOutput = `Deleting stop ${stopName} from saved stops. ${constants.FOLLOW_UP_PROMPT_SHORT}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(constants.REPROMPT_ADD_ROUTE)
              .withSimpleCard(constants.SKILL_NAME, displayOutput)
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

function deleteRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const noStopDisplay = `No stops found.`;
  const noStopSpeech = `Deleting route ${digitize(routeId)}. ${constants.FOLLOW_UP_PROMPT_SHORT}`;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      if (sessionAttributes.recent === null) {
        return handlerInput.responseBuilder
          .speak(noStopSpeech)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, noStopDisplay)
          .withShouldEndSession(false)
          .getResponse();
      } else {
        const data = sessionAttributes.recent;
        data.routeIds = _.without(data.routeIds, routeId);
        data.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
        const index = _.findIndex(
          sessionAttributes.stops, s => (s.stopId === data.stopId && s.direction === data.direction));
        sessionAttributes.stops[index] = data;

        return stopRouteDb.updateEntry(data)
          .then(() => {
            attributes.setAttributes(handlerInput, sessionAttributes);
            const displayOutput = `Route ${routeId} deleted.`;
            const speechOutput = `Deleting route ${digitize(routeId)} from stop ${data.stopName}. ` +
              `${constants.FOLLOW_UP_PROMPT_SHORT}`;

            return handlerInput.responseBuilder
              .speak(speechOutput)
              .reprompt(constants.REPROMPT_ADD_ROUTE)
              .withSimpleCard(constants.SKILL_NAME, displayOutput)
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

function handleNumberInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const number = handlerInput.requestEnvelope.request.intent.slots.Number.value;
  const addRouteConfirmation = `Adding route ${digitize(number)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;
  const addRouteDisplay = `Route ${number} added.`;
  const invalidStopSpeech = `Stop ${digitize(number)} is invalid. ${constants.TRY_AGAIN_PROMPT}`;
  const invalidStopDisplay = `Stop ${number} invalid.`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];
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
          const addStopDisplay = `Stop (${number}) ${stop.attributes.name} added.`;
          const addStopConfirmation = `Adding stop ${digitize(number)}, ${address(stop.attributes.name)}, ` +
            `into saved stops. ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;

          return handlerInput.responseBuilder
            .speak(addStopConfirmation)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
            .withShouldEndSession(false)
            .getResponse();
        } else {
          return handlerInput.responseBuilder
            .speak(invalidStopSpeech)
            .reprompt(constants.REPROMPT_REPEAT)
            .withSimpleCard(constants.SKILL_NAME, invalidStopDisplay)
            .withShouldEndSession(false)
            .getResponse();
        }
      });
  } else if (currentState === constants.ADD_ROUTE_INTENT) {
    const recent = sessionAttributes.recent;
    recent.routeIds.push(number);
    recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
    const index = _.findIndex(
      sessionAttributes.stops, s => (s.stopId === recent.stopId && s.direction === recent.direction));
    if (index === -1) {
      sessionAttributes.stops.push(recent);
    } else {
      sessionAttributes.stops[index] = recent;
    }

    return stopRouteDb.updateEntry(recent)
      .then(() => {
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return handlerInput.responseBuilder
          .speak(addRouteConfirmation)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, addRouteDisplay)
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
    return handlerInput.responseBuilder
      .speak(constants.REPROMPT_GET_SUMMARY)
      .reprompt(constants.REPROMPT_GET_SUMMARY)
      .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
      .withShouldEndSession(false)
      .getResponse();
  }
}

function handleNameInput(handlerInput) {
  var name = '';
  if (handlerInput.requestEnvelope.request.intent.slots.City &&
    handlerInput.requestEnvelope.request.intent.slots.City.value) {
    name = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
  } else {
    name = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
  }
  const addStopConfirmation = `Using ${name} as stop name. ${constants.FOLLOW_UP_YES_NO_PROMPT}`;
  const addStopDisplay = `Using ${name} as stop name.`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];
  if (!currentState) {
    return handlerInput.responseBuilder
      .speak(constants.REPROMPT_GET_SUMMARY)
      .reprompt(constants.REPROMPT_GET_SUMMARY)
      .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
      .withShouldEndSession(false)
      .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    const sameName = _.find(sessionAttributes.stops, s => s.stopName === name);
    if (sameName) {
      const speechOutput = `The name ${name} has already been used. ${constants.TRY_AGAIN_PROMPT}`;
      const displayOutput = `The name ${name} has already been used.`;
      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(constants.REPROMPT_REPEAT)
        .withSimpleCard(constants.SKILL_NAME, displayOutput)
        .withShouldEndSession(false)
        .getResponse();
    }

    const data = sessionAttributes.recent;
    data.stopName = name;
    attributes.setAttributes(handlerInput, sessionAttributes);

    return handlerInput.responseBuilder
      .speak(addStopConfirmation)
      .reprompt(constants.REPROMPT_REPEAT)
      .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
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
}

function handleDirectionInput(handlerInput) {
  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];

  if (!currentState) {
    return handlerInput.responseBuilder
      .speak(constants.STOP_MESSAGE)
      .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    const directionValue = handlerInput.requestEnvelope.request.intent.slots.Direction.value.toLowerCase();
    var direction = constants.OUTBOUND;
    if (directionValue === constants.INBOUND_TEXT) {
      direction = constants.INBOUND;
    }

    const recent = sessionAttributes.recent;
    recent.direction = direction;

    const duplicateStop = _.find(
      sessionAttributes.stops, s => s.stopId === recent.stopId && s.direction === recent.direction);
    if (duplicateStop) {
      const duplicateSpeech = `This stop has been added already. ${constants.TRY_AGAIN_PROMPT} ` +
        `What stop number would you like to use?`;
      const duplicateDisplay = 'This stop has been added already.';

      sessionAttributes.recent = null;
      sessionAttributes.currentState = constants.ADD_STOP_INTENT;
      attributes.setAttributes(handlerInput, sessionAttributes);

      return handlerInput.responseBuilder
        .speak(duplicateSpeech)
        .reprompt(constants.REPROMPT_REPEAT)
        .withSimpleCard(constants.SKILL_NAME, duplicateDisplay)
        .withShouldEndSession(false)
        .getResponse();
    }

    recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
    attributes.setAttributes(handlerInput, sessionAttributes);

    const addStopConfirmation = `Adding stop ${digitize(recent.stopId)} into saved routes. ` +
      `${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
    const addStopDisplay = `Stop ${recent.stopId} added.`;

    return handlerInput.responseBuilder
      .speak(addStopConfirmation)
      .reprompt(constants.REPROMPT_REPEAT)
      .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
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
}

function handleYesInput(handlerInput) {
  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];

  if (!currentState) {
    return handlerInput.responseBuilder
      .speak(constants.STOP_MESSAGE)
      .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    const recent = sessionAttributes.recent;
    const name = recent.stopName;
    const addStopConfirmation = `OK. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
    const addStopDisplay = `Using ${name} as stop name.`;

    const index = _.findIndex(
      sessionAttributes.stops, s => (s.stopId === recent.stopId && s.direction === recent.direction));
    if (index === -1) {
      sessionAttributes.stops.push(recent);
    } else {
      sessionAttributes.stops[index] = recent;
    }

    return stopRouteDb.updateEntry(recent)
      .then(() => {
        sessionAttributes.currentState = constants.ADD_ROUTE_INTENT;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return handlerInput.responseBuilder
          .speak(addStopConfirmation)
          .reprompt(constants.REPROMPT_REPEAT)
          .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
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
    return handlerInput.responseBuilder
      .speak(constants.REPROMPT_GET_SUMMARY)
      .reprompt(constants.REPROMPT_GET_SUMMARY)
      .withSimpleCard(constants.SKILL_NAME, constants.REPROMPT_GET_SUMMARY)
      .withShouldEndSession(false)
      .getResponse();
  }
}

function handleNoInput(handlerInput) {
  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];

  if (!currentState) {
    return handlerInput.responseBuilder
      .speak(constants.STOP_MESSAGE)
      .withSimpleCard(constants.SKILL_NAME, constants.STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  } else if (currentState === constants.ADD_STOP_INTENT) {
    const addStopConfirmation = `OK. ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
    const addStopDisplay = `${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;

    return handlerInput.responseBuilder
      .speak(addStopConfirmation)
      .reprompt(constants.REPROMPT_REPEAT)
      .withSimpleCard(constants.SKILL_NAME, addStopDisplay)
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
  const index = levenshtein.getBestMatch(nickname, sessionAttributes.recent, sessionAttributes.stops);
  if (index === null) {
    sessionAttributes.invalidStopName = true;
  } else {
    sessionAttributes.invalidStopName = false;
    if (index >= 0) {
      sessionAttributes.recent = sessionAttributes.stops[index];
    }
  }

  return sessionAttributes;
}

function getNextRecentStop(sessionAttributes) {
  const stopId = sessionAttributes.recent.stopId;
  const direction = sessionAttributes.recent.direction;
  const index = _.findIndex(sessionAttributes.stops, s => (s.stopId === stopId && s.direction === direction));
  sessionAttributes.stops.splice(index, 1);

  if (sessionAttributes.stops.length === 0) {
    sessionAttributes.recent = null;
  } else {
    sessionAttributes.recent = _.max(sessionAttributes.stops, d => moment(d.lastUpdatedDateTime).valueOf());
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
