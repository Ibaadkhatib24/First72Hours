/** The eight kinds of non-clinical help families juggle after discharge. */
export type Category =
  | 'transport'
  | 'meals'
  | 'household'
  | 'appointments'
  | 'equipment'
  | 'relief'
  | 'coordination'
  | 'providers';

export type Insurance =
  | 'medicare' // Original Medicare (with or without a supplement)
  | 'medicare-advantage'
  | 'medicaid'
  | 'dual' // Medicare + Medicaid
  | 'private'
  | 'va'
  | 'none';

/** How far a helper is from the patient, which decides what they can do. */
export type Distance = 'home' | 'near' | 'far';

export type Pronouns = 'she' | 'he' | 'they';

export interface Patient {
  name: string;
  pronouns: Pronouns;
  age: number;
  zip: string;
  state: string;
  livesAlone: boolean;
  veteran: boolean;
  insurance: Insurance;
  hasHsaFsa: boolean;
}

export interface CrewMember {
  id: string;
  name: string;
  relation: string;
  distance: Distance;
  hasCar: boolean;
  canLift: boolean;
  phone?: string;
  /** Their employer offers subsidized backup adult care. */
  backupCare: boolean;
  /** Willing to split out-of-pocket costs. */
  chipIn: boolean;
  /** Block keys (`day:part`) when this person can help. */
  availability: string[];
}

export interface CaseInput {
  patient: Patient;
  /** Local ISO, e.g. 2026-10-13T14:00 */
  dischargeAt: string;
  /** When planning started. Lead times are measured from here. */
  plannedAt: string;
  papers: string;
  crew: CrewMember[];
}

/** Something the decoder found in the discharge papers. */
export type FindingRule =
  | 'no-driving'
  | 'lift-limit'
  | 'mobility-device'
  | 'bath-safety'
  | 'adl-aids'
  | 'hospital-bed'
  | 'oxygen'
  | 'stairs'
  | 'fall-risk'
  | 'supervision'
  | 'follow-up'
  | 'therapy'
  | 'home-health'
  | 'prescriptions'
  | 'diet'
  | 'bending'
  | 'daily-weight'
  | 'no-housework';

export interface Finding {
  id: string;
  rule: FindingRule;
  /** Plain-language restatement. */
  label: string;
  /** The exact sentence from the papers. */
  quote: string;
  line: number;
  params: Record<string, string | number | boolean | string[]>;
}

/** Every need must say why it exists: a line from the papers or an answer from intake. */
export type Reason =
  | { kind: 'papers'; findingId: string; quote: string }
  | { kind: 'profile'; fact: string };

export type ServiceKey =
  | 'ride'
  | 'wheelchair-ride'
  | 'meals'
  | 'homemaker'
  | 'companion'
  | 'grocery'
  | 'pharmacy'
  | 'equipment';

export interface LineItem {
  name: string;
  low: number;
  high: number;
  /** Medicare Part B durable medical equipment. */
  dme?: boolean;
  /** Bathroom-safety and daily-living supplies some plans cover through OTC allowances. */
  supply?: boolean;
  /** Usually HSA/FSA eligible when medically needed. */
  hsa?: boolean;
}

export interface Need {
  id: string;
  category: Category;
  title: string;
  /** Shorter name used in lists like "For: Sat meals; Sun meals". */
  short?: string;
  detail: string;
  because: Reason[];
  /** [earliest, latest] relative hours the task can happen. */
  window: [number, number];
  /** Hours of effort. */
  duration: number;
  /** home: at the patient's home. out: driving or errands. remote: phone or online. */
  where: 'home' | 'out' | 'remote';
  req: { car?: boolean; lift?: boolean };
  /** Paid or benefit fulfilment when no one in the crew can do it. */
  service?: ServiceKey;
  /** Cost if a service does it (per need). */
  serviceCost?: { low: number; high: number };
  /** Things that must be bought regardless of who does the task. */
  items?: LineItem[];
  /** For meals: prefer a covered benefit over a family member cooking. */
  preferBenefit?: boolean;
  /** Medical trip (matters for ride benefits and HSA rules). */
  medical?: boolean;
  /** Prep for after the 72 hours (still started now). */
  beyond?: boolean;
  /** Used for pins on the runway. */
  pin?: 'appointment' | 'meal' | 'arrival' | 'visit';
  /** Specific clock moments inside the window (meal times, appointment). */
  times?: number[];
  /** Round-the-clock presence requirement, handled by the roster instead of a single owner. */
  presence?: boolean;
  /** Prefer giving this task to the person doing another one (e.g. pharmacy on the drive home). */
  pairWith?: string;
  /** Unit shown with the cost for prep needs beyond 72 hours. */
  costUnit?: string;
}

export type Eligibility = 'yes' | 'likely' | 'maybe' | 'no';

export type SourceKind = 'insurance' | 'program' | 'employer' | 'community' | 'private';
