'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendReportInput {
  date: string;
  summaryText: string;
  recipients: string[];
}

/**
 * Server Action to send the daily attendance report via email.
 */
export async function sendDailySummaryEmail({ date, summaryText, recipients }: SendReportInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Email will not be sent.");
    return { success: false, message: "Email API key not configured." };
  }

  try {
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
