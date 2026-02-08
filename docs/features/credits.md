# User Stories: Credits (Zorrak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#4-credits--zorrak--sepa-creditsmd)

## Epic: Credit Management

### Story 1: View Pending Credits

**As a** Bazkidea  
**I want to** view my accumulated debt  
**So that** I can track my financial obligations

**Acceptance Criteria:**

- Display current total pending credits
- Breakdown of credits by month/event
- Historical view of credit accumulation
- Payment history and cleared credits
- Option to download credit statement

### Story 2: Monthly Credit Summary

**As a** Diruzaina  
**I want to** generate monthly credit reports  
**So that** I can prepare billing information

**Acceptance Criteria:**

- Filter credits by month and year
- List all Bazkidea with pending credits
- Calculate totals for billing period
- Export credit list to Google Sheets
- Mark credits as "processed for billing"

### Story 3: Credit Reset After Payment

**As a** Diruzaina  
**I want to** reset credits to zero after bank payment  
**So that** accounts reflect current status

**Acceptance Criteria:**

- Select credits to clear (by month or individual)
- Confirmation before resetting
- Audit trail of credit resets
- Notification to affected Bazkidea
- Archive cleared credit records

## Epic: SEPA Export

### Story 4: Generate SEPA List

**As a** Diruzaina  
**I want to** generate a list of credits for SEPA export  
**So that** I can create bank payment files

**Acceptance Criteria:**

- Select billing period for SEPA generation
- Include only Bazkidea with positive credits
- Verify IBAN information for each user
- Calculate total amounts for SEPA file
- Export to Google Sheets format

### Story 5: SEPA Data Validation

**As a** Diruzaina  
**I want to** validate SEPA data before export  
**So that** bank payments are processed correctly

**Acceptance Criteria:**

- Check IBAN format validity
- Verify Bazkide_ID consistency
- Validate creditor information
- Flag missing or invalid data
- Provide error correction interface

### Story 6: Society Information Management

**As an** Administratzailea  
**I want to** manage society information for SEPA  
**So that** bank transfers identify the correct creditor

**Acceptance Criteria:**

- Configure society name (Izena)
- Set society IBAN (cuenta emisora)
- Manage Creditor ID for SEPA compliance
- Update contact information
- Validate SEPA configuration

## Epic: Payment Tracking

### Story 7: Payment Status Tracking

**As a** Diruzaina  
**I want to** track payment status for each billing cycle  
**So that** I can monitor collection progress

**Acceptance Criteria:**

- Mark credits as "sent to bank"
- Track return/rejection status
- Record payment confirmation dates
- Generate payment status reports
- Handle payment exceptions

### Story 8: Credit Notifications

**As a** Bazkidea  
**I want to** receive notifications about my credit status  
**So that** I stay informed about my financial obligations

**Acceptance Criteria:**

- Monthly credit summary notifications
- Alert when credits exceed threshold
- Notification when credits are cleared
- Payment confirmation messages
- Options for notification preferences

## Epic: Financial Reporting

### Story 9: Financial Dashboard

**As a** Diruzaina or Administratzailea  
**I want to** view financial analytics  
**So that** I can understand the society's financial health

**Acceptance Criteria:**

- Total credits overview by period
- Payment collection rates
- Average credit per Bazkidea
- Monthly revenue trends
- Comparison with previous periods

### Story 10: Export Financial Reports

**As a** Diruzaina  
**I want to** export comprehensive financial reports  
**So that** I can provide transparency to the society

**Acceptance Criteria:**

- Monthly financial statements
- Year-to-date summaries
- Individual Bazkidea credit reports
- SEPA export history
- Payment collection analytics
