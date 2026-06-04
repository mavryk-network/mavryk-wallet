---
name: pr-creator
description: Use this when preparing commits and creating or updating a pull request for the current branch with a clean title, proper base branch, and structured summary.
---

# Purpose

Use this skill when:

- preparing commits before push
- creating a new PR
- updating an existing PR for the current branch
- generating a clean PR title and description

# Rules

- Be concise and factual
- Follow conventional commit style
- Group related changes logically
- Do not include unrelated changes in one PR
- Do not rewrite history unless explicitly requested
- Do not guess base branch — detect or ask if unclear
- Prefer updating an existing PR for the current branch instead of creating a new one
- Prefer current working branch pattern (e.g. MAV-xxxx/dev)

# Workflow

1. Detect current branch

   - use git branch
   - confirm it is a feature branch

2. Check whether an open PR already exists for the current branch

   - if yes, update the existing PR title/body
   - if no, continue with PR creation flow

3. Determine base branch

   - try to detect from:
     - existing branch naming patterns
     - previous PRs
   - if unclear → ask user
   - fallback: use provided default (e.g. MAV-3661/dev)

4. Prepare commits

   - group changes logically
   - use conventional commits:
     - feat:
     - fix:
     - refactor:
     - chore:
   - avoid vague commit messages

5. Generate PR title

   - format:
     [TASK-ID] short description

6. Generate PR description

   Structure:

   ## Summary

   - what was done

   ## Changes

   - main changes

   ## Technical details

   - important implementation notes

   ## Risks

   - edge cases or potential issues

   ## Test plan

   - how to verify

7. Create or update PR

   If CLI is available:

   - if PR exists:
     - use `gh pr edit`
   - if PR does not exist:
     - use `gh pr create --base <base> --head <current-branch> --title "<title>" --body "<description>"`

   If CLI is not available:

   - output the title, description, and command for the user

# PR title format

[TASK-ID] short description

Example:
MAV-3661: update wallet API parsing and auth flow fixes

# PR description format

## Summary

- short overview

## Changes

- main changes

## Technical details

- implementation notes

## Risks

- possible edge cases

## Test plan

- how to verify

# CLI guidance

To detect PR state for current branch:

- use `gh pr view`

To update existing PR:

- use `gh pr edit`

To create new PR:

- use `gh pr create --base <base> --head <current-branch>`

If base branch is not provided and cannot be detected safely, ask for it instead of guessing.
