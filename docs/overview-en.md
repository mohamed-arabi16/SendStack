# Bulk Email & WhatsApp Sender - Overview

This application is a powerful, user-friendly tool for sending bulk personalized notifications via Email and WhatsApp. It is designed to handle CSV-based mailing lists with support for dynamic templates and RTL (Arabic) layouts.

## Core Features

### 1. Multi-Channel Messaging

- **Email Mode:** Send bulk emails using any SMTP provider (iCloud, Gmail, or Custom).
- **WhatsApp Mode:** Launch WhatsApp messages directly to recipients' phone numbers with pre-filled personalized content.

### 2. CSV Data Processing

- **Smart Parsing:** Upload CSV files with support for UTF-8 encoding and Arabic headers.
- **Column Mapping:** Map your CSV columns to specific fields like Name, Email, or Phone Number.
- **Data Preview:** View your data directly in the dashboard before sending.

### 3. Personalization & Templates

- **Dynamic Variables:** Use `{{Column_Name}}` syntax to insert data from your CSV into your message subject and body.
- **HTML Support:** Create rich email content using HTML tags (e.g., `<h2>`, `<b>`).
- **RTL Support:** Toggle Right-to-Left (RTL) mode for perfect Arabic message alignment.

### 4. Robust Sending System

- **SMTP Configuration:** Securely configure your own mail server with support for app-specific passwords.
- **Rate Limiting:** Set a custom delay between messages (in seconds) to avoid spam filters or server rate limits.
- **Live Logs:** Monitor the sending progress in real-time with detailed success and error logging.

## Workflow

1. **Upload:** Drop your CSV file into the upload zone.
2. **Map:** Select which columns contain the addresses (email/phone) and names.
3. **Compose:** Write your message template using dynamic variables. Configure your SMTP settings or WhatsApp preferences.
4. **Send:** Review the summary and start the sending process. Monitor progress through the live dashboard.

## Technical Details

- **Frontend:** Next.js (React)
- **Styling:** CSS3 with RTL support
- **File Parsing:** PapaParse
- **Email Backend:** Nodemailer (via API Routes)
- **WhatsApp Integration:** WhatsApp `wa.me` API
