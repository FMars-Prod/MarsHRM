'use server';

import { Resend } from 'resend';

interface SendReportInput {
  date: string;
  summaryText: string;
  recipients: string[];
}

/**
 * Server Action to send the daily attendance report via email.
 */
export async function sendDailySummaryEmail({ date, summaryText, recipients }: SendReportInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Email will not be sent.");
    return { success: false, message: "Email API key not configured." };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'MarsHRM Reports <reports@fortumars.com>',
      to: recipients,
      subject: `Daily Attendance Summary - ${date}`,
      text: summaryText,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to send email action:", err);
    return { success: false, message: err.message };
  }
}

/**
 * Server Action to send the weekly performance summary via email.
 */
export async function sendWeeklySummaryEmail({ dateRange, summaryText, recipients }: { dateRange: string, summaryText: string, recipients: string[] }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Weekly email will not be sent.");
    return { success: false, message: "Email API key not configured." };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'MarsHRM Reports <reports@fortumars.com>',
      to: recipients,
      subject: `Weekly Performance Pulse - ${dateRange}`,
      text: summaryText,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to send weekly email action:", err);
    return { success: false, message: err.message };
  }
}
