/**
 * 2027 booking fields that do not have their own columns yet.
 * Stored in bookings.extra_notes between sentinel markers, and copied onto
 * planner_plans.payload.bookingDetails (or localStorage in the planner).
 * Pages keep working if sql/19_2027_booking_fields.sql has not been run.
 */
(function (root) {
  'use strict';

  var START = '<<<BOOKING_EXTRAS_JSON>>>';
  var END = '<<<END_BOOKING_EXTRAS>>>';
  var DEPOSIT_PER_PERSON_GBP = 200;

  var SIDE_PLACES = [
    { place: 'cesky_krumlov', label: 'Český Krumlov' },
    { place: 'tabor', label: 'Tábor' },
    { place: 'kutna_hora', label: 'Kutná Hora' }
  ];

  function emptySideTrips() {
    return SIDE_PLACES.map(function (p) {
      return { place: p.place, include: false, hotel: '', nights: '' };
    });
  }

  function empty() {
    return {
      version: 1,
      organiser: { firstName: '', lastName: '', email: '', personId: '' },
      headcount: '',
      guests: [],
      rooms: { singles: '', twins: '', doubles: '', keithRoom: false },
      travel: {
        arrivalTime: '',
        departureTime: '',
        arrivalFlight: '',
        departureFlight: '',
        pickupPoint: '',
        pickupPlace: '',
        pickupTime: ''
      },
      tourHotel: { nights: '', rooms: '', booked: '', paid: '', paidBy: '' },
      extraStays: { pragueNights: '', pragueHotel: '', airportNights: '', airportHotel: '' },
      sideTrips: emptySideTrips(),
      money: {
        pricePerPerson: '',
        total: '',
        depositAmount: '',
        depositDate: '',
        method: '',
        balance: '',
        balanceDueDate: '',
        fxNote: ''
      },
      companion: { joining: false, otherBookingId: '', otherGroup: '' },
      interests: { buttons: false, antique: false, lampwork: false, heritage: false, other: '' },
      needs: { dietary: '', mobility: '' },
      consent: { futureOffers: '', contactMethod: '' }
    };
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function str(v) {
    return v == null ? '' : String(v);
  }

  function merge(raw) {
    var base = empty();
    var src = isObj(raw) ? raw : {};
    base.version = 1;
    if (isObj(src.organiser)) {
      base.organiser.firstName = str(src.organiser.firstName).trim();
      base.organiser.lastName = str(src.organiser.lastName).trim();
      base.organiser.email = str(src.organiser.email).trim();
      base.organiser.personId = str(src.organiser.personId).trim();
    }
    base.headcount = str(src.headcount).trim();
    base.guests = Array.isArray(src.guests) ? src.guests.map(function (g) {
      var row = isObj(g) ? g : {};
      return {
        firstName: str(row.firstName).trim(),
        lastName: str(row.lastName).trim(),
        email: str(row.email).trim(),
        personId: str(row.personId).trim()
      };
    }).filter(function (g) {
      return g.firstName || g.lastName || g.email || g.personId;
    }) : [];
    if (isObj(src.rooms)) {
      base.rooms.singles = str(src.rooms.singles).trim();
      base.rooms.twins = str(src.rooms.twins).trim();
      base.rooms.doubles = str(src.rooms.doubles).trim();
      base.rooms.keithRoom = !!src.rooms.keithRoom;
    }
    if (isObj(src.travel)) {
      Object.keys(base.travel).forEach(function (k) {
        base.travel[k] = str(src.travel[k]).trim();
      });
    }
    if (isObj(src.tourHotel)) {
      base.tourHotel.nights = str(src.tourHotel.nights).trim();
      base.tourHotel.rooms = str(src.tourHotel.rooms).trim();
      base.tourHotel.booked = src.tourHotel.booked === 'yes' || src.tourHotel.booked === 'no' ? src.tourHotel.booked : '';
      base.tourHotel.paid = src.tourHotel.paid === 'advance' || src.tourHotel.paid === 'on_day' ? src.tourHotel.paid : '';
      base.tourHotel.paidBy = str(src.tourHotel.paidBy).trim();
    }
    if (isObj(src.extraStays)) {
      Object.keys(base.extraStays).forEach(function (k) {
        base.extraStays[k] = str(src.extraStays[k]).trim();
      });
    }
    var byPlace = {};
    (Array.isArray(src.sideTrips) ? src.sideTrips : []).forEach(function (row) {
      if (!isObj(row) || !row.place) return;
      byPlace[row.place] = row;
    });
    base.sideTrips = emptySideTrips().map(function (row) {
      var srcRow = byPlace[row.place];
      if (!srcRow) return row;
      return {
        place: row.place,
        include: !!srcRow.include,
        hotel: str(srcRow.hotel).trim(),
        nights: str(srcRow.nights).trim()
      };
    });
    if (isObj(src.money)) {
      Object.keys(base.money).forEach(function (k) {
        base.money[k] = str(src.money[k]).trim();
      });
    }
    if (isObj(src.companion)) {
      base.companion.joining = !!src.companion.joining;
      base.companion.otherBookingId = str(src.companion.otherBookingId).trim();
      base.companion.otherGroup = str(src.companion.otherGroup).trim();
    }
    if (isObj(src.interests)) {
      base.interests.buttons = !!src.interests.buttons;
      base.interests.antique = !!src.interests.antique;
      base.interests.lampwork = !!src.interests.lampwork;
      base.interests.heritage = !!src.interests.heritage;
      base.interests.other = str(src.interests.other).trim();
    }
    if (isObj(src.needs)) {
      base.needs.dietary = str(src.needs.dietary).trim();
      base.needs.mobility = str(src.needs.mobility).trim();
    }
    if (isObj(src.consent)) {
      base.consent.futureOffers = src.consent.futureOffers === 'yes' || src.consent.futureOffers === 'no' ? src.consent.futureOffers : '';
      var method = str(src.consent.contactMethod).trim();
      base.consent.contactMethod = ['email', 'phone', 'whatsapp', 'post'].indexOf(method) >= 0 ? method : '';
    }
    return base;
  }

  function hasContent(raw) {
    var x = merge(raw);
    if (x.organiser.firstName || x.organiser.lastName || x.organiser.email || x.organiser.personId) return true;
    if (x.headcount) return true;
    if (x.guests.length) return true;
    if (x.rooms.singles || x.rooms.twins || x.rooms.doubles || x.rooms.keithRoom) return true;
    var travelHit = Object.keys(x.travel).some(function (k) { return !!x.travel[k]; });
    if (travelHit) return true;
    if (x.tourHotel.nights || x.tourHotel.rooms || x.tourHotel.booked || x.tourHotel.paid || x.tourHotel.paidBy) return true;
    var stayHit = Object.keys(x.extraStays).some(function (k) { return !!x.extraStays[k]; });
    if (stayHit) return true;
    if (x.sideTrips.some(function (s) { return s.include || s.hotel || s.nights; })) return true;
    var moneyHit = Object.keys(x.money).some(function (k) { return !!x.money[k]; });
    if (moneyHit) return true;
    if (x.companion.joining || x.companion.otherBookingId || x.companion.otherGroup) return true;
    if (x.interests.buttons || x.interests.antique || x.interests.lampwork || x.interests.heritage || x.interests.other) return true;
    if (x.needs.dietary || x.needs.mobility) return true;
    if (x.consent.futureOffers || x.consent.contactMethod) return true;
    return false;
  }

  function splitNotesAndExtras(raw) {
    var text = str(raw);
    var i = text.indexOf(START);
    if (i < 0) return { notes: text.trim(), extras: empty() };
    var notes = text.slice(0, i).trim();
    var j = text.indexOf(END, i + START.length);
    if (j < 0) return { notes: text.trim(), extras: empty() };
    var json = text.slice(i + START.length, j).trim();
    try {
      return { notes: notes, extras: merge(JSON.parse(json)) };
    } catch (err) {
      return { notes: text.trim(), extras: empty() };
    }
  }

  function joinNotesAndExtras(notes, extras) {
    var human = str(notes);
    var cut = human.indexOf(START);
    if (cut >= 0) human = human.slice(0, cut);
    human = human.trim();
    var packed = merge(extras);
    if (!hasContent(packed)) return human || null;
    var block = START + '\n' + JSON.stringify(packed) + '\n' + END;
    return human ? (human + '\n\n' + block) : block;
  }

  function num(v) {
    if (v == null || String(v).trim() === '') return 0;
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function guestBeds(rooms) {
    var r = isObj(rooms) ? rooms : {};
    return num(r.singles) + num(r.twins) * 2 + num(r.doubles) * 2;
  }

  function roomPlanStarted(rooms) {
    var r = isObj(rooms) ? rooms : {};
    return [r.singles, r.twins, r.doubles].some(function (v) { return str(v).trim() !== ''; });
  }

  function roomWarning(headcount, rooms) {
    if (!roomPlanStarted(rooms)) return '';
    var beds = guestBeds(rooms);
    var people = num(headcount);
    if (people === beds) return '';
    var keith = (rooms && rooms.keithRoom) ? ' Keith\'s own room is separate and is not part of that bed count.' : '';
    var bedWord = beds === 1 ? 'bed' : 'beds';
    if (!people) {
      return 'The room plan has ' + beds + ' guest ' + bedWord + ' and the headcount is still blank.' + keith;
    }
    return 'The room plan has ' + beds + ' guest ' + bedWord + ' and the headcount is ' + people + '. Singles sleep 1; twins and doubles sleep 2.' + keith;
  }

  function guestCountWarning(headcount, namedGuests) {
    var people = num(headcount);
    var named = num(namedGuests);
    if (!people || people === named) return '';
    if (!named) {
      return 'Headcount is ' + people + '. No guest names are listed yet — add a first name and surname for each person.';
    }
    var noun = named === 1 ? 'guest name is' : 'guest names are';
    return 'Headcount is ' + people + ' and ' + named + ' ' + noun + ' listed. Add a first name and surname for each person.';
  }

  function suggestedDepositGbp(headcount) {
    var people = num(headcount);
    if (people <= 0) return null;
    return Math.round(people * DEPOSIT_PER_PERSON_GBP * 100) / 100;
  }

  function organiserFullName(extras) {
    var o = (extras && extras.organiser) || {};
    return [o.firstName, o.lastName].map(function (s) { return str(s).trim(); }).filter(Boolean).join(' ');
  }

  function methodLabel(method) {
    var map = { cash: 'Cash', bank: 'Bank transfer', paypal: 'PayPal', wise: 'Wise' };
    return map[method] || '';
  }

  function roomSummary(rooms) {
    if (!isObj(rooms)) return '';
    var parts = [];
    if (str(rooms.singles).trim()) parts.push(str(rooms.singles).trim() + ' single');
    if (str(rooms.twins).trim()) parts.push(str(rooms.twins).trim() + ' twin');
    if (str(rooms.doubles).trim()) parts.push(str(rooms.doubles).trim() + ' double');
    if (rooms.keithRoom) parts.push('Keith\'s room');
    return parts.join(', ');
  }

  function hhmm(t) {
    var s = str(t).trim();
    if (!s) return null;
    return s.length >= 5 ? s.slice(0, 5) : s;
  }

  function mergeTravelIntoFlights(flights, extras, arrivalDate, departureDate) {
    var list = Array.isArray(flights) ? flights.map(function (f) { return Object.assign({}, f); }) : [];
    var tr = (extras && extras.travel) || {};
    var arrF = str(tr.arrivalFlight).trim();
    var depF = str(tr.departureFlight).trim();
    var arrT = hhmm(tr.arrivalTime);
    var depT = hhmm(tr.departureTime);
    var pickupBits = [];
    if (tr.pickupPoint === 'airport') pickupBits.push('Airport');
    else if (tr.pickupPoint === 'prague_hotel') pickupBits.push('Prague hotel');
    if (str(tr.pickupPlace).trim()) pickupBits.push(str(tr.pickupPlace).trim());
    if (hhmm(tr.pickupTime)) pickupBits.push(hhmm(tr.pickupTime));
    var pickup = pickupBits.join(' · ');
    if (!arrF && !depF && !arrT && !depT && !pickup) return list;

    function blankFlight() {
      return {
        id: null,
        flight_number: '',
        arrival_date: arrivalDate || null,
        arrival_time: null,
        departure_date: departureDate || null,
        departure_time: null,
        comments: null
      };
    }

    if (!list.length) {
      var inbound = blankFlight();
      inbound.flight_number = arrF || depF || '';
      inbound.arrival_time = arrT;
      inbound.departure_time = (arrF && depF && arrF !== depF) ? null : depT;
      if (arrF && depF && arrF !== depF) {
        inbound.departure_date = null;
        inbound.departure_time = null;
      }
      if (pickup) inbound.comments = 'Pick-up: ' + pickup;
      list.push(inbound);
      if (arrF && depF && arrF !== depF) {
        var outbound = blankFlight();
        outbound.flight_number = depF;
        outbound.arrival_date = null;
        outbound.arrival_time = null;
        outbound.departure_time = depT;
        list.push(outbound);
      }
      return list;
    }

    var target = list[0];
    if (arrF) {
      var match = list.find(function (f) {
        return str(f.flight_number).trim().toLowerCase() === arrF.toLowerCase();
      });
      if (match) target = match;
    }
    if (!str(target.flight_number).trim() && (arrF || depF)) target.flight_number = arrF || depF;
    if (!target.arrival_time && arrT) target.arrival_time = arrT;
    if (!target.departure_time && depT && !(arrF && depF && arrF !== depF)) target.departure_time = depT;
    if (!target.arrival_date && arrivalDate) target.arrival_date = arrivalDate;
    if (!target.departure_date && departureDate) target.departure_date = departureDate;
    if (pickup && !str(target.comments).trim()) target.comments = 'Pick-up: ' + pickup;
    if (depF && (!arrF || depF.toLowerCase() !== arrF.toLowerCase())) {
      var haveOut = list.some(function (f) {
        return str(f.flight_number).trim().toLowerCase() === depF.toLowerCase();
      });
      if (!haveOut && list.length === 1 && !str(list[0].flight_number).trim()) {
        list[0].flight_number = depF;
        if (!list[0].departure_time && depT) list[0].departure_time = depT;
      } else if (!haveOut) {
        var outRow = blankFlight();
        outRow.flight_number = depF;
        outRow.arrival_date = null;
        outRow.arrival_time = null;
        outRow.departure_time = depT;
        list.push(outRow);
      }
    }
    return list;
  }

  root.BookingExtras = {
    START: START,
    END: END,
    DEPOSIT_PER_PERSON_GBP: DEPOSIT_PER_PERSON_GBP,
    DAY_TRIP_PRICE_GBP: 85,
    SIDE_PLACES: SIDE_PLACES,
    empty: empty,
    merge: merge,
    hasContent: hasContent,
    splitNotesAndExtras: splitNotesAndExtras,
    joinNotesAndExtras: joinNotesAndExtras,
    guestBeds: guestBeds,
    roomPlanStarted: roomPlanStarted,
    roomWarning: roomWarning,
    guestCountWarning: guestCountWarning,
    suggestedDepositGbp: suggestedDepositGbp,
    organiserFullName: organiserFullName,
    methodLabel: methodLabel,
    roomSummary: roomSummary,
    mergeTravelIntoFlights: mergeTravelIntoFlights
  };
})(typeof window !== 'undefined' ? window : globalThis);
