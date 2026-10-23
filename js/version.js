// version.js -- the version the athlete can read on screen.
//
// A second copy of sw.js's VERSION, because sw.js is a worker script the page
// cannot import. tests/version.test.mjs fails the moment the two disagree, so
// bumping one without the other is caught before it ships.
//
// Why it is on screen at all: a phone ran a build older than v70 for five days
// while v75 was live, and his feedback on it re-reported two fixed defects.
// design-mobility-and-warmup.md §14.

export const APP_VERSION = 'v80';
