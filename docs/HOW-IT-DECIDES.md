# How First72 decides

Everything is measured in **hours relative to discharge** (Hour 0). Negative hours are prep time before the patient leaves the hospital. Planning time matters, because every lead time is measured from when the plan was started.

## 1. Reading the papers

The decoder splits the papers into sentences (keeping titles like "Dr." intact and skipping headings like "FOLLOW-UP") and runs each rule. Every finding keeps the exact sentence.

| Rule | Example sentence | Creates |
|---|---|---|
| Supervision | "Someone should stay with you for the first 72 hours" | Round-the-clock shifts for 72 hours |
| No driving | "No driving for 6 weeks" | Ride tasks, rides for later weeks |
| Lifting limit | "Do not lift anything heavier than 10 pounds" | Laundry, trash, groceries |
| Mobility device | "Walk with your walker at all times" | Get the walker before discharge, walker-proof the house |
| Bathroom safety | "Use a raised toilet seat and a shower chair" | Home-safety kit order, bathroom setup before bedtime |
| Daily-living aids | "A reacher and sock aid are recommended" | Added to the kit |
| Bending | "Hip precautions: no bending past 90 degrees" | Household help, reacher and sock aid |
| Stairs | "Avoid stairs" or "set up a bed on the first floor" | First-floor bedroom setup |
| Fall risk | "Remove throw rugs and use a night light" | Fall-proofing, night lights |
| Hospital bed, oxygen | "Oxygen tank delivery" | Delivery and setup tasks |
| Follow-up | "Follow up with Dr. Patel in 2 days" | Confirm the time, drive and stay (or book it if it's later) |
| Therapy | "Outpatient physical therapy, 3 times per week" | Schedule it, line up recurring rides |
| Home health | "A home health nurse will visit within 48 hours" | Confirm the time, be home for the visit |
| Prescriptions | "New prescriptions were sent to your pharmacy" | Pick up on the drive home |
| Diet | "Low sodium diet" | Meals for each day, labeled with the diet |
| Daily weights | "Weigh yourself every morning" | A scale in the kit |
| Chores | "No housework or yard work" | Household help |
| Supplies | "You will need a glucose meter, test strips and lancets" | Added to the pharmacy pickup, priced item by item |
| Off work | "Do not return to work until cleared" | Employer call, food assistance, 211 rent and utility help |

Intake answers add needs too. For patients without insurance (or under 200% of the poverty line), the plan adds the case manager ask before discharge, a cash-price check before prescription pickup, a food pantry run instead of grocery delivery, and coverage tasks from the screener below.  Living alone adds a first-night stay (if the papers don't already require supervision) and daily check-in visits and calls once round-the-clock coverage ends. Every plan gets the group text and the fridge sheet.

## 2. Who is there each hour

Each helper marks 6-hour blocks (overnight, morning, afternoon, evening) when they can be there. Only people who live there or nearby can take shifts. The roster keeps the same person on for continuity up to 12 hours, then hands off to whoever has the fewest hours so far. Any hour with nobody available becomes a **gap**.

## 3. Who does each task

Tasks go to the earliest time someone can do them, with these rules:

- Driving needs a car, heavy tasks need someone who can lift, and anything in person needs someone nearby
- Nobody is booked for two things at once (except paired tasks, like the pharmacy stop on the drive home)
- At-home tasks prefer whoever is already on shift
- Phone and online tasks prefer people far away, so the people nearby can stay with the patient
- Meals are decided meal by meal: a covered benefit if it can arrive in time, otherwise whoever is there, otherwise whoever covers the gap, otherwise delivery

If no one can do a task, it goes to a benefit or a paid service that can start in time.

## 4. Who pays

Each source has eligibility, coverage, a lead time, a contact, a script and a caveat.

| Source | Eligible when | Covers | Lead time |
|---|---|---|---|
| Medicare Part B / Medicare Advantage equipment | Medicare, Medicare Advantage, dual | 80% of walkers, commodes, hospital beds | 2h if the case manager orders before discharge, otherwise about a day |
| Health plan equipment benefit | Job or marketplace plan | About 70% of equipment | About a day |
| Medicare Advantage OTC allowance | Medicare Advantage (some plans) | Bathroom-safety supplies | About a day |
| Medicare Advantage post-discharge meals | Medicare Advantage (likely) | Meals | About 2 days after asking |
| Medicare Advantage rides | Medicare Advantage (some plans) | Rides to medical visits | About 2 days |
| Medicare Advantage in-home support | Medicare Advantage (some plans) | Companion and homemaker hours | About 3 days |
| Medicaid / KanCare rides (NEMT) | Medicaid, dual | Rides to medical visits | About 3 business days |
| Older Americans Act home-delivered meals | Age 60+ | Meals (donation based) | About 5 days, often longer |
| Family Caregiver Support Program respite | Age 60+ (some areas) | Short breaks | About a week |
| VA respite | Veterans | Companion and homemaker care | About a week |
| Hospital case manager | No insurance, Medicaid or low income, before discharge | Ride home, equipment to take home (worth asking) | Only before discharge |
| Food pantry | Under 200% of the poverty line (likely), no insurance (maybe) | Groceries | About 12 hours |
| Kansas Equipment Exchange or a loan closet | No insurance or low income | Walkers, shower chairs, beds (worth asking) | About 2 days |
| Friends, neighbors, faith community | Anyone (not counted) | Companion time, chores | About 12 hours |
| Employer backup care | A helper's job offers it | 80% of companion care | About a day |
| Meal train | Anyone (not counted) | Meals | About 12 hours |
| 211 volunteers | Anyone (not counted) | Rides, chores | About 3 days |
| Rideshare, agencies, delivery | Anyone | Full price | 30 minutes to a day |

Only sources marked **yes** or **likely** are counted in the totals. "Some plans" sources and community help appear in the call list as worth asking.

A source can only cover a need if it's ready in time:

```
ready at = planning time + lead time
counts if ready at <= when the help is needed
```

When it's too slow, the call list says so ("Too slow for the ride to Dr. Patel. It needs about 2 days' notice"), and if it's useful later it moves to **Start now for next week**.

The **start earlier** number re-runs the whole plan as if planning had started 48 hours before discharge and reports the difference in benefits.

## 5. Care and coverage screener

From household size and monthly income, the screener computes the percent of the 2026 poverty line ($15,960 for one person, plus $5,680 for each additional person) and checks:

| Program | Likely when | Notes |
|---|---|---|
| Hospital financial assistance | At or under 200% | Nonprofit hospitals must have a policy. Many go up to 400%. Apply for about 240 days after the first bill |
| Community health center | Always seen | Full discount at or under 100%, sliding discount to 200%. Lawrence ZIP codes get Heartland Community Health Center |
| Free clinic | No insurance in the Kansas City area | JayDoc Free Clinic (KU School of Medicine), Kansas City, KS |
| Medicaid | Missouri: adults 19 to 64 at or under 138%. Kansas: parents only at about 33% | Kansas hasn't expanded Medicaid. Below 100% in Kansas is the coverage gap |
| Marketplace | No insurance, at or above 100%, not Medicaid-eligible | Open enrollment Nov 1 to Jan 15, enroll by Dec 15 for Jan 1 |
| SNAP | At or under 130% gross | Help within 7 days for very low income. Use this month's income if off work |
| Food pantry | At or under 200% | Same-week groceries |
| Equipment exchange | Worth asking | Kansas Equipment Exchange in Kansas, loan closets elsewhere |
| Prescription costs | No insurance | Cash price, generics, discount cards, health center pharmacy, maker programs |

## 6. Caregiver load

For each helper: hours on shift, overnights, and longest stretch. 36+ hours or an 18-hour stretch is **overloaded**; 24+ hours, a 14-hour stretch or two overnights is **heavy**. Heavy or overloaded helpers get a suggested hand-off (their last overnight, or the middle of their longest stretch), priced through the same funding engine.

## Prices used for estimates

Kansas City area ranges: home care $30 to $38 an hour, rides $15 to $35 one way, wheelchair van $50 to $100 one way, meals $10 to $14 each, and item prices for each piece of equipment in `src/engine/needs.ts`.
