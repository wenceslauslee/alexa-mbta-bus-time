const Alexa = require('ask-sdk-core');
const constants = require('./constants');
const indexHelper = require('./index-helper');
const timeHelper = require('./time-helper');

const HELP_MESSAGE = 'You can say where is route 11, or, you can say give me a summary.';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    return indexHelper.getSummary(handlerInput)
  }
};

const GetRouteIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.GET_ROUTE_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.getRoute(handlerInput);
  },
};

const GetRouteIntentStreetHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.GET_ROUTE_INTENT_STREET;
  },
  handle(handlerInput) {
    return indexHelper.getRoute(handlerInput);
  },
};

const GetSummaryIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.GET_SUMMARY_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.getSummary(handlerInput);
  },
};

const GetSummaryIntentStreetHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.GET_SUMMARY_INTENT_STREET;
  },
  handle(handlerInput) {
    return indexHelper.getSummary(handlerInput);
  },
};

const AddStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.ADD_STOP_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.addStop(handlerInput);
  },
};

const AddStopIntentStreetHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.ADD_STOP_INTENT_STREET;
  },
  handle(handlerInput) {
    return indexHelper.addStop(handlerInput);
  },
};

const AddRouteIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.ADD_ROUTE_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.addRoute(handlerInput);
  },
};

const AddRouteIntentStreetHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.ADD_ROUTE_INTENT_STREET;
  },
  handle(handlerInput) {
    return indexHelper.addRoute(handlerInput);
  },
};

const DeleteStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.DELETE_STOP_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.deleteStop(handlerInput);
  },
};

const DeleteRouteIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === constants.DELETE_ROUTE_INTENT;
  },
  handle(handlerInput) {
    return indexHelper.deleteRoute(handlerInput);
  },
};

const NumberIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'NumberIntent';
  },
  handle(handlerInput) {
    return indexHelper.handleNumberInput(handlerInput);
  },
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .withShouldEndSession(false)
      .getResponse();
  }
};

const CancelIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const StopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Sorry, I do not understand. Please try again.')
      .withShouldEndSession(false)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error encountered: ${error}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I ran into some error. Please try again later.')
      .withShouldEndSession(true)
      .getResponse();
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    GetRouteIntentHandler,
    GetRouteIntentStreetHandler,
    GetSummaryIntentHandler,
    GetSummaryIntentStreetHandler,
    AddStopIntentHandler,
    AddStopIntentStreetHandler,
    AddRouteIntentHandler,
    AddRouteIntentStreetHandler,
    DeleteStopIntentHandler,
    DeleteRouteIntentHandler,
    NumberIntentHandler,
    HelpIntentHandler,
    CancelIntentHandler,
    StopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
