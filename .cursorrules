# MEMBERSTACK-AI-DOCS-START

# Memberstack DOM Package - AI Documentation

## Quick Start
```javascript
import memberstack from '@memberstack/dom';
const ms = memberstack.init({ publicKey: 'pk_...' });
```

## Most Common Methods

For complete implementation examples, see `.memberstack/quickref.md`

### Authentication
- `loginMemberEmailPassword({ email, password })` - Email/password login
- `signupMemberEmailPassword({ email, password, customFields?, metaData?, plans? })` - Create account
- `logout()` - Sign out current member
- `getCurrentMember()` - Get logged-in member data
- `onAuthChange(callback)` - Listen for auth state changes
- `sendMemberResetPasswordEmail({ email })` - Send password reset
- `loginWithProvider({ provider })` - Social login (google/facebook)
- `sendMemberLoginPasswordlessEmail({ email })` - Passwordless login

### Member Management
- `updateMember({ customFields?, metaData? })` - Update member data
- `updateMemberAuth({ email?, oldPassword?, newPassword? })` - Update credentials
- `getMemberJSON()` - Get member data as JSON
- `updateMemberJSON(json)` - Update member JSON data
- `updateMemberProfileImage({ image })` - Update profile picture
- `deleteMember()` - Delete member account
- `sendMemberVerificationEmail()` - Send email verification

### Plans & Billing
- `getPlans()` - Get all available plans
- `getPlan({ planId })` - Get specific plan details
- `purchasePlansWithCheckout({ priceIds, successUrl?, cancelUrl? })` - Stripe checkout
- `launchStripeCustomerPortal({ returnUrl? })` - Open billing portal
- `addPlan({ planId })` - Add free plan to member
- `removePlan({ planId })` - Remove plan from member

### UI Components
- `openModal({ type: 'LOGIN' | 'SIGNUP' | 'PROFILE' })` - Open pre-built modal
- `hideModal()` - Close current modal

## Finding All Methods (49 total)

1. **Search index**: `.memberstack/index.json` - Searchable method index
2. **Quick reference**: `.memberstack/quickref.md` - 30 common methods with examples
3. **Full reference**: `.memberstack/complete.md` - Complete documentation

## AI Instructions

When implementing Memberstack features:
1. ALWAYS check `.memberstack/index.json` for available methods
2. Use exact method signatures from documentation
3. Include error handling in all examples using try/catch blocks
4. Reference `.memberstack/complete.md` for detailed parameters and return types

## Documentation Version: 2.0.0
Last Updated: 2025-01-11
Total Methods: 49

# MEMBERSTACK-AI-DOCS-END