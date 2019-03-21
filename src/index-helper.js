const attributes = require('./attributes');
const constants = require('./constants');
const levenshtein = require('./levenshtein');
const mbtaInfo = require('./mbta-info');
const moment = require('moment-timezone');
const prediction = require('./prediction');
const stopRouteDb = require('./stop-route-db');
const timeHelper = require('./time-helper');
const utils = require('./utils');
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
      refreshRecent(sessionAttributes);
      const recent = sessionAttributes.recent;
      if (!recent) {
        return getNoStopPrompt(handlerInput, sessionAttributes);
      }
      const nickname = getName(handlerInput);
      sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
        const display = `Stop name ${nickname} is invalid.`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      if (recent.routeIds.length === 0) {
        const display = `No routes related to this stop.`;
        const speech = `We could not find any routes related to this stop. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
        const reprompt = `${constants.REPROMPT_SORRY} ${speech}`;
        sessionAttributes.currentState = {
          state: constants.ADD_ROUTE_ID,
          speech: speech,
          display: display,
          reprompt: reprompt
        };
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, reprompt, false);
      }
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;
      sessionAttributes.currentState = null;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);

          return prediction.getPredictions(
            recent.stopId, recent.direction, recent.routeIds, timeAttributes.currentDate, timeAttributes.currentTime);
        })
        .then((predictions) => {
          const speech = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

          return response(handlerInput, speech, predictions.display, constants.REPROMPT_TRY_AGAIN, false);
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
      refreshRecent(sessionAttributes);
      const recent = sessionAttributes.recent;
      if (!recent) {
        return getNoStopPrompt(handlerInput, sessionAttributes);
      }
      const nickname = getName(handlerInput);
      sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
        const display = `Stop name ${nickname} is invalid.`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;
      sessionAttributes.currentState = null;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);

          return prediction.getPredictions(
            recent.stopId, recent.direction, [routeId], timeAttributes.currentDate, timeAttributes.currentTime);
        })
        .then((predictions) => {
          const speech = `${predictions.speech} ${constants.FOLLOW_UP_PROMPT}`;

          return response(handlerInput, speech, predictions.display, constants.REPROMPT_TRY_AGAIN, false);
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
            const display = `Stop (${stopId}) ${stop.attributes.name} selected.`;
            const speech = `Selecting stop ${utils.digitize(stopId)}, ${utils.address(stop.attributes.name)}. ` +
                `${constants.FOLLOW_UP_DIRECTION_PROMPT}`;
            const reprompt = `${constants.REPROMPT_SORRY} ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;
            sessionAttributes.currentState = {
              state: constants.ADD_STOP_DIRECTION,
              speech: speech,
              display: display,
              reprompt: reprompt
            };
            attributes.setAttributes(handlerInput, sessionAttributes);

            return response(handlerInput, speech, display, reprompt, false);
          } else {
            const display = `Stop ${stopId} invalid.`;
            const speech = `Stop ${utils.digitize(stopId)} is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
            const reprompt = `${constants.REPROMPT_SORRY} ${speech}`;
            sessionAttributes.currentState = {
              state: constants.ADD_STOP_ID,
              speech: speech,
              display: display,
              reprompt: reprompt
            };
            attributes.setAttributes(handlerInput, sessionAttributes);

            return response(handlerInput, speech, display, reprompt, false);
          }
        });
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function listStop(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      refreshRecent(sessionAttributes);
      if (!sessionAttributes.recent) {
        return getNoStopPrompt(handlerInput, sessionAttributes);
      }
      const stopNames = _.map(sessionAttributes.stops, s => s.stopName);

      const display = `Existing stops: \n${stopNames.join('\n')}`;
      const speech = `You have stops ${utils.concatenate(stopNames)}. ${constants.FOLLOW_UP_PROMPT}`;
      sessionAttributes.currentState = null;
      attributes.setAttributes(handlerInput, sessionAttributes);

      return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
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
      refreshRecent(sessionAttributes);
      if (!sessionAttributes.recent) {
        return getNoStopPrompt(handlerInput, sessionAttributes);
      }
      const nickname = getName(handlerInput);
      sessionAttributes = getSpecificLocation(sessionAttributes, nickname);
      if (sessionAttributes.invalidOperation) {
        const speech = `Stop name ${nickname} is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
        const display = `Stop name ${nickname} is invalid.`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      if (isNaN(parseInt(routeId))) {
        const speech = `Route is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
        const display = `Route ${routeId} is invalid.`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
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
          const speech = `Adding route ${utils.digitize(routeId)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;

          return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
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
      if (!sessionAttributes.recent) {
        const display = `No stops related to your device.`;
        const speech = `There are no stops related to your device. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      if (sessionAttributes.currentState && sessionAttributes.currentState.state !== constants.ADD_ROUTE_ID) {
        const display = `Stop deleted.`;
        const speech = `Deleting stop. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
        refreshRecent(sessionAttributes);
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      const stopId = sessionAttributes.recent.stopId;
      const direction = sessionAttributes.recent.direction;
      const stopName = sessionAttributes.recent.stopName;

      return stopRouteDb.remove(deviceId, stopId, direction)
        .then(() => {
          sessionAttributes = deleteAndGetNextRecentStop(sessionAttributes);
          sessionAttributes.currentState = null;
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

          return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
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
      if (!recent) {
        const display = `Route ${routeId} deleted.`;
        const speech = `Deleting route ${utils.digitize(routeId)}. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      if (sessionAttributes.currentState && sessionAttributes.currentState.state !== constants.ADD_ROUTE_ID) {
        const display = `Route ${routeId} deleted.`;
        const speech = `Deleting route ${utils.digitize(routeId)}. ${constants.FOLLOW_UP_PROMPT_SHORT}`;
        refreshRecent(sessionAttributes);
        sessionAttributes.currentState = null;
        attributes.setAttributes(handlerInput, sessionAttributes);

        return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
      }
      recent.routeIds = _.without(recent.routeIds, routeId);
      recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
      sessionAttributes.stops[sessionAttributes.index] = recent;
      sessionAttributes.currentState = null;

      return stopRouteDb.updateEntry(recent)
        .then(() => {
          attributes.setAttributes(handlerInput, sessionAttributes);
          const display = `Route ${routeId} deleted.`;
          const speech = `Deleting route ${utils.digitize(routeId)} from stop ${recent.stopName}. ` +
            `${constants.FOLLOW_UP_PROMPT_SHORT}`;

          return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
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
        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      } else if (currentState) {
        if (currentState.state === constants.ADD_STOP_ID) {
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
                const display = `Stop (${number}) ${stop.attributes.name} selected.`;
                const speech = `Selecting stop ${utils.digitize(number)}, ${utils.address(stop.attributes.name)}, ` +
                  `${constants.FOLLOW_UP_DIRECTION_PROMPT}`;
                const reprompt = `${constants.REPROMPT_SORRY} ${constants.FOLLOW_UP_DIRECTION_PROMPT}`;
                sessionAttributes.currentState = {
                  state: constants.ADD_STOP_DIRECTION,
                  speech: speech,
                  display: display,
                  reprompt: reprompt
                };
                attributes.setAttributes(handlerInput, sessionAttributes);

                return response(handlerInput, speech, display, reprompt, false);
              }
              const speech = `Stop ${utils.digitize(number)} is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
              const display = `Stop ${number} invalid.`;
              const reprompt = `${constants.REPROMPT_SORRY} ${constants.speech}`;
              sessionAttributes.currentState = {
                state: constants.ADD_STOP_ID,
                speech: speech,
                display: display,
                reprompt: reprompt
              };
              attributes.setAttributes(handlerInput, sessionAttributes);

              return response(handlerInput, speech, display, reprompt, false);
            });
        } else if (currentState.state === constants.ADD_ROUTE_ID) {
          if (isNaN(parseInt(number))) {
            const speech = `Route is invalid. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
            const display = `Route ${number} is invalid.`;
            const reprompt = `${constants.REPROMPT_SORRY} ${constants.speech}`;
            sessionAttributes.currentState = {
              state: constants.ADD_ROUTE_ID,
              speech: speech,
              display: display,
              reprompt: reprompt
            };
            attributes.setAttributes(handlerInput, sessionAttributes);

            return response(handlerInput, speech, display, reprompt, false);
          }
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
              const speech = `Adding route ${utils.digitize(number)} into saved routes. ${constants.FOLLOW_UP_PROMPT}`;
              const display = `Route ${number} added.`;
              attributes.setAttributes(handlerInput, sessionAttributes);

              return response(handlerInput, speech, display, constants.REPROMPT_TRY_AGAIN, false);
            });
        }

        return response(handlerInput, currentState.reprompt, currentState.display, currentState.reprompt, false);
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleNameInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const name = getName(handlerInput);

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      const currentState = sessionAttributes.currentState;
      if (!currentState) {
        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      } else if (currentState) {
        if (currentState.state === constants.ADD_STOP_NAME) {
          const duplicateName = _.find(sessionAttributes.stops, s => s.stopName === name);
          if (duplicateName) {
            const speech = `The name ${name} has already been used. ${constants.REPROMPT_TRY_AGAIN_SHORT}`;
            const display = `The name ${name} has already been used.`;
            const reprompt = `${constants.REPROMPT_SORRY} ${speech}`;
            sessionAttributes.currentState = {
              state: constants.ADD_STOP_NAME,
              speech: speech,
              display: display,
              reprompt: reprompt
            };
            attributes.setAttributes(handlerInput, sessionAttributes);

            return response(handlerInput, speech, display, reprompt, false);
          }
          const recent = sessionAttributes.recent;
          recent.stopName = name;
          const speech = `Using ${name} as stop name. ${constants.FOLLOW_UP_YES_NO_PROMPT}`;
          const display = `Using ${name} as stop name.`;
          const reprompt = `${constants.REPROMPT_SORRY} ${speech}`;
          sessionAttributes.currentState = {
            state: constants.CONFIRM_STOP_NAME,
            speech: speech,
            display: display,
            reprompt: reprompt
          };
          attributes.setAttributes(handlerInput, sessionAttributes);

          return response(handlerInput, speech, display, reprompt, false);
        }

        return response(handlerInput, currentState.reprompt, currentState.display, currentState.reprompt, false);
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
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
        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      } else if (currentState) {
        if (currentState.state === constants.ADD_STOP_DIRECTION) {
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
            sessionAttributes.recent = null;
            const speech = `This stop has been added already. ${constants.REPROMPT_TRY_AGAIN_SHORT} ` +
              `What stop number would you like to use?`;
            const display = 'This stop has been added already.';
            const reprompt = `${constants.REPROMPT_SORRY} What stop number would you like to use?`;
            sessionAttributes.currentState = {
              state: constants.ADD_STOP_ID,
              speech: speech,
              display: display,
              reprompt: reprompt
            };
            attributes.setAttributes(handlerInput, sessionAttributes);

            return response(handlerInput, speech, display, reprompt, false);
          }
          recent.lastUpdatedDateTime = timeHelper.getTimeAttributes().currentDateTimeUtc;
          const speech = `OK. ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
          const display = `Setting stop ${recent.stopId} as ${directionValue}.`;
          const reprompt = `${constants.REPROMPT_SORRY} ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
          sessionAttributes.currentState = {
            state: constants.ADD_STOP_NAME,
            speech: speech,
            display: display,
            reprompt: reprompt
          };
          attributes.setAttributes(handlerInput, sessionAttributes);

          return response(handlerInput, speech, display, reprompt, false);
        }

        return response(handlerInput, currentState.reprompt, currentState.display, currentState.reprompt, false);
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
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
        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      } else if (currentState) {
        if (currentState.state === constants.CONFIRM_STOP_NAME) {
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
              const speech = `OK. ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
              const display = `Using ${name} as stop name.`;
              const reprompt = `${constants.REPROMPT_SORRY} ${constants.FOLLOW_UP_ROUTE_PROMPT}`;
              sessionAttributes.currentState = {
                state: constants.ADD_ROUTE_ID,
                speech: speech,
                display: display,
                reprompt: reprompt
              };
              attributes.setAttributes(handlerInput, sessionAttributes);

              return response(handlerInput, speech, display, reprompt, false);
            });
        }

        return response(handlerInput, currentState.reprompt, currentState.display, currentState.reprompt, false);
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
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
        return response(handlerInput, constants.STOP_MESSAGE, constants.STOP_MESSAGE, constants.STOP_MESSAGE, true);
      } else if (currentState) {
        if (currentState.state === constants.CONFIRM_STOP_NAME) {
          const speech = `OK. ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
          const display = `${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
          const reprompt = `${constants.REPROMPT_SORRY} ${constants.FOLLOW_UP_STOP_NAME_PROMPT}`;
          sessionAttributes.currentState = {
            state: constants.ADD_STOP_NAME,
            speech: speech,
            display: display,
            reprompt: reprompt
          };
          attributes.setAttributes(handlerInput, sessionAttributes);

          return response(handlerInput, speech, display, reprompt, false);
        }

        return response(handlerInput, currentState.reprompt, currentState.display, currentState.reprompt, false);
      } else {
        const errorMessage = `Unable to recognize what current state (${currentState}) is.`;
        console.log(errorMessage);

        return response(handlerInput, constants.REPROMPT_TRY_AGAIN, constants.REPROMPT_TRY_AGAIN,
          constants.REPROMPT_TRY_AGAIN, false);
      }
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function handleHelpInput(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

  return getSessionAttributes(handlerInput, deviceId)
    .then(sessionAttributes => {
      refreshRecent(sessionAttributes);
      sessionAttributes.currentState = null;
      attributes.setAttributes(handlerInput, sessionAttributes);

      return response(handlerInput, constants.HELP_PROMPT, constants.HELP_PROMPT, constants.REPROMPT_TRY_AGAIN, false);
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

// Prompt when no stops are setup
function getNoStopPrompt(handlerInput, sessionAttributes) {
  const display = `No stops related to this device.`;
  const speech = `We could not find any data related to your device. ${constants.FOLLOW_UP_STOP_PROMPT}`;
  const reprompt = `${constants.REPROMPT_SORRY} ${speech}`;
  sessionAttributes.currentState = {
    state: constants.ADD_STOP_ID,
    speech: speech,
    display: display,
    reprompt: reprompt
  };
  attributes.setAttributes(handlerInput, sessionAttributes);

  return response(handlerInput, speech, display, reprompt, false);
}

// Gets the stop name out of intent slots
function getName(handlerInput) {
  var nickname = null;
  if (handlerInput.requestEnvelope.request.intent &&
    handlerInput.requestEnvelope.request.intent.slots.City &&
    handlerInput.requestEnvelope.request.intent.slots.City.value) {
    nickname = handlerInput.requestEnvelope.request.intent.slots.City.value.toLowerCase();
  }
  if (handlerInput.requestEnvelope.request.intent &&
    handlerInput.requestEnvelope.request.intent.slots.Street &&
    handlerInput.requestEnvelope.request.intent.slots.Street.value) {
    nickname = handlerInput.requestEnvelope.request.intent.slots.Street.value.toLowerCase();
  }

  return nickname;
}

// Returns session attributes with the best location
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

// Gets the next recent stop and deletes current stop.
function deleteAndGetNextRecentStop(sessionAttributes) {
  sessionAttributes.stops.splice(sessionAttributes.index, 1);
  getNextRecentStop(sessionAttributes);

  return sessionAttributes;
}

// Clears recent entry and gets the saved recent stop.
function refreshRecent(sessionAttributes) {
  const recent = sessionAttributes.recent;
  if (recent && (!recent.stopName || !recent.stopId || recent.direction !== null) &&
    (sessionAttributes.currentState && sessionAttributes.currentState.state !== constants.ADD_ROUTE_ID)) {
    getNextRecentStop(sessionAttributes);
  }

  return sessionAttributes;
}

// Gets the next recent stop.
function getNextRecentStop(sessionAttributes) {
  if (sessionAttributes.stops.length === 0) {
    sessionAttributes.recent = null;
    sessionAttributes.index = -1;
  } else {
    const recent = _.max(sessionAttributes.stops, s => moment(s.lastUpdatedDateTime).valueOf());
    const index = _.findIndex(sessionAttributes.stops, s =>
      recent.stopId === s.stopId && recent.direction === s.direction);
    sessionAttributes.recent = recent;
    sessionAttributes.index = index;
  }
}

function response(handlerInput, speech, display, reprompt, shouldEndSession) {
  return handlerInput.responseBuilder
    .speak(speech)
    .reprompt(reprompt)
    .withSimpleCard(constants.SKILL_NAME, display)
    .withShouldEndSession(shouldEndSession)
    .getResponse();
}

module.exports = {
  callDirectiveService: callDirectiveService,
  getSummary: getSummary,
  getRoute: getRoute,
  addStop: addStop,
  listStop: listStop,
  addRoute: addRoute,
  deleteStop: deleteStop,
  deleteRoute: deleteRoute,
  handleNumberInput: handleNumberInput,
  handleNameInput: handleNameInput,
  handleDirectionInput: handleDirectionInput,
  handleYesInput: handleYesInput,
  handleNoInput: handleNoInput,
  handleHelpInput: handleHelpInput
};
