// Constants for time units
const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

// Language translations for time ago strings
const timeAgoTranslations = {
  en: {
    justNow: 'just now',
    seconds: 'secs ago',
    minutes: 'mins ago',
    hours: 'hours ago',
    days: 'days ago',
    weeks: 'weeks ago',
  },
  es: {
    justNow: 'justo ahora',
    seconds: 'segs atrás',
    minutes: 'mins atrás',
    hours: 'horas atrás',
    days: 'días atrás',
    weeks: 'semanas atrás',
  }
};

// Language translations for time left strings
const timeLeftTranslations = {
  en: {
    justNow: 'now',
    seconds: 'secs',
    minutes: 'mins',
    hours: 'hours',
    days: 'days',
    weeks: 'weeks',
  },
  es: {
    justNow: 'ahora',
    seconds: 'segs',
    minutes: 'mins',
    hours: 'horas',
    days: 'días',
    weeks: 'semanas',
  }
};

// Convert a string to a date in case necessary
function convertStringToDate(str) {
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  return date;
}

/**
 * Formats a past date into the "time ago" style
 * @param {Date} date The past date
 * @param {string} language Language code ('en' or 'es')
 * @returns {string} The formatted time ago string
 */
const formatTimeAgo = (date, language = 'en') => {
  try {
    if (!(date instanceof Date)) {
      date = convertStringToDate(date);
    }

    const translations = timeAgoTranslations[language];
    const timeDifference = (Date.now() - date.getTime());

    if (timeDifference < 5 * SECOND) {
      return translations.justNow;
    } else if (timeDifference < MINUTE) {
      return Math.floor(timeDifference / SECOND) + ' ' + translations.seconds;
    } else if (timeDifference < HOUR) {
      return Math.floor(timeDifference / MINUTE) + ' ' + translations.minutes;
    } else if (timeDifference < DAY) {
      return Math.floor(timeDifference / HOUR) + ' ' + translations.hours;
    } else if (timeDifference < WEEK) {
      return Math.floor(timeDifference / DAY) + ' ' + translations.days;
    } else {
      return Math.floor(timeDifference / WEEK) + ' ' + translations.weeks;
    }
  } catch (error) {
    // console.error(error);
    return '';
  }
};

/**
 * Formats a future date into the "time left" style
 * Shows days for anything >= 1 day, hours/minutes for less than a day
 * @param {Date} date The future date
 * @param {string} language Language code ('en' or 'es')
 * @returns {string} The formatted time left string
 */
const formatTimeLeft = (date, language = 'en') => {
  try {
    if (!(date instanceof Date)) {
      date = convertStringToDate(date);
    }

    const translations = timeLeftTranslations[language];
    const timeDifference = (date.getTime() - Date.now());

    if (timeDifference < 5 * SECOND) {
      return translations.justNow;
    } else if (timeDifference < MINUTE) {
      return Math.floor(timeDifference / SECOND) + ' ' + translations.seconds;
    } else if (timeDifference < HOUR) {
      return Math.floor(timeDifference / MINUTE) + ' ' + translations.minutes;
    } else if (timeDifference < DAY) {
      return Math.floor(timeDifference / HOUR) + ' ' + translations.hours;
    } else {
      // Always show days for anything >= 1 day (no weeks)
      return Math.floor(timeDifference / DAY) + ' ' + translations.days;
    }
  } catch (error) {
    // console.error(error);
    return '';
  }
};

exports.formatTimeAgo = formatTimeAgo;
exports.formatTimeLeft = formatTimeLeft;
