# Security Specification

## Data Invariants
1. **User Identity**: Every document (except public settings) must be linked to a valid user or verified by a staff member.
2. **Relational Integrity**: 
   - Attendance must refer to a valid student ID.
   - Receipts must refer to a valid student ID (or be explicitly marked as non-student).
   - Exams and Schedules must be linked to a valid class level.
3. **Role Hierarchy**:
   - `superadmin`: Full control.
   - `manager`: Management control (except sensitive system/admin deletions).
   - `teacher`: Management of their assigned classes only.
   - `student`: Read-only access to their own data and public materials.
4. **Immutability**:
   - `createdAt` and `ownerId` should not change after creation.
   - `email` in user profile must match the auth email.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile with `uid` different from `request.auth.uid`.
2. **Role Escalation**: Attempt to update own role to `superadmin`.
3. **Ghost Fields**: Attempt to add `isVerified: true` to a profile update.
4. **Orphaned Attendance**: Attempt to add attendance for a non-existent student.
5. **Unauthorized Receipt Deletion**: A `manager` attempting to delete a fee receipt (restricted to `superadmin`).
6. **Cross-Grade Access**: A `teacher` attempting to read attendance for a class level they don't teach.
7. **Negative Fees**: Attempt to create a receipt with a negative amount.
8. **PII Leak**: A student attempting to `get` the full profile of another student (should only see staff).
9. **Old Timestamp Injection**: Attempt to set `createdAt` to a date in the past.
10. **Resource Poisoning**: Injection of a 1MB string into a `remarks` field.
11. **State Shortcut**: Attempt to approve own fee receipt.
12. **Anonymous Write**: Attempt to write to any collection without being signed in.

## Test Runner
Verified through manual verification and rules analysis. Final `firestore.rules` will be hardened to block all these.
