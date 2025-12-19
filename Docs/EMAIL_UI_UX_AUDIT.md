# Email UI/UX Audit Report

## Overview
This document audits all email-related input fields in the Dokploy UI to ensure proper validation, accessibility, and user experience.

## Issues Found

### 1. Let's Encrypt Email Field (`web-domain.tsx`)
**Location:** Settings > Web Server > Server Domain

**Issues:**
- ❌ Missing `type="email"` HTML attribute
- ❌ No email format validation in Zod schema (only checks if required)
- ❌ Placeholder shows example but no format guidance
- ⚠️ Validation only triggers when HTTPS is enabled and certificate type is "letsencrypt"

**Impact:** Users can enter invalid email formats without immediate feedback.

**Recommendation:**
- Add `type="email"` for HTML5 validation
- Add `.email()` validation to Zod schema
- Improve placeholder text

---

### 2. Login Email Field (`pages/index.tsx`)
**Location:** Login page

**Issues:**
- ❌ Missing `type="email"` HTML attribute
- ✅ Has Zod email validation (good)
- ⚠️ No autocomplete attribute

**Impact:** Mobile keyboards won't show email-specific layout.

**Recommendation:**
- Add `type="email"`
- Add `autoComplete="email"`

---

### 3. Register Email Field (`pages/register.tsx`)
**Location:** Registration page

**Issues:**
- ❌ Missing `type="email"` HTML attribute
- ✅ Has Zod email validation (good)
- ⚠️ No autocomplete attribute

**Impact:** Mobile keyboards won't show email-specific layout.

**Recommendation:**
- Add `type="email"`
- Add `autoComplete="email"`

---

### 4. Profile Email Field (`profile-form.tsx`)
**Location:** Settings > Profile

**Issues:**
- ❌ Missing `type="email"` HTML attribute
- ⚠️ Validation schema not visible in component
- ⚠️ No autocomplete attribute

**Impact:** Users may not get proper email validation feedback.

**Recommendation:**
- Add `type="email"`
- Add `autoComplete="email"`
- Verify backend validation exists

---

### 5. Add Invitation Email Field (`add-invitation.tsx`)
**Location:** Settings > Users > Add Invitation

**Issues:**
- ❌ Missing `type="email"` HTML attribute
- ✅ Has Zod email validation (good)
- ⚠️ No autocomplete attribute

**Impact:** Mobile keyboards won't show email-specific layout.

**Recommendation:**
- Add `type="email"`
- Add `autoComplete="email"`

---

### 6. Email Forward Destination (`add-email-forward.tsx`)
**Location:** Email Management > Add Forward

**Status:** ✅ **GOOD**
- ✅ Has `type="email"` attribute
- ✅ Has proper Zod email validation
- ✅ Good user experience with domain suffix display

**No changes needed.**

---

## Summary

### Critical Issues (Must Fix)
1. **Let's Encrypt Email Field** - Missing email validation entirely
2. All email input fields missing `type="email"` attribute

### Medium Priority
1. Missing `autoComplete` attributes for better UX
2. Inconsistent validation patterns across components

### Good Practices Found
- Email forward component has proper implementation
- Most components use Zod for validation
- Good use of FormDescription for user guidance

## Fixes Required

### Priority 1: Add `type="email"` to all email inputs
- `web-domain.tsx` - Let's Encrypt email field
- `pages/index.tsx` - Login email field
- `pages/register.tsx` - Register email field
- `profile-form.tsx` - Profile email field
- `add-invitation.tsx` - Invitation email field

### Priority 2: Improve validation
- Add email validation to Let's Encrypt field schema
- Add `autoComplete` attributes for better mobile UX

### Priority 3: Consistency
- Ensure all email fields have consistent validation messages
- Standardize placeholder text patterns
