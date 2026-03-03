# MarsHRM - Firebase Studio

This is a NextJS HRM application with geolocation features.

## Setup Instructions

### 1. Firebase Configuration
Ensure your `src/firebase/config.ts` is up to date with your project's credentials.

### 2. Environment Variables
To enable automated emails, you must set the following environment variable in your hosting provider (e.g., Firebase App Hosting or Vercel):
- `RESEND_API_KEY`: Your API key from Resend.com.

### 3. Service Account Details
If you need to create a service account for advanced integrations, use these details:

- **Service account name**: MarsHRM Server Tasks
- **Service account ID**: `marshrm-server`
- **Description**: `Service account for MarsHRM server-side operations, including automated reports and data management.`
- **Email**: `marshrm-server@studio-6661404512-7e22c.iam.gserviceaccount.com`

## Features
- **Geolocation Attendance**: Clock in/out within office or home radius.
- **Leave Management**: Multi-stage approval workflow (Member -> Team Lead -> HR).
- **Daily Monitor**: Real-time status overview for Admins/HR with map integration.
- **Automated Reports**: Attendance summaries sent automatically at 9:50 AM and 6:50 PM.
- **PDF Export**: Comprehensive daily activity reports.
- **Dual Audio Reporting**: Submit Business reports with both "Best" and "Worst" call recordings for coaching.

Developed by FortuMars
