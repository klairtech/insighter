# Credit System Implementation

This document outlines the complete credit system implementation for Insighter, including user rewards, billing management, and automated credit allocation.

## Overview

The credit system provides:

- **Free Credits**: Monthly allocation for free tier users
- **Welcome Credits**: Automatic allocation for new users
- **Purchase System**: Flexible and premium credit purchases
- **Billing Dashboard**: Complete user billing management
- **Reward System**: Ability to reward existing users

## Features Implemented

### 1. User Interface Enhancements

#### Navigation Bar

- Added credit balance display in the navigation bar
- Added "Billing & Credits" link in user dropdown menu
- Real-time credit balance updates

#### Billing Dashboard (`/billing`)

- Complete credit balance overview
- Purchase history with invoice downloads
- Current subscription details
- Quick actions for buying credits and viewing plans

#### Profile Page

- Credit balance overview with visual indicators
- Link to billing dashboard for detailed management

### 2. Credit Allocation System

#### Monthly Free Credits

- **API Endpoint**: `/api/credits/allocate-monthly`
- **Automation**: Cron job script at `scripts/monthly-credit-allocation.js`
- **Allocation**: 100 credits per month for free tier users
- **Prevention**: Prevents duplicate allocations for the same month

#### Welcome Credits

- **API Endpoint**: `/api/credits/allocate-welcome`
- **Trigger**: Automatic allocation during user registration
- **Allocation**: 50 credits for new users
- **Expiry**: 30 days from allocation

#### Existing User Rewards

- **API Endpoint**: `/api/credits/reward-existing-users`
- **Script**: `scripts/reward-existing-users.js`
- **Flexibility**: Configurable reward types, amounts, and target users
- **Prevention**: Prevents duplicate rewards within 30 days

### 3. Billing Management

#### Purchase History

- **API Endpoint**: `/api/billing/purchases`
- **Data**: Combines flexible and premium purchases
- **Features**: Status tracking, bonus credit display, invoice downloads

#### Subscription Management

- **API Endpoint**: `/api/billing/subscription`
- **Data**: Current subscription details, billing periods, credit allowances

#### Invoice Generation

- **API Endpoint**: `/api/billing/invoice/[id]`
- **Format**: PDF invoice generation
- **Data**: Purchase details, payment information, customer details

### 4. Enhanced Credit Balance API

#### Updated Balance Endpoint

- **API Endpoint**: `/api/credits/balance`
- **Enhanced Data**:
  - Current balance
  - Total purchased credits
  - Total used credits
  - Credit batch details

## Database Schema

The system uses the existing `insighter_credit_batches` table with the following structure:

```sql
CREATE TABLE insighter_credit_batches (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  batch_code TEXT NOT NULL,
  credits_added INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  credits_used INTEGER DEFAULT 0,
  batch_type TEXT CHECK (batch_type IN ('monthly_free', 'monthly_paid', 'one_time_purchase', 'bonus', 'refund')),
  plan_type TEXT DEFAULT 'free',
  added_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Instructions

### 1. Monthly Credit Allocation

Set up a cron job to run monthly:

```bash
# Add to crontab (runs on 1st of every month at 9 AM)
0 9 1 * * /usr/bin/node /path/to/your/project/scripts/monthly-credit-allocation.js
```

### 2. Reward Existing Users

```bash
# Reward all free users with 50 loyalty credits
node scripts/reward-existing-users.js --type loyalty --credits 50 --target free

# Reward specific users with 200 promotional credits
node scripts/reward-existing-users.js --type promotional --credits 200 --users "user1,user2,user3"

# Reward all premium users with 100 anniversary credits
node scripts/reward-existing-users.js --type anniversary --credits 100 --target premium
```

### 3. Manual Credit Allocation

You can also trigger credit allocation manually via API:

```bash
# Monthly allocation
curl -X POST https://your-domain.com/api/credits/allocate-monthly

# Welcome credits for specific user
curl -X POST https://your-domain.com/api/credits/allocate-welcome \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "email": "user@example.com"}'

# Reward existing users
curl -X POST https://your-domain.com/api/credits/reward-existing-users \
  -H "Content-Type: application/json" \
  -d '{"rewardType": "loyalty", "creditsPerUser": 100, "targetUsers": "free"}'
```

## Security Considerations

1. **API Key Protection**: Use `CRON_API_KEY` environment variable for script authentication
2. **Rate Limiting**: Implement rate limiting on credit allocation endpoints
3. **Audit Trail**: All credit allocations are logged with timestamps and batch codes
4. **Duplicate Prevention**: System prevents duplicate allocations within specified timeframes

## Monitoring and Analytics

### Key Metrics to Track

- Monthly credit allocation success rate
- User engagement with free credits
- Conversion rate from free to paid users
- Credit usage patterns by user segment

### Logging

All credit operations are logged with:

- User ID
- Credit amount
- Operation type
- Timestamp
- Success/failure status

## Future Enhancements

1. **Credit Expiry Notifications**: Email users before credits expire
2. **Usage Analytics**: Detailed credit usage analytics dashboard
3. **Referral System**: Credit rewards for user referrals
4. **Gamification**: Achievement-based credit rewards
5. **Credit Transfers**: Allow users to transfer credits to other users

## Troubleshooting

### Common Issues

1. **Credits Not Allocating**: Check database connection and user permissions
2. **Duplicate Allocations**: Verify batch code uniqueness and time-based checks
3. **Balance Not Updating**: Ensure credit balance API is called after allocations
4. **Invoice Generation**: Verify PDF generation library is properly configured

### Debug Commands

```bash
# Check user credit balance
curl https://your-domain.com/api/credits/balance

# View purchase history
curl https://your-domain.com/api/billing/purchases

# Check subscription status
curl https://your-domain.com/api/billing/subscription
```

## Environment Variables

Required environment variables:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
CRON_API_KEY=your-secure-api-key
NEXT_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

This implementation provides a complete, production-ready credit system with automated allocation, user rewards, and comprehensive billing management.
