'use strict';

const ZODIAC_SIGNS = [
  { name: 'Capricórnio', start: [12, 22], end: [1, 19] },
  { name: 'Aquário',     start: [1,  20], end: [2, 18] },
  { name: 'Peixes',      start: [2,  19], end: [3, 20] },
  { name: 'Áries',       start: [3,  21], end: [4, 19] },
  { name: 'Touro',       start: [4,  20], end: [5, 20] },
  { name: 'Gêmeos',      start: [5,  21], end: [6, 20] },
  { name: 'Câncer',      start: [6,  21], end: [7, 22] },
  { name: 'Leão',        start: [7,  23], end: [8, 22] },
  { name: 'Virgem',      start: [8,  23], end: [9, 22] },
  { name: 'Libra',       start: [9,  23], end: [10, 22] },
  { name: 'Escorpião',   start: [10, 23], end: [11, 21] },
  { name: 'Sagitário',   start: [11, 22], end: [12, 21] },
];

const getZodiacSign = (month, day) => {
  for (const sign of ZODIAC_SIGNS) {
    const [sm, sd] = sign.start;
    const [em, ed] = sign.end;
    if (sm === 12 && em === 1) {
      if ((month === 12 && day >= sd) || (month === 1 && day <= ed)) return sign.name;
    } else if ((month === sm && day >= sd) || (month === em && day <= ed)) {
      return sign.name;
    }
  }
  return 'Desconhecido';
};

const calculateAge = (name, birthdate) => {
  const birth = new Date(birthdate);
  const now   = new Date();

  if (isNaN(birth.getTime())) throw new Error('Invalid birthdate');
  if (birth > now) throw new Error('Birthdate cannot be in the future');

  let years  = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days   = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays   = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  const totalMonths = years * 12 + months;
  const nextBirthday = new Date(birth);
  nextBirthday.setFullYear(now.getFullYear());
  if (nextBirthday <= now) nextBirthday.setFullYear(now.getFullYear() + 1);
  const daysUntilBirthday = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));

  return {
    name,
    birthdate:          birthdate,
    age_years:          years,
    age_months:         months,
    age_days:           days,
    total_days:         totalDays,
    total_months:       totalMonths,
    days_until_birthday: daysUntilBirthday,
    zodiac_sign:        getZodiacSign(birth.getMonth() + 1, birth.getDate()),
    is_birthday_today:  now.getDate() === birth.getDate() && now.getMonth() === birth.getMonth(),
    timestamp:          now.toISOString(),
  };
};

module.exports = { calculateAge };
