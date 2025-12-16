# Content Management Strategy

## Overview

This document covers content lifecycle management, separate from the moderation process.

---

## Topics to Discuss

### Content State After Moderation

- What happens to content after "Upheld" (removal) outcome?
- Auto-hidden vs flagged vs manual removal?
- On-chain state vs off-chain display handling?
- Can creator appeal or re-upload?

### Creator Pool Depletion

- What happens when creator pool reaches 0?
- Status of existing content (hidden? disabled?)
- Can creator add stake during pending reports?
- Minimum pool to maintain content visibility?

### Evidence Preservation

- IPFS pinning strategy for `details_cid`
- What if evidence is unpinned before resolution?
- Who is responsible for pinning? Reporter? Platform?
- Backup/redundancy for critical evidence?

### Repeat Offender Handling

- Creators with multiple upheld reports
- Reporters with multiple dismissed reports
- Ban mechanisms vs pure economic deterrent?
- Reputation system for creators/reporters?

### Content Categories

- Different handling per category?
- Category-specific minimum bonds?
- Specialized moderator pools per category?

### Content Discovery & Flagging

- How is potentially violating content surfaced?
- Pre-report flagging mechanism?
- Community flagging vs formal reports?

---

## Related Documents

- [Moderation System Design](./MODERATION_SYSTEM_DESIGN.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2024-12 | Initial placeholder |
