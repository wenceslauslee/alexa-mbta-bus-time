const Alexa = require('ask-sdk-core');
const httpRequest = require('request-promise');
const moment = require('moment-timezone');
const prediction = require('./prediction');
const _ = require('underscore');

const APP_ID = 'amzn1.ask.skill.dd081fb8-e2fc-498e-bd62-02a4bd761590';
const SKILL_NAME = 'MBTA Bus Time';
const HELP_MESSAGE = 'You can say where is bus number 11, or, you can say give me a summary.';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye and safe trip!';
const TIME_ZONE = 'America/New_York';

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const stopId = 86963;
    const routeIds = [553, 554, 556];

    const currentTime = moment().utc().tz(TIME_ZONE).format('hh:mm A');
    const followUpPrompt = 'What else would you like to know?';

    return prediction.getPredictions(routeIds, stopId)
      .then((predictions) => {
        const speechOutput = `Good morning my bad rabbit! The current time is now ${currentTime}. `
          + `${predictions} ${followUpPrompt}`;
        const repromptSpeech = 'I did not quite get that.  Would you like to get a summary?';

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(repromptSpeech)
          .withSimpleCard(SKILL_NAME, speechOutput)
          .withShouldEndSession(true)
          .getResponse();
      });
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
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
      .speak('Oops I do not understand. Please try again.')
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
      .getResponse();
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    HelpIntentHandler,
    CancelIntentHandler,
    StopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
