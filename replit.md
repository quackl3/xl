# Aclaraciones Bancarias Platform

## Overview

This project is a comprehensive banking clarification platform designed to streamline banking clarifications, enhance user experience, and provide administrators with powerful tools for managing sessions and users. It features a dual-domain architecture for client and admin interfaces, built with Express.js and React. The platform offers real-time communication, robust banking session management, user authentication, SMS integration, file management, and Telegram notifications. Key capabilities include automated payment verification via Bitso API and OpenAI GPT-4o Vision, and a sophisticated link management system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform uses a multi-domain setup (`aclaracion.info` for clients and `panel.aclaracion.info` for administration) served by a single Express.js backend. The frontend is built with React 18, TypeScript, Vite, and Tailwind CSS with shadcn/ui. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and WebSockets for real-time updates. Authentication is session-based with Passport.js, supporting role-based access, device limitations, and account expiration.

**Key Architectural Decisions and Features:**

*   **Database Schema**: Manages users, executives, banking sessions (including screen types, user inputs, file attachments), SMS configurations, and notification preferences.
*   **Authentication**: Session-based with Passport.js, incorporating anti-bot measures, behavioral analysis, and OTP verification for executives. Supports various account types (Individual, Office) with differing device limits and management capabilities.
*   **Screen Management**: Dynamic screen types guide users through banking workflows (validation, OTP, card info, transfers, protection banking).
*   **File Management**: Multer-based uploads for protection banking with Telegram notifications for downloads.
*   **Data Flow**: Admin-initiated sessions with QR codes, real-time client-admin updates via WebSockets, and a guided banking workflow.
*   **Security**: Anti-detection, rate limiting, header obfuscation, and comprehensive input validation.
*   **UI/UX**: Tailwind CSS with shadcn/ui for a consistent and modern design.
*   **WhatsApp Bot Architecture**: Utilizes `@whiskeysockets/baileys` for multi-user WhatsApp Web connections, offering independent bot instances, QR code management, hierarchical menus, and dynamic content placeholders. Conversation history is stored in the database.
*   **Payment Verification Flow**: Integrates Bitso API and OpenAI GPT-4o Vision for automated payment verification, with a fallback to manual review and a discount code system.
*   **Payment Bot (Telegram)**: A dedicated Telegram bot for payment receipt notifications and manual user activation by administrators.
*   **Link Management System**: Provides comprehensive link creation and management with 12-digit numeric tokens (cryptographically secure via crypto.randomInt), bank-specific URL paths or subdomains, user quota management (150 links/week resetting on Mondays shared between web panel and Telegram bot), active session monitoring, and admin controls for viewing/resetting user quotas. Links remain active indefinitely until manually cancelled. Once a user enters their folio, a 1-hour session timer begins for completion.
    *   **Bank Subdomain Support**: Links can use bank-specific subdomains (e.g., liverpool.domain.com/client/123456789012) or path-based URLs (domain.com/liverpool/client/123456789012). Subdomain prefixes are stored in the database and combined with the base domain configured in Site Config. Supports both HTTP/HTTPS and preserves base URL paths for non-subdomain deployments.
*   **Bank-Specific Screen Flow Configuration System**: Allows both administrators and regular users to define custom sequences of screens for each bank. These configurations are stored in the database (`bank_screen_flows` for global admin flows, `user_bank_flows` for individual user flows) and are applied to sessions when links are created. The UI supports drag-and-drop step management with configurable screen types, durations, and user input requirements.
*   **Personalized Telegram Notifications**: Each user receives Telegram notifications only for their own sessions via `telegramChatId` lookup. The system sends notifications to both the main admin (if configured) and the session creator (if they have a Telegram chat ID linked). Error handling is independent for each recipient to ensure delivery resilience.
*   **Telegram Bot Link Generation**: The `/generar` command allows users to create banking links directly from Telegram with an interactive bank selection menu. The system enforces comprehensive security controls including role verification (user/admin only), weekly quota enforcement (150 links/week shared with panel), session timeout (5 minutes of inactivity), anti-concurrency checks, and account expiration validation. Generated links appear in the user's panel and follow the same quota and flow configuration as panel-generated links. The bot displays updated quota information after each successful generation, showing exactly how many links remain for the current week.

## External Dependencies

*   **Database**: `@neondatabase/serverless` (PostgreSQL), `drizzle-orm`
*   **Authentication**: `passport`, `bcrypt`
*   **File Uploads**: `multer`
*   **Real-time Communication**: `ws`
*   **Frontend Libraries**: `@tanstack/react-query`, `@radix-ui`, `wouter`, `tailwindcss`
*   **SMS Integration**: Soft Mex API, eims premium SMS API
*   **Telegram Integration**: `node-telegram-bot-api` (Main Bot for notifications, 2FA, payments; Payment Bot for dedicated payment receipt management)
*   **WhatsApp Integration**: `@whiskeysockets/baileys`
*   **Payment Gateway**: Bitso API
*   **AI Integration**: OpenAI GPT-4o Vision
*   **Environment Management**: Replit Secrets