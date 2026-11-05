// ─────────────────────────────────────────────────────────────
//  SARC survey kiosk: edit this file, nothing else needs changing.
// ─────────────────────────────────────────────────────────────
window.KIOSK_CONFIG = {
  label: "SARC: Belonging on Stage · Belfast International Arts Festival",
  heading: "Tell us what you thought",
  lede: "Thanks for joining us for Belonging on Stage. Help us understand the impact of the Towards Inclusion project by choosing the survey that fits you best.",

  incentive: {
    title: "Win a £50 One4all gift voucher",
    body: "Complete any survey, then you'll be offered a separate entry to our prize draw.",
    // Small print shown under the incentive. Leave as "" to hide.
    terms: "One entry per person. Your draw entry is kept separate from your survey answers and deleted after the draw.",
  },

  // Four surveys. `key` is used in QR-code links (?s=audience).
  // `signifier` is one of: grid, dots, bars, rings
  // (each has its SARC brand colour).
  //
  // These are Microsoft Forms. Keep "embed=true" in each URL. Completion is
  // detected by the browser extension in extension/ (see README). The
  // "I'm finished" button and the inactivity timeout are back-ups.
  // completeAfterLoads is only for Google Forms (number of sections + 1).
  surveys: [
    {
      key: "audience",
      title: "Audience",
      who: "I came to watch the performance",
      url: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?embed=true&id=6ner6qW040mh6NbdI6Hyhu-UHCKBDGtHqTJOHW3nfdtUMUgwNk9KTzdSQkpDWTFROE5VSE9CNlNCVy4u",
      signifier: "grid",
      completeAfterLoads: null,
    },
    {
      key: "participant",
      title: "Participant",
      who: "I took part in the performance project",
      url: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?embed=true&id=6ner6qW040mh6NbdI6Hyhu-UHCKBDGtHqTJOHW3nfdtUQVRFWEc5VDE4SUdISVgwTVI1SEk0MEdDSS4u",
      signifier: "dots",
      completeAfterLoads: null,
    },
    {
      key: "family",
      title: "Family or friend",
      who: "Someone close to me took part in the project",
      url: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?embed=true&id=6ner6qW040mh6NbdI6Hyhu-UHCKBDGtHqTJOHW3nfdtUQ1lENUJVN1RNNFUzWTNEUTEwTThYRjNTOC4u",
      signifier: "bars",
      completeAfterLoads: null,
    },
    {
      key: "organisation",
      title: "Arts organisation",
      who: "I'm here on behalf of an arts organisation",
      url: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?embed=true&id=6ner6qW040mh6NbdI6Hyhu-UHCKBDGtHqTJOHW3nfdtUN0ZMQ0ZPVDlWM1AwNzFTSlpaM1BZT1lBUi4u",
      signifier: "rings",
      completeAfterLoads: null,
    },
  ],

  // Separate prize-draw entry form, offered on the thank-you screen after a
  // survey. Kept apart from the surveys so draw details never mix with
  // research data. Set url to "" to switch the offer off.
  draw: {
    title: "Prize draw entry",
    url: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?embed=true&id=6ner6qW040mh6NbdI6Hyhie8qV6yP5FFopAHhKZVNgJUOUxVTzBVSjEwVDg4T0lNUVhETko2RFRIRy4u",
    signifier: "dots",
  },
  // Seconds the "enter the draw?" screen waits before returning home.
  drawOfferSeconds: 30,

  // Seconds of no activity on a survey before asking "Are you still there?"
  idleSeconds: 180,
  // Seconds the "still there?" prompt counts down before returning home.
  idleCountdownSeconds: 20,
  // Seconds the thank-you screen stays up before returning home.
  thankYouSeconds: 10,
};
