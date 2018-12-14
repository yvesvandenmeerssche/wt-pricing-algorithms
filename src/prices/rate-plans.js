import dayjs from 'dayjs';

export const selectApplicableModifiers = (modifiers, dateDayjs, lengthOfStay, numberOfGuests) => {
  if (!modifiers || !modifiers.length) {
    return [];
  }
  // Drop modifiers not fitting the overall guest data
  let maxMinLOS;
  let maxMinOccupants;
  // Some modifiers might be affecting the same thing, but we can't
  // modify the original array while iterating over it, so they
  // get deleted later.
  const elementsToDrop = [];
  const applicableModifiers = modifiers.filter((mod) => {
    // no conditions - no modifier
    if (!mod.conditions) {
      return false;
    }
    // date limits
    if (mod.conditions.from && dayjs(mod.conditions.from).diff(dateDayjs, 'days') > 0) {
      return false;
    }
    if (mod.conditions.to && dayjs(mod.conditions.to).diff(dateDayjs, 'days') < 0) {
      return false;
    }
    // LOS condition
    if (mod.conditions.minLengthOfStay) {
      if (mod.conditions.minLengthOfStay > lengthOfStay) {
        return false;
      }
      if (maxMinLOS &&
        mod.conditions.minLengthOfStay < maxMinLOS.conditions.minLengthOfStay
      ) {
        return false;
      }
      if (maxMinLOS) {
        elementsToDrop.push(maxMinLOS);
      }
      maxMinLOS = mod;
      return true;
    }
    // Occupants condition
    if (mod.conditions.minOccupants) {
      if (mod.conditions.minOccupants > numberOfGuests) {
        return false;
      }
      if (maxMinOccupants &&
        mod.conditions.minOccupants < maxMinOccupants.conditions.minOccupants
      ) {
        return false;
      }
      if (maxMinOccupants) {
        elementsToDrop.push(maxMinOccupants);
      }
      maxMinOccupants = mod;
      return true;
    }
    return true;
  });
  return applicableModifiers.filter(mod => elementsToDrop.indexOf(mod) === -1);
};

export const selectBestGuestModifier = (modifiers, age) => {
  const ageModifiers = modifiers.filter(mod => mod.conditions.maxAge !== undefined);
  const selectedAgeModifier = ageModifiers.reduce((best, current) => {
    if (current.conditions.maxAge >= age && ( // guest is under the bar
      !best || // no best has yet been setup
      // current has a closer limit than the best
      best.conditions.maxAge > current.conditions.maxAge ||
      ( // the limit is the same, but current has better price adjustment
        best.conditions.maxAge === current.conditions.maxAge &&
        best.adjustment > current.adjustment
      )
    )) {
      return current;
    }
    return best;
  }, undefined);
  if (selectedAgeModifier) {
    return selectedAgeModifier;
  }
  // Fallback to a best offer, no age-specific modifier matched
  const genericModifiers = modifiers
    .filter(mod => mod.conditions.maxAge === undefined)
    .sort((a, b) => (a.adjustment <= b.adjustment ? -1 : 1));
  return genericModifiers[0];
};

export const selectApplicableRatePlans = (roomType, ratePlans, arrivalDateDayjs, departureDateDayjs, fallbackCurrency, preferredCurrency = null) => {
  const now = dayjs();
  const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
  return ratePlans.filter((rp) => {
    // Rate plan is not tied to this room type
    if (rp.roomTypeIds.indexOf(roomType.id) === -1) {
      return false;
    }

    // Rate plan has a different currency than requested.
    if (preferredCurrency && (rp.currency || fallbackCurrency) !== preferredCurrency) {
      return false;
    }

    // Filter out rate plans by dates
    if (rp.availableForReservation) {
    // Rate plan cannot be used today
      const availableForReservationFrom = dayjs(rp.availableForReservation.from);
      const availableForReservationTo = dayjs(rp.availableForReservation.to);
      if (availableForReservationTo.isBefore(now) ||
          availableForReservationFrom.isAfter(now)) {
        return false;
      }
    }
    if (rp.availableForTravel) {
      // Rate plan is totally out of bounds of travel dates
      const availableForTravelFrom = dayjs(rp.availableForTravel.from);
      const availableForTravelTo = dayjs(rp.availableForTravel.to);
      if (availableForTravelTo.isBefore(arrivalDateDayjs) ||
          availableForTravelFrom.isAfter(departureDateDayjs)) {
        return false;
      }
    }

    // apply general restrictions if any
    if (rp.restrictions) {
      if (rp.restrictions.bookingCutOff) {
        if (rp.restrictions.bookingCutOff.min &&
          dayjs(arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.min, 'days')
            .isBefore(now)
        ) {
          return false;
        }

        if (rp.restrictions.bookingCutOff.max &&
          dayjs(arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.max, 'days')
            .isAfter(now)
        ) {
          return false;
        }
      }
      if (rp.restrictions.lengthOfStay) {
        if (rp.restrictions.lengthOfStay.min &&
          rp.restrictions.lengthOfStay.min > lengthOfStay
        ) {
          return false;
        }

        if (rp.restrictions.lengthOfStay.max &&
          rp.restrictions.lengthOfStay.max < lengthOfStay
        ) {
          return false;
        }
      }
    }

    return true;
  });
};

export default {
  selectApplicableModifiers,
  selectBestGuestModifier,
  selectApplicableRatePlans,
};
