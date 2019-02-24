module.exports = {
  // Skill related constants
  SKILL_NAME: 'MBTA Bus Time',

  // Prompts
  FOLLOW_UP_PROMPT: 'Would you like to do anything else?',
  FOLLOW_UP_PROMPT_SHORT: 'What else?',
  FOLLOW_UP_DIRECTION_PROMPT: 'Is this an inbound or outbound route?',
  FOLLOW_UP_STOP_NAME_PROMPT: 'What would you like to call this stop? You can use a city or street name.',
  FOLLOW_UP_STOP_PROMPT: 'What stop number would you like to use by default?',
  FOLLOW_UP_ROUTE_PROMPT: 'What route would you like to add to this stop?',
  FOLLOW_UP_YES_NO_PROMPT: 'Is that correct?',
  REPROMPT_ADD_ROUTE: 'I did not quite get that. Would you like to add a specific route?',
  REPROMPT_ADD_STOP: 'I did not quite get that. Would you like to add a specific stop?',
  REPROMPT_GET_ROUTE: 'I did not quite get that. Would you like to ask for a specific route?',
  REPROMPT_GET_SUMMARY: 'I did not quite get that. Would you like to get a summary?',
  REPROMPT_REPEAT: 'I did not quite get that. Can you repeat that again?',
  REPROMPT_TRY_AGAIN: 'I did not quite get that. Please try again.',
  TRY_AGAIN_PROMPT: 'Please try again.',

  STOP_MESSAGE: 'Goodbye.',

  // Intents
  GET_ROUTE_INTENT: 'GetRouteIntent',
  GET_ROUTE_INTENT_STREET: 'GetRouteIntentStreet',
  GET_SUMMARY_INTENT: 'GetSummaryIntent',
  GET_SUMMARY_INTENT_STREET: 'GetSummaryIntentStreet',
  ADD_ROUTE_INTENT: 'AddRouteIntent',
  ADD_ROUTE_INTENT_STREET: 'AddRouteIntentStreet',
  ADD_STOP_INTENT: 'AddStopIntent',
  ADD_STOP_INTENT_STREET: 'AddStopIntentStreet',
  DELETE_ROUTE_INTENT: 'DeleteRouteIntent',
  DELETE_STOP_INTENT: 'DeleteStopIntent',

  // Direction
  INBOUND: 1,
  INBOUND_TEXT: 'inbound',
  OUTBOUND: 0,
  OUTBOUND_TEXT: 'outbound'
};
