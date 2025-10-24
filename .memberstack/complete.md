---
title: Memberstack DOM Package - Complete Documentation
version: 2.0.0
description: Complete AI-optimized documentation for Memberstack DOM SDK
last_updated: 2025-01-11
total_methods: 75
categories: [authentication, members, plans, ui, advanced, data-tables]
---

# Memberstack DOM Package - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Initialization](#initialization)
3. [Authentication](#authentication)
4. [Member Management](#member-management)
5. [Plan Management](#plan-management)
6. [UI Components](#ui-components)
7. [Member Journey](#member-journey)
8. [Advanced Features](#advanced-features)
9. [Types Reference](#types-reference)
10. [Error Handling](#error-handling)
11. [Examples](#examples)
12. [Data Tables](#data-tables)

---

# Overview

## AI Assistant Instructions
This documentation is optimized for AI coding assistants. When helping developers with Memberstack DOM implementation:

1. **Always use exact method signatures** provided in these docs
2. **Include error handling** in all code examples  
3. **Reference specific file sections** when needed (e.g., "See 02-authentication.md for login methods")
4. **Provide complete, runnable code examples**
5. **Explain the relationship** between methods and overall authentication flow

## Package Overview

The `@memberstack/dom` package is Memberstack's core JavaScript SDK for browser-based applications. It provides comprehensive member authentication, subscription management, and UI components.

### Core Capabilities
- **Authentication**: Email/password, passwordless, social login (Google, Facebook)
- **Member Management**: Profile updates, custom fields, member data
- **Subscription Management**: Plan purchases, billing portal, subscription lifecycle
- **Pre-built UI**: Login/signup/profile modals with customizable styling
- **Real-time Features**: Authentication state changes, member data updates
- **Advanced Features**: Comments system, secure content, team management

## Installation

### CDN (Recommended for most web apps)
```html
<script src="https://api.memberstack.com/static/memberstack-dom.js"></script>
<script>
  const memberstack = window.MemberstackDom.init({
    publicKey: "YOUR_PUBLIC_KEY"
  });
</script>
```

### NPM/Yarn
```bash
npm install @memberstack/dom
# or
yarn add @memberstack/dom
```

```javascript
import MemberstackDom from '@memberstack/dom';

const memberstack = MemberstackDom.init({
  publicKey: 'YOUR_PUBLIC_KEY'
});
```

## Core Concepts

### 1. Initialization
Every app must initialize the Memberstack DOM instance with a public key:
```javascript
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-public-key',
  useCookies: true // Optional: enables cookie-based authentication
});
```

### 2. Authentication State
The package manages authentication state automatically:
- **Authentication tokens** stored in cookies (if enabled) or localStorage
- **Member data** cached for performance
- **Authentication callbacks** for reactive UI updates

### 3. Global Access
After initialization, the instance is available globally:
```javascript
// Access the instance anywhere in your app
const memberstack = window.$memberstackDom;
```

### 4. Promise-Based API
All methods return promises for async operations:
```javascript
try {
  const result = await memberstack.loginMemberEmailPassword({
    email: 'user@example.com',
    password: 'password'
  });
  console.log('Login successful:', result.data.member);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

## Quick Start Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Memberstack Quick Start</title>
</head>
<body>
  <!-- Login Form -->
  <div id="login-form" style="display: none;">
    <h2>Login</h2>
    <form id="login">
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
    <button onclick="memberstack.openModal('SIGNUP')">Sign Up</button>
  </div>

  <!-- Member Dashboard -->
  <div id="member-dashboard" style="display: none;">
    <h2>Welcome!</h2>
    <p>Email: <span id="member-email"></span></p>
    <button onclick="memberstack.openModal('PROFILE')">Edit Profile</button>
    <button onclick="logout()">Logout</button>
  </div>

  <script src="https://api.memberstack.com/static/memberstack-dom.js"></script>
  <script>
    // Initialize Memberstack
    const memberstack = window.MemberstackDom.init({
      publicKey: 'pk_sb_your-public-key',
      useCookies: true
    });

    // Handle authentication state changes
    memberstack.onAuthChange(({ member }) => {
      const loginForm = document.getElementById('login-form');
      const dashboard = document.getElementById('member-dashboard');
      
      if (member) {
        // User is logged in
        loginForm.style.display = 'none';
        dashboard.style.display = 'block';
        document.getElementById('member-email').textContent = member.email;
      } else {
        // User is logged out
        loginForm.style.display = 'block';
        dashboard.style.display = 'none';
      }
    });

    // Handle login form submission
    document.getElementById('login').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        await memberstack.loginMemberEmailPassword({ email, password });
        // onAuthChange callback will handle UI updates
      } catch (error) {
        alert('Login failed: ' + error.message);
      }
    });

    // Logout function
    async function logout() {
      try {
        await memberstack.logout();
        // onAuthChange callback will handle UI updates
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
  </script>
</body>
</html>
```

## Common Patterns

### Authentication Flow
```javascript
// 1. Check if user is already logged in
const currentMember = await memberstack.getCurrentMember();

if (currentMember.data) {
  // User is authenticated
  console.log('Welcome back!', currentMember.data.email);
} else {
  // User needs to login
  memberstack.openModal('LOGIN');
}

// 2. Listen for auth changes
memberstack.onAuthChange(({ member }) => {
  if (member) {
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } else {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

### Plan Purchase Flow
```javascript
// 1. Get available plans
const plans = await memberstack.getPlans();

// 2. Show pricing to user, then purchase
await memberstack.purchasePlansWithCheckout({
  priceId: 'price_1234567890',
  successUrl: '/dashboard?success=true',
  cancelUrl: '/pricing?cancelled=true'
});
```

### Error Handling Pattern
```javascript
async function handleMemberstackOperation(operation) {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    console.error('Memberstack error:', error);
    
    // Handle common error types
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return { success: false, message: 'Invalid email or password' };
      case 'MEMBER_NOT_VERIFIED':
        return { success: false, message: 'Please verify your email' };
      case 'PLAN_REQUIRED':
        return { success: false, message: 'This feature requires a subscription' };
      default:
        return { success: false, message: error.message };
    }
  }
}
```

## API Method Categories

| Category | Methods | Description |
|----------|---------|-------------|
| **Initialization** | `init()` | Setup and configuration |
| **Authentication** | `loginMemberEmailPassword()`, `signupMemberEmailPassword()`, `logout()`, `loginWithProvider()` | Member authentication |
| **Member Management** | `getCurrentMember()`, `updateMember()`, `updateMemberAuth()` | Member data operations |
| **Plan Management** | `getPlans()`, `addPlan()`, `purchasePlansWithCheckout()`, `launchStripeCustomerPortal()` | Subscription operations |
| **UI Components** | `openModal()`, `hideModal()` | Pre-built UI elements |
| **Member Journey** | `sendMemberVerificationEmail()`, `resetMemberPassword()`, `onAuthChange()` | Email flows and callbacks |
| **Advanced Features** | `getSecureContent()`, `createPost()`, `joinTeam()` | Comments, teams, secure content |

## Next Steps

1. **[01-initialization.md](01-initialization.md)** - Detailed setup and configuration options
2. **[02-authentication.md](02-authentication.md)** - Complete authentication methods
3. **[03-member-management.md](03-member-management.md)** - Member data operations
4. **[04-plan-management.md](04-plan-management.md)** - Subscription and billing
5. **[10-examples.md](10-examples.md)** - Complete implementation examples

## Support Resources

- **Memberstack Dashboard**: Configure your app settings
- **Error Codes**: See [09-error-handling.md](09-error-handling.md)
- **TypeScript Definitions**: See [08-types-reference.md](08-types-reference.md)
- **Advanced Features**: See [07-advanced-features.md](07-advanced-features.md)# Memberstack DOM - Initialization & Configuration

## AI Assistant Instructions
When helping with Memberstack initialization:
- Always include `publicKey` - it's required
- Use `useCookies: true` for web apps (recommended)
- Show both CDN and NPM usage patterns
- Include error handling for initialization failures
- Reference environment-specific endpoints when needed

## Overview

The Memberstack DOM package must be initialized before any other methods can be used. Initialization creates a global instance and configures authentication settings.

## Basic Initialization

### CDN Method (Recommended)
```javascript
// Initialize with minimal configuration
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-public-key-here'
});

// The instance is now available globally
console.log(window.$memberstackDom); // Same as memberstack variable
```

### NPM/ES Module Method
```javascript
import MemberstackDom from '@memberstack/dom';

const memberstack = MemberstackDom.init({
  publicKey: 'pk_sb_your-public-key-here'
});

export default memberstack;
```

## Configuration Options

### Complete Configuration Interface
```typescript
interface DOMConfig {
  publicKey: string;                    // Required: Your Memberstack public key
  appId?: string;                      // Optional: Specific app ID
  useCookies?: boolean;                // Optional: Enable cookie storage (default: false)
  setCookieOnRootDomain?: boolean;     // Optional: Set cookies on root domain (default: false)  
  domain?: string;                     // Optional: Custom API domain
}
```

### Configuration Examples

#### Production Configuration
```javascript
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_prod_your-production-key',
  useCookies: true,
  setCookieOnRootDomain: true
});
```

#### Development Configuration  
```javascript
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-sandbox-key',
  useCookies: true,
  domain: 'https://api-dev.memberstack.com' // Custom endpoint
});
```

#### Multi-App Configuration
```javascript
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  appId: 'app_specific_id_here',
  useCookies: true
});
```

## Configuration Details

### publicKey (Required)
Your Memberstack public key from the dashboard.

```javascript
// Sandbox key format
publicKey: 'pk_sb_1234567890abcdef'

// Production key format  
publicKey: 'pk_prod_1234567890abcdef'
```

**Finding Your Public Key:**
1. Login to Memberstack Dashboard
2. Go to Settings → API Keys
3. Copy the "Public Key" (starts with `pk_`)

### useCookies (Recommended: true)
Enables cookie-based authentication storage for better cross-tab sync.

```javascript
// Enable cookies (recommended for web apps)
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  useCookies: true
});
```

**Benefits of cookies:**
- Automatic authentication across browser tabs
- Persistent login across browser sessions
- Better security than localStorage for tokens

### setCookieOnRootDomain
Sets authentication cookies on the root domain for subdomain sharing.

```javascript
// For apps with multiple subdomains (app.example.com, api.example.com)
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  useCookies: true,
  setCookieOnRootDomain: true // Cookies work across *.example.com
});
```

### domain (Custom API Endpoint)
Override the default API endpoint for development or custom deployments.

```javascript
// Development environment
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  domain: 'https://api-dev.memberstack.com'
});

// Custom endpoint
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key', 
  domain: 'https://your-custom-api.com'
});
```

## Initialization Patterns

### Basic Web App
```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <script src="https://api.memberstack.com/static/memberstack-dom.js"></script>
  <script>
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
      const memberstack = window.MemberstackDom.init({
        publicKey: 'pk_sb_your-key',
        useCookies: true
      });
      
      // Setup auth state listener
      memberstack.onAuthChange(({ member }) => {
        console.log('Auth state changed:', member ? 'logged in' : 'logged out');
      });
    });
  </script>
</body>
</html>
```

### React App
```jsx
// services/memberstack.js
import MemberstackDom from '@memberstack/dom';

let memberstack = null;

export const initMemberstack = () => {
  if (!memberstack) {
    memberstack = MemberstackDom.init({
      publicKey: process.env.REACT_APP_MEMBERSTACK_PUBLIC_KEY,
      useCookies: true
    });
  }
  return memberstack;
};

export const getMemberstack = () => {
  if (!memberstack) {
    throw new Error('Memberstack not initialized. Call initMemberstack() first.');
  }
  return memberstack;
};

// App.jsx
import { useEffect } from 'react';
import { initMemberstack } from './services/memberstack';

function App() {
  useEffect(() => {
    const memberstack = initMemberstack();
    
    memberstack.onAuthChange(({ member }) => {
      // Handle auth state changes
      console.log('Member:', member);
    });
  }, []);
  
  return <div>My App</div>;
}
```

### Next.js App
```javascript
// lib/memberstack.js
import MemberstackDom from '@memberstack/dom';

let memberstack = null;

export const initMemberstack = () => {
  // Only initialize in browser environment
  if (typeof window !== 'undefined' && !memberstack) {
    memberstack = MemberstackDom.init({
      publicKey: process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY,
      useCookies: true
    });
  }
  return memberstack;
};

// pages/_app.js
import { useEffect } from 'react';
import { initMemberstack } from '../lib/memberstack';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initMemberstack();
  }, []);
  
  return <Component {...pageProps} />;
}
```

### Vue.js App
```javascript
// plugins/memberstack.js
import MemberstackDom from '@memberstack/dom';

let memberstack = null;

export const initMemberstack = () => {
  if (!memberstack) {
    memberstack = MemberstackDom.init({
      publicKey: process.env.VUE_APP_MEMBERSTACK_PUBLIC_KEY,
      useCookies: true
    });
  }
  return memberstack;
};

// main.js
import { createApp } from 'vue';
import App from './App.vue';
import { initMemberstack } from './plugins/memberstack';

const app = createApp(App);

// Initialize Memberstack
initMemberstack();

app.mount('#app');
```

## Environment Configuration

### Environment Variables
Store your public keys in environment variables:

```bash
# .env file
MEMBERSTACK_PUBLIC_KEY_SANDBOX=pk_sb_your-sandbox-key
MEMBERSTACK_PUBLIC_KEY_PRODUCTION=pk_prod_your-production-key
```

```javascript
// Environment-based initialization
const memberstack = window.MemberstackDom.init({
  publicKey: process.env.NODE_ENV === 'production'
    ? process.env.MEMBERSTACK_PUBLIC_KEY_PRODUCTION
    : process.env.MEMBERSTACK_PUBLIC_KEY_SANDBOX,
  useCookies: true
});
```

### Multi-Environment Setup
```javascript
const environments = {
  development: {
    publicKey: 'pk_sb_dev-key',
    domain: 'https://api-dev.memberstack.com'
  },
  staging: {
    publicKey: 'pk_sb_staging-key',
    domain: 'https://api-staging.memberstack.com'
  },
  production: {
    publicKey: 'pk_prod_production-key'
  }
};

const config = environments[process.env.NODE_ENV] || environments.development;

const memberstack = window.MemberstackDom.init({
  ...config,
  useCookies: true
});
```

## Error Handling

### Initialization Error Handling
```javascript
try {
  const memberstack = window.MemberstackDom.init({
    publicKey: 'pk_sb_your-key',
    useCookies: true
  });
  
  console.log('Memberstack initialized successfully');
} catch (error) {
  console.error('Memberstack initialization failed:', error);
  
  // Handle specific errors
  if (error.message.includes('Invalid public key')) {
    alert('Configuration error: Invalid Memberstack public key');
  } else {
    alert('Failed to initialize authentication system');
  }
}
```

### Async Initialization Check
```javascript
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  useCookies: true
});

// Wait for initialization to complete
async function waitForMemberstack() {
  let retries = 0;
  const maxRetries = 10;
  
  while (!window.$memberstackDom && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (!window.$memberstackDom) {
    throw new Error('Memberstack initialization timeout');
  }
  
  return window.$memberstackDom;
}

// Usage
try {
  const memberstack = await waitForMemberstack();
  console.log('Memberstack ready:', memberstack);
} catch (error) {
  console.error('Memberstack initialization failed:', error);
}
```

## Validation & Testing

### Check Initialization Success
```javascript
function validateMemberstackInit() {
  // Check global instance exists
  if (!window.$memberstackDom) {
    throw new Error('Memberstack not initialized');
  }
  
  // Check required methods exist
  const requiredMethods = [
    'loginMemberEmailPassword',
    'getCurrentMember',
    'logout',
    'onAuthChange'
  ];
  
  for (const method of requiredMethods) {
    if (typeof window.$memberstackDom[method] !== 'function') {
      throw new Error(`Memberstack method ${method} not available`);
    }
  }
  
  console.log('✅ Memberstack validation passed');
  return true;
}

// Run validation after init
const memberstack = window.MemberstackDom.init({
  publicKey: 'pk_sb_your-key',
  useCookies: true
});

try {
  validateMemberstackInit();
} catch (error) {
  console.error('❌ Memberstack validation failed:', error);
}
```

### Test Connection
```javascript
async function testMemberstackConnection() {
  try {
    // Test with a simple API call
    const result = await window.$memberstackDom.getApp();
    console.log('✅ Connection test passed:', result.data.name);
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

// Run connection test
testMemberstackConnection();
```

## Troubleshooting

### Common Issues

**"Memberstack is not defined"**
```javascript
// ❌ Wrong - Memberstack not loaded yet
const memberstack = window.MemberstackDom.init({ ... });

// ✅ Correct - Wait for script to load
document.addEventListener('DOMContentLoaded', function() {
  const memberstack = window.MemberstackDom.init({ ... });
});
```

**"Invalid public key"**  
```javascript
// ❌ Wrong - Missing pk_ prefix
publicKey: 'sb_1234567890abcdef'

// ✅ Correct - Include full key
publicKey: 'pk_sb_1234567890abcdef'
```

**Cookies not working across subdomains**
```javascript
// ❌ Wrong - Root domain not enabled
useCookies: true

// ✅ Correct - Enable root domain cookies
useCookies: true,
setCookieOnRootDomain: true
```

## Next Steps

- **[02-authentication.md](02-authentication.md)** - Authentication methods after initialization
- **[06-member-journey.md](06-member-journey.md)** - Setting up authentication state listeners
- **[09-error-handling.md](09-error-handling.md)** - Comprehensive error handling
- **[10-examples.md](10-examples.md)** - Complete app examples with initialization# Memberstack DOM - Authentication Methods

## AI Assistant Instructions
When implementing Memberstack authentication:
- Always include error handling with try/catch blocks
- Use `onAuthChange()` callback for reactive UI updates
- Include token/session management automatically (handled by SDK)
- Show both programmatic and modal-based authentication
- Reference specific error codes from 09-error-handling.md

## Overview

Memberstack DOM provides comprehensive authentication methods including email/password, passwordless login, social authentication, and pre-built UI modals.

## Email & Password Authentication

### loginMemberEmailPassword()
Authenticate a member using email and password credentials.

**Method Signature:**
```typescript
await memberstack.loginMemberEmailPassword({
  email: string;
  password: string;
}): Promise<LoginMemberEmailPasswordPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | ✅ | Member's email address |
| password | string | ✅ | Member's password |

**Response:**
```typescript
{
  data: {
    member: {
      id: string;
      email: string;
      verified: boolean;
      customFields: Record<string, any>;
      planConnections: Array<PlanConnection>;
      // ... additional member properties
    };
    tokens: {
      accessToken: string;
      expires: number; // Unix timestamp
    };
  }
}
```

**Examples:**

Basic Login:
```javascript
const memberstack = window.$memberstackDom;

async function loginUser(email, password) {
  try {
    const result = await memberstack.loginMemberEmailPassword({
      email,
      password
    });
    
    console.log('Login successful:', result.data.member);
    
    // Redirect to dashboard
    window.location.href = '/dashboard';
    
    return result.data.member;
  } catch (error) {
    console.error('Login failed:', error);
    throw new Error(`Login failed: ${error.message}`);
  }
}

// Usage
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const email = formData.get('email');
  const password = formData.get('password');
  
  try {
    await loginUser(email, password);
  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
  }
});
```

With Advanced Error Handling:
```javascript
async function loginWithErrorHandling(email, password) {
  try {
    const result = await memberstack.loginMemberEmailPassword({
      email: email.trim().toLowerCase(),
      password
    });
    
    // Success - member is automatically set in global state
    return {
      success: true,
      member: result.data.member,
      message: 'Login successful!'
    };
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific error cases
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return {
          success: false,
          message: 'Invalid email or password. Please try again.'
        };
      case 'MEMBER_NOT_VERIFIED':
        return {
          success: false,
          message: 'Please verify your email address first.',
          showVerificationOption: true
        };
      case 'ACCOUNT_LOCKED':
        return {
          success: false,
          message: 'Account temporarily locked due to too many failed attempts.'
        };
      default:
        return {
          success: false,
          message: 'Login failed. Please try again later.'
        };
    }
  }
}
```

### signupMemberEmailPassword()
Create a new member account with email and password.

**Method Signature:**
```typescript
await memberstack.signupMemberEmailPassword({
  email: string;
  password: string;
  customFields?: Record<string, any>;
  plans?: Array<{ planId: string }>;
  captchaToken?: string;
  inviteToken?: string;
  metaData?: Record<string, any>;
}): Promise<SignupMemberEmailPasswordPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | ✅ | Member's email address |
| password | string | ✅ | Member's password |
| customFields | object | ❌ | Additional member data |
| plans | Array | ❌ | Free plans to assign |
| captchaToken | string | ❌ | hCaptcha token |
| inviteToken | string | ❌ | Team invitation token |
| metaData | object | ❌ | Internal metadata |

**Examples:**

Basic Signup:
```javascript
async function signupUser(formData) {
  try {
    const result = await memberstack.signupMemberEmailPassword({
      email: formData.email,
      password: formData.password
    });
    
    console.log('Signup successful:', result.data.member);
    
    // Show verification message if email verification is required
    if (!result.data.member.verified) {
      alert('Please check your email to verify your account.');
    }
    
    return result.data.member;
  } catch (error) {
    console.error('Signup failed:', error);
    throw error;
  }
}
```

Signup with Custom Fields:
```javascript
async function signupWithProfile(userData) {
  try {
    const result = await memberstack.signupMemberEmailPassword({
      email: userData.email,
      password: userData.password,
      customFields: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        company: userData.company,
        phone: userData.phone,
        source: 'website_signup',
        signupDate: new Date().toISOString()
      }
    });
    
    // Member is automatically logged in after signup
    console.log('New member created:', result.data.member);
    
    return result;
  } catch (error) {
    // Handle signup-specific errors
    if (error.code === 'EMAIL_ALREADY_EXISTS') {
      throw new Error('An account with this email already exists. Try logging in instead.');
    } else if (error.code === 'WEAK_PASSWORD') {
      throw new Error('Password must be at least 8 characters with numbers and letters.');
    }
    throw error;
  }
}
```

Signup with Plan Assignment:
```javascript
async function signupWithFreePlan(userData, planId) {
  try {
    const result = await memberstack.signupMemberEmailPassword({
      email: userData.email,
      password: userData.password,
      customFields: userData.customFields,
      plans: [{ planId: planId }] // Assign free plan during signup
    });
    
    console.log('Member signed up with plan:', result.data.member.planConnections);
    
    return result;
  } catch (error) {
    if (error.code === 'PLAN_NOT_FREE') {
      throw new Error('Only free plans can be assigned during signup.');
    }
    throw error;
  }
}
```

### logout()
Log out the current member and clear authentication tokens.

**Method Signature:**
```typescript
await memberstack.logout(): Promise<LogoutMemberPayload>
```

**Examples:**

Basic Logout:
```javascript
async function logoutUser() {
  try {
    await memberstack.logout();
    console.log('Logout successful');
    
    // Redirect to home page
    window.location.href = '/';
  } catch (error) {
    console.error('Logout failed:', error);
    // Even if logout API fails, clear local state
    window.location.href = '/';
  }
}

// Logout button handler
document.getElementById('logout-btn').addEventListener('click', logoutUser);
```

With Confirmation:
```javascript
async function logoutWithConfirmation() {
  const confirmed = confirm('Are you sure you want to log out?');
  
  if (confirmed) {
    try {
      const result = await memberstack.logout();
      
      // Handle optional redirect from server
      if (result.data.redirect) {
        window.location.href = result.data.redirect;
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even on error
      window.location.href = '/login';
    }
  }
}
```

## Passwordless Authentication

### sendMemberLoginPasswordlessEmail()
Send a passwordless login email to a member.

**Method Signature:**
```typescript
await memberstack.sendMemberLoginPasswordlessEmail({
  email: string;
}): Promise<SendMemberLoginPasswordlessEmailPayload>
```

**Example:**
```javascript
async function sendPasswordlessLogin(email) {
  try {
    const result = await memberstack.sendMemberLoginPasswordlessEmail({
      email: email.trim().toLowerCase()
    });
    
    console.log('Passwordless email sent:', result.data);
    
    return {
      success: true,
      message: 'Check your email for a login link!'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send login email. Please try again.'
    };
  }
}
```

### loginMemberPasswordless()
Complete passwordless login using token from email.

**Method Signature:**
```typescript
await memberstack.loginMemberPasswordless({
  passwordlessToken: string;
  email: string;
}): Promise<LoginMemberEmailPasswordPayload>
```

**Example:**
```javascript
// Typically called from passwordless login page
async function handlePasswordlessLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');
  
  if (!token || !email) {
    alert('Invalid login link');
    window.location.href = '/login';
    return;
  }
  
  try {
    const result = await memberstack.loginMemberPasswordless({
      passwordlessToken: token,
      email: email
    });
    
    console.log('Passwordless login successful:', result.data.member);
    window.location.href = '/dashboard';
    
  } catch (error) {
    console.error('Passwordless login failed:', error);
    alert('Login link expired or invalid. Please try again.');
    window.location.href = '/login';
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', handlePasswordlessLogin);
```

## Social Authentication

### loginWithProvider()
Authenticate using social providers (Google, Facebook, etc.).

**Method Signature:**
```typescript
await memberstack.loginWithProvider({
  provider: string;
  allowSignup?: boolean;
}): Promise<void> // Opens popup, returns via callback
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| provider | string | ✅ | 'GOOGLE' or 'FACEBOOK' |
| allowSignup | boolean | ❌ | Allow new account creation |

**Example:**
```javascript
async function loginWithGoogle() {
  try {
    // This opens a popup window
    await memberstack.loginWithProvider({
      provider: 'GOOGLE',
      allowSignup: true // Allow new users to sign up
    });
    
    // Success is handled by onAuthChange callback
    console.log('Google login initiated');
  } catch (error) {
    console.error('Social login failed:', error);
    alert('Social login failed. Please try again.');
  }
}

// Social login buttons
document.getElementById('google-login').addEventListener('click', loginWithGoogle);

document.getElementById('facebook-login').addEventListener('click', async () => {
  try {
    await memberstack.loginWithProvider({
      provider: 'FACEBOOK',
      allowSignup: false // Only allow existing users
    });
  } catch (error) {
    console.error('Facebook login failed:', error);
  }
});
```

### signupWithProvider()
Create new account using social providers.

**Method Signature:**
```typescript
await memberstack.signupWithProvider({
  provider: string;
  customFields?: Record<string, any>;
  plans?: Array<{ planId: string }>;
  allowLogin?: boolean;
}): Promise<void>
```

**Example:**
```javascript
async function signupWithGoogle(customFields = {}) {
  try {
    await memberstack.signupWithProvider({
      provider: 'GOOGLE',
      allowLogin: true, // Allow login if account exists
      customFields: {
        source: 'google_signup',
        ...customFields
      }
    });
    
    console.log('Google signup initiated');
  } catch (error) {
    console.error('Google signup failed:', error);
  }
}
```

## Authentication State Management

### onAuthChange()
Listen for authentication state changes (login, logout, data updates).

**Method Signature:**
```typescript
memberstack.onAuthChange(({ member }) => void): void
```

**Examples:**

Basic Auth State Listener:
```javascript
memberstack.onAuthChange(({ member }) => {
  if (member) {
    console.log('User logged in:', member.email);
    
    // Update UI for authenticated state
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('member-section').style.display = 'block';
    document.getElementById('member-email').textContent = member.email;
    
    // Show member-specific content
    updateMemberUI(member);
  } else {
    console.log('User logged out');
    
    // Update UI for unauthenticated state  
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('member-section').style.display = 'none';
    
    // Clear sensitive data
    clearMemberUI();
  }
});
```

Advanced Auth Handler:
```javascript
memberstack.onAuthChange(({ member }) => {
  updateAuthenticationUI(member);
  updateNavigationMenu(member);
  handleRouteAccess(member);
  updatePlanAccessUI(member);
});

function updateAuthenticationUI(member) {
  const elements = {
    loginBtn: document.getElementById('login-btn'),
    signupBtn: document.getElementById('signup-btn'), 
    logoutBtn: document.getElementById('logout-btn'),
    profileBtn: document.getElementById('profile-btn'),
    memberName: document.getElementById('member-name')
  };
  
  if (member) {
    // Show authenticated UI
    elements.loginBtn?.classList.add('hidden');
    elements.signupBtn?.classList.add('hidden');
    elements.logoutBtn?.classList.remove('hidden');
    elements.profileBtn?.classList.remove('hidden');
    
    if (elements.memberName) {
      elements.memberName.textContent = member.customFields?.firstName || member.email;
    }
  } else {
    // Show unauthenticated UI
    elements.loginBtn?.classList.remove('hidden');
    elements.signupBtn?.classList.remove('hidden');
    elements.logoutBtn?.classList.add('hidden');
    elements.profileBtn?.classList.add('hidden');
  }
}

function handleRouteAccess(member) {
  const currentPath = window.location.pathname;
  const protectedRoutes = ['/dashboard', '/profile', '/billing', '/admin'];
  const authRoutes = ['/login', '/signup'];
  
  // Redirect unauthenticated users from protected routes
  if (!member && protectedRoutes.some(route => currentPath.startsWith(route))) {
    window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
  }
  
  // Redirect authenticated users away from auth routes
  if (member && authRoutes.includes(currentPath)) {
    const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
    window.location.href = redirectUrl || '/dashboard';
  }
}

function updatePlanAccessUI(member) {
  const premiumElements = document.querySelectorAll('[data-plan-required]');
  
  premiumElements.forEach(element => {
    const requiredPlan = element.dataset.planRequired;
    const hasAccess = member?.planConnections?.some(pc => 
      pc.planId === requiredPlan && pc.status === 'ACTIVE'
    );
    
    if (hasAccess) {
      element.classList.remove('plan-locked');
    } else {
      element.classList.add('plan-locked');
    }
  });
}
```

## Complete Authentication Flow Example

```javascript
class MemberstackAuth {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentMember = null;
    this.setupAuthListener();
    this.setupEventListeners();
  }
  
  setupAuthListener() {
    this.memberstack.onAuthChange(({ member }) => {
      this.currentMember = member;
      this.handleAuthStateChange(member);
    });
  }
  
  setupEventListeners() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin(e);
    });
    
    // Signup form
    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup(e);
    });
    
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.handleLogout();
    });
    
    // Social login buttons
    document.getElementById('google-login')?.addEventListener('click', () => {
      this.handleSocialLogin('GOOGLE');
    });
  }
  
  async handleLogin(event) {
    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    this.setLoading('login-form', true);
    this.clearErrors();
    
    try {
      await this.memberstack.loginMemberEmailPassword({ email, password });
      // Auth state change will handle UI updates
    } catch (error) {
      this.showError('login-error', this.getErrorMessage(error));
    } finally {
      this.setLoading('login-form', false);
    }
  }
  
  async handleSignup(event) {
    const formData = new FormData(event.target);
    const userData = {
      email: formData.get('email'),
      password: formData.get('password'),
      customFields: {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName')
      }
    };
    
    this.setLoading('signup-form', true);
    this.clearErrors();
    
    try {
      await this.memberstack.signupMemberEmailPassword(userData);
      // Show verification message if needed
    } catch (error) {
      this.showError('signup-error', this.getErrorMessage(error));
    } finally {
      this.setLoading('signup-form', false);
    }
  }
  
  async handleLogout() {
    try {
      await this.memberstack.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout locally
      window.location.href = '/';
    }
  }
  
  async handleSocialLogin(provider) {
    try {
      await this.memberstack.loginWithProvider({
        provider,
        allowSignup: true
      });
    } catch (error) {
      this.showError('social-error', 'Social login failed. Please try again.');
    }
  }
  
  handleAuthStateChange(member) {
    this.updateUI(member);
    this.handleRedirects(member);
  }
  
  updateUI(member) {
    // Update authentication UI elements
    document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
      el.style.display = member ? 'none' : 'block';
    });
    
    document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
      el.style.display = member ? 'block' : 'none';
    });
    
    // Update member-specific content
    if (member) {
      document.querySelectorAll('[data-member="email"]').forEach(el => {
        el.textContent = member.email;
      });
      
      document.querySelectorAll('[data-member="name"]').forEach(el => {
        el.textContent = member.customFields?.firstName || member.email.split('@')[0];
      });
    }
  }
  
  handleRedirects(member) {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    if (member && ['/login', '/signup'].includes(currentPath)) {
      // Redirect authenticated users away from auth pages
      const redirect = urlParams.get('redirect') || '/dashboard';
      window.location.href = redirect;
    } else if (!member && this.isProtectedRoute(currentPath)) {
      // Redirect unauthenticated users to login
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
  
  isProtectedRoute(path) {
    const protectedRoutes = ['/dashboard', '/profile', '/billing', '/settings'];
    return protectedRoutes.some(route => path.startsWith(route));
  }
  
  getErrorMessage(error) {
    const errorMessages = {
      'INVALID_CREDENTIALS': 'Invalid email or password',
      'EMAIL_ALREADY_EXISTS': 'An account with this email already exists',
      'WEAK_PASSWORD': 'Password must be stronger',
      'MEMBER_NOT_VERIFIED': 'Please verify your email address'
    };
    
    return errorMessages[error.code] || error.message || 'An error occurred';
  }
  
  setLoading(formId, loading) {
    const form = document.getElementById(formId);
    const submitBtn = form?.querySelector('button[type="submit"]');
    
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Loading...' : submitBtn.dataset.originalText || 'Submit';
      
      if (!submitBtn.dataset.originalText) {
        submitBtn.dataset.originalText = submitBtn.textContent;
      }
    }
  }
  
  showError(errorId, message) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }
  
  clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// Initialize authentication handling
document.addEventListener('DOMContentLoaded', () => {
  new MemberstackAuth();
});
```

## Next Steps

- **[03-member-management.md](03-member-management.md)** - Managing member data after authentication
- **[05-ui-components.md](05-ui-components.md)** - Using pre-built authentication modals
- **[06-member-journey.md](06-member-journey.md)** - Email verification and password reset flows
- **[09-error-handling.md](09-error-handling.md)** - Complete authentication error reference# Memberstack DOM - Member Management

## AI Assistant Instructions
When implementing member management:
- Use `getCurrentMember()` to check authentication before operations
- Include `useCache: true` for frequent member data access
- Handle custom fields with proper validation
- Show authentication updates (email/password) separately from profile updates
- Include member JSON operations for advanced use cases

## Overview

Member management in Memberstack DOM includes retrieving current member data, updating profiles, managing authentication credentials, and handling custom member information.

## Getting Member Information

### getCurrentMember()
Retrieve the currently authenticated member's information.

**Method Signature:**
```typescript
await memberstack.getCurrentMember({
  useCache?: boolean;
}): Promise<GetCurrentMemberPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| useCache | boolean | ❌ | Use cached data (faster) vs fresh data from server |

**Response:**
```typescript
{
  data: {
    id: string;
    email: string;
    verified: boolean;
    loginRedirectUrl: string | null;
    customFields: Record<string, any>;
    profileImage: string | null;
    metaData: Record<string, any>;
    planConnections: Array<{
      id: string;
      planId: string;
      status: "ACTIVE" | "CANCELLED" | "PAST_DUE";
      createdAt: string;
      // ... additional plan connection properties
    }>;
  } | null; // null if no member is authenticated
}
```

**Examples:**

Check Current Member:
```javascript
async function getCurrentMember() {
  try {
    const result = await memberstack.getCurrentMember();
    
    if (result.data) {
      console.log('Member is logged in:', result.data.email);
      return result.data;
    } else {
      console.log('No member logged in');
      return null;
    }
  } catch (error) {
    console.error('Failed to get current member:', error);
    return null;
  }
}

// Usage
const member = await getCurrentMember();
if (member) {
  document.getElementById('welcome-message').textContent = 
    `Welcome back, ${member.customFields?.firstName || member.email}!`;
}
```

Using Cache for Performance:
```javascript
// Fast cached access (use for frequent checks)
const cachedMember = await memberstack.getCurrentMember({ useCache: true });

// Fresh data from server (use when you need up-to-date info)
const freshMember = await memberstack.getCurrentMember({ useCache: false });

// Practical usage pattern
async function getMemberWithFallback() {
  // Try cached first for speed
  let member = await memberstack.getCurrentMember({ useCache: true });
  
  // If no cached data, get fresh data
  if (!member.data) {
    member = await memberstack.getCurrentMember({ useCache: false });
  }
  
  return member.data;
}
```

Member Profile Component:
```javascript
async function loadMemberProfile() {
  const loadingEl = document.getElementById('profile-loading');
  const profileEl = document.getElementById('member-profile');
  
  try {
    loadingEl.style.display = 'block';
    
    const result = await memberstack.getCurrentMember();
    
    if (result.data) {
      displayMemberProfile(result.data);
    } else {
      // Redirect to login
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
    document.getElementById('profile-error').style.display = 'block';
  } finally {
    loadingEl.style.display = 'none';
  }
}

function displayMemberProfile(member) {
  const profileEl = document.getElementById('member-profile');
  
  profileEl.innerHTML = `
    <div class="profile-header">
      <img src="${member.profileImage || '/default-avatar.png'}" alt="Profile" class="profile-image">
      <div class="profile-info">
        <h2>${member.customFields?.firstName || 'Member'} ${member.customFields?.lastName || ''}</h2>
        <p class="email">${member.email}</p>
        ${!member.verified ? '<span class="unverified">Email not verified</span>' : ''}
      </div>
    </div>
    
    <div class="profile-details">
      <div class="field">
        <label>Member ID:</label>
        <span>${member.id}</span>
      </div>
      
      <div class="field">
        <label>Company:</label>
        <span>${member.customFields?.company || 'Not provided'}</span>
      </div>
      
      <div class="field">
        <label>Phone:</label>
        <span>${member.customFields?.phone || 'Not provided'}</span>
      </div>
      
      <div class="field">
        <label>Active Plans:</label>
        <span>${member.planConnections?.filter(pc => pc.status === 'ACTIVE').length || 0}</span>
      </div>
    </div>
  `;
  
  profileEl.style.display = 'block';
}
```

## Updating Member Information

### updateMember()
Update the current member's custom fields and profile information.

**Method Signature:**
```typescript
await memberstack.updateMember({
  customFields?: Record<string, any>;
}): Promise<UpdateMemberPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customFields | object | ❌ | Custom fields to update |

**Response:**
```typescript
{
  data: {
    id: string;
    email: string;
    customFields: Record<string, any>;
    verified: boolean;
    profileImage: string | null;
    // ... other member properties
  }
}
```

**Examples:**

Basic Profile Update:
```javascript
async function updateProfile(formData) {
  try {
    const result = await memberstack.updateMember({
      customFields: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        phone: formData.phone,
        bio: formData.bio,
        preferences: {
          newsletter: formData.newsletter,
          notifications: formData.notifications
        }
      }
    });
    
    console.log('Profile updated:', result.data);
    
    return {
      success: true,
      message: 'Profile updated successfully!',
      member: result.data
    };
  } catch (error) {
    console.error('Profile update failed:', error);
    
    return {
      success: false,
      message: 'Failed to update profile. Please try again.'
    };
  }
}

// Form handler
document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const profileData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    company: formData.get('company'),
    phone: formData.get('phone'),
    bio: formData.get('bio'),
    newsletter: formData.get('newsletter') === 'on',
    notifications: formData.get('notifications') === 'on'
  };
  
  const result = await updateProfile(profileData);
  
  if (result.success) {
    document.getElementById('success-message').textContent = result.message;
    document.getElementById('success-message').style.display = 'block';
  } else {
    document.getElementById('error-message').textContent = result.message;
    document.getElementById('error-message').style.display = 'block';
  }
});
```

Incremental Field Updates:
```javascript
async function updateSingleField(fieldName, value) {
  try {
    // Get current member to preserve existing fields
    const currentMember = await memberstack.getCurrentMember();
    
    if (!currentMember.data) {
      throw new Error('No member logged in');
    }
    
    const result = await memberstack.updateMember({
      customFields: {
        ...currentMember.data.customFields,
        [fieldName]: value,
        lastUpdated: new Date().toISOString()
      }
    });
    
    console.log(`Updated ${fieldName}:`, value);
    return result.data;
  } catch (error) {
    console.error(`Failed to update ${fieldName}:`, error);
    throw error;
  }
}

// Usage examples
await updateSingleField('company', 'New Company Name');
await updateSingleField('preferences', { theme: 'dark', language: 'en' });
```

Complex Profile Update with Validation:
```javascript
class ProfileManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
  }
  
  async updateProfile(profileData) {
    // Validate data before sending
    const validation = this.validateProfileData(profileData);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Get current member to merge with updates
    const currentMember = await this.memberstack.getCurrentMember();
    if (!currentMember.data) {
      throw new Error('No member authenticated');
    }
    
    const updatedFields = {
      ...currentMember.data.customFields,
      ...profileData,
      lastProfileUpdate: new Date().toISOString()
    };
    
    try {
      const result = await this.memberstack.updateMember({
        customFields: updatedFields
      });
      
      // Trigger UI updates
      this.onProfileUpdated(result.data);
      
      return result.data;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error('Failed to update profile. Please try again.');
    }
  }
  
  validateProfileData(data) {
    if (data.email && !this.isValidEmail(data.email)) {
      return { valid: false, message: 'Invalid email format' };
    }
    
    if (data.phone && !this.isValidPhone(data.phone)) {
      return { valid: false, message: 'Invalid phone number format' };
    }
    
    if (data.firstName && data.firstName.length > 50) {
      return { valid: false, message: 'First name too long' };
    }
    
    return { valid: true };
  }
  
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  isValidPhone(phone) {
    return /^\+?[\d\s\-\(\)]+$/.test(phone);
  }
  
  onProfileUpdated(member) {
    // Update UI elements
    document.querySelectorAll('[data-member-field]').forEach(el => {
      const field = el.dataset.memberField;
      const value = this.getNestedValue(member.customFields, field);
      if (value !== undefined) {
        el.textContent = value;
      }
    });
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('memberProfileUpdated', {
      detail: { member }
    }));
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

const profileManager = new ProfileManager();
```

### updateMemberProfileImage()
Update the member's profile image.

**Method Signature:**
```typescript
await memberstack.updateMemberProfileImage({
  profileImage: File;
}): Promise<UpdateMemberProfileImagePayload>
```

**Example:**
```javascript
async function updateProfileImage(imageFile) {
  try {
    // Validate file
    if (!imageFile || !imageFile.type.startsWith('image/')) {
      throw new Error('Please select a valid image file');
    }
    
    if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('Image file too large. Maximum size is 5MB');
    }
    
    const result = await memberstack.updateMemberProfileImage({
      profileImage: imageFile
    });
    
    console.log('Profile image updated:', result.data.profileImage);
    
    // Update UI
    document.getElementById('profile-image').src = result.data.profileImage;
    
    return result.data.profileImage;
  } catch (error) {
    console.error('Profile image update failed:', error);
    throw error;
  }
}

// File input handler
document.getElementById('profile-image-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      document.getElementById('image-loading').style.display = 'block';
      await updateProfileImage(file);
      document.getElementById('image-success').style.display = 'block';
    } catch (error) {
      document.getElementById('image-error').textContent = error.message;
      document.getElementById('image-error').style.display = 'block';
    } finally {
      document.getElementById('image-loading').style.display = 'none';
    }
  }
});
```

## Authentication Credential Updates

### updateMemberAuth()
Update member's email address and/or password. Requires current password for security.

**Method Signature:**
```typescript
await memberstack.updateMemberAuth({
  email?: string;
  oldPassword?: string;
  newPassword?: string;
}): Promise<UpdateMemberAuthPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | ❌ | New email address |
| oldPassword | string | ❌ | Current password (required for any changes) |
| newPassword | string | ❌ | New password |

**Examples:**

Change Password:
```javascript
async function changePassword(oldPassword, newPassword) {
  try {
    const result = await memberstack.updateMemberAuth({
      oldPassword,
      newPassword
    });
    
    console.log('Password changed successfully');
    
    return {
      success: true,
      message: 'Password updated successfully!'
    };
  } catch (error) {
    console.error('Password change failed:', error);
    
    const errorMessages = {
      'INVALID_PASSWORD': 'Current password is incorrect',
      'WEAK_NEW_PASSWORD': 'New password is too weak',
      'SAME_PASSWORD': 'New password must be different from current password'
    };
    
    return {
      success: false,
      message: errorMessages[error.code] || 'Failed to change password'
    };
  }
}

// Password change form
document.getElementById('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const oldPassword = formData.get('currentPassword');
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');
  
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  const result = await changePassword(oldPassword, newPassword);
  
  if (result.success) {
    alert(result.message);
    e.target.reset();
  } else {
    alert(result.message);
  }
});
```

Change Email Address:
```javascript
async function changeEmail(newEmail, currentPassword) {
  try {
    const result = await memberstack.updateMemberAuth({
      email: newEmail.trim().toLowerCase(),
      oldPassword: currentPassword
    });
    
    console.log('Email changed successfully:', result.data.email);
    
    return {
      success: true,
      message: 'Email updated successfully! Please verify your new email address.',
      newEmail: result.data.email
    };
  } catch (error) {
    console.error('Email change failed:', error);
    
    const errorMessages = {
      'INVALID_PASSWORD': 'Current password is incorrect',
      'EMAIL_ALREADY_EXISTS': 'This email address is already in use',
      'INVALID_EMAIL': 'Please enter a valid email address'
    };
    
    return {
      success: false,
      message: errorMessages[error.code] || 'Failed to change email'
    };
  }
}
```

## Advanced Member Data Management

### getMemberJSON()
Get member's JSON data store (key-value storage).

**Method Signature:**
```typescript
await memberstack.getMemberJSON(): Promise<GetMemberJSONPayload>
```

**Example:**
```javascript
async function getMemberData() {
  try {
    const result = await memberstack.getMemberJSON();
    console.log('Member JSON data:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to get member JSON:', error);
    return {};
  }
}
```

### updateMemberJSON()
Update member's JSON data store.

**Method Signature:**
```typescript
await memberstack.updateMemberJSON({
  json: object;
}): Promise<GetMemberJSONPayload>
```

**Example:**
```javascript
async function saveMemberData(data) {
  try {
    const result = await memberstack.updateMemberJSON({
      json: {
        preferences: {
          theme: data.theme,
          language: data.language,
          notifications: data.notifications
        },
        appData: {
          lastLogin: new Date().toISOString(),
          loginCount: (data.loginCount || 0) + 1,
          features: data.enabledFeatures
        },
        metadata: {
          version: '1.0',
          updatedAt: new Date().toISOString()
        }
      }
    });
    
    console.log('Member JSON updated:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to update member JSON:', error);
    throw error;
  }
}
```

### deleteMember()
Delete the current member's account permanently.

**Method Signature:**
```typescript
await memberstack.deleteMember(): Promise<DeleteMemberPayload>
```

**Example:**
```javascript
async function deleteAccount() {
  const confirmed = confirm(
    'Are you sure you want to delete your account? This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  const doubleConfirm = prompt(
    'Type "DELETE" to confirm account deletion:'
  );
  
  if (doubleConfirm !== 'DELETE') {
    alert('Account deletion cancelled');
    return;
  }
  
  try {
    await memberstack.deleteMember();
    
    alert('Your account has been successfully deleted.');
    window.location.href = '/';
  } catch (error) {
    console.error('Account deletion failed:', error);
    alert('Failed to delete account. Please contact support.');
  }
}

document.getElementById('delete-account-btn').addEventListener('click', deleteAccount);
```

## Complete Member Management Example

```javascript
class MemberProfileManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentMember = null;
    this.init();
  }
  
  async init() {
    try {
      await this.loadMemberProfile();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize profile manager:', error);
    }
  }
  
  async loadMemberProfile() {
    try {
      const result = await this.memberstack.getCurrentMember();
      
      if (result.data) {
        this.currentMember = result.data;
        this.displayProfile(result.data);
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      this.showError('Failed to load profile data');
    }
  }
  
  setupEventListeners() {
    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleProfileUpdate(e);
    });
    
    // Password form
    document.getElementById('password-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange(e);
    });
    
    // Email form
    document.getElementById('email-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEmailChange(e);
    });
    
    // Profile image
    document.getElementById('profile-image-input')?.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });
  }
  
  displayProfile(member) {
    // Populate form fields
    const fields = {
      'firstName': member.customFields?.firstName || '',
      'lastName': member.customFields?.lastName || '',
      'company': member.customFields?.company || '',
      'phone': member.customFields?.phone || '',
      'bio': member.customFields?.bio || '',
      'email-display': member.email
    };
    
    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.value = value;
        } else {
          element.textContent = value;
        }
      }
    });
    
    // Profile image
    const profileImg = document.getElementById('profile-image');
    if (profileImg) {
      profileImg.src = member.profileImage || '/default-avatar.png';
    }
    
    // Verification status
    const verificationStatus = document.getElementById('verification-status');
    if (verificationStatus) {
      verificationStatus.textContent = member.verified ? 'Verified' : 'Not Verified';
      verificationStatus.className = member.verified ? 'verified' : 'unverified';
    }
  }
  
  async handleProfileUpdate(event) {
    const formData = new FormData(event.target);
    const profileData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      company: formData.get('company'),
      phone: formData.get('phone'),
      bio: formData.get('bio')
    };
    
    this.setFormLoading('profile-form', true);
    
    try {
      const result = await this.memberstack.updateMember({
        customFields: {
          ...this.currentMember.customFields,
          ...profileData,
          lastUpdated: new Date().toISOString()
        }
      });
      
      this.currentMember = result.data;
      this.showSuccess('Profile updated successfully!');
    } catch (error) {
      this.showError('Failed to update profile');
    } finally {
      this.setFormLoading('profile-form', false);
    }
  }
  
  async handlePasswordChange(event) {
    const formData = new FormData(event.target);
    const oldPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    if (newPassword !== confirmPassword) {
      this.showError('New passwords do not match');
      return;
    }
    
    this.setFormLoading('password-form', true);
    
    try {
      await this.memberstack.updateMemberAuth({
        oldPassword,
        newPassword
      });
      
      this.showSuccess('Password updated successfully!');
      event.target.reset();
    } catch (error) {
      const message = error.code === 'INVALID_PASSWORD' 
        ? 'Current password is incorrect' 
        : 'Failed to change password';
      this.showError(message);
    } finally {
      this.setFormLoading('password-form', false);
    }
  }
  
  async handleEmailChange(event) {
    const formData = new FormData(event.target);
    const newEmail = formData.get('newEmail');
    const password = formData.get('password');
    
    this.setFormLoading('email-form', true);
    
    try {
      const result = await this.memberstack.updateMemberAuth({
        email: newEmail,
        oldPassword: password
      });
      
      this.currentMember = result.data;
      this.showSuccess('Email updated successfully! Please verify your new email.');
      this.displayProfile(result.data);
      event.target.reset();
    } catch (error) {
      const message = error.code === 'EMAIL_ALREADY_EXISTS'
        ? 'This email is already in use'
        : 'Failed to change email';
      this.showError(message);
    } finally {
      this.setFormLoading('email-form', false);
    }
  }
  
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const imageUrl = await this.memberstack.updateMemberProfileImage({
        profileImage: file
      });
      
      document.getElementById('profile-image').src = imageUrl.data.profileImage;
      this.showSuccess('Profile image updated!');
    } catch (error) {
      this.showError('Failed to update profile image');
    }
  }
  
  setFormLoading(formId, loading) {
    const form = document.getElementById(formId);
    const submitBtn = form?.querySelector('button[type="submit"]');
    
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Saving...' : 'Save Changes';
    }
  }
  
  showSuccess(message) {
    this.showMessage(message, 'success');
  }
  
  showError(message) {
    this.showMessage(message, 'error');
  }
  
  showMessage(message, type) {
    const messageEl = document.getElementById('message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message ${type}`;
      messageEl.style.display = 'block';
      
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MemberProfileManager();
});
```

## Next Steps

- **[04-plan-management.md](04-plan-management.md)** - Managing member subscriptions and plans
- **[06-member-journey.md](06-member-journey.md)** - Email verification and member lifecycle
- **[07-advanced-features.md](07-advanced-features.md)** - Advanced member features like teams
- **[08-types-reference.md](08-types-reference.md)** - TypeScript definitions for member objects# Memberstack DOM - Plan Management

## AI Assistant Instructions
When implementing plan management:
- Use `getPlans()` to display available subscription options
- Use `addPlan()` only for free plans - paid plans require checkout
- Use `purchasePlansWithCheckout()` for all paid plan purchases
- Include `autoRedirect: false` to get checkout URL without redirecting
- Use `launchStripeCustomerPortal()` for subscription management
- Handle plan connections and status in member data

## Overview

Plan management in Memberstack DOM handles subscription plans, billing, and member plan assignments. This includes retrieving available plans, purchasing subscriptions, and managing existing plan connections.

## Retrieving Plan Information

### getPlans()
Get all available plans for your Memberstack application.

**Method Signature:**
```typescript
await memberstack.getPlans(): Promise<GetPlansPayload>
```

**Response:**
```typescript
{
  data: Array<{
    id: string;
    name: string;
    description: string;
    type: "FREE" | "PAID";
    prices: Array<{
      id: string;
      amount: number; // Amount in cents
      currency: string;
      interval: "month" | "year" | "one_time";
      intervalCount: number;
    }>;
    features: Array<string>;
    // ... additional plan properties
  }>
}
```

**Examples:**

Display Available Plans:
```javascript
async function loadPricingPlans() {
  try {
    const result = await memberstack.getPlans();
    const plans = result.data;
    
    console.log(`Found ${plans.length} plans`);
    
    displayPlans(plans);
    return plans;
  } catch (error) {
    console.error('Failed to load plans:', error);
    document.getElementById('plans-error').style.display = 'block';
    return [];
  }
}

function displayPlans(plans) {
  const container = document.getElementById('pricing-plans');
  
  container.innerHTML = plans.map(plan => `
    <div class="plan-card ${plan.type.toLowerCase()}" data-plan-id="${plan.id}">
      <h3>${plan.name}</h3>
      <p class="plan-description">${plan.description}</p>
      
      <div class="plan-pricing">
        ${plan.prices.map(price => `
          <div class="price-option" data-price-id="${price.id}">
            <span class="amount">$${(price.amount / 100).toFixed(2)}</span>
            <span class="interval">/${price.interval}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="plan-features">
        ${plan.features ? plan.features.map(feature => `
          <div class="feature">✓ ${feature}</div>
        `).join('') : ''}
      </div>
      
      <button class="select-plan-btn" 
              data-plan-id="${plan.id}" 
              data-plan-type="${plan.type}">
        ${plan.type === 'FREE' ? 'Select Plan' : 'Subscribe'}
      </button>
    </div>
  `).join('');
  
  // Add event listeners
  container.querySelectorAll('.select-plan-btn').forEach(btn => {
    btn.addEventListener('click', handlePlanSelection);
  });
}

async function handlePlanSelection(event) {
  const planId = event.target.dataset.planId;
  const planType = event.target.dataset.planType;
  
  if (planType === 'FREE') {
    await selectFreePlan(planId);
  } else {
    // For paid plans, need to get price ID
    const priceId = event.target.closest('.plan-card')
                         .querySelector('.price-option').dataset.priceId;
    await purchasePaidPlan(priceId);
  }
}
```

Filter Plans by Type:
```javascript
async function getFreePlans() {
  try {
    const result = await memberstack.getPlans();
    const freePlans = result.data.filter(plan => plan.type === 'FREE');
    
    console.log('Free plans available:', freePlans.length);
    return freePlans;
  } catch (error) {
    console.error('Failed to get free plans:', error);
    return [];
  }
}

async function getPaidPlans() {
  try {
    const result = await memberstack.getPlans();
    const paidPlans = result.data.filter(plan => plan.type === 'PAID');
    
    console.log('Paid plans available:', paidPlans.length);
    return paidPlans;
  } catch (error) {
    console.error('Failed to get paid plans:', error);
    return [];
  }
}
```

### getPlan()
Get details for a specific plan by ID.

**Method Signature:**
```typescript
await memberstack.getPlan({
  planId: string;
}): Promise<GetPlanPayload>
```

**Example:**
```javascript
async function getPlanDetails(planId) {
  try {
    const result = await memberstack.getPlan({ planId });
    console.log('Plan details:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to get plan details:', error);
    return null;
  }
}

// Display single plan details
async function showPlanModal(planId) {
  const plan = await getPlanDetails(planId);
  
  if (plan) {
    const modal = document.getElementById('plan-modal');
    modal.querySelector('.modal-title').textContent = plan.name;
    modal.querySelector('.modal-description').textContent = plan.description;
    modal.querySelector('.modal-price').textContent = 
      plan.prices ? `$${(plan.prices[0].amount / 100).toFixed(2)}/${plan.prices[0].interval}` : 'Free';
    
    modal.style.display = 'block';
  }
}
```

## Free Plan Management

### addPlan()
Add a free plan to the current member's account.

**Method Signature:**
```typescript
await memberstack.addPlan({
  planId: string;
}): Promise<AddPlanPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| planId | string | ✅ | ID of the free plan to add |

**Response:**
```typescript
{
  data: {
    planConnection: {
      id: string;
      planId: string;
      status: "ACTIVE";
      createdAt: string;
    }
  }
}
```

**Examples:**

Add Free Plan:
```javascript
async function selectFreePlan(planId) {
  try {
    // Check if member is authenticated
    const currentMember = await memberstack.getCurrentMember();
    if (!currentMember.data) {
      alert('Please log in to select a plan');
      window.location.href = '/login';
      return;
    }
    
    // Add the free plan
    const result = await memberstack.addPlan({ planId });
    
    console.log('Free plan added:', result.data.planConnection);
    
    // Show success message
    alert('Plan activated successfully!');
    
    // Refresh member data or redirect
    window.location.reload();
    
    return result.data.planConnection;
  } catch (error) {
    console.error('Failed to add free plan:', error);
    
    if (error.code === 'PLAN_NOT_FREE') {
      alert('This plan requires payment. Please use the purchase option.');
    } else if (error.code === 'PLAN_ALREADY_ACTIVE') {
      alert('You already have this plan activated.');
    } else {
      alert('Failed to activate plan. Please try again.');
    }
  }
}
```

Bulk Free Plan Assignment:
```javascript
async function assignMultipleFreePlans(planIds) {
  const results = [];
  
  for (const planId of planIds) {
    try {
      const result = await memberstack.addPlan({ planId });
      results.push({
        planId,
        success: true,
        connection: result.data.planConnection
      });
    } catch (error) {
      results.push({
        planId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Usage
const freePlanIds = ['plan_free_starter', 'plan_free_community'];
const results = await assignMultipleFreePlans(freePlanIds);

results.forEach(result => {
  if (result.success) {
    console.log(`✅ Added plan ${result.planId}`);
  } else {
    console.log(`❌ Failed to add plan ${result.planId}: ${result.error}`);
  }
});
```

### removePlan()
Remove a plan from the current member's account.

**Method Signature:**
```typescript
await memberstack.removePlan({
  planId: string;
}): Promise<RemovePlanPayload>
```

**Example:**
```javascript
async function cancelPlan(planId, planName) {
  const confirmed = confirm(`Are you sure you want to cancel ${planName}?`);
  
  if (!confirmed) return;
  
  try {
    const result = await memberstack.removePlan({ planId });
    
    console.log('Plan removed:', result.data);
    alert('Plan cancelled successfully.');
    
    // Refresh the page to update UI
    window.location.reload();
  } catch (error) {
    console.error('Failed to remove plan:', error);
    alert('Failed to cancel plan. Please try again or contact support.');
  }
}

// Cancel button handler
document.querySelectorAll('.cancel-plan-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const planId = e.target.dataset.planId;
    const planName = e.target.dataset.planName;
    cancelPlan(planId, planName);
  });
});
```

## Paid Plan Management

### purchasePlansWithCheckout()
Create a Stripe checkout session for plan purchase.

**Method Signature:**
```typescript
await memberstack.purchasePlansWithCheckout({
  priceId: string;
  couponId?: string;
  successUrl?: string;
  cancelUrl?: string;
  autoRedirect?: boolean;
  metadataForCheckout?: object;
}): Promise<PurchasePlansWithCheckoutPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| priceId | string | ✅ | Stripe price ID for the plan |
| couponId | string | ❌ | Stripe coupon ID for discounts |
| successUrl | string | ❌ | URL to redirect after successful payment |
| cancelUrl | string | ❌ | URL to redirect if payment is cancelled |
| autoRedirect | boolean | ❌ | Auto-redirect to checkout (default: true) |
| metadataForCheckout | object | ❌ | Additional metadata for the checkout session |

**Response:**
```typescript
{
  data: {
    url: string; // Stripe checkout URL
  }
}
```

**Examples:**

Basic Checkout:
```javascript
async function purchasePlan(priceId, planName) {
  try {
    // Check if member is authenticated
    const currentMember = await memberstack.getCurrentMember();
    if (!currentMember.data) {
      // Redirect to signup with plan pre-selected
      window.location.href = `/signup?plan=${priceId}`;
      return;
    }
    
    // Create checkout session and redirect
    await memberstack.purchasePlansWithCheckout({
      priceId: priceId,
      successUrl: '/dashboard?purchase=success',
      cancelUrl: '/pricing?cancelled=true',
      metadataForCheckout: {
        planName: planName,
        source: 'pricing_page'
      }
    });
    
    // Will auto-redirect to Stripe checkout
  } catch (error) {
    console.error('Checkout failed:', error);
    alert('Failed to start checkout process. Please try again.');
  }
}

// Plan purchase button handler
document.querySelectorAll('.purchase-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const priceId = e.target.dataset.priceId;
    const planName = e.target.dataset.planName;
    purchasePlan(priceId, planName);
  });
});
```

Get Checkout URL Without Redirect:
```javascript
async function getCheckoutUrl(priceId, options = {}) {
  try {
    const result = await memberstack.purchasePlansWithCheckout({
      priceId: priceId,
      autoRedirect: false, // Don't auto-redirect
      successUrl: options.successUrl || '/dashboard',
      cancelUrl: options.cancelUrl || '/pricing',
      couponId: options.couponId,
      metadataForCheckout: options.metadata
    });
    
    console.log('Checkout URL:', result.data.url);
    return result.data.url;
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    throw error;
  }
}

// Usage examples
async function handleCustomCheckout() {
  try {
    const checkoutUrl = await getCheckoutUrl('price_1234567890', {
      couponId: 'discount_code_123',
      metadata: { source: 'custom_flow' }
    });
    
    // Open in new tab
    window.open(checkoutUrl, '_blank');
    
    // Or show in modal
    showCheckoutModal(checkoutUrl);
  } catch (error) {
    alert('Failed to create checkout session');
  }
}
```

Checkout with Coupon:
```javascript
async function purchaseWithDiscount(priceId, couponCode) {
  try {
    await memberstack.purchasePlansWithCheckout({
      priceId: priceId,
      couponId: couponCode,
      successUrl: '/dashboard?discount=applied',
      cancelUrl: '/pricing',
      metadataForCheckout: {
        couponApplied: couponCode,
        discountSource: 'promotional_campaign'
      }
    });
  } catch (error) {
    if (error.code === 'INVALID_COUPON') {
      alert('Invalid coupon code. Please try again.');
    } else {
      alert('Checkout failed. Please try again.');
    }
  }
}

// Coupon form handler
document.getElementById('coupon-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const priceId = formData.get('priceId');
  const couponCode = formData.get('couponCode');
  
  purchaseWithDiscount(priceId, couponCode);
});
```

## Customer Portal & Billing Management

### launchStripeCustomerPortal()
Launch the Stripe Customer Portal for subscription management.

**Method Signature:**
```typescript
await memberstack.launchStripeCustomerPortal({
  returnUrl?: string;
  autoRedirect?: boolean;
  priceIds?: string[];
  configuration?: object;
}): Promise<LaunchStripeCustomerPortalPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| returnUrl | string | ❌ | URL to return to after portal session |
| autoRedirect | boolean | ❌ | Auto-redirect to portal (default: true) |
| priceIds | string[] | ❌ | Specific prices to allow in portal |
| configuration | object | ❌ | Stripe portal configuration |

**Examples:**

Basic Customer Portal:
```javascript
async function openBillingPortal() {
  try {
    // Check if member has active subscriptions
    const member = await memberstack.getCurrentMember();
    if (!member.data || !member.data.planConnections?.length) {
      alert('No active subscriptions to manage');
      return;
    }
    
    // Launch customer portal
    await memberstack.launchStripeCustomerPortal({
      returnUrl: '/account/billing',
    });
    
    // Will auto-redirect to Stripe portal
  } catch (error) {
    console.error('Failed to open billing portal:', error);
    
    if (error.code === 'NO_STRIPE_CUSTOMER') {
      alert('No billing information found. Please contact support.');
    } else {
      alert('Unable to access billing portal. Please try again.');
    }
  }
}

// Billing portal button
document.getElementById('manage-billing-btn').addEventListener('click', openBillingPortal);
```

Get Portal URL Without Redirect:
```javascript
async function getBillingPortalUrl() {
  try {
    const result = await memberstack.launchStripeCustomerPortal({
      returnUrl: '/account/billing',
      autoRedirect: false
    });
    
    return result.data.url;
  } catch (error) {
    console.error('Failed to get portal URL:', error);
    return null;
  }
}

// Usage
async function showBillingOptions() {
  const portalUrl = await getBillingPortalUrl();
  
  if (portalUrl) {
    const modal = document.getElementById('billing-modal');
    modal.querySelector('.portal-link').href = portalUrl;
    modal.style.display = 'block';
  }
}
```

## Plan Detection Using payment.priceId

### Critical: Use payment.priceId for Paid Plan Detection

For paid plans, always check `planConnection.payment.priceId` rather than `planConnection.planId`:

```javascript
// ✅ CORRECT: Check paid plan using payment.priceId
const hasPremiumPlan = member?.planConnections?.some(planConnection =>
  planConnection.payment?.priceId === 'prc_premium-monthly-d422107a7' &&
  planConnection.status === 'ACTIVE'
) || false;

// ❌ INCORRECT: Checking planId for paid plans (unreliable)
const incorrectCheck = member?.planConnections?.some(planConnection =>
  planConnection.planId === 'pln_some_plan_id' &&
  planConnection.status === 'ACTIVE'
);
```

### Complete Plan Detection Helper

```javascript
function checkMemberPlanAccess(member, targetPriceId) {
  if (!member?.planConnections) {
    return false;
  }
  
  return member.planConnections.some(planConnection =>
    planConnection.payment?.priceId === targetPriceId &&
    planConnection.status === 'ACTIVE'
  );
}

// Usage examples
const { data: member } = await memberstack.getCurrentMember();

const hasPremiumMonthly = checkMemberPlanAccess(member, 'prc_premium-monthly-d422107a7');
const hasPremiumYearly = checkMemberPlanAccess(member, 'prc_premium-yearly-e533218b8');
const hasProPlan = checkMemberPlanAccess(member, 'prc_pro-monthly-f644329c9');
```

### Real Member Object Example

When a member purchases a paid plan, their planConnections structure looks like this:

```javascript
{
  id: "mem_abc123",
  auth: { email: "user@example.com" },
  planConnections: [
    {
      id: "pc_connection123",
      planId: "pln_some_internal_id", // Don't rely on this for paid plans
      status: "ACTIVE",
      payment: {
        priceId: "prc_premium-monthly-d422107a7" // USE THIS for plan detection
      },
      createdAt: "2024-01-15T10:30:00.000Z",
      updatedAt: "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Content Gating Patterns

```javascript
// Gate premium content
function gatePremiumContent(member) {
  const premiumPriceIds = [
    'prc_premium-monthly-d422107a7',
    'prc_premium-yearly-e533218b8'
  ];
  
  const hasPremiumAccess = member?.planConnections?.some(pc =>
    premiumPriceIds.includes(pc.payment?.priceId) &&
    pc.status === 'ACTIVE'
  ) || false;
  
  if (hasPremiumAccess) {
    // Show premium content
    document.querySelectorAll('.premium-content').forEach(el => {
      el.style.display = 'block';
    });
    document.querySelectorAll('.upgrade-prompt').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    // Show upgrade prompt
    document.querySelectorAll('.premium-content').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.upgrade-prompt').forEach(el => {
      el.style.display = 'block';
    });
  }
}

// Usage
const { data: member } = await memberstack.getCurrentMember();
gatePremiumContent(member);
```

### Complete Paid Plan Implementation Example

```javascript
class PremiumFeatures {
  constructor() {
    this.memberstack = null;
    this.currentMember = null;
    this.premiumPriceId = 'prc_premium-monthly-d422107a7';
    this.init();
  }
  
  async init() {
    try {
      // Initialize Memberstack
      this.memberstack = window.$memberstackDom || await import('@memberstack/dom');
      
      // Load current member
      await this.loadCurrentMember();
      
      // Setup UI based on membership status
      this.setupUI();
      
      // Add event listeners
      this.addEventListeners();
    } catch (error) {
      console.error('Failed to initialize premium features:', error);
    }
  }
  
  async loadCurrentMember() {
    try {
      const result = await this.memberstack.getCurrentMember();
      this.currentMember = result.data;
    } catch (error) {
      console.error('Failed to load member:', error);
      this.currentMember = null;
    }
  }
  
  checkPremiumAccess() {
    if (!this.currentMember?.planConnections) {
      return false;
    }
    
    return this.currentMember.planConnections.some(planConnection =>
      planConnection.payment?.priceId === this.premiumPriceId &&
      planConnection.status === 'ACTIVE'
    );
  }
  
  async purchasePremium() {
    try {
      // Check if member is logged in
      if (!this.currentMember) {
        // Show signup modal with plan pre-selected
        await this.memberstack.openModal({
          type: 'SIGNUP',
          priceId: this.premiumPriceId
        });
        return;
      }
      
      // Start checkout process
      const checkout = await this.memberstack.purchasePlansWithCheckout({
        priceId: this.premiumPriceId,
        successUrl: window.location.origin + '/dashboard?upgraded=true',
        cancelUrl: window.location.origin + '/dashboard',
        metadataForCheckout: {
          source: 'premium_features_widget',
          timestamp: new Date().toISOString()
        }
      });
      
      // Redirect to Stripe checkout
      window.location.href = checkout.url;
    } catch (error) {
      console.error('Purchase failed:', error);
      
      if (error.code === 'MEMBER_NOT_FOUND') {
        alert('Please log in first to purchase a plan.');
      } else if (error.code === 'PLAN_ALREADY_ACTIVE') {
        alert('You already have this plan active!');
        await this.loadCurrentMember(); // Refresh member data
        this.setupUI();
      } else {
        alert('Purchase failed. Please try again or contact support.');
      }
    }
  }
  
  setupUI() {
    const hasPremiumAccess = this.checkPremiumAccess();
    
    // Show/hide premium content
    document.querySelectorAll('[data-premium-content]').forEach(el => {
      el.style.display = hasPremiumAccess ? 'block' : 'none';
    });
    
    // Show/hide upgrade prompts
    document.querySelectorAll('[data-upgrade-prompt]').forEach(el => {
      el.style.display = hasPremiumAccess ? 'none' : 'block';
    });
    
    // Update purchase buttons
    const purchaseButtons = document.querySelectorAll('[data-purchase-premium]');
    purchaseButtons.forEach(btn => {
      if (hasPremiumAccess) {
        btn.textContent = 'Premium Active ✓';
        btn.disabled = true;
        btn.classList.add('premium-active');
      } else if (this.currentMember) {
        btn.textContent = 'Upgrade to Premium';
        btn.disabled = false;
        btn.classList.remove('premium-active');
      } else {
        btn.textContent = 'Sign Up for Premium';
        btn.disabled = false;
        btn.classList.remove('premium-active');
      }
    });
    
    // Show member info
    this.updateMemberInfo();
  }
  
  updateMemberInfo() {
    const memberInfoEl = document.getElementById('member-info');
    if (!memberInfoEl) return;
    
    if (!this.currentMember) {
      memberInfoEl.innerHTML = '<p>Not logged in</p>';
      return;
    }
    
    const activePlans = this.currentMember.planConnections?.filter(pc => 
      pc.status === 'ACTIVE'
    ) || [];
    
    const premiumPlan = activePlans.find(pc => 
      pc.payment?.priceId === this.premiumPriceId
    );
    
    memberInfoEl.innerHTML = `
      <div class="member-status">
        <h4>Account Status</h4>
        <p><strong>Email:</strong> ${this.currentMember.auth?.email || 'N/A'}</p>
        <p><strong>Member ID:</strong> ${this.currentMember.id}</p>
        <p><strong>Premium Status:</strong> 
          ${premiumPlan ? 
            `<span class="premium-active">Active since ${new Date(premiumPlan.createdAt).toLocaleDateString()}</span>` : 
            '<span class="premium-inactive">Not Active</span>'
          }
        </p>
        <p><strong>Total Plans:</strong> ${activePlans.length}</p>
      </div>
    `;
  }
  
  addEventListeners() {
    // Purchase buttons
    document.querySelectorAll('[data-purchase-premium]').forEach(btn => {
      btn.addEventListener('click', () => this.purchasePremium());
    });
    
    // Refresh member data button (useful for testing)
    const refreshBtn = document.getElementById('refresh-member-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.loadCurrentMember();
        this.setupUI();
      });
    }
    
    // Listen for member updates from other parts of the app
    window.addEventListener('memberstack:member-updated', () => {
      this.loadCurrentMember().then(() => this.setupUI());
    });
  }
  
  // Utility method to trigger member refresh from other parts of app
  static triggerMemberUpdate() {
    window.dispatchEvent(new CustomEvent('memberstack:member-updated'));
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PremiumFeatures();
});

// Also provide global access for manual initialization
window.PremiumFeatures = PremiumFeatures;
```

### HTML Structure for Premium Features

```html
<!-- Member Info Display -->
<div id="member-info"></div>

<!-- Premium Content (hidden by default) -->
<div data-premium-content style="display: none;">
  <h3>🎉 Premium Content</h3>
  <p>This content is only visible to premium members!</p>
  <div class="premium-features">
    <ul>
      <li>Advanced Analytics Dashboard</li>
      <li>Priority Customer Support</li>
      <li>Exclusive Content Library</li>
      <li>Advanced Export Features</li>
    </ul>
  </div>
</div>

<!-- Upgrade Prompt (shown to non-premium users) -->
<div data-upgrade-prompt>
  <div class="upgrade-card">
    <h3>Unlock Premium Features</h3>
    <p>Get access to advanced features and priority support.</p>
    <ul class="benefits-list">
      <li>✓ Advanced Analytics</li>
      <li>✓ Priority Support</li>
      <li>✓ Exclusive Content</li>
      <li>✓ Export Tools</li>
    </ul>
    <button data-purchase-premium class="upgrade-btn">
      Sign Up for Premium
    </button>
  </div>
</div>

<!-- Admin/Debug Tools (for testing) -->
<div class="debug-tools" style="margin-top: 2rem; padding: 1rem; border: 1px dashed #ccc;">
  <h4>Debug Tools</h4>
  <button id="refresh-member-data">Refresh Member Data</button>
</div>
```

### CSS for Premium Features

```css
.premium-active {
  background-color: #10b981 !important;
  color: white !important;
  cursor: not-allowed;
}

.premium-inactive {
  color: #ef4444;
  font-weight: bold;
}

.upgrade-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.benefits-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.benefits-list li {
  padding: 0.5rem 0;
  color: #059669;
  font-weight: 500;
}

.upgrade-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.upgrade-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
}

.debug-tools {
  background-color: #fef3c7;
  border-radius: 4px;
}

.member-status {
  background-color: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
```

## Plan Status & Member Subscriptions

### Check Member Plan Status
```javascript
async function getMemberPlanStatus() {
  try {
    const member = await memberstack.getCurrentMember();
    
    if (!member.data) {
      return { authenticated: false, plans: [] };
    }
    
    const activePlans = member.data.planConnections
      ?.filter(connection => connection.status === 'ACTIVE')
      ?.map(connection => ({
        id: connection.id,
        planId: connection.planId,
        status: connection.status,
        createdAt: connection.createdAt,
        // Add plan details if needed
      })) || [];
    
    return {
      authenticated: true,
      member: member.data,
      plans: activePlans,
      hasPaidPlan: activePlans.some(plan => plan.type === 'PAID'),
      planCount: activePlans.length
    };
  } catch (error) {
    console.error('Failed to get plan status:', error);
    return { authenticated: false, plans: [], error: error.message };
  }
}

// Usage
async function displayMembershipStatus() {
  const status = await getMemberPlanStatus();
  
  const statusEl = document.getElementById('membership-status');
  
  if (!status.authenticated) {
    statusEl.innerHTML = '<p>Please log in to view your membership status.</p>';
    return;
  }
  
  if (status.plans.length === 0) {
    statusEl.innerHTML = `
      <div class="no-plans">
        <h3>No Active Plans</h3>
        <p>You don't have any active subscriptions.</p>
        <a href="/pricing" class="btn">View Plans</a>
      </div>
    `;
  } else {
    statusEl.innerHTML = `
      <div class="active-plans">
        <h3>Active Subscriptions (${status.plans.length})</h3>
        ${status.plans.map(plan => `
          <div class="plan-item">
            <span class="plan-id">${plan.planId}</span>
            <span class="plan-status ${plan.status.toLowerCase()}">${plan.status}</span>
            <span class="plan-date">Since ${new Date(plan.createdAt).toLocaleDateString()}</span>
          </div>
        `).join('')}
        
        <div class="plan-actions">
          <button onclick="openBillingPortal()" class="btn">Manage Billing</button>
        </div>
      </div>
    `;
  }
}
```

### Plan Access Control
```javascript
function checkPlanAccess(requiredPlanId, member) {
  if (!member || !member.planConnections) {
    return false;
  }
  
  return member.planConnections.some(connection => 
    connection.planId === requiredPlanId && connection.status === 'ACTIVE'
  );
}

function checkAnyPlanAccess(requiredPlanIds, member) {
  if (!member || !member.planConnections) {
    return false;
  }
  
  return requiredPlanIds.some(planId => 
    member.planConnections.some(connection =>
      connection.planId === planId && connection.status === 'ACTIVE'
    )
  );
}

// Usage in content gating
async function gatePremiumContent() {
  const member = await memberstack.getCurrentMember();
  
  if (!member.data) {
    // Show login prompt
    document.getElementById('login-prompt').style.display = 'block';
    return;
  }
  
  const hasProAccess = checkPlanAccess('plan_pro_monthly', member.data);
  const hasAnyPaidPlan = checkAnyPlanAccess(['plan_basic', 'plan_pro', 'plan_enterprise'], member.data);
  
  if (hasProAccess) {
    document.getElementById('pro-content').style.display = 'block';
  } else if (hasAnyPaidPlan) {
    document.getElementById('upgrade-prompt').style.display = 'block';
  } else {
    document.getElementById('subscription-prompt').style.display = 'block';
  }
}
```

## Complete Plan Management Example

```javascript
class PlanManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentMember = null;
    this.availablePlans = [];
    this.init();
  }
  
  async init() {
    try {
      await this.loadCurrentMember();
      await this.loadAvailablePlans();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Failed to initialize plan manager:', error);
    }
  }
  
  async loadCurrentMember() {
    try {
      const result = await this.memberstack.getCurrentMember();
      this.currentMember = result.data;
    } catch (error) {
      console.error('Failed to load current member:', error);
    }
  }
  
  async loadAvailablePlans() {
    try {
      const result = await this.memberstack.getPlans();
      this.availablePlans = result.data;
    } catch (error) {
      console.error('Failed to load plans:', error);
      this.availablePlans = [];
    }
  }
  
  setupEventListeners() {
    // Plan selection buttons
    document.querySelectorAll('.select-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handlePlanSelection(e));
    });
    
    // Cancel plan buttons
    document.querySelectorAll('.cancel-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handlePlanCancellation(e));
    });
    
    // Billing portal button
    document.getElementById('billing-portal-btn')?.addEventListener('click', () => {
      this.openBillingPortal();
    });
  }
  
  async handlePlanSelection(event) {
    const planId = event.target.dataset.planId;
    const priceId = event.target.dataset.priceId;
    const planType = event.target.dataset.planType;
    
    if (!this.currentMember) {
      // Redirect to signup with plan preselected
      window.location.href = `/signup?plan=${planId}`;
      return;
    }
    
    try {
      if (planType === 'FREE') {
        await this.addFreePlan(planId);
      } else {
        await this.purchasePaidPlan(priceId);
      }
    } catch (error) {
      this.showError('Failed to select plan: ' + error.message);
    }
  }
  
  async addFreePlan(planId) {
    const result = await this.memberstack.addPlan({ planId });
    
    this.showSuccess('Free plan activated successfully!');
    
    // Reload member data
    await this.loadCurrentMember();
    this.updateUI();
  }
  
  async purchasePaidPlan(priceId) {
    await this.memberstack.purchasePlansWithCheckout({
      priceId: priceId,
      successUrl: window.location.href + '?purchase=success',
      cancelUrl: window.location.href + '?purchase=cancelled',
      metadataForCheckout: {
        source: 'plan_manager'
      }
    });
  }
  
  async handlePlanCancellation(event) {
    const planId = event.target.dataset.planId;
    const planName = event.target.dataset.planName;
    
    const confirmed = confirm(`Cancel ${planName}? You'll lose access to premium features.`);
    
    if (!confirmed) return;
    
    try {
      await this.memberstack.removePlan({ planId });
      
      this.showSuccess('Plan cancelled successfully');
      
      // Reload member data
      await this.loadCurrentMember();
      this.updateUI();
    } catch (error) {
      this.showError('Failed to cancel plan: ' + error.message);
    }
  }
  
  async openBillingPortal() {
    try {
      await this.memberstack.launchStripeCustomerPortal({
        returnUrl: window.location.href
      });
    } catch (error) {
      this.showError('Unable to open billing portal: ' + error.message);
    }
  }
  
  updateUI() {
    this.displayAvailablePlans();
    this.displayCurrentPlans();
    this.updateAccessControls();
  }
  
  displayAvailablePlans() {
    const container = document.getElementById('available-plans');
    if (!container) return;
    
    const memberPlanIds = this.currentMember?.planConnections
      ?.filter(pc => pc.status === 'ACTIVE')
      ?.map(pc => pc.planId) || [];
    
    container.innerHTML = this.availablePlans.map(plan => {
      const isActive = memberPlanIds.includes(plan.id);
      const price = plan.prices?.[0];
      
      return `
        <div class="plan-card ${plan.type.toLowerCase()} ${isActive ? 'active' : ''}">
          <h3>${plan.name}</h3>
          <p>${plan.description}</p>
          
          ${price ? `
            <div class="price">
              $${(price.amount / 100).toFixed(2)}/${price.interval}
            </div>
          ` : '<div class="price">Free</div>'}
          
          ${isActive ? `
            <button class="btn active-plan">Current Plan</button>
            ${plan.type === 'PAID' ? `
              <button class="btn cancel-plan-btn" 
                      data-plan-id="${plan.id}" 
                      data-plan-name="${plan.name}">
                Cancel
              </button>
            ` : ''}
          ` : `
            <button class="btn select-plan-btn"
                    data-plan-id="${plan.id}"
                    data-price-id="${price?.id || ''}"
                    data-plan-type="${plan.type}">
              ${plan.type === 'FREE' ? 'Select Plan' : 'Subscribe'}
            </button>
          `}
        </div>
      `;
    }).join('');
    
    // Re-attach event listeners
    this.setupEventListeners();
  }
  
  displayCurrentPlans() {
    const container = document.getElementById('current-plans');
    if (!container) return;
    
    if (!this.currentMember || !this.currentMember.planConnections?.length) {
      container.innerHTML = '<p>No active plans</p>';
      return;
    }
    
    const activePlans = this.currentMember.planConnections
      .filter(pc => pc.status === 'ACTIVE');
    
    container.innerHTML = `
      <h3>Active Subscriptions</h3>
      ${activePlans.map(connection => {
        const plan = this.availablePlans.find(p => p.id === connection.planId);
        return `
          <div class="active-plan-item">
            <span class="plan-name">${plan?.name || connection.planId}</span>
            <span class="plan-status">${connection.status}</span>
            <span class="plan-date">Since ${new Date(connection.createdAt).toLocaleDateString()}</span>
          </div>
        `;
      }).join('')}
      
      ${activePlans.some(pc => this.availablePlans.find(p => p.id === pc.planId)?.type === 'PAID') ? `
        <button id="billing-portal-btn" class="btn">Manage Billing</button>
      ` : ''}
    `;
  }
  
  updateAccessControls() {
    // Update UI based on member's plan access
    const memberPlanIds = this.currentMember?.planConnections
      ?.filter(pc => pc.status === 'ACTIVE')
      ?.map(pc => pc.planId) || [];
    
    // Show/hide premium content
    document.querySelectorAll('[data-requires-plan]').forEach(el => {
      const requiredPlan = el.dataset.requiresPlan;
      const hasAccess = memberPlanIds.includes(requiredPlan);
      
      el.style.display = hasAccess ? 'block' : 'none';
    });
    
    // Show/hide upgrade prompts
    document.querySelectorAll('[data-show-without-plan]').forEach(el => {
      const requiredPlan = el.dataset.showWithoutPlan;
      const hasAccess = memberPlanIds.includes(requiredPlan);
      
      el.style.display = hasAccess ? 'none' : 'block';
    });
  }
  
  showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
  }
  
  showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
  }
}

// Initialize plan manager
document.addEventListener('DOMContentLoaded', () => {
  new PlanManager();
});
```

## Next Steps

- **[05-ui-components.md](05-ui-components.md)** - Using pre-built modals for plan selection
- **[03-member-management.md](03-member-management.md)** - Accessing member plan data
- **[07-advanced-features.md](07-advanced-features.md)** - Plan-gated content and features
- **[09-error-handling.md](09-error-handling.md)** - Handling plan and billing errors# Memberstack DOM - UI Components

## AI Assistant Instructions
When implementing Memberstack UI components:
- Use `openModal()` for pre-built authentication flows
- Use `hideModal()` to programmatically close modals
- Show loading states with `_showLoader()` and `_hideLoader()` (internal methods)
- Display messages with `_showMessage()` (internal method)
- Customize modal appearance through Memberstack dashboard settings
- Include translations parameter for multi-language support

## Overview

Memberstack DOM includes pre-built UI components for common authentication and member management flows. These components are styled according to your Memberstack app settings and provide a complete user experience without custom development.

## Modal Components

### openModal()
Open pre-built Memberstack modals for various user flows.

**Method Signature:**
```typescript
memberstack.openModal(type: ModalType, options?: {
  translations?: MemberstackTranslations;
  [key: string]: any;
}): Promise<any>
```

**Modal Types:**
| Type | Description | When to Use |
|------|-------------|-------------|
| `'LOGIN'` | Email/password and social login | When user needs to authenticate |
| `'SIGNUP'` | Account creation with email/password | For new user registration |
| `'FORGOT_PASSWORD'` | Password reset request | When user forgets password |
| `'RESET_PASSWORD'` | Set new password with token | Password reset confirmation page |
| `'PROFILE'` | Member profile management | Logged-in users managing account |

**Examples:**

Basic Modal Usage:
```javascript
// Login modal
document.getElementById('login-btn').addEventListener('click', () => {
  memberstack.openModal('LOGIN');
});

// Signup modal
document.getElementById('signup-btn').addEventListener('click', () => {
  memberstack.openModal('SIGNUP');
});

// Profile modal (requires authenticated member)
document.getElementById('profile-btn').addEventListener('click', () => {
  memberstack.openModal('PROFILE');
});

// Forgot password modal
document.getElementById('forgot-password-link').addEventListener('click', (e) => {
  e.preventDefault();
  memberstack.openModal('FORGOT_PASSWORD');
});
```

Modal with Promise Handling:
```javascript
async function showLoginModal() {
  try {
    const result = await memberstack.openModal('LOGIN');
    console.log('Login modal completed:', result);
    
    // Modal resolved - user logged in successfully
    // The onAuthChange callback will handle UI updates
    
  } catch (error) {
    console.log('Login modal cancelled or failed:', error);
    // User closed modal or authentication failed
  }
}

// Usage with async/await
document.getElementById('login-btn').addEventListener('click', showLoginModal);
```

Modal Flow Chain:
```javascript
function setupAuthFlow() {
  // Login button opens login modal
  document.getElementById('login-btn').addEventListener('click', async () => {
    try {
      await memberstack.openModal('LOGIN');
      // Success handled by onAuthChange
    } catch (error) {
      console.log('Login cancelled');
    }
  });
  
  // Signup button opens signup modal
  document.getElementById('signup-btn').addEventListener('click', async () => {
    try {
      await memberstack.openModal('SIGNUP');
      // Success handled by onAuthChange
    } catch (error) {
      console.log('Signup cancelled');
    }
  });
  
  // Forgot password link in login modal opens forgot password modal
  // This is handled automatically by the pre-built modals
}
```

### hideModal()
Programmatically close any open Memberstack modal.

**Method Signature:**
```typescript
memberstack.hideModal(): void
```

**Examples:**

Close Modal Programmatically:
```javascript
// Close modal after external event
function closeModalOnEscape(event) {
  if (event.key === 'Escape') {
    memberstack.hideModal();
  }
}

document.addEventListener('keydown', closeModalOnEscape);

// Close modal after successful operation
async function performExternalLogin() {
  // Some external authentication logic
  const success = await externalAuthService.login();
  
  if (success) {
    // Close any open Memberstack modals
    memberstack.hideModal();
  }
}

// Auto-close modal after timeout (not recommended for auth flows)
function autoCloseModal(timeoutMs = 30000) {
  setTimeout(() => {
    memberstack.hideModal();
  }, timeoutMs);
}
```

Modal State Management:
```javascript
class ModalManager {
  constructor() {
    this.modalStack = [];
    this.isModalOpen = false;
    this.setupModalHandling();
  }
  
  setupModalHandling() {
    // Track modal state changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const modalElements = document.querySelectorAll('[data-ms-modal]');
          this.isModalOpen = modalElements.length > 0;
          
          if (this.isModalOpen) {
            document.body.classList.add('modal-open');
          } else {
            document.body.classList.remove('modal-open');
          }
        }
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  async openModalWithTracking(type, options = {}) {
    this.modalStack.push({ type, timestamp: Date.now() });
    
    try {
      const result = await memberstack.openModal(type, options);
      this.modalStack.pop();
      return result;
    } catch (error) {
      this.modalStack.pop();
      throw error;
    }
  }
  
  closeAllModals() {
    memberstack.hideModal();
    this.modalStack = [];
  }
  
  getCurrentModal() {
    return this.modalStack[this.modalStack.length - 1] || null;
  }
}

const modalManager = new ModalManager();
```

## Modal Customization

### Translations
Customize modal text for different languages or branding.

**Translation Interface:**
```typescript
interface MemberstackTranslations {
  login?: {
    title?: string;
    emailPlaceholder?: string;
    passwordPlaceholder?: string;
    submitButton?: string;
    forgotPasswordLink?: string;
    signupLink?: string;
  };
  signup?: {
    title?: string;
    emailPlaceholder?: string;
    passwordPlaceholder?: string;
    submitButton?: string;
    loginLink?: string;
  };
  // ... more modal translations
}
```

**Examples:**

Custom Text Translations:
```javascript
const customTranslations = {
  login: {
    title: 'Welcome Back!',
    emailPlaceholder: 'Enter your email address',
    passwordPlaceholder: 'Enter your password',
    submitButton: 'Sign In',
    forgotPasswordLink: 'Forgot your password?',
    signupLink: "Don't have an account? Sign up"
  },
  signup: {
    title: 'Create Your Account',
    emailPlaceholder: 'Your email address',
    passwordPlaceholder: 'Create a password',
    submitButton: 'Create Account',
    loginLink: 'Already have an account? Sign in'
  },
  profile: {
    title: 'Account Settings',
    saveButton: 'Save Changes',
    cancelButton: 'Cancel'
  }
};

// Use translations with modals
document.getElementById('login-btn').addEventListener('click', () => {
  memberstack.openModal('LOGIN', {
    translations: customTranslations
  });
});

document.getElementById('signup-btn').addEventListener('click', () => {
  memberstack.openModal('SIGNUP', {
    translations: customTranslations
  });
});
```

Multi-Language Support:
```javascript
const translations = {
  en: {
    login: {
      title: 'Login',
      emailPlaceholder: 'Email address',
      passwordPlaceholder: 'Password',
      submitButton: 'Sign In'
    }
  },
  es: {
    login: {
      title: 'Iniciar Sesión',
      emailPlaceholder: 'Dirección de correo',
      passwordPlaceholder: 'Contraseña',
      submitButton: 'Acceder'
    }
  },
  fr: {
    login: {
      title: 'Connexion',
      emailPlaceholder: 'Adresse e-mail',
      passwordPlaceholder: 'Mot de passe',
      submitButton: 'Se connecter'
    }
  }
};

function getLanguage() {
  return navigator.language.split('-')[0] || 'en';
}

function openLocalizedModal(type) {
  const language = getLanguage();
  const modalTranslations = translations[language] || translations.en;
  
  memberstack.openModal(type, {
    translations: modalTranslations
  });
}

// Usage
document.getElementById('login-btn').addEventListener('click', () => {
  openLocalizedModal('LOGIN');
});
```

### Modal Styling
While modal styling is primarily controlled through the Memberstack dashboard, you can add custom CSS to complement the design.

**CSS Customization:**
```css
/* Target Memberstack modal containers */
[data-ms-modal] {
  /* Custom modal container styles */
  z-index: 10000;
}

[data-ms-modal] .modal-content {
  /* Custom content area styles */
  border-radius: 12px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

[data-ms-modal] .modal-header {
  /* Custom header styles */
  border-bottom: 1px solid #e5e5e5;
}

[data-ms-modal] .modal-footer {
  /* Custom footer styles */
  border-top: 1px solid #e5e5e5;
}

/* Custom button styles */
[data-ms-modal] .btn-primary {
  background: linear-gradient(45deg, #007ace, #0056b3);
  border: none;
}

[data-ms-modal] .btn-primary:hover {
  background: linear-gradient(45deg, #0056b3, #004085);
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  [data-ms-modal] {
    --ms-modal-bg: #1a1a1a;
    --ms-text-color: #ffffff;
    --ms-border-color: #333333;
  }
}
```

## Internal UI Utilities

### Loading States
Display loading indicators during operations (internal methods).

**Method Signatures:**
```typescript
memberstack._showLoader(element?: HTMLElement): void
memberstack._hideLoader(element?: HTMLElement): void
```

**Examples:**

Global Loading Indicator:
```javascript
// Show global loading overlay
memberstack._showLoader();

// Perform operation
try {
  await memberstack.loginMemberEmailPassword({ email, password });
} finally {
  // Hide global loading overlay
  memberstack._hideLoader();
}
```

Element-Specific Loading:
```javascript
const button = document.getElementById('login-btn');

// Show loading state on specific element
button.textContent = 'Signing In...';
button.disabled = true;
memberstack._showLoader(button);

try {
  await memberstack.loginMemberEmailPassword({ email, password });
} finally {
  // Hide element loading state
  memberstack._hideLoader(button);
  button.textContent = 'Sign In';
  button.disabled = false;
}
```

### Message Display
Show success or error messages to users (internal method).

**Method Signature:**
```typescript
memberstack._showMessage(message: string, isError: boolean): void
```

**Examples:**

Success Messages:
```javascript
// Show success message
memberstack._showMessage('Profile updated successfully!', false);

// Show error message
memberstack._showMessage('Login failed. Please try again.', true);
```

Custom Message Handling:
```javascript
function showCustomMessage(message, type = 'info') {
  // Use Memberstack's built-in messaging
  memberstack._showMessage(message, type === 'error');
  
  // Or implement custom message display
  const messageEl = document.getElementById('custom-messages');
  if (messageEl) {
    messageEl.innerHTML = `
      <div class="message message-${type}">
        ${message}
        <button onclick="this.parentElement.remove()">×</button>
      </div>
    `;
  }
}

// Usage
showCustomMessage('Welcome to our platform!', 'success');
showCustomMessage('Please fix the errors below', 'error');
showCustomMessage('Your session will expire soon', 'warning');
```

## Complete UI Integration Example

```javascript
class MemberstackUI {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentModal = null;
    this.setupEventHandlers();
    this.setupAuthListener();
    this.setupCustomStyling();
  }
  
  setupEventHandlers() {
    // Authentication buttons
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      // Login buttons
      if (target.matches('[data-ms-action="login"]')) {
        e.preventDefault();
        this.showLoginModal();
      }
      
      // Signup buttons
      if (target.matches('[data-ms-action="signup"]')) {
        e.preventDefault();
        this.showSignupModal();
      }
      
      // Profile buttons
      if (target.matches('[data-ms-action="profile"]')) {
        e.preventDefault();
        this.showProfileModal();
      }
      
      // Logout buttons
      if (target.matches('[data-ms-action="logout"]')) {
        e.preventDefault();
        this.handleLogout();
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + L for login
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        this.showLoginModal();
      }
      
      // Alt + S for signup
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        this.showSignupModal();
      }
      
      // Escape to close modals
      if (e.key === 'Escape') {
        this.memberstack.hideModal();
      }
    });
  }
  
  setupAuthListener() {
    this.memberstack.onAuthChange(({ member }) => {
      this.updateUIState(member);
      
      if (member) {
        // User logged in - close any auth modals
        this.memberstack.hideModal();
        this.showWelcomeMessage(member);
      }
    });
  }
  
  setupCustomStyling() {
    // Add custom CSS for modal enhancements
    const style = document.createElement('style');
    style.textContent = `
      [data-ms-modal] {
        backdrop-filter: blur(4px);
      }
      
      [data-ms-modal] .modal-content {
        animation: modalSlideIn 0.3s ease-out;
      }
      
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-50px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .ms-loading-btn {
        position: relative;
        color: transparent !important;
      }
      
      .ms-loading-btn::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border: 2px solid #ffffff;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        to {
          transform: translate(-50%, -50%) rotate(360deg);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  async showLoginModal() {
    try {
      this.currentModal = 'LOGIN';
      
      const result = await this.memberstack.openModal('LOGIN', {
        translations: this.getTranslations('login')
      });
      
      console.log('Login modal completed:', result);
    } catch (error) {
      console.log('Login modal cancelled:', error);
    } finally {
      this.currentModal = null;
    }
  }
  
  async showSignupModal() {
    try {
      this.currentModal = 'SIGNUP';
      
      const result = await this.memberstack.openModal('SIGNUP', {
        translations: this.getTranslations('signup')
      });
      
      console.log('Signup modal completed:', result);
    } catch (error) {
      console.log('Signup modal cancelled:', error);
    } finally {
      this.currentModal = null;
    }
  }
  
  async showProfileModal() {
    try {
      // Check if user is authenticated
      const member = await this.memberstack.getCurrentMember();
      if (!member.data) {
        this.showLoginModal();
        return;
      }
      
      this.currentModal = 'PROFILE';
      
      const result = await this.memberstack.openModal('PROFILE', {
        translations: this.getTranslations('profile')
      });
      
      console.log('Profile modal completed:', result);
    } catch (error) {
      console.log('Profile modal cancelled:', error);
    } finally {
      this.currentModal = null;
    }
  }
  
  async handleLogout() {
    const confirmed = confirm('Are you sure you want to log out?');
    
    if (!confirmed) return;
    
    try {
      this.memberstack._showLoader();
      await this.memberstack.logout();
      
      this.memberstack._showMessage('You have been logged out successfully', false);
    } catch (error) {
      console.error('Logout failed:', error);
      this.memberstack._showMessage('Logout failed. Please try again.', true);
    } finally {
      this.memberstack._hideLoader();
    }
  }
  
  updateUIState(member) {
    // Update authentication-dependent UI
    const authElements = document.querySelectorAll('[data-auth]');
    
    authElements.forEach(element => {
      const authState = element.dataset.auth;
      
      if (authState === 'logged-in') {
        element.style.display = member ? 'block' : 'none';
      } else if (authState === 'logged-out') {
        element.style.display = member ? 'none' : 'block';
      }
    });
    
    // Update member-specific content
    if (member) {
      document.querySelectorAll('[data-member-field]').forEach(element => {
        const field = element.dataset.memberField;
        const value = this.getNestedValue(member, field);
        
        if (value !== undefined) {
          element.textContent = value;
        }
      });
    }
  }
  
  showWelcomeMessage(member) {
    const welcomeText = member.customFields?.firstName 
      ? `Welcome back, ${member.customFields.firstName}!`
      : 'Welcome back!';
    
    this.memberstack._showMessage(welcomeText, false);
  }
  
  getTranslations(modalType) {
    // Get translations based on user's language preference
    const language = navigator.language.split('-')[0] || 'en';
    
    const translations = {
      en: {
        login: {
          title: 'Sign In to Your Account',
          submitButton: 'Sign In',
          forgotPasswordLink: 'Forgot password?'
        },
        signup: {
          title: 'Create Your Account',
          submitButton: 'Create Account'
        },
        profile: {
          title: 'Account Settings',
          saveButton: 'Save Changes'
        }
      }
      // Add more languages as needed
    };
    
    return translations[language]?.[modalType] || {};
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Initialize UI system
document.addEventListener('DOMContentLoaded', () => {
  new MemberstackUI();
});
```

**HTML Usage:**
```html
<!-- Authentication buttons with data attributes -->
<button data-ms-action="login">Sign In</button>
<button data-ms-action="signup">Sign Up</button>
<button data-ms-action="profile" data-auth="logged-in">My Account</button>
<button data-ms-action="logout" data-auth="logged-in">Sign Out</button>

<!-- Member-specific content -->
<span data-auth="logged-in">
  Welcome, <span data-member-field="customFields.firstName">User</span>!
</span>

<!-- Plan-specific content -->
<div data-auth="logged-in" data-requires-plan="pro">
  <h3>Pro Features</h3>
  <p>Access to advanced features</p>
</div>
```

## Best Practices

### Modal UX Guidelines

1. **Progressive Disclosure**: Start with login, offer signup as alternative
```javascript
// Good: Clear primary action
<button data-ms-action="login" class="btn-primary">Sign In</button>
<a href="#" data-ms-action="signup" class="link">New? Create account</a>

// Avoid: Competing equal-weight options
<button data-ms-action="login">Sign In</button>
<button data-ms-action="signup">Sign Up</button>
```

2. **Context-Aware Modals**: Show appropriate modal based on user state
```javascript
function showContextualAuth() {
  const intent = new URLSearchParams(window.location.search).get('intent');
  
  if (intent === 'signup') {
    memberstack.openModal('SIGNUP');
  } else if (intent === 'reset') {
    memberstack.openModal('FORGOT_PASSWORD');
  } else {
    memberstack.openModal('LOGIN');
  }
}
```

3. **Error Recovery**: Provide clear paths forward on modal errors
```javascript
async function showLoginWithRecovery() {
  try {
    await memberstack.openModal('LOGIN');
  } catch (error) {
    if (error.type === 'CANCELLED') {
      // User cancelled - don't show error
      return;
    }
    
    // Show recovery options
    const retry = confirm('Authentication failed. Try again?');
    if (retry) {
      showLoginWithRecovery();
    }
  }
}
```

## Next Steps

- **[02-authentication.md](02-authentication.md)** - Programmatic authentication methods
- **[06-member-journey.md](06-member-journey.md)** - Complete user journey flows
- **[09-error-handling.md](09-error-handling.md)** - Handling modal and UI errors
- **[10-examples.md](10-examples.md)** - Complete UI implementation examples# Memberstack DOM - Member Journey & Lifecycle

## AI Assistant Instructions
When implementing member journey flows:
- Use `sendMemberVerificationEmail()` for email verification
- Use `sendMemberResetPasswordEmail()` and `resetMemberPassword()` for password reset
- Include `onAuthChange()` callback for reactive UI updates
- Handle URL parameters for tokens (verification, reset, passwordless)
- Show appropriate UI states for unverified members
- Include proper error handling for email delivery failures

## Overview

Member journey management includes email verification, password reset workflows, authentication state changes, and member lifecycle events. These flows ensure secure and user-friendly experiences throughout the member's relationship with your application.

## Email Verification

### sendMemberVerificationEmail()
Send an email verification to the currently authenticated member.

**Method Signature:**
```typescript
await memberstack.sendMemberVerificationEmail(): Promise<SendMemberVerificationEmailPayload>
```

**Response:**
```typescript
{
  data: {
    success: boolean;
    message: string;
  }
}
```

**Examples:**

Basic Email Verification:
```javascript
async function sendVerificationEmail() {
  try {
    const result = await memberstack.sendMemberVerificationEmail();
    
    console.log('Verification email sent:', result.data);
    
    return {
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    
    return {
      success: false,
      message: 'Failed to send verification email. Please try again.'
    };
  }
}

// Verification button handler
document.getElementById('send-verification-btn').addEventListener('click', async () => {
  const result = await sendVerificationEmail();
  
  const messageEl = document.getElementById('verification-message');
  messageEl.textContent = result.message;
  messageEl.className = result.success ? 'message success' : 'message error';
  messageEl.style.display = 'block';
  
  if (result.success) {
    // Disable button temporarily to prevent spam
    const btn = document.getElementById('send-verification-btn');
    btn.disabled = true;
    btn.textContent = 'Email Sent';
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Resend Verification Email';
    }, 60000); // Re-enable after 1 minute
  }
});
```

Verification Status Checker:
```javascript
class EmailVerificationManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.checkInterval = null;
    this.init();
  }
  
  async init() {
    await this.checkVerificationStatus();
    this.setupVerificationUI();
    this.startPeriodicCheck();
  }
  
  async checkVerificationStatus() {
    try {
      const member = await this.memberstack.getCurrentMember({ useCache: false });
      
      if (member.data) {
        this.updateVerificationUI(member.data.verified);
        return member.data.verified;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check verification status:', error);
      return false;
    }
  }
  
  updateVerificationUI(isVerified) {
    const verificationBanner = document.getElementById('verification-banner');
    const verifiedBadge = document.getElementById('verified-badge');
    const sendVerificationBtn = document.getElementById('send-verification-btn');
    
    if (isVerified) {
      verificationBanner?.classList.add('hidden');
      verifiedBadge?.classList.remove('hidden');
      sendVerificationBtn?.classList.add('hidden');
      this.stopPeriodicCheck();
    } else {
      verificationBanner?.classList.remove('hidden');
      verifiedBadge?.classList.add('hidden');
      sendVerificationBtn?.classList.remove('hidden');
    }
  }
  
  setupVerificationUI() {
    // Send verification email button
    document.getElementById('send-verification-btn')?.addEventListener('click', 
      () => this.handleSendVerification()
    );
    
    // Resend with cooldown
    document.getElementById('resend-verification-btn')?.addEventListener('click',
      () => this.handleResendVerification()
    );
  }
  
  async handleSendVerification() {
    try {
      const result = await this.memberstack.sendMemberVerificationEmail();
      
      this.showMessage('Verification email sent! Please check your inbox.', 'success');
      this.startCooldown();
      
    } catch (error) {
      this.showMessage('Failed to send verification email. Please try again.', 'error');
    }
  }
  
  async handleResendVerification() {
    const confirmed = confirm('Send another verification email?');
    if (confirmed) {
      await this.handleSendVerification();
    }
  }
  
  startCooldown(duration = 60000) {
    const btn = document.getElementById('send-verification-btn');
    if (!btn) return;
    
    btn.disabled = true;
    
    let secondsLeft = duration / 1000;
    const countdown = setInterval(() => {
      btn.textContent = `Resend in ${secondsLeft}s`;
      secondsLeft--;
      
      if (secondsLeft < 0) {
        clearInterval(countdown);
        btn.disabled = false;
        btn.textContent = 'Resend Verification Email';
      }
    }, 1000);
  }
  
  startPeriodicCheck() {
    // Check every 30 seconds if user has verified their email
    this.checkInterval = setInterval(() => {
      this.checkVerificationStatus();
    }, 30000);
  }
  
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  showMessage(message, type) {
    const messageEl = document.getElementById('verification-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message ${type}`;
      messageEl.style.display = 'block';
      
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialize verification manager for logged-in users
document.addEventListener('DOMContentLoaded', () => {
  memberstack.onAuthChange(({ member }) => {
    if (member && !member.verified) {
      new EmailVerificationManager();
    }
  });
});
```

## Password Reset Flow

### sendMemberResetPasswordEmail()
Send a password reset email to a specified email address.

**Method Signature:**
```typescript
await memberstack.sendMemberResetPasswordEmail({
  email: string;
}): Promise<SendMemberResetPasswordEmailPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | ✅ | Email address to send reset link to |

**Examples:**

Password Reset Request:
```javascript
async function sendPasswordReset(email) {
  try {
    const result = await memberstack.sendMemberResetPasswordEmail({
      email: email.trim().toLowerCase()
    });
    
    console.log('Password reset email sent:', result.data);
    
    return {
      success: true,
      message: 'Password reset email sent! Please check your inbox and follow the instructions.'
    };
  } catch (error) {
    console.error('Password reset failed:', error);
    
    // Don't reveal if email exists for security
    return {
      success: true, // Always show success to prevent email enumeration
      message: 'If an account with this email exists, you will receive a password reset link.'
    };
  }
}

// Forgot password form
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const email = formData.get('email');
  
  if (!email) {
    alert('Please enter your email address');
    return;
  }
  
  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  
  try {
    const result = await sendPasswordReset(email);
    
    // Show success message
    document.getElementById('reset-success').textContent = result.message;
    document.getElementById('reset-success').style.display = 'block';
    
    // Hide form and show success state
    e.target.style.display = 'none';
    
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
```

### resetMemberPassword()
Complete the password reset using a token from the reset email.

**Method Signature:**
```typescript
await memberstack.resetMemberPassword({
  token: string;
  newPassword: string;
}): Promise<ResetMemberPasswordPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | ✅ | Password reset token from email |
| newPassword | string | ✅ | New password for the member |

**Examples:**

Password Reset Completion:
```javascript
async function completePasswordReset(token, newPassword) {
  try {
    const result = await memberstack.resetMemberPassword({
      token,
      newPassword
    });
    
    console.log('Password reset completed:', result.data);
    
    return {
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    };
  } catch (error) {
    console.error('Password reset failed:', error);
    
    const errorMessages = {
      'INVALID_TOKEN': 'This password reset link is invalid or has expired. Please request a new one.',
      'EXPIRED_TOKEN': 'This password reset link has expired. Please request a new one.',
      'WEAK_PASSWORD': 'Password is too weak. Please choose a stronger password.',
      'TOKEN_ALREADY_USED': 'This password reset link has already been used.'
    };
    
    return {
      success: false,
      message: errorMessages[error.code] || 'Password reset failed. Please try again.'
    };
  }
}

// Password reset page handler
class PasswordResetHandler {
  constructor() {
    this.token = this.getTokenFromURL();
    this.init();
  }
  
  getTokenFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  }
  
  init() {
    if (!this.token) {
      this.showInvalidTokenMessage();
      return;
    }
    
    this.setupForm();
  }
  
  showInvalidTokenMessage() {
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('invalid-token').style.display = 'block';
  }
  
  setupForm() {
    const form = document.getElementById('reset-password-form');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(e);
    });
    
    // Password confirmation validation
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    confirmPassword.addEventListener('input', () => {
      if (newPassword.value !== confirmPassword.value) {
        confirmPassword.setCustomValidity('Passwords do not match');
      } else {
        confirmPassword.setCustomValidity('');
      }
    });
  }
  
  async handleFormSubmit(event) {
    const formData = new FormData(event.target);
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting Password...';
    
    try {
      const result = await completePasswordReset(this.token, newPassword);
      
      if (result.success) {
        this.showSuccessMessage(result.message);
      } else {
        this.showErrorMessage(result.message);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
  
  showSuccessMessage(message) {
    document.getElementById('reset-form').style.display = 'none';
    
    const successEl = document.getElementById('reset-success');
    successEl.textContent = message;
    successEl.style.display = 'block';
    
    // Redirect to login after delay
    setTimeout(() => {
      window.location.href = '/login?message=password-reset-complete';
    }, 3000);
  }
  
  showErrorMessage(message) {
    const errorEl = document.getElementById('reset-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 10000);
  }
}

// Initialize on password reset page
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/reset-password')) {
    new PasswordResetHandler();
  }
});
```

## Passwordless Authentication Flow

### sendMemberLoginPasswordlessEmail()
Send a passwordless login email (magic link).

**Example with Complete Flow:**
```javascript
class PasswordlessLoginManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.init();
  }
  
  init() {
    // Handle passwordless login request
    this.setupPasswordlessForm();
    
    // Handle passwordless login completion (from email link)
    this.handlePasswordlessCallback();
  }
  
  setupPasswordlessForm() {
    const form = document.getElementById('passwordless-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendPasswordlessEmail(e);
    });
  }
  
  async sendPasswordlessEmail(event) {
    const formData = new FormData(event.target);
    const email = formData.get('email');
    
    if (!email) {
      this.showMessage('Please enter your email address', 'error');
      return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    try {
      const result = await this.memberstack.sendMemberLoginPasswordlessEmail({
        email: email.trim().toLowerCase()
      });
      
      console.log('Passwordless email sent:', result.data);
      
      this.showSuccessState(email);
      
    } catch (error) {
      console.error('Passwordless email failed:', error);
      this.showMessage('Failed to send login link. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
  
  showSuccessState(email) {
    document.getElementById('passwordless-form').style.display = 'none';
    
    const successEl = document.getElementById('passwordless-success');
    successEl.innerHTML = `
      <div class="success-message">
        <h3>Check Your Email</h3>
        <p>We've sent a login link to <strong>${email}</strong></p>
        <p>Click the link in your email to sign in instantly.</p>
        
        <div class="help-text">
          <p>Didn't receive the email?</p>
          <button id="resend-passwordless" class="btn-link">Send another link</button>
          <button id="use-password" class="btn-link">Use password instead</button>
        </div>
      </div>
    `;
    successEl.style.display = 'block';
    
    // Setup help actions
    document.getElementById('resend-passwordless').addEventListener('click', () => {
      document.getElementById('passwordless-form').style.display = 'block';
      successEl.style.display = 'none';
    });
    
    document.getElementById('use-password').addEventListener('click', () => {
      window.location.href = '/login';
    });
  }
  
  async handlePasswordlessCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    
    if (!token || !email) return;
    
    this.showMessage('Completing login...', 'info');
    
    try {
      const result = await this.memberstack.loginMemberPasswordless({
        passwordlessToken: token,
        email: email
      });
      
      console.log('Passwordless login successful:', result.data.member);
      
      this.showMessage('Login successful! Redirecting...', 'success');
      
      // Redirect after short delay
      setTimeout(() => {
        const redirect = params.get('redirect') || '/dashboard';
        window.location.href = redirect;
      }, 1500);
      
    } catch (error) {
      console.error('Passwordless login failed:', error);
      
      const errorMessages = {
        'INVALID_TOKEN': 'This login link is invalid or has expired.',
        'EXPIRED_TOKEN': 'This login link has expired. Please request a new one.',
        'TOKEN_ALREADY_USED': 'This login link has already been used.'
      };
      
      this.showMessage(
        errorMessages[error.code] || 'Login failed. Please try again.',
        'error'
      );
      
      // Redirect to login page after error
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    }
  }
  
  showMessage(message, type) {
    const messageEl = document.getElementById('passwordless-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message ${type}`;
      messageEl.style.display = 'block';
    }
  }
}

// Initialize passwordless manager
document.addEventListener('DOMContentLoaded', () => {
  new PasswordlessLoginManager();
});
```

## Authentication State Management

### onAuthChange()
Handle real-time authentication state changes throughout the member journey.

**Advanced State Management Example:**
```javascript
class MemberJourneyManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentMember = null;
    this.journeyState = 'anonymous';
    this.setupAuthListener();
  }
  
  setupAuthListener() {
    this.memberstack.onAuthChange(({ member }) => {
      const previousMember = this.currentMember;
      this.currentMember = member;
      
      this.updateJourneyState(member, previousMember);
      this.handleStateTransition(member, previousMember);
    });
  }
  
  updateJourneyState(member, previousMember) {
    if (!member) {
      this.journeyState = 'anonymous';
    } else if (!member.verified) {
      this.journeyState = 'unverified';
    } else if (!member.planConnections?.length) {
      this.journeyState = 'verified_free';
    } else {
      this.journeyState = 'verified_paid';
    }
    
    console.log('Journey state changed to:', this.journeyState);
  }
  
  handleStateTransition(member, previousMember) {
    // Handle login
    if (!previousMember && member) {
      this.handleMemberLogin(member);
    }
    
    // Handle logout
    if (previousMember && !member) {
      this.handleMemberLogout(previousMember);
    }
    
    // Handle verification status change
    if (member && previousMember) {
      if (!previousMember.verified && member.verified) {
        this.handleEmailVerified(member);
      }
    }
    
    // Update UI for current state
    this.updateJourneyUI();
  }
  
  handleMemberLogin(member) {
    console.log('Member logged in:', member.email);
    
    // Show welcome message
    const welcomeMessage = member.customFields?.firstName 
      ? `Welcome back, ${member.customFields.firstName}!`
      : 'Welcome back!';
    
    this.showNotification(welcomeMessage, 'success');
    
    // Track login event
    this.trackEvent('member_login', {
      member_id: member.id,
      verified: member.verified,
      plan_count: member.planConnections?.length || 0
    });
    
    // Handle post-login redirects
    this.handlePostLoginRedirect(member);
  }
  
  handleMemberLogout(previousMember) {
    console.log('Member logged out:', previousMember.email);
    
    this.showNotification('You have been logged out', 'info');
    
    // Track logout event
    this.trackEvent('member_logout', {
      member_id: previousMember.id,
      session_duration: Date.now() - (previousMember.loginTime || Date.now())
    });
    
    // Redirect to home
    if (window.location.pathname.startsWith('/dashboard') || 
        window.location.pathname.startsWith('/account')) {
      window.location.href = '/';
    }
  }
  
  handleEmailVerified(member) {
    console.log('Email verified for:', member.email);
    
    this.showNotification('Email verified successfully!', 'success');
    
    // Track verification event
    this.trackEvent('email_verified', {
      member_id: member.id
    });
    
    // Show onboarding or next steps
    this.showPostVerificationFlow(member);
  }
  
  handlePostLoginRedirect(member) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect) {
      window.location.href = decodeURIComponent(redirect);
      return;
    }
    
    // Default redirects based on member state
    switch (this.journeyState) {
      case 'unverified':
        if (!window.location.pathname.includes('/verify')) {
          window.location.href = '/verify-email';
        }
        break;
      case 'verified_free':
        if (window.location.pathname === '/login') {
          window.location.href = '/dashboard';
        }
        break;
      case 'verified_paid':
        if (window.location.pathname === '/login') {
          window.location.href = '/dashboard';
        }
        break;
    }
  }
  
  showPostVerificationFlow(member) {
    // Show welcome modal or onboarding
    if (!member.planConnections?.length) {
      // Offer plan selection
      setTimeout(() => {
        const showPlans = confirm('Welcome! Would you like to see our subscription plans?');
        if (showPlans) {
          window.location.href = '/pricing';
        }
      }, 2000);
    }
  }
  
  updateJourneyUI() {
    // Update navigation
    this.updateNavigation();
    
    // Update page content based on journey state
    this.updatePageContent();
    
    // Update banners and notifications
    this.updateBanners();
  }
  
  updateNavigation() {
    const nav = document.getElementById('main-navigation');
    if (!nav) return;
    
    // Remove all journey-specific nav items
    nav.querySelectorAll('.journey-nav').forEach(item => item.remove());
    
    // Add navigation based on current state
    switch (this.journeyState) {
      case 'anonymous':
        this.addNavItem(nav, 'Login', '/login', 'journey-nav');
        this.addNavItem(nav, 'Sign Up', '/signup', 'journey-nav');
        break;
      case 'unverified':
        this.addNavItem(nav, 'Verify Email', '/verify-email', 'journey-nav');
        this.addNavItem(nav, 'Logout', '#logout', 'journey-nav');
        break;
      case 'verified_free':
        this.addNavItem(nav, 'Dashboard', '/dashboard', 'journey-nav');
        this.addNavItem(nav, 'Upgrade', '/pricing', 'journey-nav');
        this.addNavItem(nav, 'Account', '/account', 'journey-nav');
        break;
      case 'verified_paid':
        this.addNavItem(nav, 'Dashboard', '/dashboard', 'journey-nav');
        this.addNavItem(nav, 'Account', '/account', 'journey-nav');
        this.addNavItem(nav, 'Billing', '/billing', 'journey-nav');
        break;
    }
  }
  
  updateBanners() {
    // Remove existing banners
    document.querySelectorAll('.journey-banner').forEach(banner => banner.remove());
    
    // Show relevant banners
    switch (this.journeyState) {
      case 'unverified':
        this.showVerificationBanner();
        break;
      case 'verified_free':
        if (this.shouldShowUpgradeBanner()) {
          this.showUpgradeBanner();
        }
        break;
    }
  }
  
  showVerificationBanner() {
    const banner = document.createElement('div');
    banner.className = 'journey-banner verification-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">📧</span>
        <span class="banner-text">Please verify your email address to access all features.</span>
        <button id="resend-verification-banner" class="banner-btn">Resend Email</button>
        <button class="banner-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Handle resend button
    document.getElementById('resend-verification-banner').addEventListener('click', async () => {
      try {
        await this.memberstack.sendMemberVerificationEmail();
        this.showNotification('Verification email sent!', 'success');
      } catch (error) {
        this.showNotification('Failed to send verification email', 'error');
      }
    });
  }
  
  addNavItem(nav, text, href, className = '') {
    const item = document.createElement('a');
    item.href = href;
    item.textContent = text;
    item.className = className;
    
    if (href === '#logout') {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.memberstack.logout();
      });
    }
    
    nav.appendChild(item);
  }
  
  shouldShowUpgradeBanner() {
    // Logic to determine if upgrade banner should be shown
    const lastShown = localStorage.getItem('upgrade_banner_last_shown');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    return !lastShown || parseInt(lastShown) < oneDayAgo;
  }
  
  showUpgradeBanner() {
    const banner = document.createElement('div');
    banner.className = 'journey-banner upgrade-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-text">Unlock premium features with a paid plan!</span>
        <button onclick="window.location.href='/pricing'" class="banner-btn">View Plans</button>
        <button class="banner-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Track banner shown
    localStorage.setItem('upgrade_banner_last_shown', Date.now().toString());
  }
  
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after delay
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
  
  trackEvent(eventName, properties = {}) {
    // Integration with analytics service
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, properties);
    }
    
    console.log('Event tracked:', eventName, properties);
  }
  
  updatePageContent() {
    // Update page-specific content based on journey state
    const stateElements = document.querySelectorAll('[data-journey-state]');
    
    stateElements.forEach(element => {
      const requiredState = element.dataset.journeyState;
      element.style.display = requiredState === this.journeyState ? 'block' : 'none';
    });
  }
}

// Initialize journey manager
document.addEventListener('DOMContentLoaded', () => {
  new MemberJourneyManager();
});
```

**HTML for Journey States:**
```html
<!-- Content shown only for anonymous users -->
<div data-journey-state="anonymous">
  <h1>Welcome! Sign up to get started.</h1>
  <button data-ms-action="signup">Create Account</button>
</div>

<!-- Content for unverified users -->
<div data-journey-state="unverified">
  <h1>Please verify your email</h1>
  <p>Check your inbox and click the verification link.</p>
  <button id="send-verification-btn">Resend Verification</button>
</div>

<!-- Content for verified free users -->
<div data-journey-state="verified_free">
  <h1>Welcome to your dashboard!</h1>
  <div class="upgrade-prompt">
    <p>Upgrade to unlock premium features</p>
    <a href="/pricing">View Plans</a>
  </div>
</div>

<!-- Content for verified paid users -->
<div data-journey-state="verified_paid">
  <h1>Premium Dashboard</h1>
  <div class="premium-features">
    <!-- Premium content here -->
  </div>
</div>
```

## Next Steps

- **[02-authentication.md](02-authentication.md)** - Authentication methods and flows
- **[03-member-management.md](03-member-management.md)** - Member profile and data management
- **[05-ui-components.md](05-ui-components.md)** - Pre-built UI components for journeys
- **[09-error-handling.md](09-error-handling.md)** - Handling email and verification errors# Memberstack DOM - Advanced Features

## AI Assistant Instructions
When implementing advanced Memberstack features:
- Use `getSecureContent()` for plan-gated content protection
- Implement comments with `createPost()`, `createThread()`, `getPosts()`, `getThreads()`
- Use team methods: `joinTeam()`, `getTeam()`, `generateInviteToken()`
- Include proper authentication checks before advanced operations
- Handle real-time features with WebSocket connections for comments
- Show loading states for content fetching operations

## Overview

Advanced Memberstack DOM features include secure content delivery, comments system, team management, and plan-based access control. These features enable complex membership applications with rich user interactions.

## Secure Content

### getSecureContent()
Retrieve plan-protected content that's only accessible to members with specific subscriptions.

**Method Signature:**
```typescript
await memberstack.getSecureContent({
  contentId: string;
}): Promise<GetSecureContentPayload>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| contentId | string | ✅ | Unique identifier for the secure content |

**Response:**
```typescript
{
  data: {
    id: string;
    content: string;
    contentType: "HTML" | "TEXT" | "JSON" | "MARKDOWN";
    accessLevel: string;
    // ... additional content properties
  }
}
```

**Examples:**

Basic Secure Content Retrieval:
```javascript
async function loadSecureContent(contentId) {
  try {
    const result = await memberstack.getSecureContent({
      contentId: contentId
    });
    
    console.log('Secure content loaded:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to load secure content:', error);
    
    // Handle different error scenarios
    if (error.code === 'INSUFFICIENT_ACCESS') {
      throw new Error('This content requires a premium subscription');
    } else if (error.code === 'CONTENT_NOT_FOUND') {
      throw new Error('Content not found');
    } else {
      throw new Error('Failed to load content');
    }
  }
}

// Usage
document.getElementById('load-content-btn').addEventListener('click', async () => {
  try {
    const content = await loadSecureContent('premium-tutorial-123');
    document.getElementById('content-area').innerHTML = content.content;
  } catch (error) {
    document.getElementById('content-error').textContent = error.message;
    document.getElementById('content-error').style.display = 'block';
  }
});
```

Content Gate Manager:
```javascript
class SecureContentManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.contentCache = new Map();
    this.init();
  }
  
  async init() {
    this.setupContentGates();
    this.setupDynamicLoading();
  }
  
  setupContentGates() {
    // Find all secure content elements
    document.querySelectorAll('[data-secure-content]').forEach(element => {
      this.setupContentGate(element);
    });
  }
  
  async setupContentGate(element) {
    const contentId = element.dataset.secureContent;
    const requiredPlan = element.dataset.requiredPlan;
    
    // Check if member has required access
    const hasAccess = await this.checkAccess(requiredPlan);
    
    if (hasAccess) {
      await this.loadSecureContentIntoElement(element, contentId);
    } else {
      this.showAccessDeniedMessage(element, requiredPlan);
    }
  }
  
  async checkAccess(requiredPlan) {
    try {
      const member = await this.memberstack.getCurrentMember();
      
      if (!member.data) {
        return false;
      }
      
      // Check if member has the required plan
      return member.data.planConnections?.some(connection =>
        connection.planId === requiredPlan && connection.status === 'ACTIVE'
      );
    } catch (error) {
      console.error('Failed to check access:', error);
      return false;
    }
  }
  
  async loadSecureContentIntoElement(element, contentId) {
    try {
      // Show loading state
      element.innerHTML = '<div class="loading">Loading premium content...</div>';
      
      // Check cache first
      let content = this.contentCache.get(contentId);
      
      if (!content) {
        const result = await this.memberstack.getSecureContent({ contentId });
        content = result.data;
        this.contentCache.set(contentId, content);
      }
      
      // Render content based on type
      this.renderContent(element, content);
      
    } catch (error) {
      console.error('Failed to load secure content:', error);
      this.showContentError(element, error.message);
    }
  }
  
  renderContent(element, content) {
    switch (content.contentType) {
      case 'HTML':
        element.innerHTML = content.content;
        break;
      case 'MARKDOWN':
        // Assume a markdown parser is available
        element.innerHTML = this.parseMarkdown(content.content);
        break;
      case 'JSON':
        const data = JSON.parse(content.content);
        element.innerHTML = this.renderJSONContent(data);
        break;
      case 'TEXT':
      default:
        element.textContent = content.content;
        break;
    }
    
    element.classList.add('secure-content-loaded');
  }
  
  showAccessDeniedMessage(element, requiredPlan) {
    element.innerHTML = `
      <div class="access-denied">
        <div class="lock-icon">🔒</div>
        <h3>Premium Content</h3>
        <p>This content is only available to ${requiredPlan} subscribers.</p>
        <div class="access-actions">
          <button onclick="this.showUpgradeModal('${requiredPlan}')" class="upgrade-btn">
            Upgrade Now
          </button>
          <button onclick="memberstack.openModal('LOGIN')" class="login-btn">
            Sign In
          </button>
        </div>
      </div>
    `;
    
    element.classList.add('access-denied');
  }
  
  showContentError(element, message) {
    element.innerHTML = `
      <div class="content-error">
        <p>Failed to load content: ${message}</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `;
  }
  
  setupDynamicLoading() {
    // Progressive content loading on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const contentId = element.dataset.secureContent;
          
          if (contentId && !element.classList.contains('secure-content-loaded')) {
            this.setupContentGate(element);
            observer.unobserve(element);
          }
        }
      });
    });
    
    // Observe all secure content elements
    document.querySelectorAll('[data-secure-content]').forEach(element => {
      observer.observe(element);
    });
  }
  
  parseMarkdown(markdown) {
    // Simple markdown parser - replace with full parser in production
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n/gim, '<br>');
  }
  
  renderJSONContent(data) {
    // Custom JSON content renderer
    if (data.type === 'video') {
      return `
        <div class="video-content">
          <video controls>
            <source src="${data.url}" type="video/mp4">
          </video>
          <h3>${data.title}</h3>
          <p>${data.description}</p>
        </div>
      `;
    } else if (data.type === 'document') {
      return `
        <div class="document-content">
          <h3>${data.title}</h3>
          <div class="document-body">${data.body}</div>
          <a href="${data.downloadUrl}" class="download-link">Download PDF</a>
        </div>
      `;
    }
    
    return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

// Initialize secure content manager
document.addEventListener('DOMContentLoaded', () => {
  new SecureContentManager();
});
```

## Comments System

### Posts Management

#### getPosts()
Retrieve posts from a comment channel.

**Method Signature:**
```typescript
await memberstack.getPosts({
  channelKey: string;
  order?: "newest" | "oldest";
  after?: string;
  limit?: number;
}): Promise<GetPostsPayload>
```

**Examples:**

Load Comment Posts:
```javascript
async function loadPosts(channelKey, options = {}) {
  try {
    const result = await memberstack.getPosts({
      channelKey,
      order: options.order || 'newest',
      limit: options.limit || 10,
      after: options.after
    });
    
    console.log('Posts loaded:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to load posts:', error);
    throw error;
  }
}

class CommentsSystem {
  constructor(channelKey) {
    this.channelKey = channelKey;
    this.memberstack = window.$memberstackDom;
    this.posts = [];
    this.currentMember = null;
    this.init();
  }
  
  async init() {
    await this.loadCurrentMember();
    await this.loadPosts();
    this.setupUI();
    this.setupEventListeners();
  }
  
  async loadCurrentMember() {
    try {
      const result = await this.memberstack.getCurrentMember();
      this.currentMember = result.data;
    } catch (error) {
      console.error('Failed to load current member:', error);
    }
  }
  
  async loadPosts() {
    try {
      const result = await this.memberstack.getPosts({
        channelKey: this.channelKey,
        order: 'newest',
        limit: 20
      });
      
      this.posts = result.data.posts || [];
      this.renderPosts();
    } catch (error) {
      console.error('Failed to load posts:', error);
      this.showError('Failed to load comments');
    }
  }
  
  setupUI() {
    const container = document.getElementById('comments-container');
    
    container.innerHTML = `
      <div class="comments-header">
        <h3>Comments (${this.posts.length})</h3>
      </div>
      
      <div class="comment-form">
        ${this.currentMember ? `
          <div class="user-avatar">
            <img src="${this.currentMember.profileImage || '/default-avatar.png'}" alt="Your avatar">
          </div>
          <div class="form-content">
            <textarea id="new-comment" placeholder="Write a comment..."></textarea>
            <button id="submit-comment" class="btn">Post Comment</button>
          </div>
        ` : `
          <div class="login-prompt">
            <p>Please log in to join the discussion</p>
            <button onclick="memberstack.openModal('LOGIN')">Sign In</button>
          </div>
        `}
      </div>
      
      <div id="posts-list" class="posts-list">
        <!-- Posts will be rendered here -->
      </div>
      
      <div id="load-more" class="load-more" style="display: none;">
        <button onclick="this.loadMorePosts()">Load More Comments</button>
      </div>
    `;
  }
  
  renderPosts() {
    const postsContainer = document.getElementById('posts-list');
    
    postsContainer.innerHTML = this.posts.map(post => `
      <div class="post" data-post-id="${post.id}">
        <div class="post-header">
          <img src="${post.author.profileImage || '/default-avatar.png'}" 
               alt="${post.author.name}" class="author-avatar">
          <div class="author-info">
            <span class="author-name">${post.author.name}</span>
            <span class="post-date">${this.formatDate(post.createdAt)}</span>
          </div>
          
          ${this.canEditPost(post) ? `
            <div class="post-actions">
              <button onclick="this.editPost('${post.id}')" class="edit-btn">Edit</button>
              <button onclick="this.deletePost('${post.id}')" class="delete-btn">Delete</button>
            </div>
          ` : ''}
        </div>
        
        <div class="post-content">
          ${post.content}
        </div>
        
        <div class="post-footer">
          <div class="post-voting">
            <button onclick="this.votePost('${post.id}', 'UP')" 
                    class="vote-btn ${post.userVote === 'UP' ? 'active' : ''}">
              👍 ${post.upvotes || 0}
            </button>
            <button onclick="this.votePost('${post.id}', 'DOWN')"
                    class="vote-btn ${post.userVote === 'DOWN' ? 'active' : ''}">
              👎 ${post.downvotes || 0}
            </button>
          </div>
          
          <button onclick="this.toggleThreads('${post.id}')" class="replies-btn">
            ${post.threadCount || 0} replies
          </button>
        </div>
        
        <div id="threads-${post.id}" class="threads-container" style="display: none;">
          <!-- Threads will be loaded here -->
        </div>
      </div>
    `).join('');
  }
  
  setupEventListeners() {
    // Submit new comment
    document.getElementById('submit-comment')?.addEventListener('click', () => {
      this.submitComment();
    });
    
    // Enter key to submit
    document.getElementById('new-comment')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.submitComment();
      }
    });
  }
  
  async submitComment() {
    const textarea = document.getElementById('new-comment');
    const content = textarea.value.trim();
    
    if (!content) {
      alert('Please enter a comment');
      return;
    }
    
    if (!this.currentMember) {
      memberstack.openModal('LOGIN');
      return;
    }
    
    try {
      const result = await this.memberstack.createPost({
        channelKey: this.channelKey,
        content: content
      });
      
      // Add new post to the beginning of the list
      this.posts.unshift(result.data);
      this.renderPosts();
      
      // Clear the form
      textarea.value = '';
      
      console.log('Comment posted:', result.data);
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  }
  
  canEditPost(post) {
    return this.currentMember && 
           (this.currentMember.id === post.author.id || this.currentMember.isAdmin);
  }
  
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  }
}

// Initialize comments system
document.addEventListener('DOMContentLoaded', () => {
  const channelKey = document.querySelector('[data-comments-channel]')?.dataset.commentsChannel;
  if (channelKey) {
    new CommentsSystem(channelKey);
  }
});
```

#### createPost()
Create a new post in a comment channel.

**Method Signature:**
```typescript
await memberstack.createPost({
  channelKey: string;
  content: string;
}): Promise<CreatePostPayload>
```

#### updatePost()
Update an existing post.

**Method Signature:**
```typescript
await memberstack.updatePost({
  postId: string;
  content: string;
}): Promise<UpdatePostPayload>
```

#### deletePost()
Delete a post.

**Method Signature:**
```typescript
await memberstack.deletePost({
  postId: string;
}): Promise<void>
```

#### postVote()
Vote on a post (upvote/downvote).

**Method Signature:**
```typescript
await memberstack.postVote({
  postId: string;
  vote: "UP" | "DOWN" | "NONE";
}): Promise<void>
```

### Threads Management

#### getThreads()
Get replies (threads) for a specific post.

**Method Signature:**
```typescript
await memberstack.getThreads({
  postId: string;
  order?: "newest" | "oldest";
  after?: string;
  limit?: number;
}): Promise<GetThreadsPayload>
```

#### createThread()
Create a reply to a post.

**Method Signature:**
```typescript
await memberstack.createThread({
  postId: string;
  content: string;
}): Promise<CreateThreadPayload>
```

**Complete Comments Implementation Example:**
```javascript
// Extended comments system with threads support
class AdvancedCommentsSystem extends CommentsSystem {
  constructor(channelKey) {
    super(channelKey);
    this.loadedThreads = new Set();
  }
  
  async toggleThreads(postId) {
    const threadsContainer = document.getElementById(`threads-${postId}`);
    
    if (threadsContainer.style.display === 'none') {
      // Load and show threads
      await this.loadThreads(postId);
      threadsContainer.style.display = 'block';
    } else {
      // Hide threads
      threadsContainer.style.display = 'none';
    }
  }
  
  async loadThreads(postId) {
    if (this.loadedThreads.has(postId)) return;
    
    try {
      const result = await this.memberstack.getThreads({
        postId: postId,
        order: 'oldest',
        limit: 20
      });
      
      this.renderThreads(postId, result.data.threads || []);
      this.loadedThreads.add(postId);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }
  
  renderThreads(postId, threads) {
    const threadsContainer = document.getElementById(`threads-${postId}`);
    
    threadsContainer.innerHTML = `
      <div class="thread-form">
        ${this.currentMember ? `
          <textarea placeholder="Write a reply..." id="reply-${postId}"></textarea>
          <button onclick="this.submitThread('${postId}')" class="btn-small">Reply</button>
        ` : ''}
      </div>
      
      <div class="threads-list">
        ${threads.map(thread => `
          <div class="thread" data-thread-id="${thread.id}">
            <div class="thread-header">
              <img src="${thread.author.profileImage || '/default-avatar.png'}" 
                   alt="${thread.author.name}" class="author-avatar-small">
              <span class="author-name">${thread.author.name}</span>
              <span class="thread-date">${this.formatDate(thread.createdAt)}</span>
            </div>
            <div class="thread-content">${thread.content}</div>
            
            <div class="thread-voting">
              <button onclick="this.voteThread('${thread.id}', 'UP')" 
                      class="vote-btn-small ${thread.userVote === 'UP' ? 'active' : ''}">
                👍 ${thread.upvotes || 0}
              </button>
              <button onclick="this.voteThread('${thread.id}', 'DOWN')"
                      class="vote-btn-small ${thread.userVote === 'DOWN' ? 'active' : ''}">
                👎 ${thread.downvotes || 0}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  async submitThread(postId) {
    const textarea = document.getElementById(`reply-${postId}`);
    const content = textarea.value.trim();
    
    if (!content) return;
    
    try {
      const result = await this.memberstack.createThread({
        postId: postId,
        content: content
      });
      
      // Reload threads to show the new reply
      this.loadedThreads.delete(postId);
      await this.loadThreads(postId);
      
      textarea.value = '';
      
      console.log('Thread created:', result.data);
    } catch (error) {
      console.error('Failed to create thread:', error);
      alert('Failed to post reply. Please try again.');
    }
  }
  
  async votePost(postId, vote) {
    if (!this.currentMember) {
      memberstack.openModal('LOGIN');
      return;
    }
    
    try {
      await this.memberstack.postVote({ postId, vote });
      
      // Reload posts to update vote counts
      await this.loadPosts();
    } catch (error) {
      console.error('Failed to vote on post:', error);
    }
  }
  
  async voteThread(threadId, vote) {
    if (!this.currentMember) {
      memberstack.openModal('LOGIN');
      return;
    }
    
    try {
      await this.memberstack.threadVote({ threadId, vote });
      
      // Find the post this thread belongs to and reload threads
      const post = this.posts.find(p => 
        document.querySelector(`[data-thread-id="${threadId}"]`)
               ?.closest(`[data-post-id]`)
               ?.dataset.postId === p.id
      );
      
      if (post) {
        this.loadedThreads.delete(post.id);
        await this.loadThreads(post.id);
      }
    } catch (error) {
      console.error('Failed to vote on thread:', error);
    }
  }
}
```

## Team Management

### joinTeam()
Join a team using an invitation token.

**Method Signature:**
```typescript
await memberstack.joinTeam({
  inviteToken: string;
}): Promise<void>
```

### getTeam()
Get information about a team.

**Method Signature:**
```typescript
await memberstack.getTeam({
  teamId: string;
}): Promise<GetTeamPayload>
```

### generateInviteToken()
Generate an invitation token for a team.

**Method Signature:**
```typescript
await memberstack.generateInviteToken({
  teamId: string;
}): Promise<GenerateInviteTokenPayload>
```

### removeMemberFromTeam()
Remove a member from a team.

**Method Signature:**
```typescript
await memberstack.removeMemberFromTeam({
  teamId: string;
  memberId: string;
}): Promise<void>
```

**Complete Team Management Example:**
```javascript
class TeamManager {
  constructor() {
    this.memberstack = window.$memberstackDom;
    this.currentTeam = null;
    this.init();
  }
  
  async init() {
    await this.loadCurrentTeam();
    this.setupUI();
    this.handleInviteToken();
  }
  
  async loadCurrentTeam() {
    try {
      const member = await this.memberstack.getCurrentMember();
      
      if (member.data && member.data.teamId) {
        const team = await this.memberstack.getTeam({
          teamId: member.data.teamId
        });
        this.currentTeam = team.data;
      }
    } catch (error) {
      console.error('Failed to load team:', error);
    }
  }
  
  setupUI() {
    const container = document.getElementById('team-container');
    
    if (this.currentTeam) {
      this.renderTeamDashboard(container);
    } else {
      this.renderJoinTeamPrompt(container);
    }
  }
  
  renderTeamDashboard(container) {
    container.innerHTML = `
      <div class="team-dashboard">
        <h2>${this.currentTeam.name}</h2>
        <p>Members: ${this.currentTeam.memberCount}</p>
        
        <div class="team-actions">
          <button onclick="this.generateInviteLink()">Generate Invite Link</button>
          <button onclick="this.showTeamMembers()">View Members</button>
        </div>
        
        <div id="invite-link-section" style="display: none;">
          <h3>Team Invite Link</h3>
          <div class="invite-link-container">
            <input type="text" id="invite-link" readonly>
            <button onclick="this.copyInviteLink()">Copy Link</button>
          </div>
        </div>
        
        <div id="team-members" style="display: none;">
          <!-- Team members will be loaded here -->
        </div>
      </div>
    `;
  }
  
  renderJoinTeamPrompt(container) {
    container.innerHTML = `
      <div class="join-team">
        <h2>Join a Team</h2>
        <p>Enter an invitation code to join a team:</p>
        
        <div class="join-form">
          <input type="text" id="invite-token" placeholder="Enter invitation code">
          <button onclick="this.joinTeamWithToken()">Join Team</button>
        </div>
      </div>
    `;
  }
  
  async generateInviteLink() {
    try {
      const result = await this.memberstack.generateInviteToken({
        teamId: this.currentTeam.id
      });
      
      const inviteUrl = `${window.location.origin}/join-team?token=${result.data.token}`;
      
      document.getElementById('invite-link').value = inviteUrl;
      document.getElementById('invite-link-section').style.display = 'block';
      
      console.log('Invite link generated:', inviteUrl);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      alert('Failed to generate invite link');
    }
  }
  
  copyInviteLink() {
    const linkInput = document.getElementById('invite-link');
    linkInput.select();
    document.execCommand('copy');
    
    // Show feedback
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }
  
  async joinTeamWithToken() {
    const token = document.getElementById('invite-token').value.trim();
    
    if (!token) {
      alert('Please enter an invitation code');
      return;
    }
    
    try {
      await this.memberstack.joinTeam({
        inviteToken: token
      });
      
      alert('Successfully joined the team!');
      
      // Reload the page to show team dashboard
      window.location.reload();
    } catch (error) {
      console.error('Failed to join team:', error);
      
      const errorMessages = {
        'INVALID_TOKEN': 'Invalid invitation code',
        'EXPIRED_TOKEN': 'This invitation has expired',
        'ALREADY_MEMBER': 'You are already a member of this team'
      };
      
      alert(errorMessages[error.code] || 'Failed to join team');
    }
  }
  
  handleInviteToken() {
    // Check if there's an invite token in the URL
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');
    
    if (inviteToken) {
      const confirmed = confirm('You\'ve been invited to join a team. Would you like to join?');
      
      if (confirmed) {
        document.getElementById('invite-token').value = inviteToken;
        this.joinTeamWithToken();
      }
    }
  }
  
  async showTeamMembers() {
    const membersContainer = document.getElementById('team-members');
    
    // This would typically load team members from your backend
    // Since the DOM package doesn't have a direct method for this,
    // you'd implement this with your own API
    
    membersContainer.innerHTML = `
      <h3>Team Members</h3>
      <div class="members-list">
        <!-- Team members would be listed here -->
        <p>Member management features require custom implementation</p>
      </div>
    `;
    
    membersContainer.style.display = 'block';
  }
}

// Initialize team manager
document.addEventListener('DOMContentLoaded', () => {
  new TeamManager();
});
```

## Event Tracking

### _Event()
Track custom events for analytics (internal method).

**Method Signature:**
```typescript
await memberstack._Event({
  data: {
    eventName: string;
    properties: Record<string, any>;
  };
}): Promise<void>
```

**Example:**
```javascript
async function trackCustomEvent(eventName, properties = {}) {
  try {
    await memberstack._Event({
      data: {
        eventName: eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      }
    });
    
    console.log('Event tracked:', eventName, properties);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

// Usage examples
trackCustomEvent('premium_content_viewed', {
  contentId: 'tutorial-123',
  contentType: 'video',
  duration: 300
});

trackCustomEvent('team_invite_sent', {
  teamId: 'team-456',
  inviteMethod: 'link'
});
```

## Next Steps

- **[04-plan-management.md](04-plan-management.md)** - Plan-based access control
- **[08-types-reference.md](08-types-reference.md)** - TypeScript definitions for advanced features
- **[09-error-handling.md](09-error-handling.md)** - Handling advanced feature errors
- **[10-examples.md](10-examples.md)** - Complete implementation examples# Memberstack DOM - TypeScript Types Reference

## AI Assistant Instructions
When providing TypeScript support:
- Use these exact type definitions in code examples
- Import types from `@memberstack/dom` when available
- Include proper error type handling in catch blocks
- Use union types for method parameters with multiple options
- Reference specific interfaces when explaining method signatures

## Overview

This reference provides complete TypeScript type definitions for the Memberstack DOM package. Use these types for better IDE support, type checking, and development experience.

## Core Configuration Types

### DOMConfig
Configuration object for initializing Memberstack DOM.

```typescript
interface DOMConfig {
  publicKey: string;                    // Required: Your Memberstack public key
  appId?: string;                      // Optional: Specific app ID override
  useCookies?: boolean;                // Optional: Enable cookie-based auth storage
  setCookieOnRootDomain?: boolean;     // Optional: Set cookies on root domain
  domain?: string;                     // Optional: Custom API endpoint
  sessionDurationDays?: number;        // Optional: Deprecated - handled automatically
}
```

**Usage:**
```typescript
const config: DOMConfig = {
  publicKey: 'pk_sb_your-key-here',
  useCookies: true,
  setCookieOnRootDomain: true,
  domain: 'https://api.memberstack.com'
};

const memberstack = MemberstackDom.init(config);
```

## Authentication Types

### Login Parameters

```typescript
interface LoginMemberEmailPasswordParams {
  email: string;
  password: string;
}

interface LoginMemberPasswordlessParams {
  passwordlessToken: string;
  email: string;
}

interface LoginWithProviderParams {
  provider: string;                    // 'GOOGLE' | 'FACEBOOK'
  allowSignup?: boolean;               // Allow account creation if no account exists
}
```

### Signup Parameters

```typescript
interface SignupMemberEmailPasswordParams {
  email: string;
  password: string;
  customFields?: Record<string, any>;  // Additional member data
  metaData?: Record<string, any>;      // Internal metadata (rarely used)
  plans?: Array<{ planId: string }>;   // Free plans to assign during signup
  captchaToken?: string;               // hCaptcha token if captcha enabled
  inviteToken?: string;                // Team invitation token
}

interface SignupWithProviderParams {
  provider: string;                    // 'GOOGLE' | 'FACEBOOK'
  customFields?: Record<string, any>;
  plans?: Array<{ planId: string }>;
  allowLogin?: boolean;                // Allow login if account already exists
}
```

### Authentication Response Types

```typescript
interface LoginMemberEmailPasswordPayload {
  data: {
    member: Member;
    tokens: {
      accessToken: string;
      expires: number;                 // Unix timestamp
    };
  };
}

interface SignupMemberEmailPasswordPayload {
  data: {
    member: Member;
    tokens: {
      accessToken: string;
      expires: number;
    };
  };
}

interface LogoutMemberPayload {
  data: {
    redirect?: string;                 // Optional redirect URL after logout
  };
}
```

## Member Types

### Core Member Interface

```typescript
interface Member {
  id: string;                         // Unique member identifier
  email: string;                      // Member's email address
  verified: boolean;                  // Email verification status
  loginRedirectUrl?: string | null;   // Redirect URL after login
  customFields: Record<string, any>;  // Custom field data
  profileImage?: string | null;       // Profile image URL
  metaData: Record<string, any>;      // Internal metadata
  planConnections: PlanConnection[];  // Active plan subscriptions
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
}

interface PlanConnection {
  id: string;                         // Connection identifier
  planId: string;                     // Reference to plan
  status: PlanConnectionStatus;       // Connection status
  payment?: {                         // Payment details for paid plans
    priceId: string;                  // Stripe price ID - USE THIS for plan detection
  };
  createdAt: string;                  // When connection was created
  updatedAt: string;                  // Last status change
  cancelledAt?: string | null;        // When cancelled (if applicable)
  pausedAt?: string | null;          // When paused (if applicable)
}

type PlanConnectionStatus = 
  | 'ACTIVE'                         // Currently active subscription
  | 'CANCELLED'                      // Cancelled subscription
  | 'PAST_DUE'                      // Payment failed
  | 'TRIALING'                      // In trial period
  | 'PAUSED';                       // Temporarily paused
```

### Member Management Parameters

```typescript
interface UpdateMemberParams {
  customFields?: Record<string, any>; // Only custom fields can be updated
}

interface UpdateMemberAuthParams {
  email?: string;                     // New email address
  oldPassword?: string;               // Current password (required for changes)
  newPassword?: string;               // New password
}

interface UpdateMemberProfileImageParams {
  profileImage: File;                 // Image file to upload
}

interface GetCurrentMemberParams {
  useCache?: boolean;                 // Use cached data vs fresh from server
}
```

### Member Response Types

```typescript
interface GetCurrentMemberPayload {
  data: Member | null;                // null if no member authenticated
}

interface UpdateMemberPayload {
  data: Member;                       // Updated member object
}

interface UpdateMemberAuthPayload {
  data: Member;                       // Member with updated auth info
}

interface UpdateMemberProfileImagePayload {
  data: {
    profileImage: string;             // New profile image URL
  };
}

interface DeleteMemberPayload {
  data: {
    success: boolean;
    deletedMemberId: string;
  };
}
```

## Plan Management Types

### Plan Interface

```typescript
interface Plan {
  id: string;                         // Unique plan identifier
  name: string;                       // Plan name
  description: string;                // Plan description
  type: PlanType;                     // Plan type
  prices: Price[];                    // Available pricing options
  features?: string[];                // List of plan features
  status: PlanStatus;                 // Plan availability status
  createdAt: string;
  updatedAt: string;
}

type PlanType = 'FREE' | 'PAID';

type PlanStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

interface Price {
  id: string;                         // Stripe price ID
  amount: number;                     // Price in cents (e.g., 999 = $9.99)
  currency: string;                   // Currency code (e.g., 'usd')
  interval: PriceInterval;            // Billing interval
  intervalCount: number;              // Interval multiplier (e.g., 2 = every 2 months)
  trialPeriodDays?: number;          // Trial period length
}

type PriceInterval = 'day' | 'week' | 'month' | 'year' | 'one_time';
```

### Plan Management Parameters

```typescript
interface AddPlanParams {
  planId: string;                     // Plan ID to add (free plans only)
}

interface RemovePlanParams {
  planId: string;                     // Plan ID to remove
}

interface GetPlanParams {
  planId: string;                     // Plan ID to retrieve
}

interface PurchasePlansWithCheckoutParams {
  priceId: string;                    // Stripe price ID (required)
  couponId?: string;                  // Stripe coupon code
  successUrl?: string;                // Redirect after successful payment
  cancelUrl?: string;                 // Redirect if payment cancelled
  autoRedirect?: boolean;             // Auto-redirect to checkout (default: true)
  metadataForCheckout?: object;       // Additional checkout metadata
}

interface LaunchStripeCustomerPortalParams {
  returnUrl?: string;                 // URL to return after portal session
  autoRedirect?: boolean;             // Auto-redirect to portal (default: true)
  priceIds?: string[];                // Specific prices to allow in portal
  configuration?: object;             // Stripe portal configuration
}
```

### Plan Response Types

```typescript
interface GetPlansPayload {
  data: Plan[];                       // Array of available plans
}

interface GetPlanPayload {
  data: Plan;                         // Single plan object
}

interface AddPlanPayload {
  data: {
    planConnection: PlanConnection;   // Created plan connection
  };
}

interface RemovePlanPayload {
  data: {
    success: boolean;
    message: string;
  };
}

interface PurchasePlansWithCheckoutPayload {
  data: {
    url: string;                      // Stripe checkout URL
  };
}

interface LaunchStripeCustomerPortalPayload {
  data: {
    url: string;                      // Stripe portal URL
  };
}
```

## UI Component Types

### Modal Types

```typescript
type ModalType = 
  | 'LOGIN'                           // Email/password login modal
  | 'SIGNUP'                         // Account creation modal
  | 'FORGOT_PASSWORD'                // Password reset request modal
  | 'RESET_PASSWORD'                 // Password reset completion modal
  | 'PROFILE';                       // Member profile management modal

interface OpenModalParams {
  type: ModalType;
  translations?: MemberstackTranslations;
  [key: string]: any;                // Additional modal options
}

interface MemberstackTranslations {
  login?: {
    title?: string;
    emailPlaceholder?: string;
    passwordPlaceholder?: string;
    submitButton?: string;
    forgotPasswordLink?: string;
    signupLink?: string;
    socialLoginText?: string;
    errorMessages?: Record<string, string>;
  };
  signup?: {
    title?: string;
    emailPlaceholder?: string;
    passwordPlaceholder?: string;
    confirmPasswordPlaceholder?: string;
    submitButton?: string;
    loginLink?: string;
    termsText?: string;
    errorMessages?: Record<string, string>;
  };
  profile?: {
    title?: string;
    saveButton?: string;
    cancelButton?: string;
    sections?: {
      personalInfo?: string;
      security?: string;
      billing?: string;
    };
  };
  forgotPassword?: {
    title?: string;
    emailPlaceholder?: string;
    submitButton?: string;
    backToLoginLink?: string;
    successMessage?: string;
  };
  resetPassword?: {
    title?: string;
    passwordPlaceholder?: string;
    confirmPasswordPlaceholder?: string;
    submitButton?: string;
    successMessage?: string;
  };
}
```

## Advanced Feature Types

### Secure Content Types

```typescript
interface GetSecureContentParams {
  contentId: string;                  // Unique content identifier
}

interface GetSecureContentPayload {
  data: {
    id: string;
    content: string;                  // The actual content
    contentType: ContentType;         // Format of the content
    accessLevel: string;              // Required access level
    metadata?: Record<string, any>;   // Additional content metadata
  };
}

type ContentType = 'HTML' | 'TEXT' | 'JSON' | 'MARKDOWN';
```

### Comments System Types

```typescript
interface GetPostsParams {
  channelKey: string;                 // Comment channel identifier
  order?: 'newest' | 'oldest';       // Sort order (default: 'newest')
  after?: string;                     // Pagination cursor
  limit?: number;                     // Max posts to return (default: 10)
}

interface CreatePostParams {
  channelKey: string;                 // Channel to post in
  content: string;                    // Post content
}

interface UpdatePostParams {
  postId: string;                     // Post to update
  content: string;                    // New content
}

interface DeletePostParams {
  postId: string;                     // Post to delete
}

interface PostVoteParams {
  postId: string;                     // Post to vote on
  vote: 'UP' | 'DOWN' | 'NONE';      // Vote type
}

interface GetThreadsParams {
  postId: string;                     // Parent post ID
  order?: 'newest' | 'oldest';       // Sort order
  after?: string;                     // Pagination cursor
  limit?: number;                     // Max threads to return
}

interface CreateThreadParams {
  postId: string;                     // Parent post ID
  content: string;                    // Thread content
}

interface UpdateThreadParams {
  threadId: string;                   // Thread to update
  content: string;                    // New content
}

interface DeleteThreadParams {
  threadId: string;                   // Thread to delete
}

interface ThreadVoteParams {
  threadId: string;                   // Thread to vote on
  vote: 'UP' | 'DOWN' | 'NONE';      // Vote type
}
```

### Comments Response Types

```typescript
interface Post {
  id: string;                         // Unique post identifier
  channelKey: string;                 // Channel this post belongs to
  content: string;                    // Post content
  author: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
  upvotes: number;                    // Number of upvotes
  downvotes: number;                  // Number of downvotes
  userVote?: 'UP' | 'DOWN';          // Current user's vote
  threadCount: number;                // Number of replies
  isPinned: boolean;                  // Whether post is pinned
  isEdited: boolean;                  // Whether post has been edited
}

interface Thread {
  id: string;                         // Unique thread identifier
  postId: string;                     // Parent post ID
  content: string;                    // Thread content
  author: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
  upvotes: number;                    // Number of upvotes
  downvotes: number;                  // Number of downvotes
  userVote?: 'UP' | 'DOWN';          // Current user's vote
  isEdited: boolean;                  // Whether thread has been edited
}

interface GetPostsPayload {
  data: {
    posts: Post[];                    // Array of posts
    hasNextPage: boolean;             // Whether more posts are available
    nextCursor?: string;              // Cursor for next page
    totalCount: number;               // Total number of posts
  };
}

interface GetThreadsPayload {
  data: {
    threads: Thread[];                // Array of threads
    hasNextPage: boolean;             // Whether more threads are available
    nextCursor?: string;              // Cursor for next page
    totalCount: number;               // Total number of threads
  };
}

interface CreatePostPayload {
  data: Post;                         // Created post object
}

interface CreateThreadPayload {
  data: Thread;                       // Created thread object
}

interface UpdatePostPayload {
  data: Post;                         // Updated post object
}

interface UpdateThreadPayload {
  data: Thread;                       // Updated thread object
}
```

### Team Management Types

```typescript
interface JoinTeamParams {
  inviteToken: string;                // Team invitation token
}

interface GetTeamParams {
  teamId: string;                     // Team identifier
}

interface GenerateInviteTokenParams {
  teamId: string;                     // Team to generate invite for
}

interface RemoveMemberFromTeamParams {
  teamId: string;                     // Team identifier
  memberId: string;                   // Member to remove
}

interface Team {
  id: string;                         // Unique team identifier
  name: string;                       // Team name
  description?: string;               // Team description
  memberCount: number;                // Number of team members
  maxMembers?: number;                // Maximum allowed members
  ownerId: string;                    // Team owner's member ID
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
}

interface GetTeamPayload {
  data: Team;                         // Team object
}

interface GenerateInviteTokenPayload {
  data: {
    token: string;                    // Generated invite token
    expiresAt: string;                // Token expiration time
    maxUses?: number;                 // Maximum number of uses
  };
}
```

## Email & Journey Types

### Email Verification Types

```typescript
interface SendMemberVerificationEmailPayload {
  data: {
    success: boolean;
    message: string;
  };
}
```

### Password Reset Types

```typescript
interface SendMemberResetPasswordEmailParams {
  email: string;                      // Email to send reset link to
}

interface ResetMemberPasswordParams {
  token: string;                      // Reset token from email
  newPassword: string;                // New password
}

interface SendMemberResetPasswordEmailPayload {
  data: string;                       // Success message
}

interface ResetMemberPasswordPayload {
  data: {
    success: boolean;
    message: string;
  };
}
```

### Passwordless Authentication Types

```typescript
interface SendMemberLoginPasswordlessEmailParams {
  email: string;                      // Email to send magic link to
}

interface SendMemberLoginPasswordlessEmailPayload {
  data: {
    success: boolean;
  };
}
```

## Event & Analytics Types

```typescript
interface EventParams {
  data: {
    eventName: string;                // Event identifier
    properties: Record<string, any>;  // Event properties
    timestamp?: string;               // Event timestamp (auto-generated if omitted)
    sessionId?: string;               // Session identifier
    userId?: string;                  // User identifier
  };
}
```

## Error Types

```typescript
interface MemberstackError extends Error {
  code: string;                       // Error code identifier
  message: string;                    // Human-readable error message
  details?: any;                      // Additional error details
  statusCode?: number;                // HTTP status code
}

// Common error codes
type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'             // Wrong email/password
  | 'MEMBER_NOT_VERIFIED'            // Email not verified
  | 'ACCOUNT_LOCKED'                 // Too many failed attempts
  | 'INVALID_TOKEN'                  // Invalid auth token
  | 'TOKEN_EXPIRED'                  // Expired token
  | 'EMAIL_ALREADY_EXISTS'           // Email in use during signup
  | 'WEAK_PASSWORD';                 // Password doesn't meet requirements

type PlanErrorCode = 
  | 'PLAN_NOT_FOUND'                 // Plan doesn't exist
  | 'PLAN_NOT_FREE'                  // Tried to add paid plan with addPlan()
  | 'PLAN_ALREADY_ACTIVE'            // Member already has this plan
  | 'INSUFFICIENT_ACCESS'            // Member doesn't have required plan
  | 'PAYMENT_REQUIRED';              // Payment needed for plan

type ContentErrorCode = 
  | 'CONTENT_NOT_FOUND'              // Secure content doesn't exist
  | 'INSUFFICIENT_ACCESS'            // Member lacks required plan
  | 'CONTENT_EXPIRED';               // Content no longer available

type TeamErrorCode = 
  | 'TEAM_NOT_FOUND'                 // Team doesn't exist
  | 'INVALID_INVITE_TOKEN'           // Invalid invitation token
  | 'INVITE_EXPIRED'                 // Invitation has expired
  | 'ALREADY_MEMBER'                 // Already a team member
  | 'TEAM_FULL';                     // Team has reached member limit
```

## Authentication State Types

```typescript
interface AuthChangeCallback {
  (params: { member: Member | null }): void;
}

interface MemberstackOptions {
  token?: string;                     // Override auth token
}
```

## Utility Types

```typescript
// Generic API response wrapper
interface Response<T> {
  data: T;
}

// Paginated response wrapper
interface PaginatedResponse<T> {
  data: T[];
  hasNext: boolean;
  endCursor: string | null;
  totalCount: number;
}

// HTTP method types
enum HttpMethod {
  POST = 'POST',
  GET = 'GET', 
  PATCH = 'PATCH',
  DELETE = 'DELETE'
}

// HTTP headers
enum HttpHeaders {
  AUTHORIZATION = 'Authorization',
  API_KEY = 'X-API-Key',
  APP_ID = 'X-APP-ID',
  API_VERSION = 'X-API-Version',
  USER_AGENT = 'X-User-Agent',
  SESSION_ID = 'X-Session-ID'
}
```

## Complete TypeScript Usage Example

```typescript
import MemberstackDom from '@memberstack/dom';
import type {
  DOMConfig,
  Member,
  LoginMemberEmailPasswordParams,
  SignupMemberEmailPasswordParams,
  MemberstackError,
  AuthChangeCallback
} from '@memberstack/dom';

class TypedMemberstackManager {
  private memberstack: any;
  private currentMember: Member | null = null;
  
  constructor(config: DOMConfig) {
    this.memberstack = MemberstackDom.init(config);
    this.setupAuthListener();
  }
  
  private setupAuthListener(): void {
    const authCallback: AuthChangeCallback = ({ member }) => {
      this.currentMember = member;
      this.handleAuthStateChange(member);
    };
    
    this.memberstack.onAuthChange(authCallback);
  }
  
  private handleAuthStateChange(member: Member | null): void {
    if (member) {
      console.log('Member logged in:', member.email);
      this.updateUIForAuthenticatedUser(member);
    } else {
      console.log('Member logged out');
      this.updateUIForAnonymousUser();
    }
  }
  
  async login(params: LoginMemberEmailPasswordParams): Promise<Member> {
    try {
      const result = await this.memberstack.loginMemberEmailPassword(params);
      return result.data.member;
    } catch (error) {
      const memberstackError = error as MemberstackError;
      
      switch (memberstackError.code) {
        case 'INVALID_CREDENTIALS':
          throw new Error('Invalid email or password');
        case 'MEMBER_NOT_VERIFIED':
          throw new Error('Please verify your email first');
        default:
          throw new Error('Login failed');
      }
    }
  }
  
  async signup(params: SignupMemberEmailPasswordParams): Promise<Member> {
    try {
      const result = await this.memberstack.signupMemberEmailPassword(params);
      return result.data.member;
    } catch (error) {
      const memberstackError = error as MemberstackError;
      
      switch (memberstackError.code) {
        case 'EMAIL_ALREADY_EXISTS':
          throw new Error('An account with this email already exists');
        case 'WEAK_PASSWORD':
          throw new Error('Password is too weak');
        default:
          throw new Error('Signup failed');
      }
    }
  }
  
  async getCurrentMember(useCache: boolean = false): Promise<Member | null> {
    try {
      const result = await this.memberstack.getCurrentMember({ useCache });
      return result.data;
    } catch (error) {
      console.error('Failed to get current member:', error);
      return null;
    }
  }
  
  private updateUIForAuthenticatedUser(member: Member): void {
    // Type-safe UI updates
    const nameElement = document.getElementById('member-name');
    if (nameElement) {
      nameElement.textContent = member.customFields?.firstName || member.email;
    }
    
    // Show/hide elements based on plan status
    const hasPaidPlan = member.planConnections.some(
      (connection): boolean => connection.status === 'ACTIVE'
    );
    
    this.toggleElements('[data-requires-paid-plan]', hasPaidPlan);
    this.toggleElements('[data-auth="logged-in"]', true);
    this.toggleElements('[data-auth="logged-out"]', false);
  }
  
  private updateUIForAnonymousUser(): void {
    this.toggleElements('[data-auth="logged-in"]', false);
    this.toggleElements('[data-auth="logged-out"]', true);
    this.toggleElements('[data-requires-paid-plan]', false);
  }
  
  private toggleElements(selector: string, show: boolean): void {
    document.querySelectorAll(selector).forEach((element: Element) => {
      (element as HTMLElement).style.display = show ? 'block' : 'none';
    });
  }
}

// Usage
const config: DOMConfig = {
  publicKey: 'pk_sb_your-key-here',
  useCookies: true
};

const memberstackManager = new TypedMemberstackManager(config);

// Type-safe method calls
async function handleLogin(email: string, password: string): Promise<void> {
  try {
    const member = await memberstackManager.login({ email, password });
    console.log('Logged in as:', member.email);
  } catch (error) {
    console.error('Login error:', error.message);
  }
}
```

## Next Steps

- **[09-error-handling.md](09-error-handling.md)** - Complete error handling guide
- **[10-examples.md](10-examples.md)** - Real-world TypeScript examples
- **[02-authentication.md](02-authentication.md)** - Authentication implementation with types# Memberstack DOM - Error Handling & Troubleshooting

## AI Assistant Instructions
When implementing error handling for Memberstack:
- Always wrap API calls in try/catch blocks
- Use specific error codes for conditional logic
- Provide user-friendly error messages
- Log detailed errors for debugging
- Implement retry mechanisms for network errors
- Reference specific error types from 08-types-reference.md

## Overview

Comprehensive error handling guide for Memberstack DOM package, including error codes, debugging strategies, common issues, and recovery patterns.

## Error Structure

All Memberstack errors follow a consistent structure:

```typescript
interface MemberstackError extends Error {
  code: string;           // Specific error code
  message: string;        // Human-readable message
  details?: any;          // Additional error details
  status?: number;        // HTTP status code (if applicable)
  field?: string;         // Field that caused validation error
  context?: string;       // Additional context information
}
```

## Error Codes Reference

### Authentication Errors

#### AUTH_001 - Invalid Credentials
**Code:** `INVALID_CREDENTIALS`
**Description:** Email/password combination is incorrect
**Common Causes:**
- Wrong email or password
- Account doesn't exist
- Typo in credentials

**Example:**
```typescript
try {
  await memberstack.loginMemberEmailPassword({
    email: 'user@example.com',
    password: 'wrongpassword'
  });
} catch (error) {
  if (error.code === 'INVALID_CREDENTIALS') {
    setError('Email or password is incorrect. Please try again.');
  }
}
```

#### AUTH_002 - Member Not Found
**Code:** `MEMBER_NOT_FOUND`
**Description:** No member exists with the provided email
**Common Causes:**
- Member hasn't signed up yet
- Email typo
- Different email used for signup

#### AUTH_003 - Member Not Verified
**Code:** `MEMBER_NOT_VERIFIED`
**Description:** Member must verify their email before logging in
**Recovery Pattern:**
```typescript
try {
  await memberstack.loginMemberEmailPassword({ email, password });
} catch (error) {
  if (error.code === 'MEMBER_NOT_VERIFIED') {
    // Offer to resend verification email
    const resend = confirm('Please verify your email. Resend verification?');
    if (resend) {
      await memberstack.sendMemberEmailVerification({ email });
      alert('Verification email sent!');
    }
  }
}
```

#### AUTH_004 - Account Disabled
**Code:** `MEMBER_DISABLED`
**Description:** Member account has been disabled by admin
**Common Causes:**
- Admin disabled the account
- Violation of terms
- Security concerns

#### AUTH_005 - Too Many Login Attempts
**Code:** `TOO_MANY_ATTEMPTS`
**Description:** Account temporarily locked due to failed login attempts
**Recovery Pattern:**
```typescript
if (error.code === 'TOO_MANY_ATTEMPTS') {
  setError('Too many failed attempts. Please wait 15 minutes before trying again.');
  // Implement exponential backoff
  setTimeout(() => setCanRetry(true), 15 * 60 * 1000);
}
```

### Validation Errors

#### VAL_001 - Invalid Email Format
**Code:** `INVALID_EMAIL`
**Description:** Email format is invalid
**Field:** `email`

#### VAL_002 - Password Too Weak
**Code:** `WEAK_PASSWORD`
**Description:** Password doesn't meet security requirements
**Field:** `password`
**Details:** Usually includes password requirements

```typescript
try {
  await memberstack.signupMemberEmailPassword({ email, password });
} catch (error) {
  if (error.code === 'WEAK_PASSWORD') {
    setPasswordError(`Password requirements: ${error.details.requirements.join(', ')}`);
  }
}
```

#### VAL_003 - Email Already Exists
**Code:** `EMAIL_EXISTS`
**Description:** Member already exists with this email
**Recovery Pattern:**
```typescript
if (error.code === 'EMAIL_EXISTS') {
  const login = confirm('Account exists. Would you like to log in instead?');
  if (login) {
    // Redirect to login form
    setMode('login');
    setEmail(email); // Pre-fill email
  }
}
```

#### VAL_004 - Required Field Missing
**Code:** `REQUIRED_FIELD`
**Description:** Required field is missing or empty
**Field:** Name of the missing field

### Network & API Errors

#### NET_001 - Network Connection Error
**Code:** `NETWORK_ERROR`
**Description:** Unable to connect to Memberstack servers
**Recovery Pattern:**
```typescript
if (error.code === 'NETWORK_ERROR') {
  setError('Connection failed. Please check your internet and try again.');
  // Implement retry with exponential backoff
  setTimeout(() => retryOperation(), 2000);
}
```

#### NET_002 - API Rate Limit
**Code:** `RATE_LIMIT_EXCEEDED`
**Description:** Too many API requests in a short time
**Status:** `429`

#### NET_003 - Server Error
**Code:** `SERVER_ERROR`
**Description:** Internal server error
**Status:** `5xx`
**Recovery Pattern:**
```typescript
if (error.status >= 500) {
  setError('Server temporarily unavailable. Please try again in a moment.');
  // Implement retry with backoff
  setTimeout(() => retryWithBackoff(), calculateBackoff(attempts));
}
```

### Plan & Subscription Errors

#### PLAN_001 - Plan Not Found
**Code:** `PLAN_NOT_FOUND`
**Description:** Requested plan doesn't exist or isn't available

#### PLAN_002 - Payment Failed
**Code:** `PAYMENT_FAILED`
**Description:** Stripe checkout or payment processing failed
**Details:** Usually includes Stripe error details

```typescript
try {
  await memberstack.createCheckoutSession({ planId, successUrl, cancelUrl });
} catch (error) {
  if (error.code === 'PAYMENT_FAILED') {
    setError(`Payment failed: ${error.details.stripeError.message}`);
    // Log for debugging
    console.error('Stripe error:', error.details);
  }
}
```

#### PLAN_003 - Subscription Required
**Code:** `SUBSCRIPTION_REQUIRED`
**Description:** Feature requires an active subscription
**Recovery Pattern:**
```typescript
if (error.code === 'SUBSCRIPTION_REQUIRED') {
  const upgrade = confirm('This feature requires a subscription. Upgrade now?');
  if (upgrade) {
    // Redirect to plan selection
    window.location.href = '/plans';
  }
}
```

### Permission & Access Errors

#### PERM_001 - Insufficient Permissions
**Code:** `INSUFFICIENT_PERMISSIONS`
**Description:** Member doesn't have required permissions for this action

#### PERM_002 - Plan Access Denied
**Code:** `PLAN_ACCESS_DENIED`
**Description:** Member's current plan doesn't allow this feature

#### PERM_003 - Content Gated
**Code:** `CONTENT_GATED`
**Description:** Content requires specific plan or permission
**Recovery Pattern:**
```typescript
try {
  const content = await memberstack.getSecureContent({ contentId });
} catch (error) {
  if (error.code === 'CONTENT_GATED') {
    showUpgradeModal(error.details.requiredPlan);
  }
}
```

## Universal Error Handler

Implement a centralized error handler for consistent error management:

```typescript
class MemberstackErrorHandler {
  private static showUserMessage(message: string, type: 'error' | 'warning' | 'info') {
    // Your UI notification system
    toast.show(message, type);
  }

  private static logError(error: MemberstackError, context: string) {
    console.group(`Memberstack Error: ${error.code}`);
    console.error('Message:', error.message);
    console.error('Context:', context);
    console.error('Details:', error.details);
    console.error('Stack:', error.stack);
    console.groupEnd();
  }

  static handle(error: MemberstackError, context: string = 'Unknown'): void {
    this.logError(error, context);

    // Handle specific error types
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        this.showUserMessage('Invalid email or password. Please try again.', 'error');
        break;

      case 'MEMBER_NOT_VERIFIED':
        this.showUserMessage('Please verify your email address to continue.', 'warning');
        break;

      case 'NETWORK_ERROR':
        this.showUserMessage('Connection issue. Please check your internet and retry.', 'error');
        break;

      case 'RATE_LIMIT_EXCEEDED':
        this.showUserMessage('Too many requests. Please wait a moment and try again.', 'warning');
        break;

      case 'PAYMENT_FAILED':
        this.showUserMessage('Payment could not be processed. Please try again.', 'error');
        break;

      case 'SUBSCRIPTION_REQUIRED':
        this.showUserMessage('This feature requires a subscription upgrade.', 'info');
        break;

      default:
        this.showUserMessage('Something went wrong. Please try again.', 'error');
        break;
    }
  }
}

// Usage in your application
try {
  await memberstack.loginMemberEmailPassword({ email, password });
} catch (error) {
  MemberstackErrorHandler.handle(error, 'User Login');
}
```

## Retry Mechanisms

### Exponential Backoff Implementation

```typescript
class RetryHandler {
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    context: string = 'Operation'
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (error.code && this.shouldNotRetry(error.code)) {
          throw error;
        }

        if (attempt === maxAttempts) {
          console.error(`${context} failed after ${maxAttempts} attempts:`, error);
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private static shouldNotRetry(errorCode: string): boolean {
    const noRetryErrors = [
      'INVALID_CREDENTIALS',
      'MEMBER_NOT_FOUND',
      'EMAIL_EXISTS',
      'INSUFFICIENT_PERMISSIONS',
      'INVALID_EMAIL',
      'WEAK_PASSWORD'
    ];
    return noRetryErrors.includes(errorCode);
  }
}

// Usage example
const loginWithRetry = async (email: string, password: string) => {
  return RetryHandler.withRetry(
    () => memberstack.loginMemberEmailPassword({ email, password }),
    3, // max attempts
    1000, // base delay
    'Member Login'
  );
};
```

## Common Debugging Patterns

### Debug Mode Setup

```typescript
const memberstack = MemberstackDom.init({
  publicKey: 'pk_sb_your-key-here',
  debug: process.env.NODE_ENV === 'development'
});

// Enable verbose logging
memberstack.onAuthChange((member, error) => {
  console.group('Auth State Change');
  console.log('Member:', member);
  console.log('Error:', error);
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
});
```

### Network Request Inspection

```typescript
// Monitor all Memberstack network requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].toString().includes('memberstack')) {
    console.group('Memberstack API Call');
    console.log('URL:', args[0]);
    console.log('Options:', args[1]);
    console.groupEnd();
  }
  return originalFetch.apply(this, args);
};
```

## Troubleshooting Common Issues

### Issue 1: Authentication Not Persisting

**Symptoms:**
- User gets logged out on page refresh
- Authentication state resets

**Solutions:**
```typescript
// Ensure cookies are enabled
const memberstack = MemberstackDom.init({
  publicKey: 'pk_sb_your-key-here',
  useCookies: true,
  setCookieOnRootDomain: true
});

// Wait for auth state before rendering
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  memberstack.getCurrentMember()
    .then(() => setIsLoading(false))
    .catch(() => setIsLoading(false));
}, []);
```

### Issue 2: CORS Errors

**Symptoms:**
- "Access-Control-Allow-Origin" errors
- Blocked by CORS policy

**Solutions:**
```typescript
// Ensure domain is correctly configured
const memberstack = MemberstackDom.init({
  publicKey: 'pk_sb_your-key-here',
  domain: 'https://api.memberstack.com' // Use official domain
});

// Check allowed origins in Memberstack dashboard
// Add your domain to allowed origins
```

### Issue 3: Plan Connection Issues

**Symptoms:**
- User shows as logged in but no plan access
- Plan-specific features not working

**Debugging:**
```typescript
const debugMemberPlan = async () => {
  try {
    const member = await memberstack.getCurrentMember();
    console.group('Member Plan Debug');
    console.log('Member ID:', member.data.id);
    console.log('Plan Connections:', member.data.planConnections);
    console.log('Active Plans:', member.data.planConnections.filter(pc => pc.status === 'ACTIVE'));
    console.groupEnd();
  } catch (error) {
    console.error('Debug failed:', error);
  }
};
```

### Issue 4: Modal Not Appearing

**Symptoms:**
- `showModal()` doesn't display anything
- Modal appears behind other content

**Solutions:**
```typescript
// Ensure proper z-index
const memberstack = MemberstackDom.init({
  publicKey: 'pk_sb_your-key-here'
});

// Check modal container
document.addEventListener('DOMContentLoaded', () => {
  // Ensure modal container exists
  if (!document.querySelector('#memberstack-modal-container')) {
    const container = document.createElement('div');
    container.id = 'memberstack-modal-container';
    container.style.zIndex = '10000';
    document.body.appendChild(container);
  }
});
```

## Error Recovery Patterns

### Graceful Degradation

```typescript
const withFallback = async <T>(
  primary: () => Promise<T>,
  fallback: () => T,
  errorMessage: string = 'Feature temporarily unavailable'
): Promise<T> => {
  try {
    return await primary();
  } catch (error) {
    console.warn(errorMessage, error);
    return fallback();
  }
};

// Usage
const memberData = await withFallback(
  () => memberstack.getCurrentMember(),
  () => ({ data: null }), // Fallback to null member
  'Could not load member data'
);
```

### Progressive Enhancement

```typescript
const enhanceWithMemberData = async (baseComponent: React.ComponentType) => {
  try {
    const member = await memberstack.getCurrentMember();
    return React.createElement(EnhancedComponent, { member: member.data });
  } catch (error) {
    console.warn('Member enhancement failed, using base component:', error);
    return React.createElement(baseComponent);
  }
};
```

## Best Practices Summary

1. **Always Use Try/Catch**: Wrap all Memberstack API calls
2. **Specific Error Handling**: Check error codes for targeted responses
3. **User-Friendly Messages**: Convert technical errors to user-friendly text
4. **Retry Logic**: Implement for network-related errors
5. **Logging**: Log detailed errors for debugging
6. **Graceful Degradation**: Provide fallbacks when features fail
7. **Progress Indication**: Show loading states during operations
8. **Validation**: Validate inputs before API calls
9. **State Management**: Handle authentication state changes properly
10. **Testing**: Test error scenarios in development

## Testing Error Scenarios

```typescript
// Mock error responses for testing
const mockMemberstackError = (code: string, message: string) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

// Test error handling
describe('Error Handling', () => {
  test('handles invalid credentials', async () => {
    memberstack.loginMemberEmailPassword = jest.fn()
      .mockRejectedValue(mockMemberstackError('INVALID_CREDENTIALS', 'Invalid email or password'));
    
    const result = await attemptLogin('test@example.com', 'wrong');
    expect(result.error).toBe('Email or password is incorrect. Please try again.');
  });
});
```# Memberstack DOM - Complete Implementation Examples

## AI Assistant Instructions
When implementing these examples:
- Copy patterns exactly as shown, adapting only necessary details
- Use proper TypeScript types from 08-types-reference.md
- Include comprehensive error handling from 09-error-handling.md
- Test all authentication flows thoroughly
- Implement proper loading states and user feedback
- Follow security best practices for token handling

## Overview

Real-world implementation examples and common patterns for Memberstack DOM integration, including complete authentication flows, plan management, and advanced features.

## 1. Complete Authentication System (React)

Full-featured authentication component with login, signup, and member management.

```typescript
// hooks/useMemberstack.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { MemberstackDom } from '@memberstack/dom';
import { MemberstackErrorHandler } from './errorHandler';

interface MemberstackContextType {
  member: any | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, customFields?: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Record<string, any>) => Promise<void>;
  showModal: (type: string) => void;
}

const MemberstackContext = createContext<MemberstackContextType | null>(null);

export const useMemberstack = () => {
  const context = useContext(MemberstackContext);
  if (!context) {
    throw new Error('useMemberstack must be used within MemberstackProvider');
  }
  return context;
};

// Initialize Memberstack
const memberstack = MemberstackDom.init({
  publicKey: process.env.NEXT_PUBLIC_MEMBERSTACK_KEY!,
  useCookies: true,
  setCookieOnRootDomain: true
});

export const MemberstackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [member, setMember] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
    
    // Listen for auth changes
    const unsubscribe = memberstack.onAuthChange((member, error) => {
      if (error) {
        setError(error.message);
        setMember(null);
      } else {
        setMember(member?.data || null);
        setError(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const initializeAuth = async () => {
    try {
      const currentMember = await memberstack.getCurrentMember();
      setMember(currentMember.data);
      setError(null);
    } catch (error) {
      // User not logged in - this is expected
      setMember(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await memberstack.loginMemberEmailPassword({ email, password });
      setMember(result.data.member);
    } catch (error) {
      MemberstackErrorHandler.handle(error, 'Login');
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, customFields?: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await memberstack.signupMemberEmailPassword({
        email,
        password,
        customFields: customFields || {}
      });
      setMember(result.data.member);
    } catch (error) {
      MemberstackErrorHandler.handle(error, 'Signup');
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await memberstack.logout();
      setMember(null);
      setError(null);
    } catch (error) {
      MemberstackErrorHandler.handle(error, 'Logout');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Record<string, any>) => {
    if (!member) throw new Error('No member logged in');
    
    setIsLoading(true);
    try {
      const result = await memberstack.updateMember({ customFields: data });
      setMember(result.data);
    } catch (error) {
      MemberstackErrorHandler.handle(error, 'Profile Update');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const showModal = (type: string) => {
    memberstack.showModal({ type });
  };

  return (
    <MemberstackContext.Provider value={{
      member,
      isLoading,
      error,
      login,
      signup,
      logout,
      updateProfile,
      showModal
    }}>
      {children}
    </MemberstackContext.Provider>
  );
};

// components/AuthForm.tsx
import React, { useState } from 'react';
import { useMemberstack } from '../hooks/useMemberstack';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ mode, onModeChange }) => {
  const { login, signup, isLoading } = useMemberstack();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (mode === 'signup') {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!formData.firstName) {
        newErrors.firstName = 'First name is required';
      }
      if (!formData.lastName) {
        newErrors.lastName = 'Last name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.email, formData.password, {
          'first-name': formData.firstName,
          'last-name': formData.lastName
        });
      }
      // Success - user will be redirected by auth state change
    } catch (error) {
      // Error handled by MemberstackProvider
      console.error(`${mode} failed:`, error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <>
            <div>
              <input
                type="text"
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
            </div>

            <div>
              <input
                type="text"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
            </div>
          </>
        )}

        <div>
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>

        {mode === 'signup' && (
          <div>
            <input
              type="password"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
          className="text-blue-600 hover:text-blue-800"
          disabled={isLoading}
        >
          {mode === 'login' 
            ? "Don't have an account? Sign up" 
            : "Already have an account? Sign in"
          }
        </button>
      </div>
    </div>
  );
};
```

## 2. Plan Management & Subscription System

Complete subscription management with plan selection, checkout, and customer portal.

```typescript
// hooks/usePlans.ts
import { useState, useEffect } from 'react';
import { useMemberstack } from './useMemberstack';

export const usePlans = () => {
  const { member } = useMemberstack();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await memberstack.getPlans();
      setPlans(response.data);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPlan = async (planId: string, successUrl?: string, cancelUrl?: string) => {
    try {
      const result = await memberstack.createCheckoutSession({
        planId,
        successUrl: successUrl || `${window.location.origin}/success`,
        cancelUrl: cancelUrl || `${window.location.origin}/plans`
      });
      
      // Redirect to Stripe checkout
      window.location.href = result.data.url;
    } catch (error) {
      throw new Error('Failed to create checkout session');
    }
  };

  const openCustomerPortal = async () => {
    try {
      const result = await memberstack.createCustomerPortalSession({
        returnUrl: window.location.href
      });
      window.location.href = result.data.url;
    } catch (error) {
      throw new Error('Failed to open customer portal');
    }
  };

  const getCurrentPlan = () => {
    if (!member?.planConnections?.length) return null;
    
    const activePlan = member.planConnections.find(
      (connection: any) => connection.status === 'ACTIVE'
    );
    
    return activePlan ? plans.find((plan: any) => plan.id === activePlan.planId) : null;
  };

  const hasActivePlan = () => {
    return member?.planConnections?.some(
      (connection: any) => connection.status === 'ACTIVE'
    ) || false;
  };

  const hasPlanAccess = (requiredPlanIds: string[]) => {
    if (!member?.planConnections?.length) return false;
    
    return member.planConnections.some(
      (connection: any) => 
        connection.status === 'ACTIVE' && 
        requiredPlanIds.includes(connection.planId)
    );
  };

  return {
    plans,
    loading,
    subscribeToPlan,
    openCustomerPortal,
    getCurrentPlan,
    hasActivePlan,
    hasPlanAccess,
    refetch: loadPlans
  };
};

// components/PlanSelector.tsx
import React from 'react';
import { usePlans } from '../hooks/usePlans';
import { useMemberstack } from '../hooks/useMemberstack';

export const PlanSelector: React.FC = () => {
  const { member } = useMemberstack();
  const { plans, loading, subscribeToPlan, getCurrentPlan, hasActivePlan, openCustomerPortal } = usePlans();
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  const currentPlan = getCurrentPlan();

  const handlePlanSelection = async (planId: string) => {
    setProcessingPlanId(planId);
    try {
      await subscribeToPlan(planId);
    } catch (error) {
      console.error('Subscription failed:', error);
      alert('Failed to process subscription. Please try again.');
    } finally {
      setProcessingPlanId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert('Failed to open customer portal. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h2>

      {hasActivePlan() && (
        <div className="mb-8 p-4 bg-green-100 border border-green-400 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-800 font-medium">
                Current Plan: {currentPlan?.name || 'Active Subscription'}
              </p>
              <p className="text-green-600 text-sm">
                You have an active subscription
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Manage Subscription
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan: any) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isProcessing = processingPlanId === plan.id;
          
          return (
            <div
              key={plan.id}
              className={`border rounded-lg p-6 ${
                isCurrentPlan 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              
              <div className="mb-4">
                <span className="text-3xl font-bold">${plan.amount}</span>
                <span className="text-gray-500">/{plan.interval}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features?.map((feature: string, index: number) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanSelection(plan.id)}
                disabled={isCurrentPlan || isProcessing || !member}
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  isCurrentPlan
                    ? 'bg-blue-100 text-blue-800 cursor-not-allowed'
                    : !member
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isProcessing 
                  ? 'Processing...' 
                  : isCurrentPlan 
                  ? 'Current Plan' 
                  : !member
                  ? 'Sign In Required'
                  : 'Choose Plan'
                }
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

## 3. Protected Content System

Content gating based on plans and member status.

```typescript
// components/ProtectedContent.tsx
import React, { useState, useEffect } from 'react';
import { useMemberstack } from '../hooks/useMemberstack';
import { usePlans } from '../hooks/usePlans';

interface ProtectedContentProps {
  children: React.ReactNode;
  requiredPlans?: string[];
  fallbackContent?: React.ReactNode;
  showUpgrade?: boolean;
  contentId?: string;
}

export const ProtectedContent: React.FC<ProtectedContentProps> = ({
  children,
  requiredPlans = [],
  fallbackContent,
  showUpgrade = true,
  contentId
}) => {
  const { member, showModal } = useMemberstack();
  const { hasPlanAccess, plans } = usePlans();
  const [secureContent, setSecureContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contentId && member) {
      loadSecureContent();
    }
  }, [contentId, member]);

  const loadSecureContent = async () => {
    if (!contentId) return;
    
    setLoading(true);
    try {
      const result = await memberstack.getSecureContent({ contentId });
      setSecureContent(result.data);
    } catch (error) {
      console.error('Failed to load secure content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Not logged in
  if (!member) {
    return (
      <div className="bg-gray-100 p-6 rounded-lg text-center">
        <h3 className="text-lg font-semibold mb-2">Member Access Required</h3>
        <p className="text-gray-600 mb-4">Please sign in to access this content.</p>
        <button
          onClick={() => showModal('LOGIN')}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Check plan access
  if (requiredPlans.length > 0 && !hasPlanAccess(requiredPlans)) {
    const requiredPlan = plans.find((plan: any) => requiredPlans.includes(plan.id));
    
    return (
      <div className="bg-yellow-100 border border-yellow-400 p-6 rounded-lg text-center">
        <h3 className="text-lg font-semibold mb-2">Upgrade Required</h3>
        <p className="text-gray-700 mb-4">
          This content requires the {requiredPlan?.name || 'Premium'} plan.
        </p>
        {showUpgrade && (
          <button
            onClick={() => window.location.href = '/plans'}
            className="bg-yellow-600 text-white px-6 py-2 rounded-md hover:bg-yellow-700"
          >
            Upgrade Now
          </button>
        )}
      </div>
    );
  }

  // Loading secure content
  if (contentId && loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Render content
  return (
    <div>
      {contentId && secureContent ? (
        <div dangerouslySetInnerHTML={{ __html: secureContent.content }} />
      ) : (
        children
      )}
    </div>
  );
};

// Higher-order component for protected routes
export const withProtectedRoute = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requiredPlans?: string[];
    redirectTo?: string;
  } = {}
) => {
  const ProtectedComponent: React.FC<P> = (props) => {
    const { member } = useMemberstack();
    const { hasPlanAccess } = usePlans();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      // Wait for auth state to settle
      const timer = setTimeout(() => setLoading(false), 100);
      return () => clearTimeout(timer);
    }, []);

    if (loading) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!member) {
      if (options.redirectTo) {
        window.location.href = options.redirectTo;
        return null;
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-4">Please sign in to access this page.</p>
            <button
              onClick={() => memberstack.showModal({ type: 'LOGIN' })}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Sign In
            </button>
          </div>
        </div>
      );
    }

    if (options.requiredPlans && !hasPlanAccess(options.requiredPlans)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Upgrade Required</h1>
            <p className="text-gray-600 mb-4">This page requires a premium subscription.</p>
            <button
              onClick={() => window.location.href = '/plans'}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              View Plans
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };

  return ProtectedComponent;
};

// Usage example
const PremiumDashboard = withProtectedRoute(
  ({ data }) => <div>Premium Dashboard Content</div>,
  { requiredPlans: ['premium-plan-id'] }
);
```

## 4. Member Profile Management

Complete profile system with image upload and custom fields.

```typescript
// components/MemberProfile.tsx
import React, { useState, useEffect } from 'react';
import { useMemberstack } from '../hooks/useMemberstack';

export const MemberProfile: React.FC = () => {
  const { member, updateProfile, isLoading } = useMemberstack();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    company: '',
    website: ''
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (member?.customFields) {
      setFormData({
        firstName: member.customFields['first-name'] || '',
        lastName: member.customFields['last-name'] || '',
        phone: member.customFields.phone || '',
        bio: member.customFields.bio || '',
        company: member.customFields.company || '',
        website: member.customFields.website || ''
      });
      
      if (member.profileImage) {
        setImagePreview(member.profileImage);
      }
    }
  }, [member]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (message.text) setMessage({ type: '', text: '' });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    
    try {
      // Update custom fields
      const customFields = {
        'first-name': formData.firstName,
        'last-name': formData.lastName,
        phone: formData.phone,
        bio: formData.bio,
        company: formData.company,
        website: formData.website
      };
      
      await updateProfile(customFields);
      
      // Upload profile image if selected
      if (profileImage) {
        await memberstack.updateMemberProfileImage({ file: profileImage });
      }
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
      console.error('Profile update failed:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordChange = () => {
    memberstack.showModal({ type: 'PASSWORD_RESET' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

      {message.text && (
        <div className={`p-4 rounded-md mb-6 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-400' 
            : 'bg-red-100 text-red-800 border border-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleProfileUpdate} className="space-y-6">
        {/* Profile Image */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-2xl">
                  {formData.firstName?.[0] || member?.email?.[0] || '?'}
                </span>
              </div>
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="profile-image"
            />
            <label
              htmlFor="profile-image"
              className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Change Photo
            </label>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={member?.email || ''}
            readOnly
            className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Company & Website */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={updating}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Save Changes'}
          </button>
          
          <button
            type="button"
            onClick={handlePasswordChange}
            className="border border-gray-300 px-6 py-2 rounded-md hover:bg-gray-50"
          >
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
};
```

## 5. Next.js App Router Integration

Complete integration with Next.js 13+ App Router and server components.

```typescript
// app/layout.tsx
import { MemberstackProvider } from '../providers/MemberstackProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MemberstackProvider>
          {children}
        </MemberstackProvider>
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx
'use client';

import { withProtectedRoute } from '../../components/ProtectedContent';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default withProtectedRoute(DashboardLayout);

// app/dashboard/premium/page.tsx
'use client';

import { withProtectedRoute } from '../../../components/ProtectedContent';

const PremiumPage = () => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Premium Features</h2>
      <div className="bg-white p-6 rounded-lg shadow">
        <p>This content is only available to premium subscribers.</p>
      </div>
    </div>
  );
};

export default withProtectedRoute(PremiumPage, {
  requiredPlans: ['premium-plan-id']
});

// app/api/webhook/memberstack/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-memberstack-signature');
    
    // Verify webhook signature
    if (!verifyMemberstackSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Handle different webhook events
    switch (body.type) {
      case 'member.created':
        await handleMemberCreated(body.data.member);
        break;
      case 'member.subscription.created':
        await handleSubscriptionCreated(body.data.member, body.data.subscription);
        break;
      case 'member.subscription.cancelled':
        await handleSubscriptionCancelled(body.data.member, body.data.subscription);
        break;
      default:
        console.log('Unhandled webhook event:', body.type);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function verifyMemberstackSignature(body: any, signature: string | null): boolean {
  // Implement signature verification using your webhook secret
  // This is a simplified example
  return signature === process.env.MEMBERSTACK_WEBHOOK_SECRET;
}

async function handleMemberCreated(member: any) {
  // Sync member data to your database
  console.log('New member created:', member.email);
}

async function handleSubscriptionCreated(member: any, subscription: any) {
  // Handle new subscription
  console.log('New subscription:', subscription.planId, 'for member:', member.email);
}

async function handleSubscriptionCancelled(member: any, subscription: any) {
  // Handle subscription cancellation
  console.log('Subscription cancelled:', subscription.planId, 'for member:', member.email);
}
```

## 6. Vue.js 3 + Pinia Integration

Complete Vue.js setup with Pinia state management.

```typescript
// stores/memberstack.ts
import { defineStore } from 'pinia';
import { MemberstackDom } from '@memberstack/dom';

const memberstack = MemberstackDom.init({
  publicKey: import.meta.env.VITE_MEMBERSTACK_KEY,
  useCookies: true,
  setCookieOnRootDomain: true
});

export const useMemberstackStore = defineStore('memberstack', {
  state: () => ({
    member: null as any,
    isLoading: true,
    error: null as string | null
  }),

  getters: {
    isLoggedIn: (state) => !!state.member,
    hasActivePlan: (state) => 
      state.member?.planConnections?.some((pc: any) => pc.status === 'ACTIVE') || false,
    currentPlan: (state) => {
      if (!state.member?.planConnections?.length) return null;
      const activePlan = state.member.planConnections.find(
        (pc: any) => pc.status === 'ACTIVE'
      );
      return activePlan || null;
    }
  },

  actions: {
    async initialize() {
      try {
        const currentMember = await memberstack.getCurrentMember();
        this.member = currentMember.data;
        this.error = null;
      } catch (error) {
        this.member = null;
        this.error = null; // Not logged in is not an error
      } finally {
        this.isLoading = false;
      }

      // Listen for auth changes
      memberstack.onAuthChange((member, error) => {
        if (error) {
          this.error = error.message;
          this.member = null;
        } else {
          this.member = member?.data || null;
          this.error = null;
        }
      });
    },

    async login(email: string, password: string) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const result = await memberstack.loginMemberEmailPassword({ email, password });
        this.member = result.data.member;
        return result;
      } catch (error: any) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async signup(email: string, password: string, customFields = {}) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const result = await memberstack.signupMemberEmailPassword({
          email,
          password,
          customFields
        });
        this.member = result.data.member;
        return result;
      } catch (error: any) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async logout() {
      try {
        await memberstack.logout();
        this.member = null;
        this.error = null;
      } catch (error: any) {
        this.error = error.message;
        throw error;
      }
    },

    showModal(type: string) {
      memberstack.showModal({ type });
    }
  }
});

// composables/useMemberstack.ts
import { useMemberstackStore } from '../stores/memberstack';
import { storeToRefs } from 'pinia';

export const useMemberstack = () => {
  const store = useMemberstackStore();
  const { member, isLoading, error, isLoggedIn, hasActivePlan, currentPlan } = storeToRefs(store);

  return {
    // State
    member,
    isLoading,
    error,
    isLoggedIn,
    hasActivePlan,
    currentPlan,

    // Actions
    initialize: store.initialize,
    login: store.login,
    signup: store.signup,
    logout: store.logout,
    showModal: store.showModal
  };
};

// components/AuthForm.vue
<template>
  <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
    <h2 class="text-2xl font-bold mb-6 text-center">
      {{ mode === 'login' ? 'Sign In' : 'Create Account' }}
    </h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div v-if="mode === 'signup'" class="grid grid-cols-2 gap-4">
        <div>
          <input
            v-model="formData.firstName"
            type="text"
            placeholder="First Name"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isLoading"
          />
        </div>
        <div>
          <input
            v-model="formData.lastName"
            type="text"
            placeholder="Last Name"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isLoading"
          />
        </div>
      </div>

      <div>
        <input
          v-model="formData.email"
          type="email"
          placeholder="Email"
          class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          :disabled="isLoading"
          required
        />
      </div>

      <div>
        <input
          v-model="formData.password"
          type="password"
          placeholder="Password"
          class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          :disabled="isLoading"
          required
        />
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account') }}
      </button>
    </form>

    <div class="mt-4 text-center">
      <button
        @click="$emit('toggle-mode')"
        class="text-blue-600 hover:text-blue-800"
        :disabled="isLoading"
      >
        {{ mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in" }}
      </button>
    </div>

    <div v-if="error" class="mt-4 p-3 bg-red-100 border border-red-400 rounded text-red-700">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useMemberstack } from '../composables/useMemberstack';

interface Props {
  mode: 'login' | 'signup';
}

const props = defineProps<Props>();
const emit = defineEmits(['toggle-mode']);

const { login, signup, isLoading, error } = useMemberstack();

const formData = reactive({
  email: '',
  password: '',
  firstName: '',
  lastName: ''
});

const handleSubmit = async () => {
  try {
    if (props.mode === 'login') {
      await login(formData.email, formData.password);
    } else {
      await signup(formData.email, formData.password, {
        'first-name': formData.firstName,
        'last-name': formData.lastName
      });
    }
    // Success - router will handle navigation
  } catch (error) {
    // Error handled by store
    console.error(`${props.mode} failed:`, error);
  }
};
</script>
```

## Best Practices Summary

1. **State Management**: Use proper state management (React Context, Pinia, etc.)
2. **Error Handling**: Implement comprehensive error handling with user feedback
3. **Loading States**: Show loading indicators during async operations
4. **Type Safety**: Use TypeScript for better development experience
5. **Security**: Never expose sensitive data, validate all inputs
6. **User Experience**: Provide clear feedback and intuitive interfaces
7. **Testing**: Test all authentication flows and edge cases
8. **Performance**: Implement proper caching and optimization
9. **Accessibility**: Ensure components are accessible
10. **Documentation**: Document custom implementations for team members

# Data Tables


## Overview
The Memberstack DOM package provides methods to interact with data tables and records. These methods allow querying, creating, updating, and deleting records in Memberstack data tables, including advanced relationship operations.

## Authentication
Most data table operations require authentication. Ensure the member is logged in before calling these methods.

## Core Methods

### 1. queryDataRecords
**Purpose:** Query records from a data table with advanced filtering, sorting, and pagination.

```typescript
queryDataRecords(params: QueryDataRecordsParams, options?: MemberstackOptions): Promise<QueryDataRecordsPayload>
```

**Parameters:**
```typescript
QueryDataRecordsParams = {
  table: string; // Table name/key (NOTE: This method uses 'table' not 'tableKey')
  query: DataRecordsQuery;
}

DataRecordsQuery = {
  where?: WhereClause;      // Filter conditions
  include?: IncludeClause;  // Related data to include
  select?: SelectClause;    // Specific fields to return
  orderBy?: OrderByClause;  // Sort order
  take?: number;            // Limit results (max 100)
  skip?: number;            // Offset for pagination
  after?: string;           // Cursor for pagination
  _count?: boolean | CountClause; // Count results
}
```

**Query Components:**
```typescript
// WHERE CLAUSE - Filtering
WhereClause = {
  [fieldName: string]: any | WhereOperators;
  // Can use AND, OR, NOT operators
  AND?: WhereClause[];
  OR?: WhereClause[];
  NOT?: WhereClause;
}

WhereOperators = {
  equals?: any;
  not?: any;
  in?: any[];
  notIn?: any[];
  lt?: any;      // less than
  lte?: any;     // less than or equal
  gt?: any;      // greater than
  gte?: any;     // greater than or equal
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  search?: string;
  mode?: 'insensitive' | 'default'; // for string operations
}

// SELECT CLAUSE - Field selection
SelectClause = {
  [fieldName: string]: boolean | CountClause; // true to include, or a CountClause
}

// INCLUDE CLAUSE - Relations
IncludeClause = {
  [relationName: string]: boolean | {
    select?: SelectClause;
    where?: WhereClause;
    include?: IncludeClause;
    orderBy?: OrderByClause;
    take?: number;
    skip?: number;
  };
  _count?: boolean | CountClause;
}

// ORDER BY CLAUSE - Sorting
OrderByClause = {
  [fieldName: string]: 'asc' | 'desc';
}

// COUNT CLAUSE
CountClause = {
  select: {
    [relationName: string]: boolean;
  };
}
```

**Response:**
```typescript
// Wrapped in Response<{ ... }>
type QueryDataRecordsPayload =
  | Response<{
      records: Array<{
        id: string;
        tableKey: string;
        data: Record<string, any>;
        createdAt: string;
        updatedAt: string;
        internalOrder: number;
        activeMemberOwnsIt: boolean;
        [relationName: string]: any; // included relations
        _count?: Record<string, number>; // relation counts
      }>;
      pagination?: {
        limit: number;
        hasMore: boolean;
        endCursor: number; // cursor is numeric
      };
    }>
  | Response<{ _count: number }>;
```

**Examples:**
```javascript
// Simple query with filtering
const { data } = await $memberstackDom.queryDataRecords({
  table: "products",
  query: {
    where: {
      category: "electronics",
      price: { lte: 1000 }
    },
    orderBy: { price: "asc" },
    take: 10
  }
});

// Complex query with relations
const { data } = await $memberstackDom.queryDataRecords({
  table: "orders",
  query: {
    where: {
      status: "completed",
      createdAt: { gte: "2024-01-01" }
    },
    include: {
      customer: true, // Include related customer
      orderItems: {   // Include related items with conditions
        where: { quantity: { gt: 1 } },
        include: { product: true } // Nested include
      }
    },
    select: {
      id: true,
      total: true,
      status: true
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    skip: 0
  }
});

// Count query
const countRes = await $memberstackDom.queryDataRecords({
  table: "products",
  query: {
    where: { inStock: true },
    _count: true
  }
});
const count = countRes.data._count;

// Pagination with cursor
const page1 = await $memberstackDom.queryDataRecords({
  table: "posts",
  query: {
    orderBy: { createdAt: "desc" },
    take: 10
  }
});

const page2 = await $memberstackDom.queryDataRecords({
  table: "posts",
  query: {
    orderBy: { createdAt: "desc" },
    take: 10,
    after: page1.data.pagination?.endCursor
  }
});

// Text search (case-insensitive)
const results = await $memberstackDom.queryDataRecords({
  table: "articles",
  query: {
    where: {
      OR: [
        { title: { contains: "javascript", mode: "insensitive" } },
        { content: { contains: "javascript", mode: "insensitive" } }
      ]
    }
  }
});

// Complex filtering with AND/OR
const results = await $memberstackDom.queryDataRecords({
  table: "products",
  query: {
    where: {
      AND: [
        { category: "electronics" },
        {
          OR: [
            { brand: "Apple" },
            { brand: "Samsung" }
          ]
        },
        { price: { gte: 100, lte: 1000 } }
      ]
    }
  }
});
```

### 2. getDataTable
**Purpose:** Get metadata about a single data table.

```typescript
getDataTable(
  params: GetDataTableParams,
  options?: MemberstackOptions
): Promise<GetDataTablePayload>
```

**Parameters:**
```typescript
GetDataTableParams = {
  table: string;
}
```

**Response:**
```typescript
// Wrapped in Response<DataTableResponse>
type DataTableResponse = {
  id: string;
  key: string;
  name: string;
  createRule: string;
  readRule: string;
  updateRule: string;
  deleteRule: string;
  createdAt: string;
  updatedAt?: string;
  recordCount: number;
  fields: Array<{
    id: string;
    key: string;
    name: string;
    type: string;
    required: boolean;
    unique: boolean;
    defaultValue?: any;
    tableOrder?: number;
    referencedTableId?: string;
    referencedTable?: { id: string; key: string; name: string };
  }>;
}
```

**Example:**
```javascript
const tableInfo = await $memberstackDom.getDataTable({
  table: "products"
});
console.log(tableInfo.data.fields); // List all fields and their types
```

### 3. getDataTables
**Purpose:** List all accessible data tables for the current member.

```typescript
getDataTables(options?: MemberstackOptions): Promise<GetDataTablesPayload>
```

**Example:**
```javascript
const { data } = await $memberstackDom.getDataTables();
data.tables.forEach(table => {
  console.log(`${table.name} (records: ${table.recordCount})`);
});
```

### 4. getDataRecords
**Purpose:** List records from a data table using basic filters and pagination.

```typescript
getDataRecords(
  params: GetDataRecordsParams,
  options?: MemberstackOptions
): Promise<GetDataRecordsPayload>
```

**Parameters:**
```typescript
GetDataRecordsParams = {
  table: string;
  memberId?: string;
  createdAfter?: string; // ISO string
  createdBefore?: string; // ISO string
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  limit?: number;
  after?: string; // Cursor (internal order)
  [key: string]: any; // Additional field filters become query params
}
```

**Response:**
```typescript
type GetDataRecordsPayload = Response<{
  records: DataRecordResponse[];
  pagination: {
    limit: number;
    endCursor: number | null;
    hasMore: boolean;
  };
}>;
```

**Example:**
```javascript
const res = await $memberstackDom.getDataRecords({
  table: 'products',
  sortBy: 'createdAt',
  sortDirection: 'DESC',
  limit: 20
});
const { records, pagination } = res.data;
```

### 5. getDataRecord
**Purpose:** Get a single record by ID.

```typescript
getDataRecord(
  params: GetDataRecordParams,
  options?: MemberstackOptions
): Promise<GetDataRecordPayload>
```

**Parameters:**
```typescript
GetDataRecordParams = {
  recordId: string; // NOTE: No table parameter needed
}
```

**Example:**
```javascript
const record = await $memberstackDom.getDataRecord({
  recordId: "prod_123"
});
```

### 6. createDataRecord
**Purpose:** Create a new record in a table.

```typescript
createDataRecord(
  params: CreateDataRecordParams,
  options?: MemberstackOptions
): Promise<CreateDataRecordPayload>
```

**Parameters:**
```typescript
CreateDataRecordParams = {
  table: string;
  data: {
    [fieldName: string]: any;
  };
  memberId?: string; // Optional member ID
}
```

**Example:**
```javascript
const newProduct = await $memberstackDom.createDataRecord({
  table: "products",
  data: {
    name: "iPhone 15",
    category: "electronics",
    price: 999,
    inStock: true,
    description: "Latest iPhone model"
  }
});
```

### 7. updateDataRecord
**Purpose:** Update an existing record, including relationship operations.

```typescript
updateDataRecord(
  params: UpdateDataRecordParams,
  options?: MemberstackOptions
): Promise<UpdateDataRecordPayload>
```

**Parameters:**
```typescript
UpdateDataRecordParams = {
  recordId: string; // NOTE: No table parameter needed
  data: {
    [fieldName: string]: any | ReferenceOperation | MemberReferenceOperation;
  };
}
```

#### Regular Field Updates
```javascript
const updated = await $memberstackDom.updateDataRecord({
  recordId: "prod_123",
  data: {
    price: 899,
    inStock: false
  }
});
```

## Reference Field Operations

The `updateDataRecord` method supports special operations for reference fields that manage relationships between records and members.

### Reference Field Types

| Field Type | Purpose | Operations | Authentication |
|------------|---------|------------|----------------|
| `MEMBER_REFERENCE` | Single member assignment | Direct assignment | Required |
| `MEMBER_REFERENCE_MANY` | Multiple member relationships | connect/disconnect | Required |
| `REFERENCE_MANY` | Multiple record relationships | connect/disconnect | Table permissions |

### MEMBER_REFERENCE_MANY Operations

**Use Case:** Features like likes, bookmarks, favorites, team memberships

#### Connect Self (Like/Bookmark)
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "post_123",
  data: {
    likedBy: {
      connect: { self: true }
    }
  }
});

// Response includes:
const res = await $memberstackDom.updateDataRecord(...);
const likedBy = res.data.data.likedBy;
// likedBy.count -> number; likedBy.hasself -> boolean; likedBy.action -> 'connected' | 'disconnected' | 'unchanged'
```

#### Disconnect Self (Unlike/Remove Bookmark)
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "post_123",
  data: {
    likedBy: {
      disconnect: { self: true }
    }
  }
});
```

#### Multiple Member Reference Operations
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "article_123",
  data: {
    likedBy: {
      connect: { self: true }      // Like the article
    },
    bookmarkedBy: {
      disconnect: { self: true }   // Remove bookmark
    }
  }
});
```

**Important Notes:**
- Currently only supports `{ self: true }` operations
- Requires member authentication
- Self-operations bypass normal table update permissions (allows users to like content they don't own)
- Operations are idempotent (safe to call multiple times)

### REFERENCE_MANY Operations

**Use Case:** Record-to-record relationships like Professor ↔ Courses, Product ↔ Categories

#### Connect Single Record
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "prof_123",
  data: {
    courses: {
      connect: { id: "course_456" }
    }
  }
});
```

#### Connect Multiple Records
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "prof_123",
  data: {
    courses: {
      connect: [
        { id: "course_456" },
        { id: "course_789" }
      ]
    }
  }
});
```

#### Disconnect Records
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "prof_123",
  data: {
    courses: {
      disconnect: { id: "course_456" }
    }
  }
});
```

#### Combined Connect/Disconnect
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "prof_123",
  data: {
    courses: {
      connect: { id: "course_new" },
      disconnect: { id: "course_old" }
    }
  }
});

// Response includes:
const updateRes = await $memberstackDom.updateDataRecord(...);
const courses = updateRes.data.data.courses;
// courses.count -> number; courses.action -> 'connected' | 'disconnected' | 'unchanged'
```

### MEMBER_REFERENCE Operations

**Use Case:** Single member assignments like task assignee, content author

#### Assign Member
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "task_123",
  data: {
    assignedTo: "member_456"  // Direct assignment (no connect/disconnect)
  }
});
```

#### Clear Assignment
```javascript
await $memberstackDom.updateDataRecord({
  recordId: "task_123",
  data: {
    assignedTo: null
  }
});
```

### Combined Operations

Mix regular field updates with reference operations:

```javascript
await $memberstackDom.updateDataRecord({
  recordId: "article_123",
  data: {
    title: "Updated Article Title",           // Regular field
    status: "published",                      // Regular field
    assignedTo: "editor_456",                // MEMBER_REFERENCE
    tags: {                                  // REFERENCE_MANY
      connect: [
        { id: "tag_javascript" },
        { id: "tag_tutorial" }
      ],
      disconnect: { id: "tag_draft" }
    },
    likedBy: {                              // MEMBER_REFERENCE_MANY
      connect: { self: true }
    }
  }
});
```

### TypeScript Support for Reference Operations

```typescript
import { 
  ReferenceOperation, 
  MemberReferenceOperation,
  ReferenceFieldResult,
  MemberReferenceFieldResult,
  ReferenceSelector,
  MemberReferenceSelector
} from '@memberstack/dom';

// Reference operation types
type ReferenceSelector = { id: string };
type ReferenceOperation = {
  connect?: ReferenceSelector | ReferenceSelector[];
  disconnect?: ReferenceSelector | ReferenceSelector[];
};

type MemberReferenceSelector = { self: true };
type MemberReferenceOperation = {
  connect?: MemberReferenceSelector | MemberReferenceSelector[];
  disconnect?: MemberReferenceSelector | MemberReferenceSelector[];
};

// Type-safe operations
const referenceOp: ReferenceOperation = {
  connect: { id: "record_123" },
  disconnect: { id: "record_456" }
};

const memberRefOp: MemberReferenceOperation = {
  connect: { self: true }
};

// Type-safe update call
await memberstack.updateDataRecord({
  recordId: "post_123",
  data: {
    likedBy: memberRefOp,
    tags: referenceOp
  }
});
```

### 8. deleteDataRecord
**Purpose:** Delete a record from a table.

```typescript
deleteDataRecord(
  params: DeleteDataRecordParams,
  options?: MemberstackOptions
): Promise<DeleteDataRecordPayload>
```

**Parameters:**
```typescript
DeleteDataRecordParams = {
  recordId: string; // NOTE: No table parameter needed
}
```

**Example:**
```javascript
await $memberstackDom.deleteDataRecord({
  recordId: "prod_123"
});
```

## Access Control & Authentication

### Access Control Levels
Tables have different access levels that determine who can read/write:
- **PUBLIC**: Anyone can read/write (no auth required)
- **AUTHENTICATED**: Any logged-in member can read/write
- **AUTHENTICATED_OWN**: Members can only read/write their own records (filtered by owner)
- **ADMIN_ONLY**: Only admin members can access

### Special Access Rules for Reference Operations

#### MEMBER_REFERENCE_MANY (Self Operations)
- **Authentication Required**: User must be logged in
- **Access Control Bypass**: Self-only operations (`{ self: true }`) bypass normal table update permissions
- **Use Case**: Allows users to like/bookmark content they don't own

#### REFERENCE_MANY & MEMBER_REFERENCE
- **Standard Permissions**: Normal table update permissions apply
- **Access Required**: User must have UPDATE access to the record/table

## Error Handling

### Common Errors and Solutions

```javascript
try {
  await $memberstackDom.updateDataRecord({
    recordId: "record_123",
    data: {
      courses: { connect: { id: "invalid_id" } }
    }
  });
} catch (error) {
  console.error(error.message);
  
  // Common error messages:
  // "Target record 'invalid_id' not found"
  // "Authentication required for self operations" 
  // "Invalid member selector. Currently only { 'self': true } is supported"
  // "Access denied"
}
```

### Authentication Errors
```javascript
// MEMBER_REFERENCE_MANY without authentication
{
  error: "Authentication required for self operations"
}

// Trying to use non-self selectors
{
  error: "Invalid member selector. Currently only { 'self': true } is supported"
}
```

### Validation Errors
```javascript
// Invalid record ID
{
  error: "Target record 'bad_id' not found"
}

// Wrong table reference
{
  error: "Target record belongs to wrong table"
}
```

## Best Practices

### 1. Error Handling
Always wrap reference operations in try/catch blocks:
```javascript
try {
  const result = await $memberstackDom.updateDataRecord({
    recordId: "post_123",
    data: { likedBy: { connect: { self: true } } }
  });
  
  if (result.data.data.likedBy.action === 'connected') {
    showSuccessMessage('Post liked!');
  }
} catch (error) {
  showErrorMessage('Failed to like post: ' + error.message);
}
```

### 2. Idempotent Operations
Connect/disconnect operations are safe to call multiple times:
```javascript
// Safe to call even if user already likes the post
await $memberstackDom.updateDataRecord({
  recordId: "post_123",
  data: { likedBy: { connect: { self: true } } }
});
```

### 3. Batch Operations
Combine multiple operations for efficiency:
```javascript
// Single API call for multiple changes
await $memberstackDom.updateDataRecord({
  recordId: "article_123",
  data: {
    title: "New Title",                    // Regular field
    likedBy: { connect: { self: true } },  // Like
    bookmarkedBy: { connect: { self: true } }, // Bookmark
    tags: {                               // Update tags
      connect: { id: "tag_featured" },
      disconnect: { id: "tag_draft" }
    }
  }
});
```

### 4. Check Response Data
Use the response to update UI state:
```javascript
const result = await $memberstackDom.updateDataRecord({
  recordId: "post_123",
  data: { likedBy: { connect: { self: true } } }
});

const likeData = result.data.data.likedBy;
updateLikeButton({
  isLiked: likeData.hasself,
  likeCount: likeData.count,
  wasJustLiked: likeData.action === 'connected'
});
```

### 5. Handle Authentication State
Check authentication before member reference operations:
```javascript
const currentMember = await $memberstackDom.getCurrentMember();
if (!currentMember.data) {
  // Redirect to login or show auth modal
  await $memberstackDom.openModal("LOGIN");
  return;
}

// Proceed with member reference operation
await $memberstackDom.updateDataRecord({
  recordId: "post_123",
  data: { likedBy: { connect: { self: true } } }
});
```

### 6. Pagination
Always use pagination for large datasets:
```javascript
const PAGE_SIZE = 20;
const results = await queryDataRecords({
  table: "posts",
  query: { take: PAGE_SIZE, skip: page * PAGE_SIZE }
});
```

### 7. Field Selection
Only request fields you need:
```javascript
query: {
  select: { id: true, name: true, price: true }
}
```

### 8. Efficient Filtering
Use indexes on commonly filtered fields:
```javascript
where: {
  indexed_field: "value", // Fast
  non_indexed_field: { contains: "text" } // Slower
}
```

### 9. Relationship Loading
Only include relations when needed:
```javascript
include: {
  customer: true // Only if you need customer data
}
```

## Common Use Cases

### Like/Unlike System
```javascript
async function toggleLike(postId) {
  try {
    const result = await $memberstackDom.updateDataRecord({
      recordId: postId,
      data: {
        likedBy: {
          [isCurrentlyLiked ? 'disconnect' : 'connect']: { self: true }
        }
      }
    });
    
    // Update UI with new state
    const likeData = result.data.data.likedBy;
    updateLikeUI(likeData.hasself, likeData.count);
    
  } catch (error) {
    console.error('Like toggle failed:', error);
  }
}
```

### Team Member Management
```javascript
async function joinTeam(projectId) {
  try {
    await $memberstackDom.updateDataRecord({
      recordId: projectId,
      data: {
        teamMembers: {
          connect: { self: true }  // Current member joins team
        }
      }
    });
  } catch (error) {
    console.error('Failed to join team:', error);
  }
}
```

### Tag Management
```javascript
async function updateProductTags(productId, tagsToAdd, tagsToRemove) {
  const operations = {};
  
  if (tagsToAdd.length > 0) {
    operations.connect = tagsToAdd.map(id => ({ id }));
  }
  
  if (tagsToRemove.length > 0) {
    operations.disconnect = tagsToRemove.map(id => ({ id }));
  }
  
  await $memberstackDom.updateDataRecord({
    recordId: productId,
    data: { tags: operations }
  });
}
```

### Search Implementation
```javascript
async function searchProducts(searchTerm) {
  return await $memberstackDom.queryDataRecords({
    table: "products",
    query: {
      where: {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
          { category: { contains: searchTerm, mode: "insensitive" } }
        ]
      },
      orderBy: { relevance: "desc" },
      take: 20
    }
  });
}
```

### Infinite Scroll
```javascript
let cursor = null;
let hasMore = true;

async function loadMore() {
  if (!hasMore) return;
  
  const result = await $memberstackDom.queryDataRecords({
    table: "posts",
    query: {
      orderBy: { createdAt: "desc" },
      take: 10,
      after: cursor
    }
  });
  
  cursor = result.data.pagination?.endCursor || null;
  hasMore = result.data.pagination?.hasMore || false;
  return result.data.records;
}
```

### Filtering by Date Range
```javascript
const thisMonth = await $memberstackDom.queryDataRecords({
  table: "orders",
  query: {
    where: {
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      }
    }
  }
});
```

## Error Codes
Common error responses:
- **401**: Unauthorized - Member not logged in
- **403**: Forbidden - Insufficient permissions for table
- **404**: Not Found - Table or record doesn't exist
- **400**: Bad Request - Invalid query parameters or selectors
- **429**: Rate Limited - Too many requests

## Summary of Key Parameter Differences
| Method | Key Params | Notes |
|--------|------------|-------|
| `queryDataRecords` | `table`, `query` | Uses `table` (not `tableKey`); `orderBy` is a single object; returns `Response<{ records/pagination }>` or `Response<{ _count }>` |
| `getDataTable` | `tableKey` | Returns `Response<DataTableResponse>`; includes rule fields (create/read/update/delete) |
| `getDataTables` | none | Returns `Response<{ tables: DataTableResponse[] }>` |
| `getDataRecords` | `tableKey`, filters | Basic list + pagination; returns `Response<{ records, pagination }>` |
| `getDataRecord` | `recordId` | Returns `Response<DataRecordResponse>` |
| `createDataRecord` | `tableKey`, `data` | Returns `Response<DataRecordResponse>` |
| `updateDataRecord` | `recordId`, `data` | No table param; supports reference operations; returns `Response<DataRecordResponse>` |
| `deleteDataRecord` | `recordId` | Returns `Response<{ id: string }>` |
