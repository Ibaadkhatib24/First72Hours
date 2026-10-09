# 3-minute demo script

**Setup:** open the live demo on the start screen. Have a phone ready to show the text message.

## 0:00 The problem (20 seconds)

"When an adult comes home from the hospital, the family gets discharge papers. They're full of restrictions: no driving for six weeks, nothing over ten pounds, someone has to stay with her for 72 hours. Every one of those is a job. Nobody tells the family who does it, when, or who pays."

Point at the paper on the start screen: "This is First72 reading real-looking papers. Each highlighted line already has an owner and a time."

## 0:20 The plan (40 seconds)

Click **See Rosa's plan**.

"Rosa is 74, had a hip replacement, lives alone. Her daughter Maya is nearby but works, her son Dev is in Denver, and a neighbor can do mornings."

Read the summary sentence out loud. Then the runway:

"This is the next 72 hours under a real sky. Blue is Maya, purple is Linda. These red hatched blocks are hours where **nobody is with Rosa**. A checklist app would never show you that."

## 1:00 The insight: benefits vs. the clock (50 seconds)

Scroll to **Who pays**.

"Here's what nobody else does. There's real money available: Medicare Advantage meals and rides, backup care through Maya's job, programs for seniors. But every one of them takes time to start."

Open the **Medicare Advantage ride benefit** card: "It needs about two days' notice. Rosa's follow-up is 43 hours away. So First72 says **too slow by an hour**, books a rideshare, and puts the ride benefit to work for physical therapy next week instead."

Point at the yellow box: "And it tells you what you lost by starting late. If this plan started two days before discharge, the family would get about $60 more. That's why this belongs at hospital admission."

Open **What to say** on one card: "Every call has a script, the deadline to call by, and what to have ready."

## 1:50 Obtain it (40 seconds)

Scroll to **Helpers**.

"Maya is covering 42 of 72 hours including every night. First72 flags that and books her a break. Dev can't drive from Denver, so he gets the phone calls and the orders."

Tap **Text Dev their list** (or show it on the phone): "Each person gets just their part, by text. No app to install."

Mark the **Backup care** call as **Set up**, scroll up to the runway: "And the red gap turns into booked help."

## 2:30 Trust and privacy (20 seconds)

"Every task cites the line in the papers that created it. There's no server: the plan lives in the link itself. And for Grandpa, who doesn't do group texts, there's a fridge sheet." Click **Fridge sheet** to show the print preview.

## 2:50 Close (10 seconds)

"Discharge papers say what she can't do. First72 says who will, when, and who pays."

---

## Likely judge questions

**Where does the data come from?** Funding rules are from Medicare.gov, CMS, Kansas KDADS and VA sources (linked in the README). Costs are local estimates shown as ranges. Benefits that only some plans include are never counted in the totals, only listed as worth asking.

**Is this giving medical advice?** No. It only plans non-clinical help. Every page says to call the number on the discharge papers for medical questions and 911 in an emergency.

**Why not just use AI to read the papers?** The decoder is deliberately rule-based so every output is explainable and cites its source. An LLM pass is the next step, under the same rule: it has to quote the line, or the suggestion is dropped.

**How does it make money / scale?** Hospitals and Medicare Advantage plans pay for readmissions. A plan started at admission unlocks more benefits and catches coverage gaps before discharge. Provider referrals are a second channel.

**What about privacy?** No accounts, no backend, nothing sent anywhere. Sharing puts the plan in the URL fragment, which browsers never send to servers.
