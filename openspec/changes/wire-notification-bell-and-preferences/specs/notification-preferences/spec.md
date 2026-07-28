## ADDED Requirements

### Requirement: User can disable individual notification types
The system SHALL allow each user to independently disable any of the existing notification `type` values (`booking_edited`, `booking_approval`, `booking_rejected`, `booking_approved`, `booking_cancelled`, `comment_mention`, `booking_upcoming`, `booking_resource_closed`) via a per-user `notificationSettings` field, defaulting to enabled when unset.

#### Scenario: User disables a type they don't want
- **WHEN** user sets `notificationSettings.comment_mention = false`
- **THEN** future `createNotifications` calls targeting that user with `type: "comment_mention"` do not create a notification document for them

#### Scenario: User has never configured settings
- **WHEN** a user has no `notificationSettings` field at all
- **THEN** all notification types are treated as enabled, matching current write behavior

#### Scenario: Other recipients in the same batch are unaffected
- **WHEN** `createNotifications` is called with entries for both user A (disabled `booking_upcoming`) and user B (default settings) for the same event
- **THEN** user A receives no notification document for that event while user B does

### Requirement: Notification creation respects recipient preferences
`createNotifications` SHALL check each recipient's `notificationSettings` for the entry's `type` before writing, skipping the write entirely for recipients who disabled that type — the sender-side targeting logic (who is included in the entries array) SHALL NOT change.

#### Scenario: Approval notification filtered per-approver
- **WHEN** a booking moves to the next approval step and `notifyBookingApprover` builds an entry with `type: "booking_approval"` for the next approver
- **THEN** if that approver disabled `booking_approval`, no document is created for them; the booking's approval workflow itself is unaffected
