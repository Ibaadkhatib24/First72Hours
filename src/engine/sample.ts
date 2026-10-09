import { toLocalIso } from './time';
import type { CaseInput } from './types';

// Realistic (fictional) cases for the demo.
// Denise: 56, no insurance, going home after a foot infection and a new diabetes diagnosis.
// Rosa: 74, Medicare Advantage, going home after a hip replacement.

export const UNINSURED_PAPERS = `DISCHARGE INSTRUCTIONS
Patient: Denise Carter    Reason for stay: Right foot infection, new diagnosis of type 2 diabetes

ACTIVITY
- Keep weight off your right foot. Use a walker when you walk.
- No driving until you are cleared at your follow-up visit.
- Do not return to work until cleared by your doctor.
- Use a shower chair and keep the dressing dry.

SUPERVISION
- An adult should stay with you for the first 24 hours after you get home.

WOUND CARE
- Change the dressing once a day. You will need gauze, medical tape and saline.

DIABETES
- Check your blood sugar before meals and at bedtime. You will need a glucose meter, test strips and lancets.
- Follow a diabetic, carb-controlled diet.

MEDICATIONS
- New prescriptions were sent to your pharmacy, including an antibiotic and insulin. Pick them up on the way home.

FOLLOW-UP
- Return to the wound clinic in 3 days for a dressing check.
- See a primary care doctor within 1 week. If you do not have one, call a community health center.

Go to the emergency room for fever, spreading redness, or a blood sugar over 400.`;

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

function times(now: Date) {
  const discharge = new Date(now);
  if (now.getHours() >= 12) discharge.setDate(discharge.getDate() + 1);
  discharge.setHours(14, 0, 0, 0);
  const planned = new Date(discharge.getTime() - 4 * 3_600_000);
  return { discharge, planned };
}

/** The main demo. Blocks are `day:part` (part 0 overnight, 1 morning, 2 afternoon, 3 evening). */
export function sampleCase(now = new Date()): CaseInput {
  const { discharge, planned } = times(now);
  return {
    patient: {
      name: 'Denise Carter',
      pronouns: 'she',
      age: 56,
      zip: '66044',
      state: 'KS',
      livesAlone: true,
      veteran: false,
      insurance: 'none',
      hasHsaFsa: false,
      householdSize: 1,
      monthlyIncome: 1700,
      parent: false,
    },
    dischargeAt: toLocalIso(discharge),
    plannedAt: toLocalIso(planned),
    papers: UNINSURED_PAPERS,
    crew: [
      {
        id: 'tasha',
        name: 'Tasha',
        relation: 'Daughter',
        distance: 'near',
        hasCar: true,
        canLift: true,
        phone: '',
        backupCare: false,
        chipIn: true,
        // Works retail days, free evenings and nights.
        availability: ['0:2', '0:3', '1:0', '1:3', '2:0', '2:3', '3:0'],
      },
      {
        id: 'marcus',
        name: 'Marcus',
        relation: 'Brother, lives in Wichita',
        distance: 'far',
        hasCar: false,
        canLift: false,
        phone: '',
        backupCare: false,
        chipIn: true,
        availability: ['0:1', '0:2', '0:3', '1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '3:1', '3:2'],
      },
      {
        id: 'gloria',
        name: 'Gloria',
        relation: 'Friend from church',
        distance: 'near',
        hasCar: true,
        canLift: false,
        phone: '',
        backupCare: false,
        chipIn: false,
        availability: ['1:1', '2:1', '3:1'],
      },
    ],
  };
}

/** Second demo: the same planner with Medicare Advantage benefits. */
export function sampleMedicareCase(now = new Date()): CaseInput {
  const { discharge, planned } = times(now);
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
      householdSize: 1,
      monthlyIncome: null,
      parent: false,
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
      age: 55,
      zip: '',
      state: 'KS',
      livesAlone: false,
      veteran: false,
      insurance: 'none',
      hasHsaFsa: false,
      householdSize: 1,
      monthlyIncome: null,
      parent: false,
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
