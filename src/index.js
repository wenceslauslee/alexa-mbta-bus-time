const Alexa = require('ask-sdk-core');
const httpRequest = require('request-promise');
const moment = require('moment-timezone');
const prediction = require('./prediction');
const _ = require('underscore');

const APP_ID = 'amzn1.ask.skill.dd081fb8-e2fc-498e-bd62-02a4bd761590';
const SKILL_NAME = 'MBTA Bus Time';
const HELP_MESSAGE = 'You can say where is route 11, or, you can say give me a summary.';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye and safe trip!';
const STOP_ID = 86963; //TODO: Hard coded for now.
const TIME_ZONE = 'America/New_York';

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const routeIds = [553];

    const currentDateTime = moment().utc().tz(TIME_ZONE);
    const currentDate = currentDateTime.format('YYYY-MM-DD');
    const currentTimeSpeech = currentDateTime.format('h:mm A');
    const currentTime = currentDateTime.format('HH:mm');
    const followUpPrompt = 'What else would you like to know?';

    handlerInput.attributesManager.setSessionAttributes({
      currentDate: currentDate,
      currentTime: currentTime
    });

    const initialSpeechOutput = `The current time is ${currentTimeSpeech}. `;
    await callDirectiveServiceOnStart(handlerInput, initialSpeechOutput);

    return prediction.getPredictions(routeIds, STOP_ID, currentDate, currentTime)
      .then((predictions) => {
        const speechOutput = `${predictions} ${followUpPrompt}`;
        const repromptSpeech = 'I did not quite get that.  Would you like to get a summary?';

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(repromptSpeech)
          .withSimpleCard(SKILL_NAME, speechOutput)
          .withShouldEndSession(false)
          .getResponse();
      });
  }
};

function callDirectiveServiceOnStart(handlerInput, initialSpeechOutput) {
  const requestEnvelope = handlerInput.requestEnvelope;
  const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
  const requestId = requestEnvelope.request.requestId;

  const directive = {
    header: {
      requestId,
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: initialSpeechOutput,
    },
  };

  return directiveServiceClient.enqueue(directive);
}

const AskQuestionIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AskQuestionIntent';
  },
  handle(handlerInput) {
    const repromptSpeech = 'I did not quite get that.  Do you want to ask for a specific route?';
    const followUpPrompt = 'What else would you like to know?'
    const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;

    let attributes = handlerInput.attributesManager.getSessionAttributes();

    return prediction.getPredictions([routeId], STOP_ID, attributes.currentDate, attributes.currentTime)
      .then((predictions) => {
        const speechOutput = `${predictions} ${followUpPrompt}`;

        return handlerInput.responseBuilder
          .speak(speechOutput)
          .reprompt(repromptSpeech)
          .withShouldEndSession(false)
          .getResponse();
      });
  },
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
    AskQuestionIntentHandler,
    HelpIntentHandler,
    CancelIntentHandler,
    StopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
