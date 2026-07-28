## ADDED Requirements

### Requirement: User can list their own notifications
The system SHALL expose `GET /api/notifications` that returns only the authenticated user's notifications (ordered newest first) plus an unread count, using the existing `notifications` collection and `userId` field.

#### Scenario: Authenticated user fetches their bell
- **WHEN** an authenticated user calls `GET /api/notifications`
- **THEN** the response contains `{ notifications: [...], unreadCount }` where every item's implicit owner is the calling user, and `unreadCount` equals the number of returned items with `is_read === false`

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid session calls `GET /api/notifications`
- **THEN** the system returns 401 Unauthorized

### Requirement: User can mark a single notification as read
The system SHALL expose `PATCH /api/notifications/[id]` that marks one notification as read, only if it belongs to the requesting user.

#### Scenario: Owner marks their own notification read
- **WHEN** user A calls `PATCH /api/notifications/{id}` for a notification whose `userId === A`
- **THEN** the notification's `isRead` becomes `true`

#### Scenario: Non-owner attempts to mark another user's notification read
- **WHEN** user A calls `PATCH /api/notifications/{id}` for a notification whose `userId !== A`
- **THEN** the system rejects the request (403/404) and does not modify the notification

### Requirement: User can mark all their notifications as read
The system SHALL expose `PATCH /api/notifications/read-all` that marks every unread notification belonging to the requesting user as read, without affecting other users' notifications.

#### Scenario: Mark-all-read only touches the caller's own items
- **WHEN** user A calls `PATCH /api/notifications/read-all` while user B has unread notifications
- **THEN** all of user A's unread notifications become read, and user B's notifications are unaffected
