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
  const sessionAttributes = attributes.getAttributes(handlerInput);

  return callDirectiveService(handlerInput, initialSpeechOutput)
    .then(() => {      
      if (_.isEmpty(sessionAttributes)) {
        return dbInfo.query(deviceId);
      }
      return Promise.resolve(sessionAttributes);
    })
    .then(data => {
      if (!data) {
        sessionAttributes.currentState = 'SetStopIntent';
        attributes.setAttributes(handlerInput, sessionAttributes);
        const speechOutput = `We could not find any data related to your device. `
          + `Let's start by setting up your information for you now. `
          + `What stop number would you like to use by default?`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(repromptSpeech)
          .withSimpleCard(SKILL_NAME, `${initialSpeechOutput} ${speechOutput}`)
          .withShouldEndSession(false)
          .getResponse();
      } else if (data.stopId && data.routeIds && data.routeIds.length != 0) {     
        attributes.setAttributes(handlerInput, data);   
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
        return dbInfo.query(deviceId)
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
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const stopId = handlerInput.requestEnvelope.request.intent.slots.Stop.value;
  const actionConfirmation = `Adding stop ${stopId}.`;
  const followupPrompt = `What else?`;
  const repromptSpeech = 'I did not quite get that.  Do you want to add a specific stop?';
  const speechOutput = `${actionConfirmation} ${followupPrompt}`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  return new Promise(() => {
    if (_.isEmpty(sessionAttributes)) {
      return dbInfo.query(deviceId)
        .then(data => {
          attributes.setAttributes(handlerInput, data);
          return data;
        });
    }
    return Promise.resolve(sessionAttributes);
  })
    .then(sessionAttributes => {
      sessionAttributes.stopId = stopId;
      sessionAttributes.routeIds = [];
      return dbInfo.update(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
        .then(() => sessionAttributes);
    })
    .then(sessionAttributes => {
      attributes.setAttributes(handlerInput, sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(repromptSpeech)
        .withSimpleCard(SKILL_NAME, `${speechOutput}`)
        .withShouldEndSession(false)
        .getResponse();
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

function addRoute(handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const actionConfirmation = `Adding ${routeId} into saved routes.`;
  const followupPrompt = `What else?`;
  const repromptSpeech = 'I did not quite get that.  Do you want to add a specific route?';
  const speechOutput = `${actionConfirmation} ${followupPrompt}`;

  const sessionAttributes = attributes.getAttributes(handlerInput);
  return new Promise(() => {
    if (_.isEmpty(sessionAttributes)) {
      return dbInfo.query(deviceId)
        .then(data => {
          attributes.setAttributes(handlerInput, data);
          return data;
        });
    }
    return Promise.resolve(sessionAttributes);
  })
    .then(sessionAttributes => {
      sessionAttributes.routeIds.push(routeId);
      return dbInfo.update(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
        .then(() => sessionAttributes);
    })
    .then(sessionAttributes => {
      attributes.setAttributes(handlerInput, sessionAttributes);

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(repromptSpeech)
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
  const stopConfirmation = `Adding ${number} into saved stops. What route would you like to add to this stop?`;
  const routeConfirmation = `Adding ${number} into saved routes. Would you like to do anything else?`;
  const repromptSpeech = 'I did not quite get that.  Can you repeat that again?';
  let speechOutput = '';

  const sessionAttributes = attributes.getAttributes(handlerInput);
  const currentState = sessionAttributes['currentState'];
  if (!currentState) {
    speechOutput = 'I did not understand that. Would you like to get a summary of the routes at your stop?';
    // TODO: Figure out how to route this to the get summary intent if yes, otherwise exit on no.
    return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(repromptSpeech)
        .withSimpleCard(SKILL_NAME, speechOutput)
        .withShouldEndSession(false)
        .getResponse();
  } else if (currentState === 'SetStopIntent') {
    sessionAttributes.stopId = number;
    sessionAttributes.currentState = 'AddRouteIntent';
    attributes.setAttributes(handlerInput, sessionAttributes);

    return handlerInput.responseBuilder
      .speak(stopConfirmation)
      .reprompt(repromptSpeech)
      .withSimpleCard(SKILL_NAME, stopConfirmation)
      .withShouldEndSession(false)
      .getResponse();
  } else if (currentState === 'AddRouteIntent') {
    if (!sessionAttributes.routeIds) {
      sessionAttributes.routeIds = [number];
    } else {
      sessionAttributes.routeIds.push(number);
    }
    sessionAttributes.currentState = null;
    attributes.setAttributes(handlerInput, sessionAttributes);

    return dbInfo.create(deviceId, sessionAttributes.stopId, sessionAttributes.routeIds)
      .then(() => {
        return handlerInput.responseBuilder
          .speak(routeConfirmation)
          .reprompt(repromptSpeech)
          .withSimpleCard(SKILL_NAME, routeConfirmation)
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

module.exports = {
  callDirectiveService: callDirectiveService,
  getSummary: getSummary,
  getRoute: getRoute,
  addStop: addStop,
  addRoute: addRoute,
  handleNumberInput: handleNumberInput,
};