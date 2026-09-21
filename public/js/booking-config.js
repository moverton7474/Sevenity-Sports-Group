/**
 * Sevenity booking links — Stripe Payment Links only.
 *
 * Every URL below is created in the Stripe Dashboard under
 * Payment Links > + New link (test.stripe.com or dashboard.stripe.com,
 * depending on mode), never typed or generated here. Stripe hosts the
 * checkout page and collects the card details directly — this site
 * never sees or stores a card number.
 *
 * For "Unlimited training" ($500/mo), create the Payment Link from a
 * RECURRING monthly price in Stripe so it bills automatically each
 * month, not a one-time price.
 *
 * Leave a value as an empty string '' until its Payment Link exists.
 * The booking pages check this file at load time: a package with a
 * real URL gets a "Book and pay" button that opens the Stripe link;
 * a package left empty gets a "Request this package" button that
 * scrolls to the request form instead, with that package preselected.
 */
window.SEVENITY_BOOKING_LINKS = {
  // Basketball training — book-training.html
  'training-1session': '',
  'training-5session': '',
  'training-unlimited': '', // recurring monthly price in Stripe
  'training-pro': '',

  // Content creation — book-content.html
  'content-video': '',
  'content-photo': '',
  'content-bundle': ''
};
