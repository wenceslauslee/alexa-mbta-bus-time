const prediction = require('./prediction');
const timeHelper = require('./time-helper');

const SKILL_NAME = 'MBTA Bus Time';

function callDirectiveService(handlerInput, speechOutput) {
  const requestEnvelope = handlerInput.requestEnvelope;
  const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
  const requestId = requestEnvelope.request.requestId;

  const directive = {
    header: {
      requestId,
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: speechOutput,
    },
  };

  return directiveServiceClient.enqueue(directive);
}

async function getSummary(handlerInput, routeIds, stopId) {
  const followUpPrompt = 'What else would you like to know?';
  const repromptSpeech = 'I did not quite get that.  Would you like to get a summary?';
  const timeAttributes = timeHelper.getTimeAttributes();
  const initialSpeechOutput = `The current time is ${timeAttributes.currentTimeSpeech}. `;

  await callDirectiveService(handlerInput, initialSpeechOutput);

  return prediction.getPredictions(
      routeIds, stopId, timeAttributes.currentDate, timeAttributes.currentTime)
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

function getRoute(handlerInput, stopId) {
  const followUpPrompt = 'What else would you like to know?';
  const repromptSpeech = 'I did not quite get that.  Do you want to ask for a specific route?';
  const routeId = handlerInput.requestEnvelope.request.intent.slots.Route.value;
  const timeAttributes = timeHelper.getTimeAttributes();
  const currentTimeSpeech = `The current time is ${timeAttributes.currentTimeSpeech}. `;

  return prediction.getPredictions(
      [routeId], stopId, timeAttributes.currentDate, timeAttributes.currentTime)
    .then((predictions) => {
      const speechOutput = `${predictions} ${followUpPrompt}`;

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(repromptSpeech)
        .withSimpleCard(SKILL_NAME, `${currentTimeSpeech} ${speechOutput}`)
        .withShouldEndSession(false)
        .getResponse();
    });
}

module.exports = {
  callDirectiveService: callDirectiveService,
  getSummary: getSummary,
  getRoute: getRoute
};