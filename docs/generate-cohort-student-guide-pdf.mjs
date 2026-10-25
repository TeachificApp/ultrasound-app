#!/usr/bin/env node
/**
 * Generates docs/cohort-group-student-guide.pdf
 * Usage: node docs/generate-cohort-student-guide-pdf.mjs
 */
import PDFDocument from "pdfkit";
import { createWriteStream, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = path.join(root, "docs/cohort-group-student-guide.pdf");

const TEAL = "#179ca3";
const INK = "#1f2937";
const MUTED = "#6b7280";

function heading(doc, text, size = 18) {
  doc.moveDown(0.6).fillColor(TEAL).fontSize(size).font("Helvetica-Bold").text(text);
  doc.moveDown(0.2).fillColor(INK);
}

function subheading(doc, text) {
  doc.moveDown(0.4).fillColor(INK).fontSize(13).font("Helvetica-Bold").text(text);
  doc.moveDown(0.15);
}

function body(doc, text) {
  doc.fillColor(INK).fontSize(11).font("Helvetica").text(text, { align: "left", lineGap: 3 });
}

function bullet(doc, text) {
  doc.fillColor(INK).fontSize(11).font("Helvetica").text(`• ${text}`, { indent: 12, lineGap: 3 });
}

function numbered(doc, n, text) {
  doc.fillColor(INK).fontSize(11).font("Helvetica").text(`${n}. ${text}`, { indent: 8, lineGap: 3 });
}

function mono(doc, text) {
  doc.moveDown(0.15).fillColor(MUTED).fontSize(9.5).font("Courier").text(text, { indent: 10 });
  doc.moveDown(0.2).fillColor(INK);
}

function callout(doc, text) {
  const y = doc.y;
  doc.rect(50, y, 495, 52).fillAndStroke("#ecfdf5", "#a7f3d0");
  doc.fillColor(INK).fontSize(10.5).font("Helvetica").text(text, 60, y + 10, { width: 475, lineGap: 2 });
  doc.y = y + 58;
}

function ensureSpace(doc, height = 80) {
  if (doc.y + height > doc.page.height - 60) doc.addPage();
}

const doc = new PDFDocument({ margin: 50, size: "LETTER" });
const out = createWriteStream(pdfPath);
doc.pipe(out);

// Cover
doc.fillColor(TEAL).fontSize(11).font("Helvetica-Bold").text("ALL ABOUT ULTRASOUND™ | iHEARTECHO™ LEARNING PLATFORM", { align: "center" });
doc.moveDown(0.8).fillColor(INK).fontSize(26).font("Helvetica-Bold").text("Cohort Group Student Guide", { align: "center" });
doc.moveDown(0.4).fillColor(MUTED).fontSize(13).font("Helvetica").text(
  "How to sign in, join live sessions, participate in group discussions,\nand watch session replays",
  { align: "center", lineGap: 4 },
);
doc.moveDown(1.2).strokeColor(TEAL).lineWidth(2).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
doc.moveDown(1);

callout(doc, "Important: Cohort courses are accessed on the Learning Platform at learn.allaboutultrasound.com. Use this site for live sessions, discussions, and replays.");

heading(doc, "1. Getting started — accessing the site");
subheading(doc, "Sign in");
numbered(doc, 1, "Open your web browser (Chrome, Safari, Firefox, or Edge recommended).");
numbered(doc, 2, "Go to the sign-in page:");
mono(doc, "https://learn.allaboutultrasound.com/login");
numbered(doc, 3, "Sign in with your email and password (Sign in with password), or choose Send Magic Link and click the link in your email (valid 15 minutes).");
numbered(doc, 4, "New users: click Create an account. Forgot password? Use Forgot password? on the login page.");
body(doc, "After enrollment you may receive a welcome email with a one-click access link that signs you in and opens your course automatically.");

heading(doc, "2. Finding your cohort course");
numbered(doc, 1, "Open My Dashboard:");
mono(doc, "https://learn.allaboutultrasound.com/my-dashboard");
numbered(doc, 2, "Select the My Content tab.");
numbered(doc, 3, "Under Courses, find your cohort course and click Continue Learning or Overview.");

heading(doc, "3. Opening your cohort hub");
body(doc, "Your cohort hub organizes live sessions, discussions, replays, assignments, and resources for your group.");
subheading(doc, "Three ways to get there");
bullet(doc, "Course player sidebar → click My Cohort (calendar icon)");
bullet(doc, "Course overview page → click the My Cohort top tab");
bullet(doc, "Direct link: https://learn.allaboutultrasound.com/cohort/[course-id]");
subheading(doc, "Main tabs in your cohort hub");
bullet(doc, "Live Sessions — schedule and join live classes");
bullet(doc, "Calendar — month/week/day view; Download ICS");
bullet(doc, "Assignments — cohort assignments from your instructor");
bullet(doc, "Replays — recorded session videos");
bullet(doc, "Resources — downloads and reference materials");
bullet(doc, "Discussions — private group discussion thread");

ensureSpace(doc, 120);
heading(doc, "4. Live sessions");
subheading(doc, "View your schedule");
numbered(doc, 1, "Open your cohort hub.");
numbered(doc, 2, "Click the Live Sessions tab.");
numbered(doc, 3, "Review Upcoming sessions and Past Sessions.");
subheading(doc, "Add to your calendar");
body(doc, "On a session card, click Add to Google Calendar. Or open the Calendar tab and use Download ICS for Outlook, Apple Calendar, or other apps.");
subheading(doc, "Join a live session");
numbered(doc, 1, "Return to Live Sessions shortly before class.");
numbered(doc, 2, "When the join window opens, the card shows Live Now (green).");
numbered(doc, 3, "Click Join Live Session or Join Now.");
numbered(doc, 4, "Your browser opens the meeting (Zoom, Teams, etc.) in a new tab.");
callout(doc, "Join window: Join Live Session becomes available 15 minutes before the scheduled start and stays open until the session ends.");

heading(doc, "5. Group discussions");
body(doc, "Cohort Discussions are private to your assigned cohort group (not the public Community area).");
subheading(doc, "How to participate");
numbered(doc, 1, "Open your cohort hub and click the Discussions tab.");
numbered(doc, 2, "Read posts from classmates and instructors.");
numbered(doc, 3, "Type in the composer (Share something with your cohort…).");
numbered(doc, 4, "Optionally click + Add Image/Video, then click Post.");
subheading(doc, "Notifications");
body(doc, "Use Notifications On / Notifications Off at the top of the Discussions tab to control email alerts.");
subheading(doc, "If discussions are unavailable");
bullet(doc, "\"You are not assigned to a cohort group yet.\" — contact your program administrator.");
bullet(doc, "\"No discussions yet. Be the first to post!\" — your group is ready; start the conversation.");

ensureSpace(doc, 120);
heading(doc, "6. Replay videos");
subheading(doc, "Browse replays");
numbered(doc, 1, "Open your cohort hub and click the Replays tab.");
numbered(doc, 2, "Browse recordings in grid or list view.");
numbered(doc, 3, "Each card shows title, linked session, date, and duration.");
subheading(doc, "Watch a replay");
numbered(doc, 1, "Click any recording card to open the replay player.");
numbered(doc, 2, "Your watch progress is saved automatically.");
numbered(doc, 3, "Click Back to Replays to return to the full list.");
body(doc, "If Replays is empty, your instructor has not published recordings yet — check back after live sessions.");

heading(doc, "7. Quick reference");
subheading(doc, "Bookmark these URLs");
mono(doc, "Sign in:        https://learn.allaboutultrasound.com/login");
mono(doc, "My Dashboard:   https://learn.allaboutultrasound.com/my-dashboard");
mono(doc, "Live Sessions:  https://learn.allaboutultrasound.com/cohort/[course-id]?tab=sessions");
mono(doc, "Replays:        https://learn.allaboutultrasound.com/cohort/[course-id]?tab=replays");
mono(doc, "Discussions:    https://learn.allaboutultrasound.com/cohort/[course-id]?tab=discussions");

subheading(doc, "Troubleshooting");
bullet(doc, "Cannot see cohort → sign in at learn.allaboutultrasound.com; open My Cohort from course player.");
bullet(doc, "Join button disabled → wait until 15 minutes before start; add session to calendar.");
bullet(doc, "No discussions → confirm you are assigned to the correct cohort group.");
bullet(doc, "No replays → instructor uploads after sessions; check Replays tab later.");
bullet(doc, "Magic link expired → request a new link or sign in with password.");

doc.moveDown(1).fillColor(MUTED).fontSize(9).font("Helvetica").text(
  "All About Ultrasound™ | iHeartEcho™ Learning Platform — learn.allaboutultrasound.com",
  { align: "center" },
);

doc.end();

await new Promise((resolve, reject) => {
  out.on("finish", resolve);
  out.on("error", reject);
});

if (!existsSync(pdfPath)) {
  console.error("PDF was not created.");
  process.exit(1);
}
console.log(`Wrote ${pdfPath}`);
