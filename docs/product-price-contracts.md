# Product Price Contracts

This audit distinguishes the **authoring/display amount in dollars** from the **integer cents amount sent to Stripe**. A Stripe conversion happens exactly once, at the payment boundary.

| Product family | Live primary storage | Checkout contract | Audit outcome |
| --- | --- | --- | --- |
| Courses and cohort-backed course offers | `DECIMAL(10,2)` dollars | Multiply by 100 only when creating a Stripe Price | Verified; $99.97 becomes 9,997 cents. |
| Workshops and instances | `DECIMAL(10,2)` dollars | Multiply by 100 only for Stripe | Repaired; $2,297.00 becomes 229,700 cents only in Stripe, not in UI. |
| Memberships | `DECIMAL(10,2)` dollars | Multiply by 100 only for inline Stripe price data | Repaired; legacy CME Membership values were normalized to $199.97 / $299.97. |
| Downloads and physical products | `DECIMAL(10,2)` dollars | Multiply by 100 only for Stripe | Verified in the checkout router contract. |
| Bundles | Integer primary field; structured pricing options persist cents, while legacy options expose dollars | Convert structured cents to display dollars, then back to cents once for Stripe | Verified in the real bundle checkout resolver. |
| Webinars | Integer legacy field plus authored pricing options | Resolver converts selected option dollars to cents once | Verified; $99.97 becomes 9,997 cents. |

The final remaining validation is an interactive browser pass through enabled public CTAs and checkout views after deployment. No payment should be submitted during that check.
