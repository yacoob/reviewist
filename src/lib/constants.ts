export const NOTE_PROJECT_NAMES: readonly string[] = ['Aside', 'Within'];

// Actions completed from Inbox are folded into this project, so stray
// to-dos that never got filed don't get their own chip in the UI.
export const INBOX_PROJECT_NAME = 'Inbox';
export const PLATE_PROJECT_NAME = 'Plate';

export const NOTE_PROJECT_EMOJIS: Readonly<Record<string, string>> = {
  'Aside': '🗓️',
  'Within': '💬',
};

export const BLOCKLIST: ReadonlySet<string> = new Set([
  '69gqQwRw52w2V2Qg',
  '69gqQwWQr97Xhr4g',
  '6g4MPgHfQ9Wh7R68',
  '6g4rmhGQXphwg5XM',
  '6g4wjR642rxWJRCg',
  '6g58Hc24gqVFWpwM',
  '6g58HRXpX93cWHVM',
  '6g58j7VVr66hmW4M',
  '6g58r3CM6pqV642v',
  '6g58rGF4FCHhj26X',
  '6g58RHg9gvqQC8FM',
  '6g58rHVxgrvhWJcG',
  '6g58WxqCvpwXxXF8',
  '6g5Mrp4hpm786fp5',
]);
