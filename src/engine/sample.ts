import { toLocalIso } from './time';
import type { CaseInput } from './types';

// A realistic (fictional) case for the demo: a 74-year-old going home after a hip replacement.

export const SAMPLE_PAPERS = `DISCHARGE INSTRUCTIONS
Patient: Rosa Alvarez    Procedure: Right total hip replacement

ACTIVITY
- Walk with your walker at all times for the next 4 weeks.
- No driving for 6 weeks or until cleared by your surgeon.
- Do not lift anything heavier than 10 pounds.
- Hip precautions: no bending past 90 degrees and do not cross your legs.
- Avoid stairs when possible. If your bedroom is upstairs, set up a bed on the first floor.
- You are a fall risk. Remove throw rugs and use a night light.

HOME SAFETY
- Use a raised toilet seat and a shower chair.
- A reacher and sock aid are recommended for dressing.

SUPERVISION
- Someone should stay with you for the first 72 hours after you get home.

DIET
- Resume a heart healthy, low sodium diet.

MEDICATIONS
- New prescriptions were sent to your pharmacy. Pick them up on the way home.

FOLLOW-UP
- Follow up with Dr. Patel (Orthopedics) in 2 days for a wound check.
- A home health nurse will visit within 48 hours.
- Outpatient physical therapy starts within 1 week, 3 times per week.

Call your surgeon for fever over 101, new redness or drainage, or calf pain. Call 911 for chest pain or trouble breathing.`;

/** Blocks are `day:part` (part 0 overnight, 1 morning, 2 afternoon, 3 evening). */
export function sampleCase(now = new Date()): CaseInput {
  const discharge = new Date(now);
  if (now.getHours() >= 12) discharge.setDate(discharge.getDate() + 1);
  discharge.setHours(14, 0, 0, 0);
  const planned = new Date(discharge.getTime() - 4 * 3_600_000);
  return {
    patient: {
      name: 'Rosa Alvarez',
      pronouns: 'she',
      age: 74,
      zip: '66044',
      state: 'KS',
      livesAlone: true,
      veteran: false,
      insurance: 'medicare-advantage',
      hasHsaFsa: false,
    },
    dischargeAt: toLocalIso(discharge),
    plannedAt: toLocalIso(planned),
    papers: SAMPLE_PAPERS,
    crew: [
      {
        id: 'maya',
        name: 'Maya',
        relation: 'Daughter',
        distance: 'near',
        hasCar: true,
        canLift: true,
        phone: '',
        backupCare: true,
        chipIn: true,
        // Works Wednesday and Thursday daytime.
        availability: ['0:1', '0:2', '0:3', '1:0', '1:3', '2:0', '2:3', '3:0', '3:2'],
      },
      {
        id: 'dev',
        name: 'Dev',
        relation: 'Son, lives in Denver',
        distance: 'far',
        hasCar: false,
        canLift: false,
        phone: '',
        backupCare: false,
        chipIn: true,
        availability: ['0:1', '0:2', '0:3', '1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '3:1', '3:2'],
      },
      {
        id: 'linda',
        name: 'Linda',
        relation: 'Neighbor',
        distance: 'near',
        hasCar: false,
        canLift: false,
        phone: '',
        backupCare: false,
        chipIn: false,
        availability: ['1:1', '2:1', '3:1'],
      },
    ],
  };
}

export function blankCase(now = new Date()): CaseInput {
  const discharge = new Date(now);
  discharge.setMinutes(0, 0, 0);
  discharge.setHours(discharge.getHours() + 3);
  return {
    patient: {
      name: '',
      pronouns: 'she',
      age: 70,
      zip: '',
      state: 'KS',
      livesAlone: false,
      veteran: false,
      insurance: 'medicare',
      hasHsaFsa: false,
    },
    dischargeAt: toLocalIso(discharge),
    plannedAt: toLocalIso(now),
    papers: '',
    crew: [
      {
        id: 'me',
        name: '',
        relation: 'Me',
        distance: 'near',
        hasCar: true,
        canLift: true,
        backupCare: false,
        chipIn: true,
        availability: ['0:2', '0:3', '1:0', '1:3', '2:0', '2:3', '3:0'],
      },
    ],
  };
}
