# Company vehicle, driving and DIB toll integration

The company profile stores one standard vehicle label, fuel type and AutoPASS flag. Driving and hotel travel use these as editable defaults. Vehicle support currently covers cars under 3,500 kg (DIB Bilsize=1), not heavy vehicles or configurable ferry vehicle length (currently 5 m).

## Activation

Register with DIB and obtain an API subscription key from https://api.dib.no/product#product=starter. Save it as the secret Vercel environment variable `DIB_TOLL_API_KEY`, then redeploy. Do not use a NEXT_PUBLIC variable and do not paste the key into chat. No account or subscription is created by OK Works.

Without that key, Google remains the distance provider. Missing toll estimates remain unknown and require manual entry; they are never represented as free trips.

## Contract

Source: https://api.dib.no/docs-tollroad and https://api.dib.no/api-details#api=BompengeApi-Customer.

The adapter uses the documented Azure API Management vCustomer endpoint and `Ocp-Apim-Subscription-Key` header. Address lookups use `Address/GetGooglePlaces/{navn}/{firstonly}`. Routes use `bomstasjoner/GetFeesByWaypoints`, actual outbound/return dates and departure clocks, small-car fuel codes 1/2/3/4, and separate one-way calls with shared address lookups. Totals can include ferries, hence the UI labels both tolls and ferries. Full price is used without AutoPASS; discounted price is used only when the checkbox is enabled.

A return is a separate editable order registration, not a blind doubling of distance or fees. Both registrations are inserted in one transaction. Request ids guard repeated saves. Provider errors and exhausted quotas do not create invented prices.

Automated tests use documented response fixtures. Live DIB verification requires a valid subscription key. Fees remain estimates and should be checked against the vehicle, time and actual route.
