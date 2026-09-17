ViCourt Service — AI Project Context

This file is the canonical context for AI coding agents working on ViCourt Service.

Before making changes:

Read this file.

Inspect git status.

Inspect relevant existing code and database contracts.

Preserve all current modified and untracked work.

Do not assume a task should be restarted from scratch.

1. Project

ViCourt Service is a production web application for managing:

objects / work sites

employees

warehouse and materials

equipment

tasks

activity

documents

finance / payments

reports

notifications

Stack:

Next.js 16 App Router

TypeScript

Supabase

PostgreSQL

Vercel

GitHub

Production branch:

main

2. User / AI workflow

The project owner defines product direction, reviews visible results, manually executes approved SQL in Supabase, performs commit/push unless explicitly delegated, and performs production testing when needed.

The AI coding agent is responsible for implementation and technical validation.

AI agents must NOT:

commit automatically

push automatically

execute SQL automatically

run destructive git commands

revert/reset existing work

discard modified or untracked files

Unless explicitly requested.

Never use destructive operations such as:

git reset --hard

destructive checkout / restore

force push

destructive database changes without review

Always preserve the existing working tree.

3. Standard validation

For application/code changes run:

npm run lint
npx tsc --noEmit --pretty false
git diff --check
npm run build -- --webpack

Existing unrelated warnings are acceptable if unchanged.

Do not perform manual local browser smoke unless explicitly requested.

Normal workflow:

AI implementation
→ automated validation
→ user commit/push
→ Vercel Ready
→ production smoke if required

For SQL-only work, git diff --check is usually sufficient unless additional validation is relevant.

4. Roles

Canonical application roles:

admin

object_manager

worker

Never invent new role semantics without explicit approval.

5. Critical security boundary

This is one of the most important ViCourt rules.

Worker

Worker is operational-only.

Worker must NEVER receive finance-sensitive data through:

rendered UI

hidden React props

Server Components

RSC / Flight payload

generic DTOs

client fetches

Supabase direct queries

broad RPC results

Hiding finance fields in the UI is NOT sufficient.

Finance-sensitive examples include:

purchase prices

unit cost

total cost

service cost

finance aggregates

management-only financial details

Worker-safe services must use explicit operational projections.

If worker should not see data, avoid executing the management query entirely.

Object Manager

object_manager has management permissions according to the existing module contract.

Do not assume object_manager has admin rights.

Always inspect the current DB/RPC contract.

Admin

Admin has the broadest management permissions.

Some security-sensitive mutations remain admin-only.

6. Supabase / Database principles

Prefer existing canonical RPCs and services.

Do NOT duplicate business logic in:

React components

client code

server actions

when the canonical DB/RPC flow already implements it.

For SECURITY DEFINER RPCs:

use explicit role/auth guards

keep a fixed safe search_path

preserve business logic when hardening access

use exact signatures for overloaded functions

Do not weaken RLS to make a feature easier.

Do not expose management tables directly when an existing safe RPC/projection exists.

7. SQL workflow

AI agents may create SQL files when explicitly requested.

AI agents must NEVER execute SQL.

The user executes SQL manually in Supabase after review.

Security-sensitive rollout pattern:

PRE / additive migration
→ deploy application
→ production verification
→ POST / lockdown

Do not blindly combine security migrations with product features.

For audits prefer:

ONE deploy SQL
→ ONE audit SQL
→ ONE consolidated PASS/FAIL result table

Avoid many separate result sets when one consolidated contract can verify the phase.

8. Current production modules

Production-ready / established modules include:

Object 3.0

Employees 2.0

Warehouse 4.0 current feature set

Reports 3.0

Equipment 3.1

Tasks 2.1

Activity Log 2.0

Object Documents

Finance / Payments

Notifications / PWA / Web Push

9. Equipment

Equipment 3.1 is complete.

Important architecture:

/equipment/[id] passport

Overview

Service

Usage

Tasks

management-only History

URL tabs

lazy loading

Suspense

pagination

directory server filtering

Equipment work sessions use canonical equipment_usage_logs.

Workers must not receive equipment service cost.

Management service cost is retrieved through management-safe flows.

Canonical equipment mutation/security RPCs must not be bypassed.

Recurring/equipment maintenance flows have hardened guards.

10. Warehouse

Warehouse 4.0 currently includes Material Passport, Material Operations and Stock Planning.

Material Passport

Route:

/warehouse/[id]

Includes:

material information

stock status

current quantity

min quantity

target quantity

supplier

management movement history

management purchases

object usage

Worker gets operational material passport only.

Worker management history queries = 0.

Material Operations

Management operations from passport:

receipt

issue

return

adjustment

Canonical flows:

Receipt:

completeWarehousePurchase
→ complete_warehouse_purchase

Issue:

createMaterial
→ allocate_warehouse_material

Return:

returnMaterialToWarehouse
→ return_object_material_to_warehouse

Adjustment:

createWarehouseMovement
→ adjust_warehouse_stock

Adjustment is admin-only according to the current contract.

Do not create duplicate stock mutation logic.

Stock Planning

Warehouse directory includes:

global stock summary

Out of Stock / Low / Normal

URL stock filter

recommended purchase quantity

planned purchase state

quick purchase planning

receive purchase flow

management purchase overview

Canonical status logic:

quantity <= 0
→ OUT_OF_STOCK

quantity > 0
AND min_quantity != null
AND quantity <= min_quantity
→ LOW_STOCK

otherwise
→ NORMAL

Recommended purchase quantity:

target_quantity - current_quantity

Only when:

stock is LOW or OUT

result is positive

Known Warehouse technical debt

Current API does not have a DB-level stock-status filter/aggregation.

The server currently scans a narrow stock index to calculate global counts/filter IDs and then fetches the requested page.

This is acceptable at current scale but is a future optimization.

Also deferred:

worker-safe operational warehouse history projection

Do not implement either unless explicitly requested.

11. Tasks

Current production base is Tasks 2.1.

Tasks already include hardened recurring-task architecture.

Important:

do NOT bypass recurring task guards

use canonical recurring completion flow

do not directly mutate protected recurring linkage

Tasks 3.0 is the next major planned feature.

Planned phases:

Tasks 3.0A

Task Workspace

My / All / Today / Overdue / Upcoming

URL filters

server pagination

better task cards/list

object/equipment links

mobile UX

Tasks 3.0B

Task detail

quick actions

status/completion UX

checklist

assignment UX

Tasks 3.0C

recurring tasks/templates UX

Tasks 3.0D

polish

performance

Dashboard integration

12. Security Hardening status

Completed:

Security / DB Hardening 1A

Security / DB Hardening 1B

Security / DB Hardening 1C-A

Security / DB Hardening 1C-B

Deferred:

Hardening 1C-C

production-only functions

non-empty search_path review

Hardening 1C-D

future-function default EXECUTE privileges

Do not restart completed hardening phases.

Do not modify supabase_admin platform-managed defaults without explicit proof and approval.

13. Hardened auth helpers

Important internal helpers include:

private.has_role(text[])

private.is_active_user()

private.is_admin()

They are used by RLS/functions.

Do NOT revoke authenticated execution or redesign them casually.

Existing policy dependencies must be considered.

14. Trigger helpers

Direct PUBLIC/anon/authenticated EXECUTE was removed from hardened trigger-only functions where safe.

Do not restore broad execution without proof.

Trigger bindings must not be confused with direct RPC access.

A trigger can continue firing without being directly executable through PostgREST.

15. Product development philosophy

Prefer visible product progress.

Do not spend many consecutive phases on invisible hardening unless a real security blocker exists.

Preferred rhythm:

visible feature
→ technical validation
→ short hardening/polish
→ next visible feature

Avoid unnecessary refactors.

Do not rewrite stable production architecture simply because another implementation is stylistically preferable.

16. Performance principles

Avoid:

N+1 queries

loading complete tables into the client

client-side pagination of large datasets

full histories where scoped queries are sufficient

duplicate server queries

broad SELECT * for sensitive data

Prefer:

explicit projections

server filtering

server pagination

deterministic ordering

batched lookups

scoped RPCs

lazy loading where appropriate

17. Error handling

Expected business errors should not become generic application crashes.

Prefer:

local expected-error handling

useful empty states

loading skeletons

safe notFound() for invalid entity IDs

isolated error boundaries where useful

Do not expose sensitive database details to users.

18. Mobile

New product features should remain usable around 375px width.

Do not build desktop-only workflows.

Cards, forms and actions should remain touch-friendly.

19. Current roadmap

Current next major phase:

Tasks 3.0

After Tasks:

Dashboard 3.0

Expected Dashboard focus:

tasks requiring attention

overdue / today

low stock

equipment maintenance state

recent activity

useful operational overview

Then:

Reports 4.0

Later:

Auth / Account Recovery 1.0

Planned account recovery includes:

user self-service forgot-password flow using Supabase email reset

admin-controlled recovery/reset flow if needed

service role / Admin API strictly server-side

reset must preserve employee/profile role/tasks/history

Security 1C-C / 1C-D can be returned to in a later technical sprint.

20. AI handoff protocol

When continuing work started by another AI agent:

FIRST:

Read this file.

Run git status.

Inspect git diff.

Identify existing modified/untracked files.

Understand which parts of the original task are already completed.

Then continue ONLY unfinished work.

Never restart the implementation unless the current implementation is proven incorrect.

Never overwrite another agent's work simply because a different approach is preferred.

When previous work is incomplete:

preserve it
→ understand it
→ extend/fix it

21. Codex / fallback agent rules

Primary coding agent:

Codex

Fallback coding agent:

only when explicitly chosen

must work on the SAME repository

must inspect the existing working tree first

must never restart a partially completed task

must never overwrite another agent's valid work without proof

Only one coding agent should modify the working tree at a time.

Never run Codex and another coding agent against the same working tree simultaneously.

22. Final report format

After completing a feature, report concisely:

what was implemented

architecture/data-flow decisions

role/security behavior

reused RPC/services

DB_GAP / blockers

files changed

validation results

recommended next phase

Do not commit/push.

Do not execute SQL.