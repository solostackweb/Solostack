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
 *   2. Paste this whole file.
 *   3. Set the two secrets. EITHER edit the CONFIG fallbacks below, OR (better)
 *      go to Project Settings → Script properties and add:
 *         STACKIVO_INBOUND_URL   = https://stackivo.me/api/support/inbound
 *         SUPPORT_INBOUND_SECRET = <the same value you set in Vercel>
 *   4. Run `setup` once (authorise when prompted) — it creates the label and
 *      a time trigger that runs every 5 minutes.
 *   5. Done. Send a test email to support@stackivo.me and watch a ticket
 *      appear in /admin/support.
 *
 * To stop it later: Triggers (clock icon) → delete the trigger.
 */

// ===== CONFIG — used only if the matching Script Property is not set =====
const CONFIG = {
  STACKIVO_INBOUND_URL: "https://stackivo.me/api/support/inbound",
  SUPPORT_INBOUND_SECRET: "PASTE_THE_SAME_SECRET_YOU_SET_IN_VERCEL",
};
// ========================================================================

const SYNCED_LABEL = "Stackivo/Synced";
const SUPPORT_ADDRESS = "support@stackivo.me"; // your inbound address

function cfg(name) {
  var fromProps = PropertiesService.getScriptProperties().getProperty(name);
  return fromProps && fromProps.length > 0 ? fromProps : CONFIG[name];
}

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
  var url = cfg("STACKIVO_INBOUND_URL");
  var secret = cfg("SUPPORT_INBOUND_SECRET");
  if (!url || !secret || secret.indexOf("PASTE_") === 0) {
    Logger.log("Not configured — set STACKIVO_INBOUND_URL + SUPPORT_INBOUND_SECRET.");
    return;
  }

  var label = GmailApp.getUserLabelByName(SYNCED_LABEL);
  if (!label) label = GmailApp.createLabel(SYNCED_LABEL);

  // Recent mail to support@ that we haven't synced yet.
  var query = 'to:' + SUPPORT_ADDRESS + ' newer_than:2d -label:"' + SYNCED_LABEL + '"';
  var threads = GmailApp.search(query, 0, 40);

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      try {
        var from = msg.getFrom() || "";
        // Skip anything we sent ourselves (no loops).
        if (new RegExp(SUPPORT_ADDRESS.replace(".", "\\."), "i").test(from)) return;

        var raw = "";
        try { raw = msg.getRawContent() || ""; } catch (e) { raw = ""; }

        // RFC Message-ID for idempotency. Fall back to Gmail's stable id.
        var messageId = headerFromRaw(raw, "Message-ID") || msg.getId();

        // Token from the plus-address. Check the live To/Reply-To/Cc first,
        // then the raw delivery headers (covers aliased / forwarded delivery).
        var recipients = [
          msg.getTo() || "",
          msg.getReplyTo() || "",
          msg.getCc() || "",
          headerFromRaw(raw, "Delivered-To"),
          headerFromRaw(raw, "X-Original-To"),
        ].join(" ");
        var tokenMatch = recipients.match(/support\+([^@\s>]+)@/i);
        var token = tokenMatch ? tokenMatch[1] : null;

        var payload = {
          token: token,
          messageId: messageId,
          from: extractEmail(from),
          fromName: extractName(from),
          subject: msg.getSubject() || "",
          text: msg.getPlainBody() || "",
        };

        var res = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + secret },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        var code = res.getResponseCode();
        if (code >= 200 && code < 300) {
          Logger.log("Synced: " + payload.subject);
        } else {
          Logger.log("Failed (" + code + "): " + res.getContentText());
        }
      } catch (err) {
        Logger.log("Error: " + err);
      }
    });
    thread.addLabel(label);
  });
}

/** Extract a header value from raw MIME source (case-insensitive, unfolds). */
function headerFromRaw(raw, name) {
  if (!raw) return "";
  var re = new RegExp("^" + name + ":\\s*(.*(?:\\r?\\n[ \\t].*)*)", "im");
  var m = raw.match(re);
  return m ? m[1].replace(/\r?\n[ \t]+/g, " ").trim() : "";
}

function extractEmail(fromHeader) {
  var m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

function extractName(fromHeader) {
  var m = fromHeader.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}
