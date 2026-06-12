# MarsHRM - Firebase Studio

This is a comprehensive NextJS HRM application with advanced geolocation, reporting, and automated workflow features.

## Project Replication Prompt
Use the following prompt to replicate this project in a new environment:
"Create a professional HRM system called MarsHRM using Next.js (App Router), Firebase (Auth/Firestore), Tailwind CSS, and ShadCN. Key Features: Geofenced Attendance (Office/WFH radius), 3-Stage Leave Approval (Lead -> HR), Daily Monitor with PDF/CSV exports and WhatsApp/Teams sharing, Automated Email Reports at 9:50 AM and 6:50 PM via Resend, Global Analytics with Date Range filtering, and Dual-Type Work Reports (Business/Technical) with audio upload support."

## Setup Instructions

### 1. Firebase Configuration
Ensure your `src/firebase/config.ts` is up to date with your project's credentials.

### 2. Environment Variables
To enable automated emails, you must set the following environment variable in your hosting provider:
- `RESEND_API_KEY`: Your API key from Resend.com.

### 3. Firestore Indexes (Required)
The application uses `collectionGroup` and composite queries for organization-wide monitoring. You **must** manually create the following indexes in the Firebase Console:

#### 3.1 Attendance Collection Group
- Collection ID: `attendances`
- Field: `checkInTime` (Descending)
- Query Scope: **Collection group**

#### 3.2 Reports Collection Group
- Collection ID: `reports`
- Field: `date` (Descending)
- Query Scope: **Collection group**

#### 3.3 Remote Approvals Composite Index
- Collection ID: `attendanceApprovalRequests`
- Fields: 
  - `status` (Ascending)
  - `requestTimestamp` (Descending)
- Query Scope: **Collection**

#### 3.4 Issue Reports Collection Group
- Collection ID: `issue_reports`
- Field: `submissionDate` (Descending)
- Query Scope: **Collection group**

### 4. Service Account Details
**Service account name**: MarsHRM Server Tasks
**Service account ID**: `marshrm-server`
**Email**: `marshrm-server@studio-6661404512-7e22c.iam.gserviceaccount.com`

#### Recommended IAM Roles:
1. **Firebase Firestore Admin**: For reading/writing attendance and logs.
2. **Firebase Authentication Admin**: For managing user accounts.

**Security Warning**: The downloaded JSON key file allows full administrative access. **NEVER** commit this file to source control.

## Core Features
- **Geolocation Attendance**: Clock in/out within office or home radius. Features auto-lunch breaks and auto-clock-out at midnight.
- **Leave Management**: Multi-stage approval workflow (Member -> Team Lead -> HR) with a visual status tracker.
- **Daily Monitor**: Real-time status overview for Admins/HR with map integration and formatted PDF exports (`Name - Status - In/Out`).
- **Automated Reports**: Attendance summaries sent automatically at 9:50 AM and 6:50 PM.
- **Analytics**: Organization-wide data view with custom date range selection and CSV export for Excel.
- **Dual Reporting**: Business reports (with call recordings) and Technical reports.

Developed by FortuMars
