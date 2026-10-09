# 3-minute demo script

**Setup:** open the live demo on the start screen. Have a phone ready to show the text message.

## 0:00 The problem (20 seconds)

"When someone without insurance leaves the hospital, the medical part is done, but recovery is just starting. The family gets discharge papers full of restrictions: keep weight off the foot, no driving, no work, someone has to stay the first night, check blood sugar four times a day. Every one of those is a job, and every one has a price. Nobody tells them who does it, when, or what's free."

Point at the paper on the start screen: "This is First72 reading Denise's papers. Each highlighted line already has an owner and a time."

## 0:20 Home (25 seconds)

Click **See Denise's plan**.

"Denise is 56, works at a restaurant, no insurance. Her daughter Tasha works days, her brother Marcus is three hours away in Wichita, and Gloria from church has mornings free."

"This is the home page. One sentence on where things stand, the top three things to worry about, and the next three tasks. Everything else is one tab away, and each tab shows only that one thing. My grandma could use this."

## 0:45 Heads up (30 seconds)

Click the **Heads up** tab.

"Nearly 1 in 4 people have a problem after leaving the hospital, and about half of those can be prevented. So First72 checks the plan for what usually goes wrong. At the top, the warning signs copied straight from her papers, with call 911. Then the flags, most urgent first: nobody is with Denise Saturday noon to 2, talk to the case manager before she leaves, and her new medicines cost money she may not have. Each one says what to do."

Click **Fix it** on the first flag. It opens the Schedule.

"This is the next 72 hours under a real sky. Blue is Tasha, purple is Gloria. That red block is the two hours where nobody is there, and the papers say someone has to be. A checklist app would never show you that."

## 1:15 Free help, matched to the clock (35 seconds)

Click the **Money** tab.

"First72 looks for free help first, but it checks whether that help can actually start in time. The food pantry can, so the week's groceries are covered. The Kansas Equipment Exchange at KU gives away refurbished equipment, but it takes a couple of days. So the plan says buy the shower chair tonight, borrow the rest."

Open **What to say** on the case manager card: "And the very first task is one conversation before she leaves the hospital: a ride voucher, a starter supply of medicine, the financial assistance form, and a clinic referral. Here's the exact script."

## 1:50 Health coverage (35 seconds)

Click the **Health coverage** tab.

"From household size and income, First72 screens what Denise qualifies for. At 128% of the poverty line: the hospital's charity care, a sliding fee at Heartland Community Health Center here in Lawrence, and SNAP with the 7-day option because she's off work. Marketplace open enrollment starts November 1."

Click **Missouri**: "Kansas hasn't expanded Medicaid, so Denise can't get KanCare. Move her across State Line Road and the same Denise likely qualifies for Medicaid. Same family, different answer."

Click back to **Kansas**.

## 2:25 Ask (20 seconds)

Click the **Ask** tab and tap **What does Marcus need to do?**

"Marcus can't drive from Wichita, so he gets the phone calls and applications. Caregivers can just ask, by typing or talking."

Type **How much insulin should she take?** "And it never plays doctor. Medical questions get the papers' own words and the number to call. Add a Claude key and it handles anything else about the plan."

## 2:45 Close (15 seconds)

Tap **Bigger text** once. "Big text for anyone who needs it. No server: the plan lives in the link, and for anyone not on the group text, there's a fridge sheet. Discharge papers say what she can't do. First72 says who will, when, what's free, and what could go wrong."

---

## Likely judge questions

**Where does the data come from?** The 2026 poverty guidelines, HRSA health center rules, IRS rules for nonprofit hospital financial assistance, Kansas DCF, Kansas and Missouri Medicaid rules, and verified Lawrence and Kansas City resources. All linked in the README. Costs are local estimates shown as ranges, and "maybe" help is never counted in the totals.

**Is this giving medical advice?** No. It only plans non-clinical help and coverage. The Heads up tab flags planning problems (nobody there, medicines not picked up, no ride to the follow-up). The only medical lines it shows are copied word for word from the discharge papers, next to "Emergency: call 911." Every page says to call the number on the papers for medical questions.

**How does Heads up decide what to flag?** Rules over the finished plan, not guesses. A flag needs a reason in the plan itself: an uncovered hour, a prescription in the papers, a fall-risk line, a follow-up with no family driver, a helper over the hour limit. Each one shows the line from the papers that caused it and clears itself when the task is marked done.

**Is the chatbot AI?** Both. With no setup it answers from the plan on the device, so it works offline and costs nothing. With a Claude API key, open questions go to Claude with the plan as context. Medical and emergency questions are caught first and never sent: they get the papers' own words, the number on the papers, 911 or 988.

**What about people with insurance?** Same engine. Click "Or see Rosa" on the start screen: Medicare Advantage meals, rides and equipment, each checked against how much notice it needs.

**Why not just use AI to read the papers?** The decoder is deliberately rule-based so every output is explainable and cites its source. An LLM pass is the next step, under the same rule: it has to quote the line, or the suggestion is dropped.

**Who would pay for this?** Hospitals carry the cost of readmissions and uncompensated care. A plan started at admission catches gaps before discharge and gets uninsured patients into charity care, community clinics and coverage. Health systems, community health centers and United Way 211 are natural partners.

**What about privacy?** No accounts, no backend, nothing sent anywhere by default. Income and health details stay on the device. Sharing puts the plan in the URL fragment, which browsers never send to servers. The only exception is opt-in: a Claude key on the Ask tab sends non-medical questions and the plan to Anthropic.
