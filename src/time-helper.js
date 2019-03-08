const moment = require('moment-timezone');

const TIME_ZONE = 'America/New_York';

function getTimeAttributes() {
  const currentDateTimeRaw = moment().utc().tz(TIME_ZONE);
  const currentDateTimeUtc = moment().utc().format();
  const currentDate = currentDateTimeRaw.format('YYYY-MM-DD');
  const currentTimeSpeech = currentDateTimeRaw.format('h:mm A');
  const currentTime = currentDateTimeRaw.format('HH:mm');

  return {
    currentDateTimeUtc: currentDateTimeUtc,
    currentDate: currentDate,
    currentTimeSpeech: currentTimeSpeech,
    currentTime: currentTime
  };
}

module.exports = {
  getTimeAttributes: getTimeAttributes
};
