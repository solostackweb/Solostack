/**
 * Stackivo — inbound support email → ticket (Google Apps Script).
 *
 * Runs inside the Google account that owns support@stackivo.me (Google
 * Workspace). On a timer it finds new mail in the support inbox and POSTs each
 * message to Stackivo's /api/support/inbound endpoint, so customer email
 * replies thread back into the right ticket. Processed mail is labelled
 * "Stackivo/Synced" so it is never sent twice (the app also de-dupes on
 * Message-ID, so this is belt-and-braces).
 *
 * No DNS or MX changes — this works alongside your normal Workspace inbox.
 *
 * SETUP (one time):
 *   1. Go to https://script.google.com  (signed in as support@stackivo.me, or
 *      an account that can read that inbox) → New project.
 *   2. Paste this whole file. Replace the two CONFIG values below.
 *   3. Run `setup` once (authorise when prompted) — it creates the label and
 *      a time trigger that runs every 5 minutes.
 *   4. Done. Send a test email to support@stackivo.me and watch a ticket
 *      appear in /admin/support.
 *
 * To stop it later: Triggers (clock icon) → delete the trigger.
 */

// ===== CONFIG — edit these two =====
const STACKIVO_INBOUND_URL = "https://stackivo.me/api/support/inbound";
const SUPPORT_INBOUND_SECRET = "PASTE_THE_SAME_SECRET_YOU_SET_IN_VERCEL";
// ===================================

const SYNCED_LABEL = "Stackivo/Synced";

/** Run ONCE to create the label + the 5-minute trigger. */
function setup() {
  if (!GmailApp.getUserLabelByName(SYNCED_LABEL)) {
    GmailApp.createLabel(SYNCED_LABEL);
  }
  // Remove any existing triggers for this function, then add a fresh one.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncSupportInbox") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("syncSupportInbox").timeBased().everyMinutes(5).create();
  Logger.log("Setup complete — syncing every 5 minutes.");
}

/** The worker: forward new support mail to Stackivo. */
function syncSupportInbox() {
  const label = GmailApp.getUserLabelByName(SYNCED_LABEL);
  if (!label) {
    GmailApp.createLabel(SYNCED_LABEL);
  }

  // Recent mail to support@ that we haven't synced yet.
  const query =
    'to:support@stackivo.me newer_than:2d -label:"' + SYNCED_LABEL + '"';
  const threads = GmailApp.search(query, 0, 40);

  threads.forEach(function (thread) {
    const messages = thread.getMessages();
    messages.forEach(function (msg) {
      try {
        const from = msg.getFrom() || "";
        // Skip anything we sent ourselves (no loops).
        if (/support@stackivo\.me/i.test(from)) return;

        const fromEmail = extractEmail(from);
        const fromName = extractName(from);
        const subject = msg.getSubject() || "";
        const messageId = msg.getHeader("Message-ID") || "";
        const text = msg.getPlainBody() || "";

        // Token from the plus-address (To / Delivered-To: support+<token>@…).
        const recipients =
          (msg.getHeader("Delivered-To") || "") + " " +
          (msg.getTo() || "") + " " +
          (msg.getHeader("X-Original-To") || "");
        const tokenMatch = recipients.match(/support\+([^@\s>]+)@/i);
        const token = tokenMatch ? tokenMatch[1] : null;

        const payload = {
          token: token,
          messageId: messageId,
          from: fromEmail,
          fromName: fromName,
          subject: subject,
          text: text,
        };

        const res = UrlFetchApp.fetch(STACKIVO_INBOUND_URL, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + SUPPORT_INBOUND_SECRET },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        const code = res.getResponseCode();
        if (code >= 200 && code < 300) {
          Logger.log("Synced: " + subject);
        } else {
          Logger.log("Failed (" + code + "): " + res.getContentText());
        }
      } catch (err) {
        Logger.log("Error: " + err);
      }
    });
    thread.addLabel(GmailApp.getUserLabelByName(SYNCED_LABEL));
  });
}

function extractEmail(fromHeader) {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

function extractName(fromHeader) {
  const m = fromHeader.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}
