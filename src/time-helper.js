const moment = require('moment-timezone');

const TIME_ZONE = 'America/New_York';

function getTimeAttributes() {
  const currentDateTime = moment().utc().tz(TIME_ZONE);
  const currentDate = currentDateTime.format('YYYY-MM-DD');
  const currentTimeSpeech = currentDateTime.format('h:mm A');
  const currentTime = currentDateTime.format('HH:mm');

  return {
    currentDateTime: currentDateTime,
    currentDate: currentDate,
    currentTimeSpeech: currentTimeSpeech,
    currentTime: currentTime
  };
}

module.exports = {
  getTimeAttributes: getTimeAttributes
};