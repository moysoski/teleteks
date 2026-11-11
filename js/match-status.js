// TheSportsDB match statuses, shared by the football pages and the update scripts.
export const FINISHED = ['FT', 'AET', 'PEN', 'Match Finished'];
export const POSTPONED = ['PST', 'CANC', 'ABD', 'Match Postponed'];

export const isFinished = m => FINISHED.includes(m.status);
export const isPostponed = m => POSTPONED.includes(m.status);
