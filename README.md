# RETRY ENGINE

This retry engine is a small HTTP service that takes in a HTTP request with some crucial metadata, and retries the requests according to configuration

## SETUP

## ARCHITECTURE DIAGRAM

## CORE CONCEPTS

## SCREENSHOTS

## ISSUES STRUGGLED WITH

Some issues were struggled with, such as:

- Using `better-sqlite3`: installing better sqlite3 was easy, but apparently, pnpm rebuild was not building the binary, and so the log to the console at the bottom of the db.ts file was resulting in an error when I ran `npx tsx db.ts`, to ensure it worked.
  The solution was the following command:
  `node-pre-gyp rebuild --directory node_modules/.pnpm/better-sqlite3@12.10.0/node_modules/better-sqlite3 2>&1 || npx node-gyp rebuild --directory node_modules/.pnpm/better-sqlite3@12.10.0/node_modules/better-sqlite3 2>&1`
  Only then did the native binary build successfully.

## WHAT I LEARNED:

### Concepts:

### Patterns:

### Language/Framework Features

### Debugging Techniques

## RESOURCES CONSULTED

## WHY THE PROJECT MADE ME A BETTER BACKEND DEVELOPER
