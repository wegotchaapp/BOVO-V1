# Bovogo policy drafts

Prepared September 23, 2026 for the user's review. The two DOCX files are the requested editable documents; matching Markdown provides a reviewable source. These are **drafts, not effective published policies**, and this commit does not enable in-app acceptance or consent.

Confirmed decisions reflected: WeGotcha LLC (Wyoming); Support@thebovogo.com; U.S. service, Texas initial launch; rider age 21+; human fare ($0.54 × actual GPS miles) / fixed 3; pet twice the fare and two passenger seats; $2 platform fee per booking; proposed transaction fee 2.9% of fare plus platform fee, plus $0.30; no optional insurance add-on. Full fee-inclusive refund for rider cancellation at least six hours before departure or driver cancellation, including a rider who had previously canceled late. Late rider cancellations otherwise allocate the mileage fare to the driver and preserve the other fee allocation.

## Before publication

- Obtain qualified review of Texas service classification, any permit/insurance obligations, and the separate transaction-fee treatment for supported payment methods. The user confirmed this review has not happened. Do not claim the carpool exemption or insurance coverage.
- Reconcile privacy language with the deployed SDK/vendor inventory, actual consent screens, sensitive-location processing, data locations, retention schedule, deletion/appeal operations and any biometric use. Those implementation and operational checks remain incomplete. No claim of no tracking, universal U.S. data residency, or completed security audit is made.
- Confirm the support mailbox handles requests, choose an effective date after approval, then wire versioned policy acceptance and separate optional/sensitive-data choices where required. Do not treat acceptance of general terms as consent for every data use.
- Verify the published app enforces age, geography, safe service-animal accommodations, the displayed authorization maximum, and refunds end to end. A policy draft does not prove those controls work.
- The reported exposed database credential remains unconfirmed as rotated. This is an independent launch blocker.

Separate cookie/refund pages, in-app links and consent implementation are still pending. The terms contain the agreed refund rules, and the privacy draft covers local storage at a category level, not a completed cookie inventory.

## Research checked

- Texas TDLR operations and classification: https://www.tdlr.texas.gov/tnc/operations.htm
- Texas Attorney General privacy rights and applicability: https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act
- FTC app data minimization/security: https://www.ftc.gov/business-guidance/resources/app-developers-start-security
- Stripe payment surcharge considerations: https://stripe.com/resources/more/surcharge-fees

## Document verification

Codex authored the drafts using the user's confirmed decisions and inspected all four rendered pages of each final DOCX. QA renders are not repository deliverables. No production service was changed by preparing these documents.
