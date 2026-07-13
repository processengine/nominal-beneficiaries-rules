# FL/IP scoped conflicts dedupe audit

Status date: 2026-07-13.

This document records the semantic audit of the remaining FL/IP scoped
conflicts in the rules package. It is intentionally separate from
`sync-report.json`: the report shows what is scoped, while this file explains
whether each scope is a real business difference, a public issue wrapper, or a
future dedupe candidate.

## Current policy

Rules package migration still preserves parity with processor snapshots.

Executable equality ignores only `description` text. The following properties
remain behavior-defining and must not be collapsed silently:

- rule `operator`;
- `field`, `fields`, `paths`;
- `code`, `level`, `message`;
- dictionary entries;
- condition `when` and `steps`;
- pipeline `flow`.

If two check-rules use the same operator and field but emit different public
messages, they are not merged in this slice. A shared predicate may be added in
a later slice, but the public check wrapper must remain process-specific unless
business accepts a unified message.

## Slice result

The first safe dedupe slice removed conflicts caused only by descriptions or by
identical nonresident additional-document artifacts.

| Contour | Before | After | Change |
|---|---:|---:|---:|
| `fl_nonresident` | 12 | 10 | `-2` |
| `ip_resident` | 15 | 15 | `0` |
| `ip_nonresident` | 20 | 12 | `-8` |
| `ul_resident` | 0 | 0 | `0` |
| `ul_nonresident` | 0 | 0 | `0` |
| `beneficiary_unbind` | 0 | 0 | `0` |

Artifact count changed from `430` to `420`.

## Merged in this slice

| Area | Merged artifacts | Reason |
|---|---|---|
| Address predicates | `library.address.pred_full_address_present` | Same field and predicate operator; only description differed. |
| Russian address structure condition | `library.address.cond_registration_fias_structure_for_ru` | Same `when` and same required address-field checks; only description differed. |
| Nonresident add-doc dictionary | `add_doc_type_codes` | Same entries: `007`, `005`, `006`; only description differed. |
| Nonresident add-doc type check | `library.nonresident.add_doc_type_code_supported` and `library.nonresident.cond_add_doc_type_code_supported` | Same dictionary entries, field, code, message and condition. |
| Nonresident add-doc required fields | `library.nonresident.add_doc_issuer_required`, `library.nonresident.add_doc_series_required`, `library.nonresident.cond_add_doc_right_to_stay_doc` | Same field checks and same public messages. |

## Remaining conflicts

### `fl_nonresident`

| Source id | Scoped id | Verdict | Reason |
|---|---|---|---|
| `document_type_codes_fl` | `dictionaries.fl_nonresident.document_type_codes_fl` | keep scoped | Dictionary entries differ: resident FL uses `001/002/003`, nonresident uses `004`. |
| `library.address.full_address` | `library.fl_nonresident.address.full_address` | public wrapper | Same length check, but public message uses different business wording for the address. |
| `library.common.contacts_any` | `library.fl_nonresident.common.contacts_any` | runtime proof needed | Same visible contact fields and message, but legacy artifacts differ in `paths`; do not merge until operator behavior is proven. |
| `library.documents.cond_passport_rf_fields` | `library.fl_nonresident.documents.cond_passport_rf_fields` | keep scoped | Resident condition includes age-validity checks; nonresident condition does not. |
| `library.documents.issuer_no_extra_spaces` | `library.fl_nonresident.documents.issuer_no_extra_spaces` | public wrapper | Same regex, but public message differs. |
| `library.documents.issuer_no_garbage_symbols` | `library.fl_nonresident.documents.issuer_no_garbage_symbols` | public wrapper | Same regex, but public message differs. |
| `library.documents.type_code_in_dictionary` | `library.fl_nonresident.documents.type_code_in_dictionary` | keep scoped | Same field, different dictionary. |
| `library.fl.precheck_identity_any` | `library.fl_nonresident.fl.precheck_identity_any` | public wrapper | Same identifiers, different business message for the beneficiary type. |
| `library.address.cond_address_line_if_present` | `library.fl_nonresident.address.cond_address_line_if_present` | public wrapper | Condition must call the scoped address-length check to preserve message. |
| `library.documents.cond_issuer_if_present` | `library.fl_nonresident.documents.cond_issuer_if_present` | public wrapper | Condition must call scoped issuer quality checks to preserve messages. |

### `ip_resident`

| Source id | Scoped id | Verdict | Reason |
|---|---|---|---|
| `library.fl.precheck_identity_any` | `library.ip_resident.fl.precheck_identity_any` | public wrapper | Same identifiers, different business message: owner of IP resident. |
| `internal.fl_resident.blocks.address` | `internal.ip_resident.blocks.address` | future shared person block | Runtime flow is effectively the same, but internal ids and titles still say FL resident. Needs a neutral `library.person.resident.*` slice. |
| `internal.fl_resident.blocks.address.registration_country_if_present` | `internal.ip_resident.blocks.address.registration_country_if_present` | future shared person block | Candidate for neutral resident-person condition. |
| `internal.fl_resident.blocks.address.registration_country_not_us` | `internal.ip_resident.blocks.address.registration_country_not_us` | future shared person block | Same field/value; public code must be checked before merging. |
| `internal.fl_resident.blocks.contacts_and_status` | `internal.ip_resident.blocks.contacts_and_status` | future shared person block | Candidate for neutral contact/status block. |
| `internal.fl_resident.blocks.identity_core.*` | `internal.ip_resident.blocks.identity_core.*` | future shared person block | Same owner-person field family, but ids must stop saying `fl_resident` before sharing. |
| `internal.fl_resident.blocks.identity_document` | `internal.ip_resident.blocks.identity_document` | future shared person block | Candidate for neutral identity-document block. |
| `internal.fl_resident.blocks.tax_flags` | `internal.ip_resident.blocks.tax_flags` | keep scoped for now | Current FL resident pipeline has required/type/value guard sequencing; IP resident pipeline still differs. |
| `internal.fl_resident.blocks.tax_flags.*_not_true` | `internal.ip_resident.blocks.tax_flags.*_not_true` | future shared wrapper review | Same field/value checks, but public codes are namespaced and guard sequencing differs by parent block. |

### `ip_nonresident`

| Source id | Scoped id | Verdict | Reason |
|---|---|---|---|
| `document_type_codes_fl` | `dictionaries.ip_nonresident.document_type_codes_fl` | keep scoped | IP nonresident uses the nonresident document dictionary; it must not be confused with resident FL document codes. |
| `library.address.full_address` | `library.ip_nonresident.address.full_address` | public wrapper | Same length check, different business wording. |
| `library.common.contacts_any` | `library.ip_nonresident.common.contacts_any` | runtime proof needed | Same visible contact fields and message, but legacy artifacts differ in `paths`. |
| `library.documents.cond_passport_rf_fields` | `library.ip_nonresident.documents.cond_passport_rf_fields` | keep scoped | Nonresident passport condition intentionally lacks resident age-validity checks. |
| `library.documents.issuer_no_extra_spaces` | `library.ip_nonresident.documents.issuer_no_extra_spaces` | public wrapper | Same regex, different public message. |
| `library.documents.issuer_no_garbage_symbols` | `library.ip_nonresident.documents.issuer_no_garbage_symbols` | public wrapper | Same regex, different public message. |
| `library.documents.type_code_in_dictionary` | `library.ip_nonresident.documents.type_code_in_dictionary` | keep scoped | Same field, scoped dictionary. |
| `library.fl.precheck_identity_any` | `library.ip_nonresident.fl.precheck_identity_any` | public wrapper | Same identifiers, different business message for IP nonresident. |
| `library.nonresident.add_doc_required` | `library.ip_nonresident.nonresident.add_doc_required` | public wrapper | Same fields, different business message for FL vs IP nonresident. |
| `library.address.cond_address_line_if_present` | `library.ip_nonresident.address.cond_address_line_if_present` | public wrapper | Condition must call the scoped address-length check to preserve message. |
| `library.documents.cond_issuer_if_present` | `library.ip_nonresident.documents.cond_issuer_if_present` | public wrapper | Condition must call scoped issuer quality checks to preserve messages. |
| `library.nonresident.cond_add_doc_required_unless_belarus` | `library.ip_nonresident.nonresident.cond_add_doc_required_unless_belarus` | public wrapper | Condition must call scoped add-doc-required check to preserve message. |

## Next slices

1. Prove whether `paths` is redundant for `any_filled` when `fields` is present.
   If yes, normalize it and merge `library.common.contacts_any` where public
   issue text remains identical.
2. Create neutral resident-person pipelines:
   `library.person.resident.identity_core`,
   `library.person.resident.identity_document`,
   `library.person.resident.address`,
   `library.person.resident.contacts_and_status`.
3. Review resident tax flags separately. Do not merge until IP resident has the
   same guard sequencing as FL resident or the difference is documented as
   intentional.
4. Review public messages for address, issuer and precheck wrappers. If business
   accepts common wording, those wrappers can be collapsed; otherwise keep them
   as process-facing issue wrappers.
